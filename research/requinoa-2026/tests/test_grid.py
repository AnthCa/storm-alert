import numpy as np
import pytest
import xarray as xr

from requinoa_2026.grid import distance_km, max_near


def test_distance_one_degree_of_latitude_is_about_111_km():
    assert distance_km(-34.0, -70.0, -35.0, -70.0) == pytest.approx(111.2, abs=0.5)


def test_max_near_ignores_points_outside_the_radius():
    lats = np.array([-34.0, -34.25, -34.5])
    lons = np.array([289.0, 289.25, 289.5])  # GFS 0..360 longitudes
    values = np.array([[1.0, 1.0, 1.0], [1.0, 2.0, 1.0], [1.0, 1.0, 99.0]])
    grid = xr.Dataset({"sherbs3": (("latitude", "longitude"), values)}, coords={"latitude": lats, "longitude": lons})

    # Centre on the middle point; the 99 in the corner is ~38 km away.
    assert max_near(grid, -34.25, 289.25 - 360, radius_km=20)["sherbs3"] == 2.0
    assert max_near(grid, -34.25, 289.25 - 360, radius_km=50)["sherbs3"] == 99.0


def test_max_near_skips_nan_points():
    grid = xr.Dataset(
        {"stp": (("latitude", "longitude"), [[np.nan, 0.5]])},
        coords={"latitude": [-34.25], "longitude": [289.0, 289.25]},
    )
    assert max_near(grid, -34.25, -70.875, radius_km=50)["stp"] == 0.5
