from datetime import datetime, timedelta, timezone

from requinoa_2026.push import choose, direction, mark, payload, plan

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


# A phone's places as sender_places returns them.
HOME = {**RANCAGUA, "place_id": 10, "slot": 0}
SCHOOL = {**RANCAGUA, "place_id": 11, "slot": 1, "lat": -34.19, "lon": -70.76}  # ~3 km from home
PARENTS = {**RANCAGUA, "place_id": 12, "slot": 2, "lat": -34.58, "lon": -70.99, "radius_km": 10}


def test_nearby_places_share_one_notice():
    planned = plan([HOME, SCHOOL], status(cold_pixels=COLD_SOUTH), NOW)
    assert [(p["slot"], n.kind, send) for p, n, send in planned] == [(0, "storm", True), (1, "storm", False)]


def test_distant_places_each_get_their_notice():
    cold_parents = [[-34.62, -70.99, -44.0], [-34.62, -70.98, -41.0], [-34.63, -70.99, -40.0]]
    planned = plan([HOME, PARENTS], status(cold_pixels=COLD_SOUTH + cold_parents), NOW)
    assert [(p["slot"], send) for p, _, send in planned] == [(0, True), (2, True)]
    assert planned[1][1].title.startswith("Nubes de tormenta a 4 km")


def test_severe_goes_once_per_phone_without_a_place():
    severe = status(level="severe", episode_start_utc="2026-10-26T19:40:00+00:00")
    planned = plan([HOME, PARENTS], severe, NOW)
    assert [send for _, _, send in planned] == [True, False]
    assert payload(HOME, planned[0][1])["place"] is None


def test_payload_names_the_place_by_slot_only():
    notification = choose(SCHOOL, status(cold_pixels=COLD_SOUTH), NOW)
    assert payload(SCHOOL, notification) == {
        "title": notification.title,
        "body": notification.body,
        "tag": "storm",
        "url": "https://miranubes.vercel.app/",
        "place": 1,
    }
