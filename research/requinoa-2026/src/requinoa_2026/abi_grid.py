"""Coldest GOES-19 cloud top per IMERG cell, every full-disk scan, for whole seasons.

What the app sees (band 13, parallax-corrected as in realtime.py) is reduced to the
0.1° IMERG grid, so the two can be compared cell by cell and half-hour by half-hour.
One small NetCDF file per day; days already saved are skipped, so runs can resume.

Run with:  uv run requinoa-abi-grid --start 2025-04-07 --end 2026-11-01
GOES-19 became GOES-East (75.2° W) on 2025-04-07; before that it sat elsewhere and
the parallax correction below would be wrong.
"""

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone

import numpy as np
import s3fs
import xarray as xr

from requinoa_2026.config import BBOX, RAW_DIR
from requinoa_2026.goes import hourly_keys, read_abi_crop, with_retries
from requinoa_2026.satellite_analysis import parallax_correct

OUT_DIR = RAW_DIR / "abi_grid"
GRID_DEG = 0.1  # IMERG cells: [-90 + 0.1 i, -90 + 0.1 (i + 1)]
FIRST_DAY = date(2025, 4, 7)


def cell_edges(lo: float, hi: float, origin: float) -> tuple[int, int]:
    return int(np.floor((lo - origin) / GRID_DEG)), int(np.ceil((hi - origin) / GRID_DEG))


LAT_I = cell_edges(BBOX["lat_min"], BBOX["lat_max"], -90.0)
LON_I = cell_edges(BBOX["lon_min"], BBOX["lon_max"], -180.0)
LATS = np.round(-90.0 + GRID_DEG * (np.arange(*LAT_I) + 0.5), 2)
LONS = np.round(-180.0 + GRID_DEG * (np.arange(*LON_I) + 0.5), 2)


def coldest_per_cell(scan: xr.Dataset) -> np.ndarray:
    """Min brightness temperature (°C) per IMERG cell; NaN where no pixel landed."""
    bt_c = scan.brightness_temp_k.values.ravel() - 273.15
    lat, lon = parallax_correct(scan.lat.values.ravel(), scan.lon.values.ravel())
    i = np.floor((lat + 90.0) / GRID_DEG).astype(int) - LAT_I[0]
    j = np.floor((lon + 180.0) / GRID_DEG).astype(int) - LON_I[0]
    keep = np.isfinite(bt_c) & (i >= 0) & (i < LATS.size) & (j >= 0) & (j < LONS.size)
    grid = np.full((LATS.size, LONS.size), np.inf)
    np.minimum.at(grid, (i[keep], j[keep]), bt_c[keep])
    grid[np.isinf(grid)] = np.nan
    return grid.astype("float32")


def scan_grid(key: str, fs: s3fs.S3FileSystem) -> tuple[np.datetime64, np.ndarray]:
    scan = read_abi_crop(key, fs)
    return scan.time.values, coldest_per_cell(scan)


def download_day(day: date, fs: s3fs.S3FileSystem) -> str:
    out = OUT_DIR / f"{day:%Y-%m-%d}.nc"
    if out.exists():
        return f"{day} already there"
    start = datetime(day.year, day.month, day.day, tzinfo=timezone.utc)
    keys = hourly_keys("ABI-L2-CMIPF", start, start + timedelta(days=1), fs, band="M6C13")
    if not keys:
        return f"{day} no scans"
    with ThreadPoolExecutor(max_workers=8) as pool:
        scans = sorted(pool.map(lambda k: with_retries(scan_grid, k, fs), keys), key=lambda s: s[0])
    ds = xr.Dataset(
        {"min_bt_c": (("time", "lat", "lon"), np.stack([grid for _, grid in scans]))},
        coords={"time": [t for t, _ in scans], "lat": LATS, "lon": LONS},
        attrs={"source": "GOES-19 ABI L2 CMIPF band 13, parallax-corrected at 10 km, coldest pixel per 0.1° cell"},
    )
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ds.to_netcdf(out, engine="h5netcdf")
    return f"{day} {len(keys)} scans"


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--start", default=f"{FIRST_DAY}", help="first day, YYYY-MM-DD")
    parser.add_argument("--end", required=True, help="day after the last, YYYY-MM-DD")
    args = parser.parse_args(argv)

    fs = s3fs.S3FileSystem(anon=True)
    day, end = max(date.fromisoformat(args.start), FIRST_DAY), date.fromisoformat(args.end)
    while day < end:
        print(download_day(day, fs), flush=True)
        day += timedelta(days=1)
