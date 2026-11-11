from datetime import datetime, timedelta, timezone

from requinoa_2026.push import choose, direction, ended_quietly, mark, payload, plan

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
    assert notification.title == "Nubes muy frías a 12 km al sur"
    assert "Sin rayos: puede llover o no" in notification.body
    assert "no es un aviso oficial" in notification.body


def test_storm_is_called_a_storm_only_with_lightning_in_the_radius():
    old_flash = [[-34.3, -70.74, 25.0]]  # ~14 km south, 25 min ago: too old for a lightning notice
    notification = choose(RANCAGUA, status(cold_pixels=COLD_SOUTH, flash_cells_30min=old_flash), NOW)
    assert notification.kind == "storm"
    assert notification.title == "Tormenta con rayos a 12 km al sur"


def test_one_or_two_flickering_pixels_are_not_a_storm():
    assert choose(RANCAGUA, status(cold_pixels=COLD_SOUTH[:2]), NOW) is None


def test_storm_outside_radius_is_ignored():
    far = [[lat - 0.5, lon, t] for lat, lon, t in COLD_SOUTH]
    assert choose(RANCAGUA, status(cold_pixels=far), NOW) is None


def told(place: dict, notification, state: dict, at: datetime = NOW) -> dict:
    """The place after it was sent `notification`."""
    return {**place, "last_notified": mark(place["last_notified"], notification, state, at)}


def test_cold_cloud_that_stays_is_told_once():
    cold = status(cold_pixels=COLD_SOUTH)
    after = told(RANCAGUA, choose(RANCAGUA, cold, NOW), cold)
    assert choose(after, cold, NOW) is None
    later = NOW + timedelta(hours=3)
    assert choose(after, status(cold_pixels=COLD_SOUTH, data_until_utc=later.isoformat()), later) is None


def test_a_new_cold_episode_waits_an_hour_after_the_last_one():
    recent = {**RANCAGUA, "last_notified": {"storm": (NOW - timedelta(minutes=40)).isoformat(), "open": None}}
    assert choose(recent, status(cold_pixels=COLD_SOUTH), NOW) is None
    old = {**RANCAGUA, "last_notified": {"storm": (NOW - timedelta(minutes=70)).isoformat(), "open": None}}
    assert choose(old, status(cold_pixels=COLD_SOUTH), NOW).kind == "storm"


def test_cold_cloud_is_told_again_once_when_lightning_joins_it():
    cold = status(cold_pixels=COLD_SOUTH)
    after_cold = told(RANCAGUA, choose(RANCAGUA, cold, NOW), cold)
    with_flash = status(cold_pixels=COLD_SOUTH, flash_cells_30min=[[-34.3, -70.74, 25.0]])
    upgrade = choose(after_cold, with_flash, NOW)
    assert upgrade.title == "Tormenta con rayos a 12 km al sur"
    assert choose(told(after_cold, upgrade, with_flash), with_flash, NOW) is None


def test_cold_episode_ends_quietly_when_the_cloud_is_gone():
    cold = status(cold_pixels=COLD_SOUTH)
    after = told(RANCAGUA, choose(RANCAGUA, cold, NOW), cold)
    assert not ended_quietly(after, cold)
    assert ended_quietly(after, status())
    assert choose(after, status(), NOW) is None  # nothing to say: there was no lightning
    assert not ended_quietly(after, status(health={"state": "degraded"}))
    assert not ended_quietly(RANCAGUA, status())


CLOSE_FLASH = [[-34.25, -70.74, 4.0]]  # ~9 km south, 4 min before 20:30 UTC


def test_lightning_that_goes_on_is_repeated_hourly_at_most():
    state = status(flash_cells_30min=CLOSE_FLASH)
    after = told(RANCAGUA, choose(RANCAGUA, state, NOW), state)
    assert choose(after, state, NOW + timedelta(minutes=20)) is None
    later = NOW + timedelta(minutes=61)
    again = status(flash_cells_30min=CLOSE_FLASH, data_until_utc=later.isoformat())
    assert choose(after, again, later).kind == "lightning"


