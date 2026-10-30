"""Was the Requínoa storm visible from GOES-19 before the tornado?

Run with:  uv run requinoa-satellite
"""

import numpy as np
import pandas as pd
import xarray as xr

from requinoa_2026.config import EVENT_LAT, EVENT_LON, EVENT_TIME_UTC, PROCESSED_DIR
from requinoa_2026.grid import distance_km

# Cloud tops colder than -38 C (homogeneous freezing) are a common marker of
# deep convection in IR imagery.
DEEP_CONVECTION_K = 235.0
GLM_BIN = "5min"
GOES19_LON = -75.2
# Typical top of a deep convective cloud in central Chile in spring.
CLOUD_TOP_HEIGHT_M = 10_000.0
EARTH_RADIUS_M = 6_371_000.0
GEO_ORBIT_RADIUS_M = 42_164_000.0


def parallax_correct(lat, lon, height_m: float = CLOUD_TOP_HEIGHT_M, sat_lon: float = GOES19_LON):
    """Move apparent cloud-top positions to the ground point below the cloud.

    ABI geolocates every pixel on the Earth's surface, so a cloud top seen
    obliquely appears displaced away from the satellite (about 10 km to the
    south-west over O'Higgins). The cloud sits on the same line of sight, at
    `height_m`, closer to the satellite. Spherical Earth is accurate enough here.
    """
    phi, lam, lam0 = np.radians(lat), np.radians(lon), np.radians(sat_lon)
    ground = EARTH_RADIUS_M * np.stack([np.cos(phi) * np.cos(lam), np.cos(phi) * np.sin(lam), np.sin(phi)])
    sat = GEO_ORBIT_RADIUS_M * np.array([np.cos(lam0), np.sin(lam0), 0.0]).reshape(3, *([1] * np.ndim(lat)))
    los = (sat - ground) / np.linalg.norm(sat - ground, axis=0)
    # Distance t along the line of sight where |ground + t * los| = R + h.
    along = np.sum(ground * los, axis=0)
    t = -along + np.sqrt(along**2 + (EARTH_RADIUS_M + height_m) ** 2 - EARTH_RADIUS_M**2)
    cloud = ground + t * los
    lat_c = np.degrees(np.arcsin(cloud[2] / np.linalg.norm(cloud, axis=0)))
    lon_c = np.degrees(np.arctan2(cloud[1], cloud[0]))
    return lat_c, lon_c


def cloud_top_series(abi: xr.Dataset, radius_km: float) -> pd.DataFrame:
    """Per scan: coldest cloud top near the event, its location, and cold-pixel count."""
    dist = distance_km(EVENT_LAT, EVENT_LON, abi.lat.values, abi.lon.values)
    near = dist <= radius_km
    rows = []
    for t in abi.time.values:
        bt = abi.brightness_temp_k.sel(time=t).values
        masked = np.where(near, bt, np.nan)
        coldest = np.nanargmin(masked)
        rows.append(
            {
                "time": pd.Timestamp(t).tz_localize("UTC"),
                "min_bt_c": float(np.nanmin(masked)) - 273.15,
                "coldest_km_from_requinoa": float(dist.flat[coldest]),
                "pixels_below_minus38c": int(np.sum(masked < DEEP_CONVECTION_K)),
            }
        )
    series = pd.DataFrame(rows)
    series["cooling_c_per_10min"] = -series.min_bt_c.diff()
    return series


def flash_counts(flashes: pd.DataFrame, radius_km: float) -> pd.Series:
    dist = distance_km(EVENT_LAT, EVENT_LON, flashes.lat.values, flashes.lon.values)
    near = flashes[dist <= radius_km]
    counts = near.set_index("time").resample(GLM_BIN).size()
    full_range = pd.date_range(flashes.time.min().floor(GLM_BIN), flashes.time.max().ceil(GLM_BIN), freq=GLM_BIN)
    return counts.reindex(full_range, fill_value=0)


def lightning_jumps(counts: pd.Series, sigma: float = 2.0, history: int = 5, min_rate: float = 1.0) -> pd.Series:
    """Simplified "2-sigma" lightning jump (after Schultz et al. 2009).

    A jump is flagged when the change in flash rate exceeds `sigma` standard
    deviations of the changes over the previous `history` bins, and the rate is
    at least `min_rate` flashes per minute (so noise at near-zero rates is ignored).
    """
    rate = counts / 5.0  # flashes per minute in 5-minute bins
    change = rate.diff()
    threshold = sigma * change.shift(1).rolling(history, min_periods=history).std()
    return (change > threshold) & (rate >= min_rate)


def main() -> None:
    abi = xr.open_dataset(PROCESSED_DIR / "goes19_c13_20261026.nc")
    flashes = pd.read_csv(PROCESSED_DIR / "goes19_glm_flashes_20261026.csv", parse_dates=["time"])

    tops = cloud_top_series(abi, radius_km=50)
    print(f"Cloud tops within 50 km of Requinoa (tornado ~{EVENT_TIME_UTC:%H:%M} UTC)")
    print(tops.round(1).to_string(index=False))

    print(f"\nGLM flashes in O'Higgins box: {len(flashes)}")
    table = pd.DataFrame({f"{r}km": flash_counts(flashes, r) for r in (30, 50, 100)})
    table["jump_50km"] = lightning_jumps(table["50km"])
    print(table.to_string())


if __name__ == "__main__":
    main()
