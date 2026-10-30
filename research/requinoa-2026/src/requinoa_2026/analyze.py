"""Summarize indices near Requínoa for event runs and control days.

Run with:  uv run requinoa-analyze
Writes data/results/{event,control}_near_requinoa.csv
"""

import pandas as pd

from requinoa_2026.config import (
    DATA_DIR,
    EVENT_LAT,
    EVENT_LON,
    PROCESSED_DIR,
    control_requests,
    event_requests,
)
from requinoa_2026.grid import compute_grid, load_pair, max_near

RADIUS_KM = 50.0
RESULTS_DIR = DATA_DIR / "results"


def summarize(requests) -> pd.DataFrame:
    rows = []
    for request in requests:
        profile_path = PROCESSED_DIR / f"{request.stem}_profiles.nc"
        if not profile_path.exists():
            print(f"missing {request.stem}, skipped")
            continue
        grid = compute_grid(*load_pair(profile_path))
        rows.append(
            {
                "init_utc": request.init,
                "valid_utc": request.valid,
                "lead_h": request.fxx,
                **max_near(grid, EVENT_LAT, EVENT_LON, RADIUS_KM),
            }
        )
    return pd.DataFrame(rows)


def main() -> None:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    for name, requests in (("event", event_requests()), ("control", control_requests())):
        table = summarize(requests)
        path = RESULTS_DIR / f"{name}_near_requinoa.csv"
        table.to_csv(path, index=False)
        print(f"{name}: {len(table)} rows -> {path}")


if __name__ == "__main__":
    main()
