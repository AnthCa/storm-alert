"""Score the app's "chance of rain in the next hour" against NASA IMERG rain, per town and hour.

Run with:  uv run requinoa-rain-chance [--set dev|held-out]

Rules, frozen on 2026-11-05 before any result was seen (do not change them to
improve a score; changing them means a new scoring version):
- Forecast: Open-Meteo `precipitation_probability` (share of ensemble runs with more
  than 0.1 mm in the hour), as archived by its Historical Forecast API, at each of the
  app's towns rounded to the 0.05° grid the app sends.
- Unit: one town during one UTC hour. Open-Meteo values belong to the hour that ENDS
  at their time stamp; the two IMERG half-hours starting 60 and 30 minutes before it
  make the observed hour.
- Observed rain: the IMERG cell (0.1°) holding the town gets >= RAIN_MM in the hour
  (and, separately, >= STEADY_MM for steady rain).
- Scores: Brier score; Brier skill score against climatology (the dev-set share of
  rainy hours per town and calendar month); reliability per probability bin.
  95% intervals by resampling whole days.
- Calibration: on the dev set, the observed share of rainy hours in each probability
  bin. The same table is applied once to the held-out set, and only reported there.
- Seasons as in s1 (dev 2025-04-07 to 2026-03-31, held-out 2026-04-01 to 2026-10-31);
  warm = October to March.
- Hours missing either source are left out, never counted as dry.
Limits: IMERG is a ~10 km satellite estimate, not a rain gauge, and sees weak warm
rain poorly; the archive stitches the newest model runs, so its lead time is close
to, not exactly, what a viewer saw live.
"""

import argparse
import json
import time
from datetime import date

import numpy as np
import pandas as pd
import requests
import xarray as xr

from requinoa_2026.config import DATA_DIR, RAW_DIR, TOWNS
from requinoa_2026.imerg import OUT_DIR as IMERG_DIR
from requinoa_2026.score import DEV, HELD_OUT

SCORING_VERSION = "r1"
RAIN_MM = 0.1
STEADY_MM = 1.0
BINS = [0, 1, 11, 21, 31, 41, 51, 61, 71, 81, 91, 101]  # [0], 1-10, 11-20, ..., 91-100
BOOTSTRAP = 1000
ARCHIVE_URL = "https://historical-forecast-api.open-meteo.com/v1/forecast"
OUT_DIR = RAW_DIR / "open_meteo"
COARSE_DEG = 0.05

def coarse(v: float) -> float:
    return round(round(v / COARSE_DEG) * COARSE_DEG, 2)


def forecast(name: str, lat: float, lon: float) -> pd.DataFrame:
    """Archived hourly chance of rain at the town, downloaded once and kept on disk."""
    out = OUT_DIR / f"{name}.json"
    if not out.exists():
        params = {
            "latitude": coarse(lat),
            "longitude": coarse(lon),
            "start_date": DEV[0].isoformat(),
            "end_date": (HELD_OUT[1] - pd.Timedelta(days=1)).isoformat(),
            "hourly": "precipitation_probability",
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
        {"end": pd.to_datetime(hourly["time"]), "chance": pd.to_numeric(hourly["precipitation_probability"])}
    ).dropna()


def observed(lat: float, lon: float, start: date, end: date) -> pd.Series:
    """Hourly IMERG rain (mm) in the cell holding the point, indexed by the hour's end."""
    parts = []
    day = start
    while day < end:
        path = IMERG_DIR / f"{day:%Y-%m-%d}.nc"
        if path.exists():
            with xr.open_dataset(path) as ds:
                parts.append(ds.rain_mm_h.sel(lat=lat, lon=lon, method="nearest").to_series())
        day += pd.Timedelta(days=1)
    half = pd.concat(parts).sort_index() * 0.5  # mm/h over half an hour -> mm
    hour_end = half.index.floor("h") + pd.Timedelta(hours=1)
    grouped = half.groupby(hour_end)
    # Both half-hours must be there; a missing one is not counted as dry.
    return grouped.sum()[grouped.count() == 2]


def units(start: date, end: date) -> pd.DataFrame:
    frames = []
    for name, lat, lon in TOWNS:
        f = forecast(name, lat, lon)
        f = f[(f.end > pd.Timestamp(start)) & (f.end <= pd.Timestamp(end))]
        obs = observed(lat, lon, start, end).rename("mm")
        frame = f.join(obs, on="end", how="inner")
        frame["town"] = name
        frames.append(frame)
    u = pd.concat(frames, ignore_index=True)
    u["day"] = (u.end - pd.Timedelta(minutes=1)).dt.date
    u["month"] = u.end.dt.month
    u["season"] = np.where(u.month.isin([10, 11, 12, 1, 2, 3]), "warm", "cold")
    u["bin"] = pd.cut(u.chance, BINS, right=False, labels=False)
    return u


def climatology(dev: pd.DataFrame, truth: str) -> pd.Series:
    return dev.groupby(["town", "month"])[truth].mean().rename("clim")


def calibration(dev: pd.DataFrame, truth: str) -> pd.Series:
    return dev.groupby("bin")[truth].mean().rename("calibrated")


