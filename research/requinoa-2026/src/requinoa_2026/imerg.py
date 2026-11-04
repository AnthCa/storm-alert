"""Download NASA GPM IMERG half-hourly rain over O'Higgins, as ground truth.

Only the O'Higgins window of each global file is requested (OPeNDAP subset, ~25 KB
instead of ~7 MB), and each day is saved as one small NetCDF file.

Needs a free NASA Earthdata account with "NASA GESDISC DATA ARCHIVE" authorized, and
its login in ~/.netrc:  machine urs.earthdata.nasa.gov login USER password PASS

Run with:  uv run requinoa-imerg --start 2025-10-01 --end 2026-04-01
"""

import argparse
import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta

import numpy as np
import requests
import xarray as xr

from requinoa_2026.config import BBOX, RAW_DIR
from requinoa_2026.goes import with_retries

OPENDAP = "https://gpm1.gesdisc.eosdis.nasa.gov/opendap/GPM_L3"
ARCHIVE = "https://gpm1.gesdisc.eosdis.nasa.gov/data/GPM_L3"
# Best first: Final (gauge-corrected, ~3.5 months late), then Late (~14 h), then Early (~4 h).
PRODUCTS = ["GPM_3IMERGHH.07", "GPM_3IMERGHHL.07", "GPM_3IMERGHHE.07"]
OUT_DIR = RAW_DIR / "imerg"

# IMERG grid: 0.1° cell centres from -179.95 (lon) and -89.95 (lat).
GRID_DEG = 0.1


def grid_index(value: float, first: float) -> int:
    return int(round((value - first) / GRID_DEG))


def window(bbox: dict = BBOX) -> tuple[slice, slice]:
    """Inclusive index ranges of the cells covering the box."""
    lon = slice(grid_index(bbox["lon_min"], -179.95), grid_index(bbox["lon_max"], -179.95))
    lat = slice(grid_index(bbox["lat_min"], -89.95), grid_index(bbox["lat_max"], -89.95))
    return lon, lat


def subset_url(product: str, day: date, name: str, bbox: dict = BBOX) -> str:
    lon, lat = window(bbox)
    constraint = (
        f"/precipitation[0:0][{lon.start}:{lon.stop}][{lat.start}:{lat.stop}];"
        f"/lat[{lat.start}:{lat.stop}];/lon[{lon.start}:{lon.stop}]"
    )
    path = f"{product}/{day:%Y}/{day.timetuple().tm_yday:03d}/{name}"
    return f"{OPENDAP}/{path}.dap.nc4?dap4.ce={requests.utils.quote(constraint, safe='/;:')}"


def half_hour_start(name: str) -> datetime:
    """Start time in IMERG file names: ...3IMERG.YYYYMMDD-SHHMMSS-..."""
    stamp = re.search(r"3IMERG\.(\d{8})-S(\d{6})", name)
    return datetime.strptime("".join(stamp.groups()), "%Y%m%d%H%M%S")


# After a failed day, give the server time before asking again.
FAILED_DAY_PAUSE_S = 60


def list_day(session: requests.Session, day: date) -> tuple[str, list[str]]:
    """The best product that has this day, and its 48 file names."""
    for product in PRODUCTS:
        url = f"{ARCHIVE}/{product}/{day:%Y}/{day.timetuple().tm_yday:03d}/"
        response = session.get(url, timeout=60)
        if response.status_code == 404:
            continue
        response.raise_for_status()
        names = sorted(set(re.findall(r'href="(3B-HHR[^"]+\.HDF5)"', response.text)))
        if names:
            return product, names
    return "", []


def fetch(session: requests.Session, product: str, day: date, name: str) -> xr.Dataset:
    response = session.get(subset_url(product, day, name), timeout=120)
    response.raise_for_status()
    with xr.open_dataset(response.content, engine="h5netcdf") as ds:
        rain = ds.precipitation.isel(time=0).transpose("lat", "lon").load()
    rain = rain.where(rain >= 0)  # negative values are fill
    return rain.expand_dims(time=[np.datetime64(half_hour_start(name), "ns")]).to_dataset(name="rain_mm_h")


def download_day(session: requests.Session, day: date) -> str:
    out = OUT_DIR / f"{day:%Y-%m-%d}.nc"
    if out.exists():
        return f"{day} already there"
    product, names = with_retries(list_day, session, day)
    if not names:
        return f"{day} not available yet"
    # The first request signs in to Earthdata and leaves the session cookie; after that a
    # few parallel requests are fine, more and the server starts refusing connections.
    parts = [with_retries(fetch, session, product, day, names[0])]
    with ThreadPoolExecutor(max_workers=2) as pool:
        parts += pool.map(lambda name: with_retries(fetch, session, product, day, name), names[1:])
    ds = xr.concat(parts, dim="time")
    ds.attrs.update(product=product, source="NASA GPM IMERG V07, OPeNDAP subset over O'Higgins")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ds.to_netcdf(out, engine="h5netcdf")
    return f"{day} {product} {len(names)} half-hours"


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--start", required=True, help="first day, YYYY-MM-DD")
    parser.add_argument("--end", required=True, help="day after the last, YYYY-MM-DD")
    args = parser.parse_args(argv)

    session = requests.Session()  # reads ~/.netrc and keeps the Earthdata cookies
    day, end = date.fromisoformat(args.start), date.fromisoformat(args.end)
    while day < end:
        try:
            print(download_day(session, day), flush=True)
        except Exception as error:
            # One bad day must not stop a season-long run; a later run fills the gap.
            print(f"{day} failed, will retry on the next run: {error}", flush=True)
            time.sleep(FAILED_DAY_PAUSE_S)
        day += timedelta(days=1)
