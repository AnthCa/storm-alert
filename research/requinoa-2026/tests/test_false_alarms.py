import pandas as pd

from requinoa_2026.false_alarms import alert_times, episodes


def ts(hhmm: str) -> pd.Timestamp:
    return pd.Timestamp(f"2026-10-26 {hhmm}", tz="UTC")


def jumping_counts() -> pd.Series:
    """Steady activity, then a jump in the 19:40 bin."""
    index = pd.date_range(ts("19:10"), periods=8, freq="5min")
    return pd.Series([10, 11, 10, 12, 11, 10, 40, 41], index=index)


def tops(min_bt_c: float) -> pd.DataFrame:
    return pd.DataFrame({"time": [ts("19:30:20"), ts("19:40:20")], "min_bt_c": [min_bt_c, min_bt_c]})


def test_alert_fires_when_jump_coincides_with_cold_top():
    assert alert_times(tops(-45.0), jumping_counts()) == [ts("19:40")]


def test_no_alert_when_cloud_tops_are_warm():
    assert alert_times(tops(-30.0), jumping_counts()) == []


def test_alerts_within_an_hour_are_one_episode():
    alerts = [ts("19:40"), ts("19:55"), ts("20:30"), ts("22:00")]
    assert episodes(alerts) == [ts("19:40"), ts("22:00")]
