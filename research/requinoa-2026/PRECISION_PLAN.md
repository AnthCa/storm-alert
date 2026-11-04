# Precision plan: every data source that can make Miranubes more accurate

Status: plan, 31 October 2026. Nothing here is integrated yet. Every source marked
**verify** must be checked for free access, history and terms before we depend on it.

Precision means four different things, and each needs its own data:

| # | Question | Today | Measured by |
|---|----------|-------|-------------|
| P1 | Did we see the storms that happened? | Cold tops (ABI band 13) + GLM flashes | POD (hit rate) |
| P2 | Were our storms real? | Same | FAR (false-alarm ratio), CSI |
| P3 | Did we tell severe from ordinary storms? | Fixed thresholds from the Requínoa case | POD/FAR on severe reports only |
| P4 | Were distance, motion and arrival estimates right? | Centroid tracking over 3 scans | Arrival-time error (minutes), direction error |

Ground rule (unchanged): thresholds are never tuned on the episodes we score. Seasons
are split into a development set and a held-out test set before any tuning, and the
held-out score is the one we publish.

---

## 1. Ground truth: did a storm really happen there?

Without ground truth no other improvement can be measured, so this comes first.

| Source | What it gives | Access | Use |
|--------|---------------|--------|-----|
| **INIA Agromet** (agrometeorologia.cl) | Rain, wind gusts, temperature; dense network across O'Higgins farmland | Public web; **verify** bulk/historical download | Rain at the station = storm passed. Best spatial coverage of the valley |
| **DMC automatic stations** (climatologia.meteochile.gob.cl) | Rain, gusts, pressure every few minutes; official | Free registration for the data services; **verify** | Official reference for POD/FAR; gust fronts and pressure jumps mark severe cells |
| **DGA hydrometeorological network** | Real-time rain gauges, many in the foothills and Andes | Public (DGA real-time portal); **verify** format | Covers the cordillera, where INIA and DMC are sparse |
| **CR2 data explorer** (Centro de Ciencia del Clima y la Resiliencia) | Quality-controlled daily station records | Free download | Long, clean history for the climatology of storm days |
| **NASA IMERG** (GPM) | Rain estimate every 30 min, ~10 km grid, since 2000 | Free with an Earthdata account | Validates every GOES-19 season at once, including places without stations |
| **JAXA GSMaP** | Hourly rain estimate, near real time | Free registration | Second, independent satellite rain estimate to cross-check IMERG |
| **SEC power-outage data** (Superintendencia de Electricidad y Combustibles) | Customers without power by commune and hour | Public; **verify** history | Proxy for wind and lightning damage: outages that jump during a storm |
| **DMC warnings and alerts** | Official storm warnings, times and areas | Public website and social accounts; collect by hand at first | Compare lead time with the official warning; never compete with it |
| **SENAPRED alerts** | Alert declarations by commune | Public website and social accounts | Same, and records of damage |
| **Regional media** (El Rancagüino WP API, TV O'Higgins) | Hail, damage, flooding, timestamps | El Rancagüino WP REST API (planned) | Severe-event reports (P3); already agreed |
| **In-app "¿Qué ves ahora?" reports** | Rain, hail, thunder, wind from users at a place and time | Our own (planned) | Fine-grained ground truth, grows with users |
| **ground_truth/*.csv** | Our own logged observations | Local | Already started on 31 Oct 2026 |

## 2. Detection: see storms better (P1, P2)

All of these come from the satellite we already read, so they cost no new dependency.

| Source | What it gives | Access | Use |
|--------|---------------|--------|-----|
| **GOES-19 ABI L2 rainfall rate (RRQPEF)** | Rain-rate estimate every 10 min | NOAA open data on AWS (`noaa-goes19`) | Separates cold cirrus (no rain) from raining cores; cuts false alarms |
| **GOES-19 ABI cloud-top height (ACHAF) and phase (ACTPF)** | Top height in km; ice vs liquid | Same | A deep, ice-topped cloud is a storm; a thin cold anvil is not |
| **ABI water-vapour minus IR difference** (bands 8/9 − 13) | Positive values mark overshooting tops | Same bands, computed by us | Overshooting tops are a known severe-storm signature (P3) |
| **ABI visible band 2** (0.5 km, daytime) | Cloud texture | Same | Bubbling overshooting tops by day; 4× finer than band 13 |
| **Persistence and cluster filter** | Ignore single pixels that appear for one scan | Our own logic | Fixes the 31 Oct jumps (3 km → 48 km); already on tomorrow's list |
| **Terrain model** (Copernicus DEM, free) | Height of the ground | Free download | Per-zone rules: Andes, valley and coast behave differently |

## 3. Severity: tell severe from ordinary (P3)

| Source | What it gives | Access | Use |
|--------|---------------|--------|-----|
| **GLM flash-rate history** | Flashes per minute per cell | Already ingested | **Lightning jump** (a sudden rise in flash rate) is a published precursor of severe weather, minutes ahead |
| **ERA5 reanalysis** | CAPE, wind shear, freezing level, hourly since 1940 | Free with a Copernicus CDS account | Environment of past storms: was the day able to produce severe storms? |
| **GFS and ECMWF open data** | Forecast CAPE and shear | Free (NOAA AWS; ECMWF open data) | Live "today the atmosphere can make severe storms" context, paired with what the satellite sees |
| **GOES-19 stability indices (DSIF)** | CAPE, lifted index from the satellite | NOAA AWS | Clear-sky only, but updates every hour ahead of storms |
| **Radiosondes**: Santo Domingo (85586) and Mendoza (87418) | Measured CAPE and shear, twice a day | University of Wyoming archive, free | Ground truth for the model CAPE we use |

## 4. Motion and arrival (P4)

| Source | What it gives | Access | Use |
|--------|---------------|--------|-----|
| **GOES-19 derived motion winds (DMWF)** | Wind vectors from cloud motion | NOAA AWS | Steering wind for storms: a second estimate of direction and speed |
| **Model steering wind** (GFS/ECMWF, 500–700 hPa) | Wind that carries storms | Free | Sanity check for our centroid tracking |
| **Cell tracking with overlap** | Follow each cell, not just the nearest pixel | Our own logic | Arrival time per cell instead of per nearest pixel |
| **Station timestamps** (INIA/DMC) | When rain and gusts actually arrived | Section 1 | Measures arrival-time error in minutes |

## 5. Radar (to investigate)

Central Chile has no operational public weather radar. Mendoza has radars run for hail
control and Argentina's SMN has a national network (SINARAME). **Verify** whether any
covers the Andes east of O'Higgins and whether data are public. If so, it would be the
best possible check of what is inside the clouds on the Argentine side.

## 6. Sources we will not use (and why)

| Source | Reason |
|--------|--------|
| Blitzortung | Community lightning network with sparse sensors in Chile and non-commercial terms; GLM already covers us |
| WWLLN, Vaisala GLD360 | Paid |
| Personal weather stations (Weather Underground) | API no longer free; uneven quality |
| ProbSevere, MRMS | United States only |

---

## Order of work

**Phase A: measure where we stand (first, starts tomorrow)**
1. Collector for El Rancagüino reports; finish the 31 Oct ground-truth log.
2. Download INIA and DMC station rain for every GOES-19 season (verify access first).
3. Download IMERG for the same seasons.
4. Score the current algorithm (2026.10-r1) unchanged: POD, FAR, CSI, per zone (valley, coast, Andes), plus arrival-time error.
5. Freeze the development / held-out season split.
6. **Deliverable: publish the reliability section** (only with measured numbers; see below).

**Phase B: cheap detection gains (same satellite, no new dependency)**
7. Persistence and cluster filter.
8. Rainfall rate and cloud-top height to drop non-raining cold cirrus.
9. Score again on the held-out seasons.

**Phase C: severity**
10. Lightning-jump detector from GLM.
11. Overshooting-top detector (water vapour minus IR).
12. ERA5 CAPE and shear for past episodes; GFS/ECMWF for live context.
13. Score severe-only POD/FAR.

**Phase D: motion and arrival**
14. Cell tracking; derived motion winds as a second estimate.
15. Arrival-time error against station timestamps.

**Phase E: people as sensors**
16. "¿Qué ves ahora?" button; reports feed ground truth.

## Frozen on 2026-11-01 (scoring s1)

Fixed before any season was scored; see `score.py` for the exact rules.

- Development set: 2025-04-07 to 2026-03-31. Changes to the algorithm are tried here.
- Held-out set: 2026-04-01 to 2026-10-31, plus every later season. Published scores
  come only from here, and never feed back into tuning.
- Ground truth for s1: NASA IMERG (Final where available, else Late), ≥ 1 mm/h for
  rain and ≥ 5 mm/h for heavy rain, any cell of the zone, per half-hour.
- Detection: any cloud top ≤ −38 °C in the zone during the half-hour (2026.10-r1).
- Zones by ground height (AWS Terrain Tiles): Andes ≥ 1000 m; coast west of 71.35° W;
  valley the rest. 95% intervals by resampling whole days.
- Data: `requinoa-abi-grid` and `requinoa-imerg` from 2025-04-07 (GOES-19 became
  GOES-East that day).

## Results: scoring s1, held-out 2026-04-01 to 2026-10-31 (run 2026-11-03)

214 days (183 cold-season, 31 warm-season: October only), IMERG Late for all of it.
Unit: one zone per half-hour. Detection is the cold-cloud test alone (≤ −38 °C), not the
severe alert. 95% intervals from day-block resampling.

| Truth | Zone | POD | FAR | CSI |
|---|---|---|---|---|
| Rain ≥ 1 mm/h | all | 0.84 (0.79–0.87) | 0.53 (0.47–0.60) | 0.43 (0.37–0.48) |
| Heavy ≥ 5 mm/h | all | 0.95 (0.92–0.98) | 0.77 (0.70–0.83) | 0.23 (0.17–0.30) |
| Rain ≥ 1 mm/h | Andes | 0.91 (0.87–0.93), cold season | 0.48 | 0.50 |
| Rain ≥ 1 mm/h | valley | 0.85 (0.79–0.90), cold season | 0.57 | 0.40 |
| Rain ≥ 1 mm/h | coast | 0.78 (0.71–0.85), cold season | 0.61 | 0.36 |

Reading: when it rained, there were cold cloud tops over the zone most of the time
(almost always for heavy rain); but about half of the half-hours with cold tops had no
rain of 1 mm/h, the false notices seen from the ground on 2026-11-02. The coast does
worst. Most of the sample is winter frontal rain, not summer convection, and the warm
season is one month: its intervals are wide. Full table: `data/results/score_s1_held-out.csv`.

## Reliability section in the app

Published at the end of Phase A, and never before: no estimated or placeholder numbers.

Never a single "accuracy" percentage. Storms are rare, so a system that always says "no
storm" would be right ~95% of the time and useless. We show three numbers instead.

**For everyone** (Info → "¿Qué tan confiable es?"), in plain words, errors included:
- "De cada 10 tormentas que trajeron lluvia, Miranubes vio N." (POD)
- "De cada 10 avisos, M fueron nubes que no llovieron." (FAR)
- "En promedio vio la tormenta X minutos antes de que llegara." (lead time)
- Sample, period, sources and date: "Medido en N tardes de tormenta entre A y B,
  comparado con lluvia de la NASA y estaciones de INIA. Actualizado el …"
- Where it does worse, stated plainly (for example, by zone).

**For authorities and press** (a separate technical page, also the basis of the
DMC/SENAPRED one-pager):
- POD, FAR and CSI with confidence intervals, on the held-out seasons only.
- The same per zone: valley, coast, Andes.
- Arrival-time error in minutes.
- Method, ground-truth sources, seasons, algorithm version.

The numbers are recomputed and the date updated whenever the algorithm version changes.

Each phase ends with a published score, so the DMC and SENAPRED one-pager can quote
measured numbers instead of promises.
