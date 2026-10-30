"""Near-real-time severe-storm status around Requínoa from GOES-19.

Run once:          uv run requinoa-realtime
Every 10 minutes:  uv run requinoa-realtime --loop
Replay a moment:   uv run requinoa-realtime --at 2026-10-26T19:50

Applies the rule validated in false_alarms.py (2-sigma lightning jump plus a
cloud top <= -38 C within RADIUS_KM) to the latest data, and writes
status.json and a Leaflet map (status.html) to data/realtime/.
"""

import argparse
import json
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import pandas as pd
import s3fs
import xarray as xr

from requinoa_2026.config import DATA_DIR, EVENT_LAT, EVENT_LON
from requinoa_2026.false_alarms import COLD_TOP_C, RADIUS_KM, alert_times, episodes
from requinoa_2026.goes import hourly_keys, read_abi_crop, read_glm_flashes, scan_start, with_retries
from requinoa_2026.satellite_analysis import GLM_BIN, cloud_top_series, flash_counts, lightning_jumps, parallax_correct

OUT_DIR = DATA_DIR / "realtime"
# The jump test needs 5 bins of history, the tested bin and one more for the
# first difference (35 min); the rest is margin for GOES file latency.
LOOKBACK = timedelta(minutes=45)
# An alert keeps the status at "severe" for this long after it fires.
ALERT_MEMORY = pd.Timedelta("30min")
CYCLE_S = 600

SCHEMA_VERSION = 2
# Bump whenever the alert rule or its thresholds change (see false_alarms.py).
ALGORITHM_VERSION = "2026.10-r1"

GLM_FILE_S = 20  # one GLM L2 file every 20 s
ABI_SCAN = pd.Timedelta("10min")  # full disk every 10 min
# A 5-minute bin with fewer GLM files than this has no flash count, never a zero.
MIN_BIN_COVERAGE = 14 / 15
# Beyond these delays the newest file is considered late.
MAX_GLM_DELAY = pd.Timedelta("10min")
MAX_ABI_DELAY = pd.Timedelta("25min")
# The jump test reads the last 30 minutes, so gaps there make "quiet" unprovable.
RECENT_BINS = 6


def classify(tops: pd.DataFrame, counts: pd.Series, at: pd.Timestamp) -> tuple[str, list[pd.Timestamp]]:
    """'severe' if the rule fired recently, 'deep_convection' if tops are cold, else 'quiet'.

    Bins without data (NaN) never produce a jump, so missing data can only hide an
    alert, never create one; source_health() then stops that hiding from reading as quiet.
    """
    alerts = [t for t in alert_times(tops, counts) if t >= at - ALERT_MEMORY]
    if alerts:
        return "severe", alerts
    if tops.tail(2).min_bt_c.min() <= COLD_TOP_C:
        return "deep_convection", []
    return "quiet", []


def bin_coverage(glm_starts: list[pd.Timestamp], bins: pd.DatetimeIndex) -> pd.Series:
    """Fraction of the expected GLM files that arrived in each 5-minute bin."""
    expected = pd.Timedelta(GLM_BIN).total_seconds() / GLM_FILE_S
    received = pd.Series(1, index=pd.DatetimeIndex(glm_starts)).resample(GLM_BIN).sum()
    return received.reindex(bins, fill_value=0) / expected


def complete_bins(
    flashes: pd.DataFrame, start: pd.Timestamp, data_end: pd.Timestamp, glm_starts: list[pd.Timestamp]
) -> pd.Series:
    """5-minute flash counts near Requínoa. A bin is zero only if its GLM files arrived;
    a bin with missing files is NaN, because absent data is not absent lightning."""
    bins = pd.date_range(start.ceil(GLM_BIN), data_end.floor(GLM_BIN), freq=GLM_BIN, inclusive="left")
    counts = pd.Series(0.0, index=bins)
    if not flashes.empty:
        counts = flash_counts(flashes, radius_km=RADIUS_KM).reindex(bins, fill_value=0).astype(float)
    return counts.where(bin_coverage(glm_starts, bins) >= MIN_BIN_COVERAGE)


