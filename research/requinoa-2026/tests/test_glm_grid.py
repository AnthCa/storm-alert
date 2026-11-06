import pandas as pd

from requinoa_2026.abi_grid import LATS, LONS
from requinoa_2026.glm_grid import flashes_per_cell


def test_flashes_are_counted_in_their_cell_and_outside_ones_dropped():
    lat, lon = float(LATS[3]), float(LONS[5])
    flashes = pd.DataFrame({"lat": [lat, lat + 0.01, -10.0], "lon": [lon, lon, -70.0]})
    grid = flashes_per_cell(flashes)
    assert grid[3, 5] == 2
    assert grid.sum() == 2
