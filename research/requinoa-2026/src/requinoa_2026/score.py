"""Score the app's storm detection against NASA IMERG rain, per zone and half-hour.

Run with:  uv run requinoa-score [--set dev|held-out|all]

Rules, frozen on 2026-11-01 before any result was seen (do not change them to
improve a score; changing them means a new scoring version):
- Area: O'Higgins, split by ground height into coast, valley and Andes.
- Unit: one zone during one IMERG half-hour.
- Observed rain: some cell of the zone has IMERG >= RAIN_MM_H (and, separately,
  >= HEAVY_MM_H for heavy rain).
- Detected: some cell of the zone has a cloud top <= -38 °C (the app's storm
  threshold, algorithm 2026.10-r1) in any full-disk scan starting in that half-hour.
- POD = hits / (hits + misses); FAR = false alarms / (hits + false alarms);
  CSI = hits / (hits + misses + false alarms). 95% intervals by resampling whole days.
- Half-hours missing either source are left out, never counted as quiet.
Limits: lightning is not used (a flash nearly always sits under a cold top); IMERG
is a ~10 km satellite estimate, not a rain gauge, and sees weak warm rain poorly.
"""

import argparse
import io
import math
from datetime import date

import numpy as np
import pandas as pd
import requests
import xarray as xr
from PIL import Image

from requinoa_2026.abi_grid import LATS, LONS
from requinoa_2026.abi_grid import OUT_DIR as ABI_DIR
from requinoa_2026.config import DATA_DIR, RAW_DIR
from requinoa_2026.imerg import OUT_DIR as IMERG_DIR

SCORING_VERSION = "s1"
COLD_TOP_C = -38.0
RAIN_MM_H = 1.0
HEAVY_MM_H = 5.0
# O'Higgins with a small margin; ground height decides the zone.
REGION = {"lat_min": -35.0, "lat_max": -33.8, "lon_min": -72.1, "lon_max": -70.0}
ANDES_MIN_M = 1000.0
COAST_MAX_LON = -71.35
# Seasons used to develop changes vs. seasons kept aside to report scores (frozen).
DEV = (date(2025, 4, 7), date(2026, 4, 1))
HELD_OUT = (date(2026, 4, 1), date(2026, 11, 1))
BOOTSTRAP = 1000

RELIEF_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
RELIEF_ZOOM = 9


def tile_xy(lat: float, lon: float, z: int) -> tuple[float, float]:
    n = 2**z
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return (lon + 180) / 360 * n, y


def cell_heights() -> pd.DataFrame:
    """Mean ground height (m) of every IMERG cell, from the same tiles as the app's relief."""
    path = RAW_DIR / "cell_heights.csv"
    if path.exists():
        return pd.read_csv(path)
    tiles = {}
    rows = []
    for lat in LATS:
        for lon in LONS:
            heights = []
            for dlat in np.linspace(-0.045, 0.045, 7):
                for dlon in np.linspace(-0.045, 0.045, 7):
                    x, y = tile_xy(lat + dlat, lon + dlon, RELIEF_ZOOM)
                    key = (int(x), int(y))
                    if key not in tiles:
                        url = RELIEF_URL.format(z=RELIEF_ZOOM, x=key[0], y=key[1])
                        png = requests.get(url, timeout=60)
                        png.raise_for_status()
                        tiles[key] = np.asarray(Image.open(io.BytesIO(png.content)).convert("RGB"), dtype=float)
                    r, g, b = tiles[key][int((y % 1) * 256), int((x % 1) * 256)]
                    heights.append(r * 256 + g + b / 256 - 32768)
            rows.append({"lat": lat, "lon": lon, "height_m": round(float(np.mean(heights)))})
    table = pd.DataFrame(rows)
    table.to_csv(path, index=False)
    return table


def zones() -> xr.DataArray:
    """'coast', 'valley', 'andes' per cell inside REGION; '' outside it or over the sea."""
    cells = cell_heights()
    inside = cells.lat.between(REGION["lat_min"], REGION["lat_max"]) & cells.lon.between(
        REGION["lon_min"], REGION["lon_max"]
    )
    land = cells.height_m > 0
    zone = np.where(cells.height_m >= ANDES_MIN_M, "andes", np.where(cells.lon <= COAST_MAX_LON, "coast", "valley"))
    cells["zone"] = np.where(inside & land, zone, "")
    return on_grid(cells.set_index(["lat", "lon"]).zone.to_xarray())


def on_grid(da: xr.DataArray) -> xr.DataArray:
    """Cell centres as exact 2-decimal float64, so IMERG (float32) and ABI cells align."""
    return da.assign_coords(lat=da.lat.astype("float64").round(2), lon=da.lon.astype("float64").round(2))


