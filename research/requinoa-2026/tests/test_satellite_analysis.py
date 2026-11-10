import pandas as pd

from requinoa_2026.grid import distance_km
from requinoa_2026.satellite_analysis import GOES19_LON, lightning_jumps, parallax_correct


def test_lightning_jump_flags_a_sudden_rise_after_steady_activity():
    counts = pd.Series([10, 11, 10, 12, 11, 10, 40, 41])
    jumps = lightning_jumps(counts)
    assert jumps.tolist() == [False] * 6 + [True, False]


def test_no_jump_without_enough_history():
    counts = pd.Series([0, 0, 50])
    assert not lightning_jumps(counts).any()


def test_no_jump_at_negligible_rates():
    counts = pd.Series([0, 0, 0, 0, 0, 0, 3])  # 0.6 flashes/min: below min_rate
    assert not lightning_jumps(counts).any()


def test_a_handful_of_flashes_after_a_quiet_spell_is_not_a_jump():
    # 10 Nov 2026: an ordinary thunderstorm; zero history made any rise pass "2 sigma".
    counts = pd.Series([0, 0, 0, 2, 1, 2, 5, 6, 5, 8])
    assert not lightning_jumps(counts).any()


def test_a_strong_rise_after_a_quiet_spell_is_a_jump():
    # 26 Oct 2026, the bins before the Requínoa tornado.
    counts = pd.Series([0, 0, 0, 0, 0, 0, 6, 20, 25, 46])
    assert lightning_jumps(counts).tolist() == [False] * 6 + [True, True, False, True]


def test_no_parallax_below_the_satellite():
    lat, lon = parallax_correct(0.0, GOES19_LON)
    assert abs(lat) < 1e-9 and abs(lon - GOES19_LON) < 1e-9


def test_parallax_moves_ohiggins_tops_towards_the_satellite():
    lat, lon = parallax_correct(-34.29, -70.82)
    assert lat > -34.29  # north, towards the equator
    assert lon < -70.82  # west, towards 75.2 W
    assert 8 < distance_km(-34.29, -70.82, lat, lon) < 15
