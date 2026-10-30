# Requínoa 2026: could the tornado have been seen coming?

On **26 October 2026, around 17:30 local time (20:30 UTC)**, a tornado hit
Requínoa in Chile's O'Higgins region. It was rated preliminary EF2 and
damaged about 70 homes. Central Chile has no operational weather radar
covering the area, so nobody issued a warning.

This project asks a narrow question with public, free data: **was there a
usable signal before the tornado, and how often would that signal have fired
on ordinary days?**

**Short answer:**
- The numerical-model approach failed.
- Satellite data (GOES-19 cloud tops plus lightning) showed an intensifying
  storm over Requínoa **about 50 minutes before** the tornado.
- Over October 2026, the same rule fired on 6 other days. Every one of them
  was an officially forecast thunderstorm day, and at least two had confirmed
  hail and damage in Rancagua.
- The signal detects **severe storms**, not tornadoes specifically.

## Experiment 1: environment from the GFS model (negative)

The idea was to compute the tornado ingredients used in Chilean research
(SHERBS3, STP, shear, CAPE) from GFS 0.25° forecasts near Requínoa, and
compare the event day with 25 ordinary October afternoons.

| Index (max within 50 km, 26 Oct 18 UTC) | Event | Rank among 25 days | Control median |
|---|---|---|---|
| SHERBS3 | 0.82 | 1 of 25 (**lowest**) | 1.25 |
| 0–3 km shear | 12.5 m/s | 2 of 25 | — |
| Surface-based CAPE | 1115 J/kg | 20 of 25 | — |

GFS did not see a high-shear, low-CAPE environment on the event day. Only one
run, initialised 90 h before, produced SHERBS3 above 1.

The likely reasons:
- Afternoon low-level lapse rates are about 8.5 K/km almost every day in the
  Central Valley, which inflates SHERB.
- A 25 km model cannot resolve the valley.

This is a single case, so it is not a verdict on the indices.

## Experiment 2: GOES-19 satellite (positive)

Two GOES-19 products cover Chile:
- **ABI band 13**, the 10.3 µm cloud-top temperature, every 10 min.
- **GLM**, the lightning flashes, every 20 s.

The table shows the coldest cloud top and the lightning rate within 50 km of
Requínoa:

| UTC | Coldest top | Flashes per 5-min bin | |
|---|---|---|---|
| 19:20 | −25.0 °C | 0, 0 | |
| 19:30 | −33.2 °C | 0, 0 | cooling 8 °C in 10 min |
| 19:40 | −38.2 °C | **6**, **20** | **lightning jumps** at 19:40 and 19:45 |
| 19:50 | −45.9 °C | 25, **46** | jump at 19:55 |
| 20:00 | −44.6 °C | 51, 52 | |
| 20:10 | −47.0 °C | **99**, 83 | jump at 20:10 |
| 20:20 | −48.8 °C | 112, 110 | |
| **20:30** | −48.0 °C | 87, 70 | **tornado** |

**Alert rule.** It was fixed before looking at any other day, so it is not
tuned to the result. An alert fires when, within 50 km, both conditions hold:
- there is a *2-sigma lightning jump*, after Schultz et al. 2009;
- a cloud top is at or below −38 °C in the latest two scans.

## Validation: does it cry wolf? (October 2026)

The same rule ran from 12:00 to 21:00 local time on every day from
1 to 28 October.

- **Tornado day:** alert at 16:40 local, 50 minutes ahead.
- **Deep clouds alone discriminate poorly:** 21 of 28 days had tops below −38 °C.
- **The lightning jump does the filtering:** alerts fired on 6 of the other
  27 days, 10 episodes in total.

Each of those 6 days was checked against regional news and official warnings:

| Day | What happened | Verdict |
|---|---|---|
| 8 Oct | Hail in several parts of Rancagua; DMC alert AA176 | ✅ severe storm |
| 13 Oct | Hail and emergencies in Rancagua; 60 homes under damage assessment | ✅ severe storm |
| 20 Oct | Warning for up to 35 mm, storms and hail; preventive climate emergency | 🟡 likely |
| 18 Oct | DMC alert for evening thunderstorms in the O'Higgins valley | 🟡 storm, severity unknown |
| 24 Oct | DMC warning and SENAPRED preventive alert | 🟡 unconfirmed |
| 7 Oct | DMC warning only | ⚪ no information |

None of the alerts fell on a quiet day. However, 13 October had *more*
lightning than the tornado day. The satellite can say "a severe storm is
intensifying here, now", but it cannot say "this one will produce a tornado".

**Limitations:**
- There is one tornado and one month of data.
- The 2 km satellite pixels arrive every 10 minutes.
- The news check used search summaries rather than official SENAPRED damage
  reports.

## Prototype: near-real-time map

`requinoa-realtime` applies the validated rule to the latest GOES-19 data.
Each cycle takes about 30 s. It writes `data/realtime/status.json` and a
Leaflet map, `status.html`, with these features:

- Regional status: quiet, thunderstorm clouds, or **severe-storm alert**.
- Cold cloud tops, **parallax-corrected**. GOES-19 views Chile obliquely, so
  a 10 km cloud top appears about 8 km too far south; after the correction,
  the storm core sits 2 km from Requínoa.
- Lightning from the last 10 minutes.
- A "your location" panel. Viewers can use GPS, tap the map or drag a point,
  and see the distance and direction to the nearest storm. The location is
  computed in the browser and never sent anywhere.

![Replay 5 minutes before the tornado](docs/map-tornado-replay.png)

## Running it

The project needs [uv](https://docs.astral.sh/uv/) and Python 3.12. All data
comes from public AWS buckets (`noaa-gfs-bdp-pds`, `noaa-goes19`), with no
account or API key.

```bash
uv sync
uv run pytest

uv run requinoa-realtime                        # current status
uv run requinoa-realtime --loop                 # refresh every 10 minutes
uv run requinoa-realtime --at 2026-10-26T20:25  # replay 5 min before the tornado

uv run requinoa-download event && uv run requinoa-analyze  # experiment 1 (GFS)
uv run requinoa-goes && uv run requinoa-satellite          # experiment 2 (GOES-19)
uv run requinoa-false-alarms                               # validation (about 1.5 h)
```

| Module | Purpose |
|---|---|
| `config.py` | Event location, time, area and GFS fields |
| `download.py`, `indices.py`, `grid.py`, `analyze.py` | GFS download, tornado indices (SHERBS3, STP), comparison with control days |
| `goes.py` | GOES-19 ABI and GLM access, fixed-grid geolocation |
| `satellite_analysis.py` | Cloud-top series, flash counts, lightning jumps, parallax correction |
| `false_alarms.py` | October validation of the alert rule |
| `realtime.py` | Live status and map |

## References

- Vicencio et al. (2021). The Chilean tornado outbreak of May 2019. *BAMS*.
- Sherburn & Parker (2014). Climatology and ingredients of significant severe
  convection in high-shear, low-CAPE environments. *Weather and Forecasting*.
- Schultz, Petersen & Carey (2009). Preliminary development and evaluation of
  lightning jump algorithms. *J. Appl. Meteor. Climatol.*
- GOES-R Product User Guide, Vol. 5 (ABI fixed-grid navigation).
