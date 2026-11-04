import numpy as np
import pandas as pd
import xarray as xr

from requinoa_2026.abi_grid import LATS, LONS, coldest_per_cell
from requinoa_2026.score import counts, metrics


def units(rows):
    return pd.DataFrame(rows, columns=["rain", "heavy", "detected"])


def test_counts_hits_misses_false_alarms():
    table = units([(True, False, True), (True, True, False), (False, False, True), (False, False, False)])
    assert counts(table, "rain") == {"hits": 1, "misses": 1, "false_alarms": 1}


def test_heavy_false_alarm_only_without_any_rain():
    # Detected light rain is not a false alarm for the heavy score, just not a heavy hit.
    table = units([(True, False, True), (True, True, True)])
    assert counts(table, "heavy") == {"hits": 1, "misses": 0, "false_alarms": 0}


def test_metrics():
    m = metrics({"hits": 6, "misses": 2, "false_alarms": 2})
    assert (m["POD"], m["FAR"], m["CSI"]) == (0.75, 0.25, 0.6)
    assert np.isnan(metrics({"hits": 0, "misses": 0, "false_alarms": 0})["POD"])


def test_coldest_pixel_lands_in_its_cell():
    # A cold pixel at 10 km height moves ~10 km towards the satellite (north-east).
    scan = xr.Dataset(
        {"brightness_temp_k": (("y", "x"), np.array([[273.15 - 50, 273.15 - 5]]))},
        coords={"lat": (("y", "x"), np.array([[-34.33, -34.33]])), "lon": (("y", "x"), np.array([[-70.87, -70.87]]))},
    )
    grid = coldest_per_cell(scan)
    assert grid.shape == (LATS.size, LONS.size)
    i, j = np.argwhere(np.isfinite(grid))[0]
    assert np.isclose(grid[i, j], -50, atol=0.01)
    assert (LATS[i], LONS[j]) in {(-34.25, -70.85), (-34.25, -70.75), (-34.35, -70.85), (-34.35, -70.75)}
