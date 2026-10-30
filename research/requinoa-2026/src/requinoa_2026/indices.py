"""Severe-weather indices for tornado-favorable environments, from GFS profiles.

Southern Hemisphere note: cyclonically rotating supercells here are the
LEFT movers, and their storm-relative helicity is NEGATIVE. Formulas built in
the US (STP) expect positive helicity for the dangerous case, so we use the
left-mover storm motion and flip the sign of SRH before feeding them.
"""

from dataclasses import dataclass

import metpy.calc as mpcalc
import numpy as np
import xarray as xr
from metpy.units import units

from requinoa_2026.config import PROFILE_TOP_HPA

# Normalization constants from Sherburn & Parker (2014), as reproduced in
# Dodson (NWS IWX, 2015) and ECSS 2019-139.
SHERB_SHEAR_03KM = 26.0  # m/s
SHERB_SHEAR_EFFECTIVE = 27.0  # m/s
SHERB_LLLR = 5.2  # K/km, 0-3 km lapse rate
SHERB_LR75 = 5.6  # K/km, 700-500 hPa lapse rate


@dataclass
class Profile:
    """A vertical sounding at one grid point, surface first, top last."""

    pressure: np.ndarray  # hPa
    height_agl: np.ndarray  # m above ground
    temperature: np.ndarray  # degC
    dewpoint: np.ndarray  # degC
    u: np.ndarray  # m/s
    v: np.ndarray  # m/s


def extract_profile(profiles: xr.Dataset, single: xr.Dataset, lat: float, lon: float) -> Profile:
    """Build a surface-based sounding at the grid point nearest to (lat, lon).

    GFS writes values at every pressure level, even those below ground (e.g.
    1000 hPa over the Andes foothills), so levels with pressure greater than
    the surface pressure are dropped and the 2 m / 10 m values become the
    bottom of the profile.
    """
    point = dict(latitude=lat, longitude=lon % 360, method="nearest")
    pl = profiles.sel(**point)
    sf = single.sel(**point)

    surface_pressure = float(sf["sp_surface"]) / 100.0  # Pa -> hPa
    terrain = float(sf["orog_surface"])
    above_ground = (
        (pl.isobaricInhPa.values < surface_pressure)
        & (pl.gh.values > terrain)
        # Same top for every file, so event and control profiles are comparable.
        & (pl.isobaricInhPa.values >= PROFILE_TOP_HPA)
    )

    pressure = pl.isobaricInhPa.values[above_ground]
    temperature = pl.t.values[above_ground] - 273.15
    dewpoint = (
        mpcalc.dewpoint_from_relative_humidity(
            temperature * units.degC, np.clip(pl.r.values[above_ground], 1, 100) * units.percent
        )
        .to("degC")
        .magnitude
    )

    return Profile(
        pressure=np.concatenate([[surface_pressure], pressure]),
        height_agl=np.concatenate([[0.0], pl.gh.values[above_ground] - terrain]),
        temperature=np.concatenate([[float(sf["t2m_heightAboveGround"]) - 273.15], temperature]),
        dewpoint=np.concatenate([[float(sf["d2m_heightAboveGround"]) - 273.15], dewpoint]),
        u=np.concatenate([[float(sf["u10_heightAboveGround"])], pl.u.values[above_ground]]),
        v=np.concatenate([[float(sf["v10_heightAboveGround"])], pl.v.values[above_ground]]),
    )


def lapse_rate(height_bottom_m, temp_bottom, height_top_m, temp_top) -> float:
    """Temperature drop per km going up (K/km). Positive means cooling with height."""
    return (temp_bottom - temp_top) / ((height_top_m - height_bottom_m) / 1000.0)


def sherb(shear_ms: float, lllr: float, lr75: float, shear_norm: float = SHERB_SHEAR_03KM) -> float:
    """SHERB composite (Sherburn & Parker 2014). Values near or above 1 are of interest."""
    return (shear_ms / shear_norm) * (lllr / SHERB_LLLR) * (lr75 / SHERB_LR75)


def southern_hemisphere_srh(srh_total: float) -> float:
    """Express SH helicity so that 'dangerous' is positive, like US formulas expect."""
    return -srh_total


def compute_indices(profile: Profile) -> dict[str, float]:
    p = profile.pressure * units.hPa
    z = profile.height_agl * units.m
    t = profile.temperature * units.degC
    td = profile.dewpoint * units.degC
    u = profile.u * units("m/s")
    v = profile.v * units("m/s")

    sbcape, sbcin = mpcalc.surface_based_cape_cin(p, t, td)
    mlcape, mlcin = mpcalc.mixed_layer_cape_cin(p, t, td, depth=100 * units.hPa)

    lcl_pressure, _ = mpcalc.lcl(p[0], t[0], td[0])
    lcl_height = np.interp(-lcl_pressure.m_as("hPa"), -profile.pressure, profile.height_agl)

    def shear(depth_m: float) -> float:
        du, dv = mpcalc.bulk_shear(p, u, v, height=z, depth=depth_m * units.m)
        return float(np.hypot(du.m_as("m/s"), dv.m_as("m/s")))

    _, left_mover, _ = mpcalc.bunkers_storm_motion(p, u, v, z)

    def srh(depth_m: float) -> float:
        _, _, total = mpcalc.storm_relative_helicity(
            z, u, v, depth_m * units.m, storm_u=left_mover[0], storm_v=left_mover[1]
        )
        return southern_hemisphere_srh(float(total.m_as("m^2/s^2")))

    t_3km = np.interp(3000.0, profile.height_agl, profile.temperature)
    lllr = lapse_rate(0.0, profile.temperature[0], 3000.0, t_3km)
    z700, z500 = (np.interp(-lvl, -profile.pressure, profile.height_agl) for lvl in (700.0, 500.0))
    t700, t500 = (np.interp(-lvl, -profile.pressure, profile.temperature) for lvl in (700.0, 500.0))
    lr75 = lapse_rate(z700, t700, z500, t500)

    shear_03 = shear(3000)
    srh_01 = srh(1000)
    shear_06 = shear(6000)
    stp = mpcalc.significant_tornado(
        sbcape, lcl_height * units.m, srh_01 * units("m^2/s^2"), shear_06 * units("m/s")
    )

    return {
        "sbcape": float(sbcape.m_as("J/kg")),
        "sbcin": float(sbcin.m_as("J/kg")),
        # MetPy integrates the NET area from the lowest LFC to the highest EL, so a
        # stable layer between two thin buoyant layers can yield negative CAPE.
        # Physically that means "no usable CAPE", so it is floored at 0, the same
        # way MetPy floors positive CIN (MetPy #1190).
        "mlcape": max(float(mlcape.m_as("J/kg")), 0.0),
        "lcl_height_m": float(lcl_height),
        "shear_01_ms": shear(1000),
        "shear_03_ms": shear_03,
        "shear_06_ms": shear_06,
        "srh_01": srh_01,
        "srh_03": srh(3000),
        "lllr_kkm": float(lllr),
        "lr75_kkm": float(lr75),
        "sherbs3": sherb(shear_03, lllr, lr75),
        "stp": float(np.asarray(stp.m_as("dimensionless")).squeeze()),
    }
