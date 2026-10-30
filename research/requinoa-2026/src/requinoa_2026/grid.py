"""Indices over the whole O'Higgins grid, and their maximum near a location."""

import warnings
from pathlib import Path

import numpy as np
import xarray as xr

from requinoa_2026.indices import compute_indices, extract_profile

# Over the high Andes the surface sits above 700 hPa, so the 700-500 hPa lapse
# rate (and SHERB) is undefined there. Those points are left as NaN.
MIN_SURFACE_PRESSURE_HPA = 800.0
EARTH_RADIUS_KM = 6371.0


def distance_km(lat1, lon1, lat2, lon2):
    """Great-circle (haversine) distance; works on scalars or numpy arrays."""
    lat1, lon1, lat2, lon2 = map(np.radians, (lat1, lon1, lat2, lon2))
    a = np.sin((lat2 - lat1) / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin((lon2 - lon1) / 2) ** 2
    return 2 * EARTH_RADIUS_KM * np.arcsin(np.sqrt(a))


def compute_grid(profiles: xr.Dataset, single: xr.Dataset) -> xr.Dataset:
    """Run compute_indices at every grid point; returns one variable per index."""
    lats, lons = profiles.latitude.values, profiles.longitude.values
    fields: dict[str, np.ndarray] = {}
    surface_pressure_hpa = single["sp_surface"].values / 100.0

    for i, lat in enumerate(lats):
        for j, lon in enumerate(lons):
            if surface_pressure_hpa[i, j] < MIN_SURFACE_PRESSURE_HPA:
                continue
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")  # MetPy warns on weak/odd soundings
                values = compute_indices(extract_profile(profiles, single, float(lat), float(lon)))
            for name, value in values.items():
                fields.setdefault(name, np.full((lats.size, lons.size), np.nan))[i, j] = value

    return xr.Dataset(
        {name: (("latitude", "longitude"), data) for name, data in fields.items()},
        coords={"latitude": lats, "longitude": lons, "valid_time": profiles.valid_time.values},
    )


def max_near(grid: xr.Dataset, lat: float, lon: float, radius_km: float) -> dict[str, float]:
    """Maximum of each index among grid points within radius_km of (lat, lon)."""
    lat2d, lon2d = np.meshgrid(grid.latitude.values, grid.longitude.values, indexing="ij")
    lon2d = np.where(lon2d > 180, lon2d - 360, lon2d)
    nearby = distance_km(lat, lon, lat2d, lon2d) <= radius_km
    return {name: float(np.nanmax(np.where(nearby, grid[name].values, np.nan))) for name in grid.data_vars}


def load_pair(profile_path: Path) -> tuple[xr.Dataset, xr.Dataset]:
    single_path = profile_path.with_name(profile_path.name.replace("_profiles", "_single"))
    return xr.open_dataset(profile_path), xr.open_dataset(single_path)