def source_health(
    abi_times: list[pd.Timestamp],
    glm_starts: list[pd.Timestamp],
    counts: pd.Series,
    start: pd.Timestamp,
    at: pd.Timestamp,
) -> dict:
    """Completeness and delay of each source, and an overall state:
    healthy (complete and recent), degraded (gaps or late files) or unavailable (no data)."""
    abi_expected = max(1, int((at - start) / ABI_SCAN) - 1)  # the newest scan may still be in transit
    glm_expected = int((at - start).total_seconds() // GLM_FILE_S)
    abi_latest = max(abi_times) if abi_times else None
    glm_latest = max(glm_starts) + pd.Timedelta(seconds=GLM_FILE_S) if glm_starts else None

    problems = []
    if not abi_times or not glm_starts:
        problems.append("missing_source")
    if len(abi_times) < abi_expected:
        problems.append("abi_incomplete")
    if abi_latest is not None and at - abi_latest > MAX_ABI_DELAY:
        problems.append("abi_late")
    if glm_latest is not None and at - glm_latest > MAX_GLM_DELAY:
        problems.append("glm_late")
    if counts.tail(RECENT_BINS).isna().any() or len(counts) < RECENT_BINS:
        problems.append("glm_incomplete")

    state = "unavailable" if "missing_source" in problems else ("degraded" if problems else "healthy")
    return {
        "state": state,
        "problems": problems,
        "abi": {
            "expected": abi_expected,
            "received": len(abi_times),
            "latest_utc": abi_latest.isoformat() if abi_latest is not None else None,
        },
        "glm": {
            "expected_files": glm_expected,
            "received_files": len(glm_starts),
            "latest_utc": glm_latest.isoformat() if glm_latest is not None else None,
        },
    }


def public_level(level: str, health: dict) -> str:
    """Without complete data a quiet result is unproven, so it becomes 'unknown'.
    Positive findings stand: they rest on data that did arrive."""
    return "unknown" if level == "quiet" and health["state"] != "healthy" else level


def fetch(start: datetime, end: datetime, fs: s3fs.S3FileSystem):
    abi_keys = hourly_keys("ABI-L2-CMIPF", start, end, fs, band="M6C13")
    glm_keys = hourly_keys("GLM-L2-LCFA", start, end, fs)
    if not abi_keys or not glm_keys:
        # A single run exits non-zero here, so a scheduler never publishes an empty status.
        raise RuntimeError(f"no GOES-19 files between {start:%H:%M} and {end:%H:%M} UTC yet")
    with ThreadPoolExecutor(max_workers=12) as pool:
        crops = list(pool.map(lambda k: with_retries(read_abi_crop, k, fs), abi_keys))
        frames = list(pool.map(lambda k: with_retries(read_glm_flashes, k, fs), glm_keys))
    abi = xr.concat(sorted(crops, key=lambda c: c.time.values), dim="time")
    flashes = pd.concat(frames, ignore_index=True)
    glm_starts = sorted(pd.Timestamp(scan_start(k)) for k in glm_keys)
    data_end = glm_starts[-1] + pd.Timedelta(seconds=GLM_FILE_S)
    return abi, flashes, data_end, glm_starts


def map_layers(abi: xr.Dataset, flashes: pd.DataFrame, data_end: pd.Timestamp) -> dict:
    """Cold cloud-top pixels of the latest scan and flashes of the last 10 minutes.

    Cloud tops are parallax-corrected so they line up with the lightning (GLM
    positions already are). The alert rule uses uncorrected tops, as validated;
    at a 50 km radius the ~8 km shift barely matters.
    """
    last = abi.isel(time=-1)
    bt_c = last.brightness_temp_k.values - 273.15
    cold = bt_c <= COLD_TOP_C
    lats, lons = parallax_correct(last.lat.values[cold], last.lon.values[cold])
    cold_pixels = [
        [round(float(lat), 3), round(float(lon), 3), round(float(t), 1)] for lat, lon, t in zip(lats, lons, bt_c[cold])
    ]
    recent = flashes[flashes.time >= data_end - pd.Timedelta("10min")]
    return {"cold_pixels": cold_pixels, "recent_flashes": recent[["lat", "lon"]].round(3).values.tolist()}


def run_once(at: datetime, fs: s3fs.S3FileSystem, lookback: timedelta = LOOKBACK) -> dict:
    fs.invalidate_cache()  # s3fs caches listings; new files arrive every 20 s
    start = at - lookback
    abi, flashes, data_end, glm_starts = fetch(start, at, fs)
    tops = cloud_top_series(abi, radius_km=RADIUS_KM)
    counts = complete_bins(flashes, pd.Timestamp(start), data_end, glm_starts)
    health = source_health(list(tops.time), glm_starts, counts, pd.Timestamp(start), pd.Timestamp(at))
    level, alerts = classify(tops, counts, data_end)
    level = public_level(level, health)
    jumps = lightning_jumps(counts)
    episode_start = episodes(alert_times(tops, counts))[-1] if level == "severe" else None

    latest = tops.iloc[-1]
    status = {
        "schema_version": SCHEMA_VERSION,
        "algorithm_version": ALGORITHM_VERSION,
        "generated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "health": health,
        "data_until_utc": data_end.isoformat(),
        "level": level,
        "alerts_utc": [t.isoformat() for t in alerts],
        "episode_start_utc": episode_start.isoformat() if episode_start is not None else None,
        "latest_scan_utc": latest.time.isoformat(),
        "coldest_top_c": round(float(latest.min_bt_c), 1),
        "coldest_km_from_requinoa": round(float(latest.coldest_km_from_requinoa), 1),
        "radius_km": RADIUS_KM,
        "center": [EVENT_LAT, EVENT_LON],
        "flashes_per_5min": [
            {"start_utc": t.isoformat(), "count": None if pd.isna(c) else int(c), "jump": bool(jumps[t])}
            for t, c in counts.items()
        ],
        "cloud_tops": [
            {"time_utc": row.time.isoformat(), "min_bt_c": round(float(row.min_bt_c), 1)} for row in tops.itertuples()
        ],
        **map_layers(abi, flashes, data_end),
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "status.json").write_text(json.dumps(status, indent=2))
    (OUT_DIR / "status.html").write_text(HTML_TEMPLATE.replace("__STATUS__", json.dumps(status)))
    print(
        f"{data_end:%Y-%m-%d %H:%M}Z  {level:<15}  {health['state']:<9}  coldest {status['coldest_top_c']:6.1f} C"
        f"  flashes/5min {counts.tail(6).tolist()}"
    )
    return status


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--loop", action="store_true", help=f"repeat every {CYCLE_S // 60} minutes")
    group.add_argument("--at", help="replay a past UTC time, e.g. 2026-10-26T19:50")
    parser.add_argument("--lookback-min", type=int, default=int(LOOKBACK.total_seconds() // 60), help="history to include")
    args = parser.parse_args(argv)

    fs = s3fs.S3FileSystem(anon=True)
    if args.at:
        run_once(datetime.fromisoformat(args.at).replace(tzinfo=timezone.utc), fs, timedelta(minutes=args.lookback_min))
    elif not args.loop:
        # A single run must fail loudly so a scheduler never publishes a stale page.
        run_once(datetime.now(timezone.utc), fs)
    else:
        while True:
            try:
                run_once(datetime.now(timezone.utc), fs)
            except Exception as error:  # keep the loop alive through S3 hiccups
                print(f"cycle failed: {error}")
            time.sleep(CYCLE_S)
    print(f"-> {OUT_DIR / 'status.html'}")


HTML_TEMPLATE = """<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="300">
<title>Tormentas Requínoa</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<style>
  :root { --bg: #101418; --fg: #e8eaed; --muted: #9aa0a6; --quiet: #5cb85c; --deep: #f0ad4e; --severe: #e5534b; }
  body { margin: 0; font-family: system-ui, sans-serif; background: var(--bg); color: var(--fg); }
  header { padding: 12px 16px; }
  #level { font-size: 1.3rem; font-weight: 700; }
  .quiet { color: var(--quiet); } .deep_convection { color: var(--deep); } .severe { color: var(--severe); }
  #meta { color: var(--muted); font-size: 0.9rem; margin-top: 4px; }
  #map { height: calc(100vh - 110px); }
  .legend { background: rgba(16, 20, 24, 0.9); color: var(--fg); padding: 8px 10px; border-radius: 6px; font-size: 0.85rem; line-height: 1.6; }
  .legend span { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; }
  .mine { max-width: 260px; }
  .mine b { display: block; font-size: 1rem; margin-bottom: 2px; }
  .mine small { color: var(--muted); }
  .mine button { margin-top: 6px; padding: 6px 10px; border: 0; border-radius: 4px; background: #2d6cdf; color: #fff; font: inherit; cursor: pointer; }
  .me-dot { width: 16px; height: 16px; border-radius: 50%; background: #2d6cdf; border: 3px solid #fff; box-shadow: 0 0 6px #000; }
</style>
</head>
<body>
<header><div id="level"></div><div id="meta"></div></header>
<div id="map"></div>
<script>
const s = __STATUS__;
const labels = {
  quiet: "Sin tormentas cerca de Requínoa",
  deep_convection: "Nubes de tormenta cerca (topes de -38 °C o más fríos)",
  severe: "ALERTA: tormenta severa intensificándose (posible granizo, viento fuerte o tornado)",
};
const level = document.getElementById("level");
level.textContent = labels[s.level];
level.className = s.level;
const counts = s.flashes_per_5min.slice(-6).map(b => b.count).join(" · ");
const localTime = new Date(s.data_until_utc).toLocaleString("es-CL",
  { timeZone: "America/Santiago", dateStyle: "short", timeStyle: "short" });
document.getElementById("meta").textContent =
  `Datos hasta ${localTime} (hora de Chile) · nube más fría ${s.coldest_top_c} °C ` +
  `a ${s.coldest_km_from_requinoa} km de Requínoa · rayos cada 5 min: ${counts}`;
const ageMin = Math.round((Date.now() - new Date(s.data_until_utc)) / 60000);
if (ageMin > 30) {
  document.getElementById("meta").textContent += ` · ⚠️ datos de hace ${ageMin < 120 ? ageMin + " min" : Math.round(ageMin / 60) + " h"}`;
}

const map = L.map("map").setView(s.center, 9);
// OSM's tile servers reject file:// pages (no Referer) and CARTO now needs an
// API key; Esri's canvas tiles work without either.
const esri = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas";
L.tileLayer(`${esri}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
  { maxZoom: 12, attribution: "Tiles &copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors" }).addTo(map);
L.tileLayer(`${esri}/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 12 }).addTo(map);
L.circle(s.center, { radius: s.radius_km * 1000, color: "#888", fill: false, dashArray: "4" }).addTo(map);
L.marker(s.center).addTo(map).bindTooltip("Requínoa");

const legend = L.control({ position: "bottomleft" });
legend.onAdd = () => {
  const div = L.DomUtil.create("div", "legend");
  div.innerHTML =
    '<span style="background:#ffff00"></span>Rayo (últimos 10 min)<br>' +
    '<span style="background:#fdbb84"></span>Nube de tormenta: -38 a -44 °C<br>' +
    '<span style="background:#e34a33"></span>Tormenta fuerte: -44 a -50 °C<br>' +
    '<span style="background:#b30000"></span>Núcleo muy intenso: bajo -50 °C<br>' +
    `Círculo: ${s.radius_km} km alrededor de Requínoa`;
  return div;
};
legend.addTo(map);
for (const [lat, lon, t] of s.cold_pixels) {
  const color = t <= -50 ? "#b30000" : t <= -44 ? "#e34a33" : "#fdbb84";
  L.circleMarker([lat, lon], { radius: 3, stroke: false, fillColor: color, fillOpacity: 0.6 }).addTo(map);
}
for (const [lat, lon] of s.recent_flashes) {
  L.circleMarker([lat, lon], { radius: 2, color: "#ffff00", weight: 1 }).addTo(map);
}

// "Your location": activity around a point the viewer picks (GPS, tap or drag).
const NEAR_KM = 10, AROUND_KM = 25;
const STORAGE_KEY = "requinoa-my-location";
const toRad = d => d * Math.PI / 180;
function distanceKm(lat1, lon1, lat2, lon2) {
  const a = Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lon2 - lon1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}
function direction(lat1, lon1, lat2, lon2) {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  const deg = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  return ["norte", "noreste", "este", "sureste", "sur", "suroeste", "oeste", "noroeste"][Math.round(deg / 45) % 8];
}

function activityAt(lat, lon) {
  const flashes = s.recent_flashes.filter(([la, lo]) => distanceKm(lat, lon, la, lo) <= NEAR_KM).length;
  let nearest = null, coldest = null;
  for (const [la, lo, t] of s.cold_pixels) {
    const d = distanceKm(lat, lon, la, lo);
    if (!nearest || d < nearest.d) nearest = { d, dir: direction(lat, lon, la, lo) };
    if (d <= AROUND_KM && (coldest === null || t < coldest)) coldest = t;
  }
  for (const [la, lo] of s.recent_flashes) {
    const d = distanceKm(lat, lon, la, lo);
    if (!nearest || d < nearest.d) nearest = { d, dir: direction(lat, lon, la, lo) };
  }
  return { flashes, nearest, coldest, fromRequinoa: distanceKm(lat, lon, ...s.center) };
}

function describe(a) {
  let title, cls;
  if (a.flashes > 0 || (a.nearest && a.nearest.d <= 5)) {
    title = "Tormenta sobre tu zona"; cls = "severe";
  } else if (a.nearest && a.nearest.d <= AROUND_KM) {
    title = `Tormenta a ${Math.round(a.nearest.d)} km al ${a.nearest.dir}`; cls = "deep_convection";
  } else {
    title = `Sin tormentas a menos de ${AROUND_KM} km`; cls = "quiet";
  }
  const lines = [`Rayos a menos de ${NEAR_KM} km (últimos 10 min): ${a.flashes}`];
  if (a.coldest !== null) lines.push(`Nube más fría a menos de ${AROUND_KM} km: ${a.coldest} °C`);
  if (a.fromRequinoa > s.radius_km) lines.push("Fuera del círculo: aquí la alerta aún no está validada");
  else if (s.level === "severe") lines.push('<b class="severe">Alerta activa en tu zona (radio de 50 km)</b>');
  return `<b class="${cls}">${title}</b><small>${lines.join("<br>")}</small>`;
}

const panel = L.control({ position: "topright" });
panel.onAdd = () => {
  const div = L.DomUtil.create("div", "legend mine");
  L.DomEvent.disableClickPropagation(div);
  div.innerHTML = '<b>Tu ubicación</b><small>Toca el mapa o arrastra el punto azul para mover tu ubicación.</small><div id="mine-status"></div>' +
    '<button id="locate">Usar mi ubicación</button>';
  return div;
};
panel.addTo(map);

const meIcon = L.divIcon({ className: "", html: '<div class="me-dot"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });
let me = null, meRing = null;
function setMe(lat, lon) {
  if (!me) {
    me = L.marker([lat, lon], { icon: meIcon, draggable: true }).addTo(map);
    meRing = L.circle([lat, lon], { radius: NEAR_KM * 1000, color: "#2d6cdf", weight: 1, fillOpacity: 0.05 }).addTo(map);
    me.on("drag", e => { meRing.setLatLng(e.latlng); show(e.latlng.lat, e.latlng.lng); });
    me.on("dragend", e => save(e.target.getLatLng()));
  }
  me.setLatLng([lat, lon]);
  meRing.setLatLng([lat, lon]);
  show(lat, lon);
  save({ lat, lng: lon });
}
function show(lat, lon) {
  document.getElementById("mine-status").innerHTML = describe(activityAt(lat, lon));
}
function save(latlng) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([latlng.lat, latlng.lng])); } catch (e) {}
}

map.on("click", e => setMe(e.latlng.lat, e.latlng.lng));
document.getElementById("locate").addEventListener("click", () => {
  const status = document.getElementById("mine-status");
  if (!navigator.geolocation) { status.innerHTML = "<small>Tu navegador no permite ubicarte; toca el mapa.</small>"; return; }
  status.innerHTML = "<small>Buscando tu ubicación…</small>";
  navigator.geolocation.getCurrentPosition(
    pos => { setMe(pos.coords.latitude, pos.coords.longitude); map.setView([pos.coords.latitude, pos.coords.longitude], 10); },
    () => { status.innerHTML = "<small>No se pudo obtener tu ubicación; toca el mapa para marcarla.</small>"; },
    { enableHighAccuracy: false, timeout: 10000 },
  );
});
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (Array.isArray(saved)) setMe(saved[0], saved[1]);
} catch (e) {}
</script>
</body>
</html>
"""


if __name__ == "__main__":
    main()
