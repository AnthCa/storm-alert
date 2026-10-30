import pandas as pd

from requinoa_2026.realtime import classify, complete_bins
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


def test_partial_bins_are_dropped():
    empty = pd.DataFrame(columns=["time", "lat", "lon"])
    counts = complete_bins(empty, ts("19:02"), ts("19:33:20"))
    assert counts.index.tolist() == [ts("19:05"), ts("19:10"), ts("19:15"), ts("19:20"), ts("19:25")]
    assert counts.sum() == 0
