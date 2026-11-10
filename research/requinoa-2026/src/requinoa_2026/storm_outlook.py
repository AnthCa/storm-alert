"""Can a day-ahead forecast say "lightning is possible today" for O'Higgins?

Run with:  uv run requinoa-storm-outlook [--set dev|held-out]

Rules, frozen on 2026-11-10 before any result was seen (do not change them to improve a
score; changing them means a new scoring version):
- Forecast: Open-Meteo's Previous Runs API, the values issued one day earlier
  (`*_previous_day1`), at the app's towns rounded to the 0.05° grid the app sends. So
  the score is for a notice given the evening before or early that morning.
  - "code": some hour of the day has a thunderstorm weather code (95, 96 or 99).
  - "cape": the day's highest CAPE reaches a threshold. The threshold is the one with
    the best CSI on the dev set among CAPE_CANDIDATES, then applied once to held-out.
- Day: the local calendar day in Chile (America/Santiago).
- Observed: at least one GLM flash that day in the 3 x 3 block of 0.1° cells centred on
  the town (about 15 km around it, the app's lightning distance).
- Units: "town" is one town on one day; "region" is one day, forecast in any town
  against lightning in any town's block.
- Scores: POD, FAR, CSI and the share of days with lightning; 95% intervals by
  resampling whole days. Seasons as in s1; warm = October to March.
- Days missing a lightning file for any of their hours are left out.
Limits: the lightning grid was only read for half-hours with a cloud top <= -38 °C
over the region (glm_grid.py), so flashes under warmer tops are not counted (2026-11-03
had some); GLM misses part of the flashes, more by day.
"""

import argparse
import json
import time
from datetime import date

import numpy as np
import pandas as pd
import requests
import xarray as xr

from requinoa_2026.config import DATA_DIR, RAW_DIR
from requinoa_2026.glm_grid import OUT_DIR as GLM_DIR
from requinoa_2026.rain_chance import TOWNS, coarse
from requinoa_2026.score import BOOTSTRAP, DEV, HELD_OUT, metrics as ratios

SCORING_VERSION = "t1"
THUNDER_CODES = (95, 96, 99)
CAPE_CANDIDATES = [100, 200, 300, 400, 500, 750, 1000, 1500]
BLOCK = 1  # cells each side of the town's cell: a 3 x 3 block
LOCAL = "America/Santiago"
ARCHIVE_URL = "https://previous-runs-api.open-meteo.com/v1/forecast"
OUT_DIR = RAW_DIR / "open_meteo_previous_day1"


def forecast(name: str, lat: float, lon: float) -> pd.DataFrame:
    """Day-ahead hourly weather code and CAPE at the town, downloaded once and kept."""
    out = OUT_DIR / f"{name}.json"
    if not out.exists():
        params = {
            "latitude": coarse(lat),
            "longitude": coarse(lon),
            "start_date": DEV[0].isoformat(),
            "end_date": HELD_OUT[1].isoformat(),
            "hourly": "weather_code_previous_day1,cape_previous_day1",
            "timezone": "UTC",
        }
        for attempt in range(4):
            r = requests.get(ARCHIVE_URL, params=params, timeout=120)
            if r.ok:
                break
            time.sleep(10 * (attempt + 1))
        r.raise_for_status()
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        out.write_text(r.text)
        time.sleep(1)  # be gentle with a free service
    hourly = json.loads(out.read_text())["hourly"]
    return pd.DataFrame(
        {
            "time": pd.to_datetime(hourly["time"], utc=True),
            "code": pd.to_numeric(hourly["weather_code_previous_day1"]),
            "cape": pd.to_numeric(hourly["cape_previous_day1"]),
        }
    )


def daily_forecast(hourly: pd.DataFrame) -> pd.DataFrame:
    """Per local day: whether any hour has a thunderstorm code, and the highest CAPE."""
    day = hourly.time.dt.tz_convert(LOCAL).dt.date
    grouped = hourly.assign(thunder=hourly.code.isin(THUNDER_CODES)).groupby(day)
    table = pd.DataFrame({"code": grouped.thunder.any(), "cape": grouped.cape.max(), "hours": grouped.code.count()})
    # A day counts only with every hour forecast; a gap could hide the stormy hour.
    return table[table.hours >= 23].drop(columns="hours")


def block_flashes(flashes: xr.DataArray, lat: float, lon: float) -> pd.Series:
    """Half-hourly flashes in the block of cells around a point."""
    i = int(np.abs(flashes.lat.values - lat).argmin())
    j = int(np.abs(flashes.lon.values - lon).argmin())
    block = flashes.isel(lat=slice(max(0, i - BLOCK), i + BLOCK + 1), lon=slice(max(0, j - BLOCK), j + BLOCK + 1))
    return block.sum(["lat", "lon"]).to_series()


