from datetime import datetime, timedelta, timezone

from requinoa_2026.push import choose, direction, mark

NOW = datetime(2026, 10, 26, 20, 32, tzinfo=timezone.utc)
RANCAGUA = {"id": 1, "lat": -34.17, "lon": -70.74, "radius_km": 25, "last_notified": {}}


def status(**overrides) -> dict:
    base = {
        "data_until_utc": "2026-10-26T20:30:00+00:00",
        "health": {"state": "healthy"},
        "level": "quiet",
        "episode_start_utc": None,
        "center": [-34.29, -70.82],
        "radius_km": 50.0,
        "cold_pixels": [],
        "flash_cells_30min": [],
    }
    return {**base, **overrides}


# Three cold pixels ~12 km south of Rancagua.
COLD_SOUTH = [[-34.28, -70.74, -45.0], [-34.285, -70.745, -41.0], [-34.28, -70.735, -39.0]]


def test_direction():
    assert direction(-34.17, -70.74, -34.28, -70.74) == "sur"
    assert direction(-34.17, -70.74, -34.17, -70.6) == "este"


def test_quiet_sends_nothing():
    assert choose(RANCAGUA, status(), NOW) is None


def test_storm_within_radius():
    notification = choose(RANCAGUA, status(cold_pixels=COLD_SOUTH), NOW)
    assert notification.kind == "storm"
    assert notification.title == "Nubes de tormenta a 12 km al sur"
    assert "no es un aviso oficial" in notification.body


def test_one_or_two_flickering_pixels_are_not_a_storm():
    assert choose(RANCAGUA, status(cold_pixels=COLD_SOUTH[:2]), NOW) is None


def test_storm_outside_radius_is_ignored():
    far = [[lat - 0.5, lon, t] for lat, lon, t in COLD_SOUTH]
    assert choose(RANCAGUA, status(cold_pixels=far), NOW) is None


def test_storm_waits_an_hour_between_notifications():
    recent = {**RANCAGUA, "last_notified": {"storm": (NOW - timedelta(minutes=40)).isoformat()}}
    assert choose(recent, status(cold_pixels=COLD_SOUTH), NOW) is None
    old = {**RANCAGUA, "last_notified": {"storm": (NOW - timedelta(minutes=70)).isoformat()}}
    assert choose(old, status(cold_pixels=COLD_SOUTH), NOW).kind == "storm"


def test_close_recent_lightning_beats_storm():
    flashes = [[-34.25, -70.74, 4.0]]  # ~9 km south, 4 min before 20:30 UTC
    notification = choose(RANCAGUA, status(cold_pixels=COLD_SOUTH, flash_cells_30min=flashes), NOW)
    assert notification.kind == "lightning"
    assert notification.title == "Rayo a 9 km al sur"
    assert "17:26" in notification.body  # 20:26 UTC in Chile


def test_old_or_far_lightning_is_ignored():
    flashes = [[-34.25, -70.74, 20.0], [-34.6, -70.74, 1.0]]
    assert choose(RANCAGUA, status(flash_cells_30min=flashes), NOW) is None


def test_severe_once_per_episode():
    severe = status(level="severe", episode_start_utc="2026-10-26T19:40:00+00:00")
    first = choose(RANCAGUA, severe, NOW)
    assert first.kind == "severe"
    after = {**RANCAGUA, "last_notified": mark({}, first, severe, NOW)}
    assert choose(after, severe, NOW + timedelta(minutes=10)) is None


def test_severe_skips_testers_far_from_the_alert_area():
    far = {**RANCAGUA, "lat": -35.4, "lon": -71.9, "radius_km": 10}
    assert choose(far, status(level="severe", episode_start_utc="2026-10-26T19:40:00+00:00"), NOW) is None


def test_stale_or_unavailable_data_sends_nothing():
    assert choose(RANCAGUA, status(cold_pixels=COLD_SOUTH), NOW + timedelta(minutes=40)) is None
    assert choose(RANCAGUA, status(cold_pixels=COLD_SOUTH, health={"state": "unavailable"}), NOW) is None
