"""GOES-19 cloud-top temperature (ABI band 13) and lightning (GLM) over O'Higgins.

Run with:  uv run requinoa-goes
Only the full-disk ABI scan covers Chile (every 10 minutes); the 1-minute
mesoscale sectors were pointed at the US on the event day.
"""

import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd
import s3fs
import xarray as xr

from requinoa_2026.config import BBOX, PROCESSED_DIR

BUCKET = "noaa-goes19"
WINDOW_START_UTC = datetime(2026, 10, 26, 16, tzinfo=timezone.utc)
WINDOW_END_UTC = datetime(2026, 10, 26, 22, tzinfo=timezone.utc)

# GRS80 ellipsoid constants used by the ABI fixed grid (GOES-R PUG, sec. 4.2.8).
ECCENTRICITY = 0.0818191910435


def fixed_grid_to_latlon(x, y, proj: dict):
    """ABI scan angles (radians) -> geodetic latitude/longitude (degrees)."""
    r_eq, r_pol = proj["semi_major_axis"], proj["semi_minor_axis"]
    height = proj["perspective_point_height"] + r_eq
    lon0 = np.radians(proj["longitude_of_projection_origin"])
    x, y = np.asarray(x, dtype=float), np.asarray(y, dtype=float)

    a = np.sin(x) ** 2 + np.cos(x) ** 2 * (np.cos(y) ** 2 + (r_eq**2 / r_pol**2) * np.sin(y) ** 2)
    b = -2 * height * np.cos(x) * np.cos(y)
    c = height**2 - r_eq**2
    with np.errstate(invalid="ignore"):  # off-disk pixels have no solution -> NaN
        r_s = (-b - np.sqrt(b**2 - 4 * a * c)) / (2 * a)
    s_x = r_s * np.cos(x) * np.cos(y)
    s_y = -r_s * np.sin(x)
    s_z = r_s * np.cos(x) * np.sin(y)

    lat = np.arctan((r_eq**2 / r_pol**2) * s_z / np.sqrt((height - s_x) ** 2 + s_y**2))
    lon = lon0 - np.arctan(s_y / (height - s_x))
    return np.degrees(lat), np.degrees(lon)


def latlon_to_fixed_grid(lat, lon, proj: dict):
    """Geodetic latitude/longitude (degrees) -> ABI scan angles (radians)."""
    r_eq, r_pol = proj["semi_major_axis"], proj["semi_minor_axis"]
    height = proj["perspective_point_height"] + r_eq
    lon0 = np.radians(proj["longitude_of_projection_origin"])
    lat, lon = np.radians(lat), np.radians(lon)

    lat_c = np.arctan((r_pol**2 / r_eq**2) * np.tan(lat))
    r_c = r_pol / np.sqrt(1 - ECCENTRICITY**2 * np.cos(lat_c) ** 2)
    s_x = height - r_c * np.cos(lat_c) * np.cos(lon - lon0)
    s_y = -r_c * np.cos(lat_c) * np.sin(lon - lon0)
    s_z = r_c * np.sin(lat_c)

    y = np.arctan(s_z / s_x)
    x = np.arcsin(-s_y / np.sqrt(s_x**2 + s_y**2 + s_z**2))
    return x, y


def projection_attrs(ds: xr.Dataset) -> dict:
    attrs = ds["goes_imager_projection"].attrs
    keys = ("semi_major_axis", "semi_minor_axis", "perspective_point_height", "longitude_of_projection_origin")
    return {key: float(np.asarray(attrs[key]).squeeze()) for key in keys}


def bbox_window(ds: xr.Dataset, bbox: dict = BBOX) -> dict:
    """Index slices of the fixed grid that cover the lat/lon box."""
    proj = projection_attrs(ds)
    lats = np.linspace(bbox["lat_min"], bbox["lat_max"], 5)
    lons = np.linspace(bbox["lon_min"], bbox["lon_max"], 5)
    lat2d, lon2d = np.meshgrid(lats, lons)
    xs, ys = latlon_to_fixed_grid(lat2d, lon2d, proj)
    x_values, y_values = ds.x.values, ds.y.values  # x ascends, y descends

    def index_range(values, lo, hi):
        hits = np.where((values >= lo) & (values <= hi))[0]
        return slice(int(hits.min()), int(hits.max()) + 1)

    return {"x": index_range(x_values, xs.min(), xs.max()), "y": index_range(y_values, ys.min(), ys.max())}


