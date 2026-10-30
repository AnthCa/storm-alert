"""How often does the satellite alert rule fire near Requínoa on ordinary days?

Run with:  uv run requinoa-false-alarms

The rule was fixed BEFORE looking at other days, so it is not tuned to them:
an alert fires in a 5-minute GLM bin when, within RADIUS_KM of Requínoa,
  1. there is a 2-sigma lightning jump, and
  2. the coldest cloud top is <= -38 C in the latest scan or the one before.
"""

from datetime import datetime, timedelta, timezone

import pandas as pd
import s3fs

from requinoa_2026.config import DATA_DIR, PROCESSED_DIR
from requinoa_2026.goes import download_abi, download_glm
from requinoa_2026.satellite_analysis import DEEP_CONVECTION_K, cloud_top_series, flash_counts, lightning_jumps

RADIUS_KM = 50.0
COLD_TOP_C = DEEP_CONVECTION_K - 273.15  # -38 C
EPISODE_GAP = pd.Timedelta("60min")
# 15:00-24:00 UTC is 12:00-21:00 local time (UTC-3), the usual convective window.
WINDOW_START_HOUR_UTC = 15
WINDOW_HOURS = 9
DAYS = [datetime(2026, 10, day, tzinfo=timezone.utc) for day in range(1, 29)]
EVENT_DAY = datetime(2026, 10, 26, tzinfo=timezone.utc)


def alert_times(tops: pd.DataFrame, counts: pd.Series) -> list[pd.Timestamp]:
    """5-minute bins where the rule fires (see module docstring)."""
    jumps = lightning_jumps(counts)
    alerts = []
    for bin_start in jumps[jumps].index:
        recent = tops[tops.time < bin_start + pd.Timedelta("5min")].tail(2)
        if not recent.empty and recent.min_bt_c.min() <= COLD_TOP_C:
            alerts.append(bin_start)
    return alerts


def episodes(alerts: list[pd.Timestamp]) -> list[pd.Timestamp]:
    """Collapse alerts closer than EPISODE_GAP into one; returns each episode's first alert."""
    firsts = []
    for t in sorted(alerts):
        if not firsts or t - last > EPISODE_GAP:
            firsts.append(t)
        last = t
    return firsts


def evaluate_day(day: datetime, fs: s3fs.S3FileSystem) -> dict:
    start = day + timedelta(hours=WINDOW_START_HOUR_UTC)
    end = start + timedelta(hours=WINDOW_HOURS)
    tag = f"{day:%Y%m%d}_{WINDOW_START_HOUR_UTC:02d}z{WINDOW_HOURS}h"
    abi = download_abi(start, end, PROCESSED_DIR / f"goes19_c13_{tag}.nc", fs)
    tops = cloud_top_series(abi, radius_km=RADIUS_KM)
    row = {"date": f"{day:%Y-%m-%d}", "min_top_c": round(tops.min_bt_c.min(), 1), "flashes": 0, "alerts": []}

    # Without a cold top the rule cannot fire, so lightning is not downloaded.
    if tops.min_bt_c.min() > COLD_TOP_C:
        return row

    flashes = download_glm(start, end, PROCESSED_DIR / f"goes19_glm_flashes_{tag}.csv", fs)
    if flashes.empty:
        return row
    counts = flash_counts(flashes, radius_km=RADIUS_KM)
    row["flashes"] = int(counts.sum())
    row["alerts"] = episodes(alert_times(tops, counts))
    return row


def main() -> None:
    fs = s3fs.S3FileSystem(anon=True)
    rows = []
    for day in DAYS:
        row = evaluate_day(day, fs)
        marker = "  <- tornado day" if day == EVENT_DAY else ""
        times = ", ".join(f"{t:%H:%M}Z" for t in row["alerts"]) or "-"
        print(f"{row['date']}  coldest {row['min_top_c']:6.1f} C  flashes {row['flashes']:5d}  episodes: {times}{marker}")
        rows.append({**row, "episodes": len(row["alerts"]), "alerts": times})

    table = pd.DataFrame(rows)
    out = DATA_DIR / "results" / "satellite_false_alarms.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    table.to_csv(out, index=False)

    others = table[table.date != f"{EVENT_DAY:%Y-%m-%d}"]
    print(
        f"\nOther days with at least one alert episode: {(others.episodes > 0).sum()} of {len(others)}"
        f" ({others.episodes.sum()} episodes in total) -> {out}"
    )


if __name__ == "__main__":
    main()