def observed(start: date, end: date) -> tuple[pd.DataFrame, set]:
    """Flashes per town and local day, and the UTC days that have a lightning file."""
    parts, have = [], set()
    for day in pd.date_range(start, end, freq="D"):  # one day past `end` covers the last local evening
        path = GLM_DIR / f"{day:%Y-%m-%d}.nc"
        if not path.exists():
            continue
        have.add(day.date())
        with xr.open_dataset(path) as ds:
            if ds.sizes["time"] == 0:
                continue
            for name, lat, lon in TOWNS:
                series = block_flashes(ds.flashes, lat, lon)
                parts.append(pd.DataFrame({"town": name, "time": series.index, "flashes": series.values}))
    if not parts:
        return pd.DataFrame(columns=["town", "day", "flashes"]), have
    table = pd.concat(parts, ignore_index=True)
    table["day"] = table.time.dt.tz_localize("UTC").dt.tz_convert(LOCAL).dt.date
    return table.groupby(["town", "day"], as_index=False).flashes.sum(), have


def complete_days(start: date, end: date, have: set) -> list[date]:
    """Local days whose two UTC days both have a lightning file."""
    days = [d.date() for d in pd.date_range(start, end, freq="D", inclusive="left")]
    return [d for d in days if d in have and (d + pd.Timedelta(days=1)) in have]


def units(start: date, end: date) -> pd.DataFrame:
    """One row per town and local day: code forecast, highest CAPE, lightning observed."""
    flashes, have = observed(start, end)
    days = complete_days(start, end, have)
    frames = []
    for name, lat, lon in TOWNS:
        frame = daily_forecast(forecast(name, lat, lon)).reindex(days).dropna()
        frame["town"] = name
        frames.append(frame.rename_axis("day").reset_index())
    u = pd.concat(frames, ignore_index=True).merge(flashes, on=["town", "day"], how="left")
    u["lightning"] = u.flashes.fillna(0) > 0
    u["code"] = u.code.astype(bool)
    u["season"] = np.where(pd.to_datetime(u.day).dt.month.isin([10, 11, 12, 1, 2, 3]), "warm", "cold")
    return u


def regional(u: pd.DataFrame) -> pd.DataFrame:
    """One row per day: the strongest forecast and any lightning among the towns."""
    return u.groupby("day", as_index=False).agg(
        code=("code", "any"), cape=("cape", "max"), lightning=("lightning", "any"), season=("season", "first")
    )


def tally(forecast: pd.Series, truth: pd.Series) -> dict:
    """Hits, misses and false alarms, with POD, FAR and CSI (NaN when undefined)."""
    c = {
        "hits": int((forecast & truth).sum()),
        "misses": int((~forecast & truth).sum()),
        "false_alarms": int((forecast & ~truth).sum()),
    }
    return {**c, **{k.lower(): v for k, v in ratios(c).items()}}


def best_cape(dev: pd.DataFrame) -> int:
    """The candidate threshold with the highest CSI on the dev set."""
    return max(CAPE_CANDIDATES, key=lambda t: np.nan_to_num(tally(dev.cape >= t, dev.lightning)["csi"]))


def interval(u: pd.DataFrame, forecast: pd.Series, rng: np.random.Generator) -> dict:
    """95% range of each metric when whole days are resampled with replacement."""
    per_day = pd.DataFrame(
        {
            "day": u.day,
            "hits": forecast & u.lightning,
            "misses": ~forecast & u.lightning,
            "false_alarms": forecast & ~u.lightning,
        }
    ).groupby("day").sum()
    w = rng.multinomial(len(per_day), np.full(len(per_day), 1 / len(per_day)), size=BOOTSTRAP)
    h, m, f = (w @ per_day[c].to_numpy() for c in ("hits", "misses", "false_alarms"))
    with np.errstate(invalid="ignore", divide="ignore"):
        samples = {"pod": h / (h + m), "far": f / (h + f), "csi": h / (h + m + f)}
    return {k: f"{np.nanquantile(v, 0.025):.2f}-{np.nanquantile(v, 0.975):.2f}" for k, v in samples.items()}


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--set", choices=["dev", "held-out"], default="dev")
    args = parser.parse_args(argv)

    dev = units(*DEV)
    scored = dev if args.set == "dev" else units(*HELD_OUT)
    rng = np.random.default_rng(0)
    rows = []
    for unit, dev_u, u in (("town", dev, scored), ("region", regional(dev), regional(scored))):
        threshold = best_cape(dev_u)
        for season, group in [("all", u), *u.groupby("season")]:
            for name, forecast_ in (("code", group.code), (f"cape>={threshold}", group.cape >= threshold)):
                m = tally(forecast_, group.lightning)
                ci = interval(group, forecast_, rng)
                rows.append(
                    {
                        "unit": unit,
                        "season": season,
                        "forecast": name,
                        "units": len(group),
                        "days": group.day.nunique(),
                        "lightning_%": round(100 * group.lightning.mean(), 1),
                        "forecast_%": round(100 * forecast_.mean(), 1),
                        **{k: m[k] for k in ("hits", "misses", "false_alarms")},
                        **{k: round(m[k], 2) for k in ("pod", "far", "csi")},
                        **{f"{k}_95": v for k, v in ci.items()},
                    }
                )
    table = pd.DataFrame(rows)
    out = DATA_DIR / "results" / f"storm_outlook_{SCORING_VERSION}_{args.set}.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    table.to_csv(out, index=False)
    with pd.option_context("display.width", 250, "display.max_columns", 30):
        print(table.to_string(index=False))
    print(f"\nscoring {SCORING_VERSION}, set {args.set} -> {out}")


if __name__ == "__main__":
    main()
