from datetime import datetime, timezone

import numpy as np
import pytest
import xarray as xr

from requinoa_2026.config import EVENT_LAT, EVENT_LON, ForecastRequest, event_requests, lead_hours
from requinoa_2026.download import crop_to_bbox, split_hypercubes


def utc(*args) -> datetime:
    return datetime(*args, tzinfo=timezone.utc)


def gfs_like_grid() -> xr.Dataset:
    """Global 0.25-degree grid in GFS conventions: lat north->south, lon 0..360."""
    lat = np.arange(90, -90.25, -0.25)
    lon = np.arange(0, 360, 0.25)
    data = np.zeros((lat.size, lon.size))
    return xr.Dataset({"t": (("latitude", "longitude"), data)}, coords={"latitude": lat, "longitude": lon})


def test_lead_hours_counts_whole_hours():
    assert lead_hours(utc(2026, 10, 23, 0), utc(2026, 10, 26, 18)) == 90


def test_lead_hours_rejects_partial_hours():
    with pytest.raises(ValueError):
        lead_hours(utc(2026, 10, 26, 0), utc(2026, 10, 26, 20, 30))


def test_event_requests_target_only_event_valid_times():
    valid_times = {r.valid for r in event_requests()}
    assert valid_times == {utc(2026, 10, 26, 18), utc(2026, 10, 26, 21)}


def test_event_requests_include_the_analysis():
    assert ForecastRequest(utc(2026, 10, 26, 18), 0) in event_requests()


def test_crop_converts_negative_longitudes_to_gfs_convention():
    cropped = crop_to_bbox(gfs_like_grid())
    assert float(cropped.longitude.min()) == pytest.approx(287.5)
    assert float(cropped.longitude.max()) == pytest.approx(290.5)
    assert float(cropped.latitude.max()) == pytest.approx(-33.5)
    assert float(cropped.latitude.min()) == pytest.approx(-35.5)


def test_crop_keeps_the_event_location():
    cropped = crop_to_bbox(gfs_like_grid())
    point = cropped.sel(latitude=EVENT_LAT, longitude=EVENT_LON % 360, method="nearest")
    assert abs(float(point.latitude) - EVENT_LAT) <= 0.125
    assert abs(float(point.longitude) - EVENT_LON % 360) <= 0.125


def test_split_hypercubes_keeps_same_named_fields_from_different_levels_apart():
    grid = {"latitude": [-34.0], "longitude": [289.0]}
    surface_cape = xr.Dataset(
        {"cape": (("latitude", "longitude"), [[100.0]], {"GRIB_typeOfLevel": "surface"})},
        coords={**grid, "surface": 0.0},
    )
    layer_cape = xr.Dataset(
        {"cape": (("latitude", "longitude"), [[50.0]], {"GRIB_typeOfLevel": "pressureFromGroundLayer"})},
        coords={**grid, "pressureFromGroundLayer": 18000.0},
    )
    profile = xr.Dataset(
        {"t": (("isobaricInhPa", "latitude", "longitude"), [[[280.0]], [[260.0]]])},
        coords={**grid, "isobaricInhPa": [850, 500]},
    )

    profiles, single = split_hypercubes([surface_cape, layer_cape, profile])

    assert "t" in profiles
    assert single["cape_surface"].item() == 100.0
    assert single["cape_pressureFromGroundLayer"].item() == 50.0