def day_units(day: date, zone: xr.DataArray) -> pd.DataFrame | None:
    """One row per zone and half-hour: observed rain, heavy rain, detection."""
    abi_path, imerg_path = ABI_DIR / f"{day}.nc", IMERG_DIR / f"{day}.nc"
    if not (abi_path.exists() and imerg_path.exists()):
        return None
    rain = on_grid(xr.open_dataset(imerg_path).rain_mm_h).sel(lat=zone.lat, lon=zone.lon)
    tops = on_grid(xr.open_dataset(abi_path).min_bt_c).sel(lat=zone.lat, lon=zone.lon)
    cold = (tops <= COLD_TOP_C).resample(time="30min").max()
    scans = tops.time.resample(time="30min").count()
    rows = []
    for name in ("coast", "valley", "andes"):
        mask = zone == name
        zone_rain = rain.where(mask).max(["lat", "lon"])
        zone_cold = cold.where(mask).max(["lat", "lon"])
        for t in rain.time.values:
            if t not in zone_cold.time.values or scans.sel(time=t) == 0 or np.isnan(zone_rain.sel(time=t)):
                continue
            mm_h = float(zone_rain.sel(time=t))
            rows.append(
                {
                    "day": day,
                    "time": t,
                    "zone": name,
                    "rain": mm_h >= RAIN_MM_H,
                    "heavy": mm_h >= HEAVY_MM_H,
                    "detected": bool(zone_cold.sel(time=t)),
                }
            )
    return pd.DataFrame(rows)


def counts(units: pd.DataFrame, truth: str) -> dict:
    hits = int((units[truth] & units.detected).sum())
    misses = int((units[truth] & ~units.detected).sum())
    # A detection is false only when there was no rain at all, also for the heavy score.
    false_alarms = int((~units.rain & units.detected).sum())
    return {"hits": hits, "misses": misses, "false_alarms": false_alarms}


def metrics(c: dict) -> dict:
    def ratio(a, b):
        return a / b if b else float("nan")

    return {
        "POD": ratio(c["hits"], c["hits"] + c["misses"]),
        "FAR": ratio(c["false_alarms"], c["hits"] + c["false_alarms"]),
        "CSI": ratio(c["hits"], c["hits"] + c["misses"] + c["false_alarms"]),
    }


def interval(units: pd.DataFrame, truth: str, rng: np.random.Generator) -> dict:
    """95% range of each metric when whole days are resampled with replacement."""
    by_day = {day: frame for day, frame in units.groupby("day")}
    days = list(by_day)
    samples = []
    for _ in range(BOOTSTRAP):
        pick = rng.choice(len(days), len(days))
        samples.append(metrics(counts(pd.concat([by_day[days[i]] for i in pick]), truth)))
    table = pd.DataFrame(samples)
    return {m: (table[m].quantile(0.025), table[m].quantile(0.975)) for m in table}


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--set", choices=["dev", "held-out", "all"], default="held-out")
    args = parser.parse_args(argv)
    start, end = {"dev": DEV, "held-out": HELD_OUT, "all": (DEV[0], HELD_OUT[1])}[args.set]

    zone = zones()
    frames = []
    day = start
    while day < end:
        frame = day_units(day, zone)
        if frame is not None and not frame.empty:
            frames.append(frame)
        day += pd.Timedelta(days=1)
    if not frames:
        print("no days with both sources yet")
        return
    units = pd.concat(frames, ignore_index=True)
    units["season"] = np.where(pd.to_datetime(units.day).dt.month.isin([10, 11, 12, 1, 2, 3]), "warm", "cold")

    rng = np.random.default_rng(0)
    rows = []
    for (season, zone_name), group in [(("all", "all"), units), *units.groupby(["season", "zone"])]:
        for truth in ("rain", "heavy"):
            c = counts(group, truth)
            m, ci = metrics(c), interval(group, truth, rng)
            rows.append(
                {
                    "set": args.set,
                    "season": season,
                    "zone": zone_name,
                    "truth": truth,
                    "days": group.day.nunique(),
                    **c,
                    **{k: round(v, 3) for k, v in m.items()},
                    **{f"{k}_95": f"{lo:.2f}-{hi:.2f}" for k, (lo, hi) in ci.items()},
                }
            )
    table = pd.DataFrame(rows)
    out = DATA_DIR / "results" / f"score_{SCORING_VERSION}_{args.set}.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    table.to_csv(out, index=False)
    with pd.option_context("display.width", 200, "display.max_columns", 20):
        print(table.drop(columns=["set"]).to_string(index=False))
    print(f"\n{units.day.nunique()} days, scoring {SCORING_VERSION} -> {out}")
