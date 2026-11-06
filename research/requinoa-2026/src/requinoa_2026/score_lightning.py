"""Score "cold tops AND lightning" against cold tops alone (s1), on the same units.

Run with:  uv run requinoa-score-lightning [--set dev|held-out]

Rules, frozen on 2026-11-06 before any result was seen (do not change them to
improve a score; changing them means a new scoring version):
- Everything as in s1 (`score.py`): zones, IMERG truth (>= 1 mm/h rain, >= 5 mm/h
  heavy), one unit per zone and half-hour, POD / FAR / CSI, day-block 95% intervals.
- Detection s2: in the same half-hour, some cell of the zone has a cloud top
  <= -38 °C AND some cell of the zone has at least MIN_FLASHES GLM flashes.
- Lightning is usable for a half-hour when at least MIN_GLM_FILES of its 90 GLM
  files were read. A cold unit without usable lightning is left out of BOTH
  detectors, so s1 and s2 are always compared on exactly the same units.
- The difference s2 - s1 of each metric gets its own day-block 95% interval.
- Development set first; the held-out set is scored once, after the rule is final.
Limits: GLM sees most but not all flashes (it misses some weak or low ones), and
IMERG is a ~10 km satellite estimate, not a rain gauge.
"""

import argparse
from datetime import date

import numpy as np
import pandas as pd
import xarray as xr

from requinoa_2026.config import DATA_DIR
from requinoa_2026.glm_grid import OUT_DIR as GLM_DIR
from requinoa_2026.score import BOOTSTRAP, DEV, HELD_OUT, counts, day_units, metrics, on_grid, zones

SCORING_VERSION = "s2"
MIN_FLASHES = 1
MIN_GLM_FILES = 60


def lightning_units(day: date, zone: xr.DataArray, units: pd.DataFrame) -> pd.DataFrame:
    """Adds `lightning` (zone had flashes) and drops cold units whose lightning is unknown."""
    path = GLM_DIR / f"{day}.nc"
    units = units.copy()
    units["lightning"] = False
    usable = pd.Series(False, index=units.index)
    if path.exists():
        ds = xr.open_dataset(path)
        flashes = on_grid(ds.flashes).sel(lat=zone.lat, lon=zone.lon)
        good = set(pd.to_datetime(ds.time.values[ds.glm_files.values >= MIN_GLM_FILES]))
        for name in ("coast", "valley", "andes"):
            zone_max = flashes.where(zone == name).max(["lat", "lon"]).to_series()
            rows = units.zone == name
            t = pd.to_datetime(units.loc[rows, "time"])
            units.loc[rows, "lightning"] = (t.map(zone_max).fillna(0) >= MIN_FLASHES).to_numpy()
            usable.loc[rows] = t.isin(good).to_numpy()
    # GLM is only read when some cold top was over the region, so a unit that is not
    # cold never needs it; a cold unit does.
    keep = ~units.detected | usable
    return units[keep]


def interval(units: pd.DataFrame, truth: str, rng: np.random.Generator) -> dict:
    """95% ranges for s1, s2 and their difference, resampling whole days together."""
    by_day = {day: frame for day, frame in units.groupby("day")}
    days = list(by_day)
    samples = []
    for _ in range(BOOTSTRAP):
        pick = pd.concat([by_day[days[i]] for i in rng.choice(len(days), len(days))])
        a = metrics(counts(pick.assign(detected=pick.detected), truth))
        b = metrics(counts(pick.assign(detected=pick.s2), truth))
        samples.append({**{f"s1_{k}": v for k, v in a.items()}, **{f"s2_{k}": v for k, v in b.items()},
                        **{f"diff_{k}": b[k] - a[k] for k in a}})
    table = pd.DataFrame(samples)
    return {m: f"{table[m].quantile(0.025):.2f} to {table[m].quantile(0.975):.2f}" for m in table}


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--set", choices=["dev", "held-out"], default="dev")
    args = parser.parse_args(argv)
    start, end = {"dev": DEV, "held-out": HELD_OUT}[args.set]

    zone = zones()
    frames, dropped = [], 0
    day = start
    while day < end:
        u = day_units(day, zone)
        if u is not None and not u.empty:
            kept = lightning_units(day, zone, u)
            dropped += len(u) - len(kept)
            frames.append(kept)
        day += pd.Timedelta(days=1)
    units = pd.concat(frames, ignore_index=True)
    units["s2"] = units.detected & units.lightning
    units["season"] = np.where(pd.to_datetime(units.day).dt.month.isin([10, 11, 12, 1, 2, 3]), "warm", "cold")

    rng = np.random.default_rng(0)
    rows = []
    for (season, zone_name), group in [(("all", "all"), units), *units.groupby(["season", "zone"])]:
        for truth in ("rain", "heavy"):
            row = {"set": args.set, "season": season, "zone": zone_name, "truth": truth, "days": group.day.nunique()}
            for name, col in (("s1", "detected"), ("s2", "s2")):
                c = counts(group.assign(detected=group[col]), truth)
                row.update({f"{name}_{k}": v for k, v in c.items()})
                row.update({f"{name}_{k}": round(v, 3) for k, v in metrics(c).items()})
            row.update({f"{k}_95": v for k, v in interval(group, truth, rng).items()})
            rows.append(row)
    table = pd.DataFrame(rows)
    out = DATA_DIR / "results" / f"score_{SCORING_VERSION}_{args.set}.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    table.to_csv(out, index=False)
    show = ["season", "zone", "truth", "days", "s1_POD", "s2_POD", "diff_POD_95", "s1_FAR", "s2_FAR", "diff_FAR_95", "s1_CSI", "s2_CSI", "diff_CSI_95"]
    with pd.option_context("display.width", 250, "display.max_columns", 30):
        print(table[show].to_string(index=False))
    print(f"\n{units.day.nunique()} days, {len(units)} units, {dropped} cold units left out for missing lightning")
    print(f"scoring {SCORING_VERSION} -> {out}")
