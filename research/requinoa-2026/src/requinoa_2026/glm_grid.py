"""GOES-19 lightning flashes per IMERG cell and half-hour, for whole seasons.

Only half-hours with a cloud top <= -38 °C somewhere over O'Higgins are read: a rule
that needs both cold tops and lightning cannot fire in the others, and GLM files are
large (one ~600 KB file every 20 s). Run requinoa-abi-grid for the same days first.
One small NetCDF file per day; days already saved are skipped, so runs can resume.

Run with:  uv run requinoa-glm-grid --start 2025-04-07 --end 2026-04-01
"""

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone

import numpy as np
import pandas as pd
import s3fs
import xarray as xr

from requinoa_2026.abi_grid import GRID_DEG, LAT_I, LATS, LON_I, LONS
from requinoa_2026.abi_grid import OUT_DIR as ABI_DIR
from requinoa_2026.config import RAW_DIR
from requinoa_2026.goes import hourly_keys, read_glm_flashes, scan_start, with_retries
from requinoa_2026.score import COLD_TOP_C, REGION

OUT_DIR = RAW_DIR / "glm_grid"
HALF_HOUR = pd.Timedelta("30min")
FILES_PER_HALF_HOUR = 90  # one GLM L2 file every 20 s
# Reading is network-bound: many files in flight keep the connection busy.
WORKERS = 48


def cold_half_hours(day: date) -> list[pd.Timestamp]:
    """Starts (UTC, naive) of the half-hours with a cold top over the region."""
    tops = xr.open_dataset(ABI_DIR / f"{day:%Y-%m-%d}.nc").min_bt_c
    tops = tops.where(
        (tops.lat >= REGION["lat_min"]) & (tops.lat <= REGION["lat_max"])
        & (tops.lon >= REGION["lon_min"]) & (tops.lon <= REGION["lon_max"])
    )
    cold = (tops <= COLD_TOP_C).any(["lat", "lon"]).resample(time="30min").max()
    return [pd.Timestamp(t) for t in cold.time.values[cold.values.astype(bool)]]


def flashes_per_cell(flashes: pd.DataFrame) -> np.ndarray:
    """Flash count per IMERG cell."""
    i = np.floor((flashes.lat.values + 90.0) / GRID_DEG).astype(int) - LAT_I[0]
    j = np.floor((flashes.lon.values + 180.0) / GRID_DEG).astype(int) - LON_I[0]
    keep = (i >= 0) & (i < LATS.size) & (j >= 0) & (j < LONS.size)
    grid = np.zeros((LATS.size, LONS.size), dtype="int32")
    np.add.at(grid, (i[keep], j[keep]), 1)
    return grid


def download_day(day: date, fs: s3fs.S3FileSystem) -> str:
    out = OUT_DIR / f"{day:%Y-%m-%d}.nc"
    if out.exists():
        return f"{day} already there"
    if not (ABI_DIR / f"{day:%Y-%m-%d}.nc").exists():
        return f"{day} no cloud tops yet: run requinoa-abi-grid first"
    halves = cold_half_hours(day)
    counts, files = [], []
    if halves:
        start = datetime(day.year, day.month, day.day, tzinfo=timezone.utc)
        keys = hourly_keys("GLM-L2-LCFA", start, start + timedelta(days=1), fs)
        starts = pd.to_datetime([scan_start(k) for k in keys]).tz_localize(None)
        for half in halves:
            mine = [k for k, s in zip(keys, starts) if half <= s < half + HALF_HOUR]
            with ThreadPoolExecutor(max_workers=WORKERS) as pool:
                frames = list(pool.map(lambda k: with_retries(read_glm_flashes, k, fs), mine))
            flashes = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame({"lat": [], "lon": []})
            counts.append(flashes_per_cell(flashes))
            files.append(len(mine))
    ds = xr.Dataset(
        {
            "flashes": (("time", "lat", "lon"), np.array(counts, dtype="int32").reshape(len(halves), LATS.size, LONS.size)),
            "glm_files": (("time",), np.array(files, dtype="int16")),
        },
        coords={"time": np.array(halves, dtype="datetime64[ns]"), "lat": LATS, "lon": LONS},
        attrs={
            "source": "GOES-19 GLM L2 LCFA flashes per 0.1° IMERG cell and half-hour",
            "coverage": f"only half-hours with a cloud top <= {COLD_TOP_C} C over the scoring region",
            "files_per_half_hour": FILES_PER_HALF_HOUR,
        },
    )
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ds.to_netcdf(out, engine="h5netcdf")
    return f"{day} {len(halves)} cold half-hours, {int(np.sum(counts))} flashes"


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--start", required=True, help="first day, YYYY-MM-DD")
    parser.add_argument("--end", required=True, help="day after the last, YYYY-MM-DD")
    args = parser.parse_args(argv)

    fs = s3fs.S3FileSystem(anon=True)
    day, end = date.fromisoformat(args.start), date.fromisoformat(args.end)
    while day < end:
        try:
            print(download_day(day, fs), flush=True)
        except Exception as error:
            # One bad day must not stop a season-long run; a later run fills the gap.
            print(f"{day} failed, will retry on the next run: {error}", flush=True)
        day += timedelta(days=1)
