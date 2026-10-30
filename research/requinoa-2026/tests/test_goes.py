from datetime import datetime, timezone

import numpy as np
import pytest

from requinoa_2026.goes import fixed_grid_to_latlon, latlon_to_fixed_grid, scan_start

# GOES-East projection as written in the ABI files (GOES-19 at 75.2 W).
PROJ = {
    "semi_major_axis": 6378137.0,
    "semi_minor_axis": 6356752.31414,
    "perspective_point_height": 35786023.0,
    "longitude_of_projection_origin": -75.2,
}


def test_sub_satellite_point_is_on_the_equator_below_the_satellite():
    lat, lon = fixed_grid_to_latlon(0.0, 0.0, PROJ)
    assert lat == pytest.approx(0.0, abs=1e-9)
    assert lon == pytest.approx(-75.2, abs=1e-9)


def test_pug_reference_example():
    # Worked example from the GOES-R Product User Guide (sec. 4.2.8.1), which
    # uses the GOES-East position at 75.0 W.
    proj = {**PROJ, "longitude_of_projection_origin": -75.0}
    lat, lon = fixed_grid_to_latlon(-0.024052, 0.095340, proj)
    assert lat == pytest.approx(33.846162, abs=1e-4)
    assert lon == pytest.approx(-84.690932, abs=1e-4)


def test_round_trip_through_requinoa():
    x, y = latlon_to_fixed_grid(-34.29, -70.82, PROJ)
    lat, lon = fixed_grid_to_latlon(x, y, PROJ)
    assert lat == pytest.approx(-34.29, abs=1e-6)
    assert lon == pytest.approx(-70.82, abs=1e-6)


def test_points_off_the_earth_disk_are_nan():
    lat, lon = fixed_grid_to_latlon(0.2, 0.2, PROJ)
    assert np.isnan(lat) and np.isnan(lon)


def test_scan_start_parses_julian_day_and_time():
    key = "noaa-goes19/ABI-L2-CMIPF/2026/299/20/OR_ABI-L2-CMIPF-M6C13_G19_s20262992030202_e2026299_c2026299.nc"
    assert scan_start(key) == datetime(2026, 10, 26, 20, 30, 20, tzinfo=timezone.utc)


class FakeS3:
    """Lists one folder; any other prefix does not exist yet, like a just-started hour."""

    def __init__(self, existing_prefix: str, names: list[str]):
        self.existing_prefix, self.names = existing_prefix, names

    def ls(self, prefix):
        if prefix != self.existing_prefix:
            raise FileNotFoundError(prefix)
        return [f"{prefix}/{name}" for name in self.names]


def test_hourly_keys_tolerates_a_folder_that_does_not_exist_yet():
    from datetime import datetime, timezone

    from requinoa_2026.goes import hourly_keys

    name = "OR_GLM-L2-LCFA_G19_s20263030159400_e20263030200000_c20263030200020.nc"
    fs = FakeS3("noaa-goes19/GLM-L2-LCFA/2026/303/01", [name])
    start = datetime(2026, 10, 30, 1, 30, tzinfo=timezone.utc)
    end = datetime(2026, 10, 30, 2, 5, tzinfo=timezone.utc)
    assert hourly_keys("GLM-L2-LCFA", start, end, fs) == [f"noaa-goes19/GLM-L2-LCFA/2026/303/01/{name}"]
