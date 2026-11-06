from datetime import date

import numpy as np
import pandas as pd
import xarray as xr

from requinoa_2026 import score_lightning


def test_cold_units_need_usable_lightning_and_flashes_count_per_zone(tmp_path, monkeypatch):
    lat, lon = [-34.25, -34.15], [-70.85, -70.75]
    zone = xr.DataArray([["valley", "valley"], ["andes", "andes"]], coords={"lat": lat, "lon": lon}, dims=["lat", "lon"])
    times = pd.to_datetime(["2026-10-26T20:00", "2026-10-26T20:30"])
    flashes = np.zeros((2, 2, 2), dtype="int32")
    flashes[0, 0, 1] = 3  # valley, 20:00
    xr.Dataset(
        {"flashes": (("time", "lat", "lon"), flashes), "glm_files": ("time", np.array([90, 10], dtype="int16"))},
        coords={"time": times, "lat": lat, "lon": lon},
    ).to_netcdf(tmp_path / "2026-10-26.nc", engine="h5netcdf")
    monkeypatch.setattr(score_lightning, "GLM_DIR", tmp_path)
    units = pd.DataFrame(
        {
            "day": date(2026, 10, 26),
            "time": [times[0], times[0], times[1], times[1]],
            "zone": ["valley", "andes", "valley", "andes"],
            "detected": [True, True, True, False],
        }
    )

    out = score_lightning.lightning_units(date(2026, 10, 26), zone, units)

    # 20:30 has only 10 of 90 files: its cold unit is dropped, the not-cold one kept.
    assert list(zip(out.time.dt.strftime("%H:%M"), out.zone)) == [("20:00", "valley"), ("20:00", "andes"), ("20:30", "andes")]
    assert out.lightning.tolist() == [True, False, False]
