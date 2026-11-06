import numpy as np
import pandas as pd
import xarray as xr

from requinoa_2026 import rain_chance


def test_hour_is_made_of_the_two_half_hours_before_its_end(tmp_path, monkeypatch):
    times = pd.date_range("2025-06-10", periods=48, freq="30min")
    rain = np.zeros((48, 1, 1), dtype="float32")
    rain[2, 0, 0] = 1.0  # 01:00-01:30 at 1 mm/h
    rain[3, 0, 0] = 3.0  # 01:30-02:00 at 3 mm/h
    xr.Dataset(
        {"rain_mm_h": (("time", "lat", "lon"), rain)},
        coords={"time": times, "lat": [-34.15], "lon": [-70.75]},
    ).to_netcdf(tmp_path / "2025-06-10.nc", engine="h5netcdf")
    monkeypatch.setattr(rain_chance, "IMERG_DIR", tmp_path)

    hours = rain_chance.observed(-34.17, -70.74, pd.Timestamp("2025-06-10").date(), pd.Timestamp("2025-06-11").date())

    assert hours[pd.Timestamp("2025-06-10T02:00")] == 2.0
    assert hours[pd.Timestamp("2025-06-10T01:00")] == 0.0
    assert len(hours) == 24


def test_points_are_rounded_like_the_app():
    assert rain_chance.coarse(-34.17) == -34.15
    assert rain_chance.coarse(-70.74) == -70.75
