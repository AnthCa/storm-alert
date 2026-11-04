from datetime import date, datetime
from urllib.parse import unquote

from requinoa_2026.imerg import half_hour_start, subset_url, window


def test_window_covers_the_box():
    lon, lat = window({"lat_min": -35.95, "lat_max": -33.45, "lon_min": -71.95, "lon_max": -68.95})
    # Indices checked against a real subset: they return -71.95..-68.95 and -35.95..-33.45.
    assert (lon.start, lon.stop) == (1080, 1110)
    assert (lat.start, lat.stop) == (540, 565)


def test_subset_url_asks_only_for_the_window():
    url = subset_url("GPM_3IMERGHHE.07", date(2026, 10, 31), "3B-HHR-E.MS.MRG.3IMERG.20261031-S170000-E172959.1020.V07C.HDF5")
    assert "/GPM_3IMERGHHE.07/2026/304/" in url
    assert "/precipitation[0:0][1074:1104][544:564]" in unquote(url)


def test_half_hour_start():
    assert half_hour_start("3B-HHR-E.MS.MRG.3IMERG.20261031-S170000-E172959.1020.V07C.HDF5") == datetime(2026, 10, 31, 17, 0)