def daily(u: pd.DataFrame, truth: str, prob: str) -> pd.DataFrame:
    """Per-day sums, so that resampling whole days is cheap."""
    p, o = u[prob] / 100 if prob == "chance" else u[prob], u[truth].astype(float)
    return pd.DataFrame(
        {"day": u.day, "se": (p - o) ** 2, "se_clim": (u.clim - o) ** 2, "n": 1.0}
    ).groupby("day").sum()


def brier(d: pd.DataFrame) -> tuple[float, float]:
    bs = d.se.sum() / d.n.sum()
    return bs, 1 - bs / (d.se_clim.sum() / d.n.sum())


def brier_interval(d: pd.DataFrame, rng: np.random.Generator) -> tuple[tuple, tuple]:
    values = d.to_numpy()
    se, se_clim, n = values[:, 0], values[:, 1], values[:, 2]
    w = rng.multinomial(len(d), np.full(len(d), 1 / len(d)), size=BOOTSTRAP)
    bs = (w @ se) / (w @ n)
    bss = 1 - bs / ((w @ se_clim) / (w @ n))
    q = lambda x: (round(float(np.quantile(x, 0.025)), 4), round(float(np.quantile(x, 0.975)), 4))  # noqa: E731
    return q(bs), q(bss)


def reliability(u: pd.DataFrame, truth: str, rng: np.random.Generator) -> pd.DataFrame:
    """Observed share of rainy hours per bin, with day-resampled 95% ranges."""
    days = sorted(u.day.unique())
    hits = u.pivot_table(index="day", columns="bin", values=truth, aggfunc="sum", fill_value=0).reindex(days, fill_value=0)
    count = u.pivot_table(index="day", columns="bin", values=truth, aggfunc="count", fill_value=0).reindex(days, fill_value=0)
    w = rng.multinomial(len(days), np.full(len(days), 1 / len(days)), size=BOOTSTRAP)
    with np.errstate(invalid="ignore", divide="ignore"):
        share = (w @ hits.to_numpy()) / (w @ count.to_numpy())
    rows = []
    for j, b in enumerate(count.columns):
        rows.append(
            {
                "bin": f"{BINS[b]}-{BINS[b + 1] - 1}" if BINS[b + 1] - BINS[b] > 1 else str(BINS[b]),
                "hours": int(count[b].sum()),
                "mean_forecast": round(u[u.bin == b].chance.mean(), 1),
                "observed_%": round(100 * hits[b].sum() / count[b].sum(), 1),
                "observed_95": f"{100 * np.nanquantile(share[:, j], 0.025):.0f}-{100 * np.nanquantile(share[:, j], 0.975):.0f}",
            }
        )
    return pd.DataFrame(rows)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--set", choices=["dev", "held-out"], default="dev")
    args = parser.parse_args(argv)

    dev = units(*DEV)
    for truth, mm in (("rain", RAIN_MM), ("steady", STEADY_MM)):
        dev[truth] = dev.mm >= mm
    scored = dev
    if args.set == "held-out":
        scored = units(*HELD_OUT)
        for truth, mm in (("rain", RAIN_MM), ("steady", STEADY_MM)):
            scored[truth] = scored.mm >= mm

    rng = np.random.default_rng(0)
    rows, tables = [], []
    for truth in ("rain", "steady"):
        u = scored.join(climatology(dev, truth), on=["town", "month"]).join(calibration(dev, truth), on="bin")
        u = u.dropna(subset=["clim"])
        for season, group in [("all", u), *u.groupby("season")]:
            for prob in ("chance", "calibrated"):
                if prob == "calibrated" and args.set == "dev":
                    continue  # fitted on dev: scoring it there would flatter it
                d = daily(group, truth, prob)
                (bs, bss), (bs_ci, bss_ci) = brier(d), brier_interval(d, rng)
                rows.append(
                    {
                        "truth": truth,
                        "season": season,
                        "forecast": prob,
                        "days": group.day.nunique(),
                        "hours": len(group),
                        "rainy_%": round(100 * group[truth].mean(), 1),
                        "brier": round(bs, 4),
                        "brier_95": f"{bs_ci[0]}-{bs_ci[1]}",
                        "skill": round(bss, 3),
                        "skill_95": f"{bss_ci[0]}-{bss_ci[1]}",
                    }
                )
            rel = reliability(group, truth, rng)
            rel.insert(0, "season", season)
            rel.insert(0, "truth", truth)
            tables.append(rel)

    results = DATA_DIR / "results"
    results.mkdir(parents=True, exist_ok=True)
    summary, rel = pd.DataFrame(rows), pd.concat(tables, ignore_index=True)
    summary.to_csv(results / f"rain_chance_{SCORING_VERSION}_{args.set}.csv", index=False)
    rel.to_csv(results / f"rain_chance_{SCORING_VERSION}_{args.set}_reliability.csv", index=False)
    if args.set == "dev":
        calibration(dev, "rain").to_csv(results / f"rain_chance_{SCORING_VERSION}_calibration.csv")
    with pd.option_context("display.width", 200, "display.max_columns", 20, "display.max_rows", 200):
        print(summary.to_string(index=False))
        print()
        print(rel.to_string(index=False))
    print(f"\nscoring {SCORING_VERSION}, set {args.set} -> {results}")