def hourly_keys(product: str, start: datetime, end: datetime, fs: s3fs.S3FileSystem, band: str = "") -> list[str]:
    keys = []
    hour = start.replace(minute=0)
    while hour < end:
        prefix = f"{BUCKET}/{product}/{hour:%Y}/{hour.timetuple().tm_yday:03d}/{hour:%H}"
        keys += [k for k in fs.ls(prefix) if band in k.split("/")[-1]]
        hour += timedelta(hours=1)
    return [k for k in keys if start <= scan_start(k) < end]


def scan_start(key: str) -> datetime:
    """Start time encoded in GOES file names: ..._sYYYYJJJHHMMSSt_..."""
    stamp = key.split("_s")[1][:13]
    return datetime.strptime(stamp, "%Y%j%H%M%S").replace(tzinfo=timezone.utc)


def with_retries(func, *args, attempts: int = 3, base_delay_s: float = 5.0):
    for attempt in range(1, attempts + 1):
        try:
            return func(*args)
        except Exception as error:
            if attempt == attempts:
                raise
            print(f"retry {attempt}/{attempts} after: {error}")
            time.sleep(base_delay_s * 2 ** (attempt - 1))


def read_abi_crop(key: str, fs: s3fs.S3FileSystem) -> xr.Dataset:
    """Read only the O'Higgins window of a full-disk band 13 file (HTTP range reads)."""
    with fs.open(key) as remote:
        ds = xr.open_dataset(remote, engine="h5netcdf")
        window = bbox_window(ds)
        crop = ds[["CMI"]].isel(**window).load()
        proj = projection_attrs(ds)
    x2d, y2d = np.meshgrid(crop.x.values, crop.y.values)
    lat, lon = fixed_grid_to_latlon(x2d, y2d, proj)
    return xr.Dataset(
        {"brightness_temp_k": (("y", "x"), crop.CMI.values)},
        # NetCDF cannot store timezone-aware datetimes; times are always UTC.
        coords={
            "lat": (("y", "x"), lat),
            "lon": (("y", "x"), lon),
            "time": np.datetime64(scan_start(key).replace(tzinfo=None), "ns"),
        },
    )


def read_glm_flashes(key: str, fs: s3fs.S3FileSystem, bbox: dict = BBOX) -> pd.DataFrame:
    with fs.open(key) as remote:
        ds = xr.open_dataset(remote, engine="h5netcdf")
        flashes = pd.DataFrame(
            {
                "time": pd.to_datetime(ds.flash_time_offset_of_first_event.values, utc=True),
                "lat": ds.flash_lat.values,
                "lon": ds.flash_lon.values,
                "energy_j": ds.flash_energy.values,
                "area_m2": ds.flash_area.values,
            }
        )
    inside = flashes.lat.between(bbox["lat_min"], bbox["lat_max"]) & flashes.lon.between(
        bbox["lon_min"], bbox["lon_max"]
    )
    return flashes[inside]


def download_abi(start: datetime, end: datetime, path, fs: s3fs.S3FileSystem) -> xr.Dataset:
    """Band 13 crops over O'Higgins for every full-disk scan in [start, end)."""
    if path.exists():
        return xr.open_dataset(path)
    keys = hourly_keys("ABI-L2-CMIPF", start, end, fs, band="M6C13")
    with ThreadPoolExecutor(max_workers=6) as pool:
        crops = list(pool.map(lambda k: with_retries(read_abi_crop, k, fs), keys))
    abi = xr.concat(sorted(crops, key=lambda c: c.time.values), dim="time")
    abi.to_netcdf(path)
    print(f"saved {path.name} {dict(abi.sizes)}")
    return abi


def download_glm(start: datetime, end: datetime, path, fs: s3fs.S3FileSystem) -> pd.DataFrame:
    """Every GLM flash inside the O'Higgins box in [start, end)."""
    if path.exists():
        return pd.read_csv(path, parse_dates=["time"])
    keys = hourly_keys("GLM-L2-LCFA", start, end, fs)
    with ThreadPoolExecutor(max_workers=12) as pool:
        frames = list(pool.map(lambda k: with_retries(read_glm_flashes, k, fs), keys))
    glm = pd.concat(frames, ignore_index=True).sort_values("time")
    glm.to_csv(path, index=False)
    print(f"saved {path.name} ({len(glm)} flashes from {len(keys)} files)")
    return glm


def main() -> None:
    fs = s3fs.S3FileSystem(anon=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    download_abi(WINDOW_START_UTC, WINDOW_END_UTC, PROCESSED_DIR / "goes19_c13_20261026.nc", fs)
    download_glm(WINDOW_START_UTC, WINDOW_END_UTC, PROCESSED_DIR / "goes19_glm_flashes_20261026.csv", fs)


if __name__ == "__main__":
    main()
