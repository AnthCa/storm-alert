import numpy as np
import pandas as pd
import xarray as xr

from requinoa_2026.realtime import classify, cold_cells, cold_history, complete_bins, public_level, source_health
from test_false_alarms import jumping_counts, tops, ts


def flat_counts() -> pd.Series:
    return pd.Series(10, index=jumping_counts().index)


def test_recent_jump_with_cold_top_is_severe():
    level, alerts = classify(tops(-45.0), jumping_counts(), at=ts("19:50"))
    assert (level, alerts) == ("severe", [ts("19:40")])


def test_alert_expires_after_thirty_minutes():
    assert classify(tops(-45.0), jumping_counts(), at=ts("20:30"))[0] == "deep_convection"


def test_cold_tops_without_jump_are_deep_convection():
    assert classify(tops(-45.0), flat_counts(), at=ts("19:50"))[0] == "deep_convection"


def test_warm_tops_are_quiet():
    assert classify(tops(-30.0), jumping_counts(), at=ts("19:50"))[0] == "quiet"


def glm_files(start: str, end: str, skip: tuple[str, ...] = ()) -> list[pd.Timestamp]:
    """Start times of the 20-second GLM files in [start, end), minus `skip`."""
    starts = pd.date_range(ts(start), ts(end), freq="20s", inclusive="left")
    return [t for t in starts if t not in {ts(x) for x in skip}]


EMPTY = pd.DataFrame(columns=["time", "lat", "lon"])


def test_partial_bins_are_dropped():
    counts = complete_bins(EMPTY, ts("19:02"), ts("19:33:20"), glm_files("19:00", "19:33:20"))
    assert counts.index.tolist() == [ts("19:05"), ts("19:10"), ts("19:15"), ts("19:20"), ts("19:25")]
    assert counts.sum() == 0


def test_bins_with_missing_glm_files_are_unknown_not_zero():
    files = glm_files("19:00", "19:30", skip=("19:10:00", "19:10:20"))
    counts = complete_bins(EMPTY, ts("19:00"), ts("19:30"), files)
    assert counts.isna().tolist() == [False, False, True, False, False, False]


def health_for(files: list[pd.Timestamp], abi_count: int = 3) -> dict:
    abi = [ts("19:00:20") + i * pd.Timedelta("10min") for i in range(abi_count)]
    counts = complete_bins(EMPTY, ts("19:00"), ts("19:35"), files)
    return source_health(abi, files, counts, ts("19:00"), ts("19:35"))


def test_complete_recent_data_is_healthy():
    health = health_for(glm_files("19:00", "19:35"))
    assert health["state"] == "healthy", health["problems"]
    assert public_level("quiet", health) == "quiet"


def test_glm_gap_degrades_and_quiet_becomes_unknown():
    health = health_for(glm_files("19:00", "19:35", skip=("19:20:00", "19:20:20")))
    assert health["state"] == "degraded"
    assert "glm_incomplete" in health["problems"]
    assert public_level("quiet", health) == "unknown"
    assert public_level("severe", health) == "severe"


def test_missing_abi_scan_degrades():
    health = health_for(glm_files("19:00", "19:35"), abi_count=1)
    assert "abi_incomplete" in health["problems"]


def test_late_glm_degrades():
    files = glm_files("19:00", "19:20")
    counts = complete_bins(EMPTY, ts("19:00"), ts("19:20"), files)
    health = source_health([ts("19:00:20"), ts("19:10:20"), ts("19:20:20")], files, counts, ts("19:00"), ts("19:35"))
    assert "glm_late" in health["problems"]


def abi_scans(temps_c: list[list[float]]) -> xr.Dataset:
    """One-row ABI crops (three pixels ~1 km apart), one scan per list, 10 minutes apart."""
    lat = np.full((1, 3), -34.3)
    lon = np.array([[-70.80, -70.79, -70.78]])
    times = pd.date_range("2026-10-26T19:00", periods=len(temps_c), freq="10min").values
    bt = np.array(temps_c).reshape(len(temps_c), 1, 3) + 273.15
    return xr.Dataset(
        {"brightness_temp_k": (("time", "y", "x"), bt)},
        coords={"time": times, "lat": (("y", "x"), lat), "lon": (("y", "x"), lon)},
    )


def test_cold_cells_keep_the_coldest_pixel_per_cell():
    cells = cold_cells(abi_scans([[-40.0, -45.0, -20.0]]).isel(time=0))
    assert len(cells) == 1
    assert cells[0][2] == -45.0


def test_scan_without_cold_tops_has_no_cells():
    assert cold_cells(abi_scans([[-20.0, -10.0, 0.0]]).isel(time=0)) == []


def test_history_skips_the_latest_scan_and_keeps_the_last_three():
    history = cold_history(abi_scans([[-40.0] * 3, [-20.0] * 3, [-41.0] * 3, [-42.0] * 3, [-43.0] * 3]))
    assert [h["time_utc"] for h in history] == [
        "2026-10-26T19:10:00+00:00",
        "2026-10-26T19:20:00+00:00",
        "2026-10-26T19:30:00+00:00",
    ]
    assert history[0]["cells"] == []
    assert history[-1]["cells"][0][2] == -42.0
