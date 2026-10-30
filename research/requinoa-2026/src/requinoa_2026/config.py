"""Case study constants: where, when, and which GFS fields to fetch."""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"

# Requínoa, O'Higgins. Tornado touched down around 17:30 local time (UTC-3).
EVENT_NAME = "requinoa-2026-10-26"
EVENT_LAT = -34.29
EVENT_LON = -70.82
EVENT_TIME_UTC = datetime(2026, 10, 26, 20, 30, tzinfo=timezone.utc)

# Bounding box around O'Higgins with a margin, in degrees (west is negative).
BBOX = {"lat_min": -35.5, "lat_max": -33.5, "lon_min": -72.5, "lon_max": -69.5}

# Valid times to analyze: pre-storm environment and the hour of the event.
VALID_TIMES_UTC = [
    datetime(2026, 10, 26, 18, tzinfo=timezone.utc),
    datetime(2026, 10, 26, 21, tzinfo=timezone.utc),
]

# Model runs to compare, from 3+ days before the event up to the same day.
INIT_TIMES_UTC = [
    datetime(2026, 10, 23, 0, tzinfo=timezone.utc),
    datetime(2026, 10, 24, 0, tzinfo=timezone.utc),
    datetime(2026, 10, 25, 0, tzinfo=timezone.utc),
    datetime(2026, 10, 26, 0, tzinfo=timezone.utc),
    datetime(2026, 10, 26, 12, tzinfo=timezone.utc),
    datetime(2026, 10, 26, 18, tzinfo=timezone.utc),
]

# GFS outputs hourly forecasts up to this lead time.
MAX_HOURLY_LEAD_H = 120

# Regex over the GRIB2 index. Pressure-level profiles let us compute our own
# indices with MetPy; the single-level fields are GFS's own values, kept as a
# cross-check.
GFS_SEARCH = "|".join(
    [
        # 3-4 digit levels only: 1000..100 hPa. Above 100 hPa adds download time
        # and nothing to convective indices.
        r":(UGRD|VGRD|TMP|HGT|RH):\d{3,4} mb:",
        r":(PRES|HGT):surface:",
        r":(TMP|DPT):2 m above ground:",
        r":(UGRD|VGRD):10 m above ground:",
        r":(CAPE|CIN):surface:",
        r":(CAPE|CIN):180-0 mb above ground:",
        r":HLCY:3000-0 m above ground:",
    ]
)


@dataclass(frozen=True)
class ForecastRequest:
    """One GFS file: a model run (init) plus a lead time in hours (fxx)."""

    init: datetime
    fxx: int

    @property
    def valid(self) -> datetime:
        return self.init + timedelta(hours=self.fxx)

    @property
    def stem(self) -> str:
        return f"gfs_{self.init:%Y%m%d%H}_f{self.fxx:03d}"


def lead_hours(init: datetime, valid: datetime) -> int:
    """Whole hours between a model run and the time it forecasts."""
    delta = valid - init
    hours, remainder = divmod(delta.total_seconds(), 3600)
    if remainder:
        raise ValueError(f"{valid} is not a whole number of hours after {init}")
    return int(hours)


PROFILE_TOP_HPA = 100.0

# Ordinary days to compare against: the 18Z analysis of every October 2026 day
# outside the event window. "Ordinary" means no tornado reported near Requínoa,
# not "no storms anywhere".
CONTROL_HOUR_UTC = 18
CONTROL_EXCLUDED_DAYS = {25, 26, 27}


def control_requests(year: int = 2026, month: int = 10, last_day: int = 28) -> list[ForecastRequest]:
    return [
        ForecastRequest(datetime(year, month, day, CONTROL_HOUR_UTC, tzinfo=timezone.utc), 0)
        for day in range(1, last_day + 1)
        if day not in CONTROL_EXCLUDED_DAYS
    ]


def event_requests() -> list[ForecastRequest]:
    """Every (run, lead time) pair that forecasts one of the event's valid times."""
    requests = []
    for init in INIT_TIMES_UTC:
        for valid in VALID_TIMES_UTC:
            fxx = lead_hours(init, valid)
            if 0 <= fxx <= MAX_HOURLY_LEAD_H:
                requests.append(ForecastRequest(init, fxx))
    return requests
