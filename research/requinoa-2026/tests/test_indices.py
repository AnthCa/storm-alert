import numpy as np
import pytest
import xarray as xr

from requinoa_2026.indices import (
    Profile,
    compute_indices,
    extract_profile,
    lapse_rate,
    sherb,
    southern_hemisphere_srh,
)


def test_sherb_is_one_at_the_normalization_values():
    assert sherb(26.0, 5.2, 5.6) == pytest.approx(1.0)


def test_sherb_scales_linearly_with_shear():
    assert sherb(52.0, 5.2, 5.6) == pytest.approx(2.0)


def test_lapse_rate_of_standard_atmosphere():
    assert lapse_rate(0.0, 15.0, 3000.0, -4.5) == pytest.approx(6.5)


def test_southern_hemisphere_srh_makes_cyclonic_helicity_positive():
    assert southern_hemisphere_srh(-150.0) == 150.0


def synthetic_gfs(surface_pressure_hpa: float = 950.0, terrain_m: float = 500.0):
    """Tiny one-point GFS-like dataset: 6.5 K/km atmosphere, winds increasing with height."""
    levels = np.array([1000.0, 950.0, 900.0, 850.0, 700.0, 500.0, 300.0])
    heights = np.array([110.0, 540.0, 990.0, 1460.0, 3010.0, 5570.0, 9160.0])
    temps_k = 288.15 - 0.0065 * heights
    grid = {"latitude": [-34.25], "longitude": [289.25]}

    def field(values):
        return (("isobaricInhPa", "latitude", "longitude"), np.asarray(values)[:, None, None])

    profiles = xr.Dataset(
        {
            "gh": field(heights),
            "t": field(temps_k),
            "r": field(np.full(levels.size, 70.0)),
            "u": field(np.linspace(2, 30, levels.size)),
            "v": field(np.linspace(-2, 10, levels.size)),
        },
        coords={**grid, "isobaricInhPa": levels},
    )

    def scalar(value):
        return (("latitude", "longitude"), [[value]])

    single = xr.Dataset(
        {
            "sp_surface": scalar(surface_pressure_hpa * 100),
            "orog_surface": scalar(terrain_m),
            "t2m_heightAboveGround": scalar(288.15 - 0.0065 * terrain_m),
            "d2m_heightAboveGround": scalar(282.0),
            "u10_heightAboveGround": scalar(1.0),
            "v10_heightAboveGround": scalar(0.0),
        },
        coords=grid,
    )
    return profiles, single


def test_extract_profile_drops_levels_below_ground():
    profiles, single = synthetic_gfs(surface_pressure_hpa=950.0, terrain_m=500.0)
    profile = extract_profile(profiles, single, lat=-34.29, lon=-70.82)

    assert profile.pressure[0] == pytest.approx(950.0)
    assert profile.height_agl[0] == 0.0
    assert 1000.0 not in profile.pressure
    assert np.all(np.diff(profile.pressure) < 0), "pressure must decrease upward"
    assert np.all(np.diff(profile.height_agl) > 0), "height must increase upward"


def test_compute_indices_recovers_the_synthetic_lapse_rates():
    profiles, single = synthetic_gfs()
    indices = compute_indices(extract_profile(profiles, single, lat=-34.29, lon=-70.82))

    assert indices["lllr_kkm"] == pytest.approx(6.5, abs=0.2)
    assert indices["lr75_kkm"] == pytest.approx(6.5, abs=0.2)
    assert indices["shear_06_ms"] > indices["shear_01_ms"] > 0
    assert all(np.isfinite(value) for value in indices.values())


def test_profile_fields_have_matching_lengths():
    profiles, single = synthetic_gfs()
    profile = extract_profile(profiles, single, lat=-34.29, lon=-70.82)
    lengths = {len(getattr(profile, name)) for name in Profile.__dataclass_fields__}
    assert len(lengths) == 1
