from datetime import date

import numpy as np
import pandas as pd
import xarray as xr

from requinoa_2026.storm_outlook import best_cape, block_flashes, complete_days, daily_forecast, regional, tally


def hourly(start: str, codes: list[int], cape: list[float]) -> pd.DataFrame:
    return pd.DataFrame({"time": pd.date_range(start, periods=len(codes), freq="h", tz="UTC"), "code": codes, "cape": cape})


def test_a_day_is_the_local_day_in_chile():
    # 02:00 UTC on 27 Oct is 23:00 on 26 Oct in Chile (UTC-3): the storm belongs to the 26th.
    codes = [3] * 23 + [95] + [3] * 24  # the thunderstorm hour is 02:00 UTC on the 27th
    table = daily_forecast(hourly("2026-10-26T03:00", codes, [100.0] * 48))
    assert bool(table.loc[date(2026, 10, 26), "code"]) is True
    assert bool(table.loc[date(2026, 10, 27), "code"]) is False


def test_days_with_missing_hours_are_left_out():
    table = daily_forecast(hourly("2026-10-26T03:00", [3] * 10, [0.0] * 10))
    assert table.empty


def test_daily_cape_is_the_highest_of_the_day():
    cape = [0.0] * 12 + [650.0] + [0.0] * 11
    table = daily_forecast(hourly("2026-10-26T03:00", [3] * 24, cape))
    assert table.loc[date(2026, 10, 26), "cape"] == 650.0


def test_block_counts_the_town_cell_and_its_neighbours_only():
    lats, lons = np.round(np.arange(-34.45, -33.9, 0.1), 2), np.round(np.arange(-71.05, -70.5, 0.1), 2)
    grid = np.zeros((1, lats.size, lons.size), dtype=int)
    grid[0, 2, 2] = 1  # the town's cell
    grid[0, 3, 3] = 2  # a neighbour
    grid[0, 0, 0] = 50  # two cells away: outside the block
    flashes = xr.DataArray(grid, dims=("time", "lat", "lon"), coords={"time": [pd.Timestamp("2026-10-26T20:00")], "lat": lats, "lon": lons})
    assert block_flashes(flashes, lats[2], lons[2]).tolist() == [3]


def test_a_local_day_needs_both_of_its_utc_days():
    have = {date(2026, 10, 26), date(2026, 10, 27)}
    assert complete_days(date(2026, 10, 26), date(2026, 10, 28), have) == [date(2026, 10, 26)]


def test_tally_and_ratios():
    forecast = pd.Series([True, True, False, False])
    truth = pd.Series([True, False, True, False])
    t = tally(forecast, truth)
    assert (t["hits"], t["misses"], t["false_alarms"]) == (1, 1, 1)
    assert (t["pod"], t["far"]) == (0.5, 0.5) and abs(t["csi"] - 1 / 3) < 1e-9


def test_best_cape_is_the_candidate_with_the_highest_csi():
    dev = pd.DataFrame({"cape": [50.0, 450.0, 800.0, 900.0], "lightning": [False, False, True, True]})
    assert best_cape(dev) in (500, 750)  # both split the days perfectly
    assert best_cape(dev) == 500  # the first of equals


def test_region_takes_the_strongest_forecast_and_any_lightning():
    u = pd.DataFrame(
        {
            "day": [date(2026, 10, 26)] * 2,
            "town": ["Rancagua", "Rengo"],
            "code": [False, True],
            "cape": [200.0, 650.0],
            "lightning": [True, False],
            "season": ["warm", "warm"],
        }
    )
    row = regional(u).iloc[0]
    assert (bool(row.code), row.cape, bool(row.lightning)) == (True, 650.0, True)