def test_all_clear_after_thirty_minutes_without_flashes_in_reach():
    state = status(flash_cells_30min=CLOSE_FLASH)
    after = told(RANCAGUA, choose(RANCAGUA, state, NOW), state)
    # A flash 20 km away is inside the 25 km radius: not clear yet.
    assert choose(after, status(flash_cells_30min=[[-34.35, -70.74, 28.0]]), NOW) is None
    clear = choose(after, status(), NOW)
    assert (clear.kind, clear.title) == ("clear", "Ya no hay rayos cerca")
    assert "30 minutos sin rayos a menos de 25 km" in clear.body
    assert choose(told(after, clear, status()), status(), NOW) is None


def test_no_all_clear_on_incomplete_lightning_data():
    state = status(flash_cells_30min=CLOSE_FLASH)
    after = told(RANCAGUA, choose(RANCAGUA, state, NOW), state)
    assert choose(after, status(health={"state": "degraded"}), NOW) is None


def test_no_all_clear_for_cloud_that_never_had_lightning():
    cold = status(cold_pixels=COLD_SOUTH)
    after = told(RANCAGUA, choose(RANCAGUA, cold, NOW), cold)
    assert choose(after, status(), NOW) is None


def test_cold_cloud_is_not_news_after_a_lightning_notice():
    state = status(cold_pixels=COLD_SOUTH, flash_cells_30min=CLOSE_FLASH)
    after = told(RANCAGUA, choose(RANCAGUA, state, NOW), state)
    quiet_flash = status(cold_pixels=COLD_SOUTH, flash_cells_30min=[[-34.25, -70.74, 15.0]])
    assert choose(after, quiet_flash, NOW) is None


def test_close_recent_lightning_beats_storm():
    notification = choose(RANCAGUA, status(cold_pixels=COLD_SOUTH, flash_cells_30min=CLOSE_FLASH), NOW)
    assert notification.kind == "lightning"
    assert notification.title == "Rayo a unos 9 km al sur"
    assert "Detectado a las" in notification.body
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
    assert planned[1][1].title.startswith("Nubes muy frías a 4 km")


def zones(**levels) -> list[dict]:
    centers = {"Rancagua": [-34.17, -70.74], "San Fernando": [-34.58, -70.99], "Pichilemu": [-34.39, -72.0]}
    return [
        {"name": n, "center": c, "level": levels.get(n.replace(" ", "_"), "quiet"),
         "episode_start_utc": "2026-10-26T19:40:00+00:00" if levels.get(n.replace(" ", "_")) == "severe" else None}
        for n, c in centers.items()
    ]


def test_severe_names_the_zone_of_the_nearest_town():
    state = status(zones=zones(Rancagua="severe"))
    notification = choose(RANCAGUA, state, NOW)
    assert notification.kind == "severe" and "cerca de Rancagua" in notification.body
    assert choose(told(RANCAGUA, notification, state), state, NOW) is None
    coast = {**RANCAGUA, "lat": -34.39, "lon": -71.95}
    assert choose(coast, state, NOW) is None  # Pichilemu's zone is quiet


def test_a_place_gets_its_own_zone_not_requinoas():
    # Requínoa's own fields say severe; the place's nearest town (Pichilemu) is quiet.
    state = status(level="severe", episode_start_utc="2026-10-26T19:40:00+00:00", zones=zones())
    coast = {**RANCAGUA, "lat": -34.39, "lon": -71.95}
    assert choose(coast, state, NOW) is None


def test_two_zones_severe_at_once_are_two_notices_and_one_zone_is_one():
    state = status(zones=zones(Rancagua="severe", San_Fernando="severe"))
    planned = plan([HOME, SCHOOL, PARENTS], state, NOW)
    assert [(p["slot"], send) for p, _, send in planned] == [(0, True), (1, False), (2, True)]


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
