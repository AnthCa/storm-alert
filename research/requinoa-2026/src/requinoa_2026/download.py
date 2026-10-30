"""Download GFS fields for the case study and crop them to O'Higgins.

Run with:  uv run requinoa-download
"""

import sys
import time

import cfgrib
import xarray as xr
from herbie import Herbie

from requinoa_2026.config import (
    BBOX,
    GFS_SEARCH,
    PROCESSED_DIR,
    RAW_DIR,
    ForecastRequest,
    control_requests,
    event_requests,
)


def crop_to_bbox(ds: xr.Dataset, bbox: dict = BBOX) -> xr.Dataset:
    """Keep only the grid points inside the box.

    GFS longitudes run 0..360 and latitudes run north to south, so the box is
    converted to that convention before slicing.
    """
    lon_min = bbox["lon_min"] % 360
    lon_max = bbox["lon_max"] % 360
    lat_slice = (
        slice(bbox["lat_max"], bbox["lat_min"])
        if ds.latitude[0] > ds.latitude[-1]
        else slice(bbox["lat_min"], bbox["lat_max"])
    )
    return ds.sel(latitude=lat_slice, longitude=slice(lon_min, lon_max))


def single_level_name(var: str, da: xr.DataArray) -> str:
    """Unique name for a single-level field, e.g. 'cape_pressureFromGroundLayer'.

    Different GRIB levels reuse the same short name (CAPE at the surface and
    CAPE over the lowest 180 hPa are both 'cape'), so the level type is
    appended to keep them apart.
    """
    level_type = da.attrs.get("GRIB_typeOfLevel", "unknown")
    return f"{var}_{level_type}"


def split_hypercubes(datasets: list[xr.Dataset]) -> tuple[xr.Dataset, xr.Dataset]:
    """Separate pressure-level profiles from single-level fields.

    cfgrib returns one dataset per level type ("hypercube"). Profiles share
    the isobaricInhPa dimension and merge cleanly; single-level fields each
    carry a scalar level coordinate that conflicts on merge, so they are
    renamed and stripped of it first.
    """
    profiles, single = [], []
    for ds in datasets:
        if "isobaricInhPa" in ds.dims:
            profiles.append(ds)
            continue
        level_coords = [c for c in ds.coords if c not in ("latitude", "longitude", "time", "step", "valid_time")]
        renamed = ds.drop_vars(level_coords).rename(
            {var: single_level_name(var, ds[var]) for var in ds.data_vars}
        )
        single.append(renamed)
    return (
        xr.merge(profiles, compat="override", combine_attrs="drop_conflicts"),
        xr.merge(single, compat="override", combine_attrs="drop_conflicts"),
    )


def download(request: ForecastRequest, overwrite: bool = False) -> list:
    """Fetch one GFS file subset, crop it, and save profiles and surface fields."""
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    profile_path = PROCESSED_DIR / f"{request.stem}_profiles.nc"
    single_path = PROCESSED_DIR / f"{request.stem}_single.nc"
    if profile_path.exists() and single_path.exists() and not overwrite:
        print(f"skip  {request.stem} (already processed)")
        return [profile_path, single_path]

    herbie = Herbie(
        request.init.replace(tzinfo=None),
        model="gfs",
        product="pgrb2.0p25",
        fxx=request.fxx,
        save_dir=RAW_DIR,
        verbose=False,
    )
    # Downloads only the matching GRIB messages (HTTP byte ranges), not the full file.
    grib_path = herbie.download(GFS_SEARCH)

    datasets = [crop_to_bbox(ds).load() for ds in cfgrib.open_datasets(grib_path)]
    profiles, single = split_hypercubes(datasets)
    profiles.to_netcdf(profile_path)
    single.to_netcdf(single_path)
    # The global GRIB subset is ~170 MB; the cropped NetCDF files are what we keep.
    for leftover in grib_path.parent.glob(f"*{grib_path.name.split('__')[-1]}*"):
        leftover.unlink()
    print(f"saved {request.stem}  valid {request.valid:%Y-%m-%d %H}Z")
    return [profile_path, single_path]


def download_with_retries(request: ForecastRequest, attempts: int = 3, base_delay_s: float = 10.0) -> bool:
    """Retry transient network failures with exponential backoff (10s, 20s, ...)."""
    for attempt in range(1, attempts + 1):
        try:
            download(request)
            return True
        except Exception as error:  # Herbie wraps network errors in generic exceptions
            # A failed transfer can leave a truncated subset that Herbie would reuse.
            for partial in (RAW_DIR / "gfs" / f"{request.init:%Y%m%d}").glob(f"subset_*f{request.fxx:03d}*"):
                partial.unlink()
            print(f"fail  {request.stem} attempt {attempt}/{attempts}: {error}")
            if attempt < attempts:
                time.sleep(base_delay_s * 2 ** (attempt - 1))
    return False


def main() -> None:
    which = sys.argv[1] if len(sys.argv) > 1 else "event"
    requests = {"event": event_requests, "control": control_requests}[which]()
    print(f"{len(requests)} GFS files to fetch ({which})")
    failed = [r.stem for r in requests if not download_with_retries(r)]
    if failed:
        print(f"{len(failed)} file(s) failed: {', '.join(failed)}")
        sys.exit(1)
    print("all files downloaded")


if __name__ == "__main__":
    main()
