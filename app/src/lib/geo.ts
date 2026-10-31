import { localTime, type Status } from "./status";

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Flashes closer than this count as "over you". */
export const NEAR_KM = 10;
/** Storms closer than this are reported with distance and direction. */
export const AROUND_KM = 25;

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const a =
    Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lon2 - lon1) / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

const DIRECTIONS = ["norte", "noreste", "este", "sureste", "sur", "suroeste", "oeste", "noroeste"];

/** Compass direction (in Spanish) from point 1 towards point 2. */
export function direction(lat1: number, lon1: number, lat2: number, lon2: number): string {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return DIRECTIONS[Math.round(bearing / 45) % 8];
}

/** Closed ring of [lon, lat] points approximating a circle, for map layers. */
export function circleRing(lat: number, lon: number, radiusKm: number, steps = 96): [number, number][] {
  const dLat = (radiusKm / EARTH_RADIUS_KM) * (180 / Math.PI);
  const dLon = dLat / Math.cos(toRad(lat));
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    ring.push([lon + dLon * Math.cos(t), lat + dLat * Math.sin(t)]);
  }
  return ring;
}

/** "outside": beyond the monitored circle, where no local state is computed at all. */
export type LocalLevel = "over" | "near" | "clear" | "outside";

export interface Activity {
  level: LocalLevel;
  flashesNear: number;
  nearest: { km: number; direction: string } | null;
  coldestAroundC: number | null;
  insideValidatedArea: boolean;
}

/** Storm activity around a point, from the latest status (cloud tops and recent flashes). */
export function activityAt(status: Status, lat: number, lon: number): Activity {
  let nearest: Activity["nearest"] = null;
  let coldestAroundC: number | null = null;
  const consider = (pLat: number, pLon: number) => {
    const km = distanceKm(lat, lon, pLat, pLon);
    if (!nearest || km < nearest.km) nearest = { km, direction: direction(lat, lon, pLat, pLon) };
    return km;
  };

  for (const [pLat, pLon, tempC] of status.cold_pixels) {
    const km = consider(pLat, pLon);
    if (km <= AROUND_KM && (coldestAroundC === null || tempC < coldestAroundC)) coldestAroundC = tempC;
  }
  let flashesNear = 0;
  for (const [pLat, pLon] of status.recent_flashes) {
    if (consider(pLat, pLon) <= NEAR_KM) flashesNear++;
  }

  const found = nearest as Activity["nearest"];
  const [centerLat, centerLon] = status.center;
  const insideValidatedArea = distanceKm(lat, lon, centerLat, centerLon) <= status.radius_km;
  const level: LocalLevel = !insideValidatedArea
    ? "outside"
    : flashesNear > 0 || (found && found.km <= 5)
      ? "over"
      : found && found.km <= AROUND_KM
        ? "near"
        : "clear";
  return { level, flashesNear, nearest: found, coldestAroundC, insideValidatedArea };
}

/** Closest observed storm anywhere on the map: a cold cloud top or a recent flash. */
export interface StormNearby {
  km: number;
  direction: string;
  lat: number;
  lon: number;
}

export function nearestStorm(status: Status, lat: number, lon: number): StormNearby | null {
  let best: StormNearby | null = null;
  for (const [pLat, pLon] of [...status.cold_pixels, ...status.recent_flashes]) {
    const km = distanceKm(lat, lon, pLat, pLon);
    if (!best || km < best.km) best = { km, direction: direction(lat, lon, pLat, pLon), lat: pLat, lon: pLon };
  }
  return best;
}

export function insideObservedArea(status: Status, lat: number, lon: number): boolean {
  const box = status.observed_bbox;
  return !!box && lat >= box.lat_min && lat <= box.lat_max && lon >= box.lon_min && lon <= box.lon_max;
}

/** History cells are ~5 km wide, so smaller changes are not a real movement. */
export const TREND_MIN_KM = 8;

export type Trend =
  | { kind: "approaching" | "receding" | "steady"; wasKm: number; minutes: number }
  | { kind: "new"; minutes: number };

/**
 * Whether the closest cold cloud tops got nearer to a point, comparing the latest scan with
 * the oldest earlier scan shipped in status.json. null when there is nothing to compare.
 */
export function stormTrend(status: Status, lat: number, lon: number): Trend | null {
  const oldest = status.cold_history[0];
  if (!oldest || status.cold_pixels.length === 0) return null;
  const minutes = Math.round((Date.parse(status.latest_scan_utc) - Date.parse(oldest.time_utc)) / 60_000);
  if (minutes <= 0) return null;
  if (oldest.cells.length === 0) return { kind: "new", minutes };
  const closest = (points: [number, number, number][]) =>
    Math.min(...points.map(([pLat, pLon]) => distanceKm(lat, lon, pLat, pLon)));
  const nowKm = closest(status.cold_pixels);
  const wasKm = closest(oldest.cells);
  const kind = nowKm <= wasKm - TREND_MIN_KM ? "approaching" : nowKm >= wasKm + TREND_MIN_KM ? "receding" : "steady";
  return { kind, wasKm, minutes };
}

/** Arrival estimates only for storms between these distances; farther, the error is too large. */
export const ETA_MIN_KM = NEAR_KM;
export const ETA_MAX_KM = 150;
/** Slower than this, "arrival" is not a meaningful idea within the next hours. */
const ETA_MIN_SPEED_KMH = 10;
export const ETA_MAX_MIN = 180;
const ETA_MARGIN_LOW = 0.8;
const ETA_MARGIN_HIGH = 1.25;

export interface Eta {
  speedKmh: number;
  /** Range of minutes until the closest cold tops reach the point, if they keep the observed pace.
   * fromMin is at most ETA_MAX_MIN; toMin may exceed it. */
  fromMin: number;
  toMin: number;
}

/**
 * When the closest cold cloud tops might reach a point, if they keep their pace.
 *
 * Conservative on purpose: only when every scan (at least three) is closer than the one
 * before, so new cells popping up or old ones dying do not pass for movement. The range
 * comes from the slowest and fastest step speeds. It tracks the edge of the cold tops,
 * which is what reaches a place first. The range is never narrower than -20 % / +25 %. Experimental: to be checked against real arrivals.
 */
export function stormEta(status: Status, lat: number, lon: number): Eta | null {
  const scans = [
    ...status.cold_history.map((scan) => ({ time: Date.parse(scan.time_utc), points: scan.cells })),
    { time: Date.parse(status.latest_scan_utc), points: status.cold_pixels },
  ];
  if (scans.length < 3 || scans.some((scan) => scan.points.length === 0)) return null;
  const series = scans.map((scan) => ({
    time: scan.time,
    km: Math.min(...scan.points.map(([pLat, pLon]) => distanceKm(lat, lon, pLat, pLon))),
  }));

  const nowKm = series.at(-1)!.km;
  if (nowKm <= ETA_MIN_KM || nowKm > ETA_MAX_KM) return null;
  if (series[0].km - nowKm < TREND_MIN_KM) return null;

  const stepSpeeds: number[] = [];
  for (let i = 1; i < series.length; i++) {
    const hours = (series[i].time - series[i - 1].time) / 3_600_000;
    const closedKm = series[i - 1].km - series[i].km;
    if (hours <= 0 || closedKm <= 0) return null;
    stepSpeeds.push(closedKm / hours);
  }
  const hours = (series.at(-1)!.time - series[0].time) / 3_600_000;
  const speedKmh = (series[0].km - nowKm) / hours;
  if (speedKmh < ETA_MIN_SPEED_KMH) return null;

  // Even a perfectly steady approach gets a margin: cells are ~5 km and storms change.
  const centralMin = (nowKm / speedKmh) * 60;
  const fromMin = Math.min((nowKm / Math.max(...stepSpeeds)) * 60, centralMin * ETA_MARGIN_LOW);
  const toMin = Math.max((nowKm / Math.min(...stepSpeeds)) * 60, centralMin * ETA_MARGIN_HIGH);
  if (fromMin > ETA_MAX_MIN) return null;
  return { speedKmh, fromMin, toMin };
}

/** Clock time in Chile, rounded to 10 minutes: an estimate should not look minute-exact. */
function roughTime(ms: number): string {
  const step = 10 * 60_000;
  return localTime(new Date(Math.round(ms / step) * step).toISOString());
}

/**
 * "Se acercan a ~60 km/h. Si mantienen el ritmo, podrían llegar entre las 14:20 y las 14:50."
 * Times count from the scan, not from now, so satellite latency does not shift them.
 */
export function etaText(eta: Eta, scanUtc: string): string {
  const scan = Date.parse(scanUtc);
  const from = roughTime(scan + eta.fromMin * 60_000);
  const to = roughTime(scan + eta.toMin * 60_000);
  const when =
    eta.toMin > ETA_MAX_MIN ? `después de las ${from}` : from === to ? `cerca de las ${from}` : `entre las ${from} y las ${to}`;
  const speed = Math.max(5, Math.round(eta.speedKmh / 5) * 5);
  return `Se acercan a ~${speed} km/h. Si mantienen el ritmo, podrían llegar ${when} (estimación, puede cambiar).`;
}

/** Two decimals is about 1 km: enough to measure distance to a storm, too coarse to find a home. */
export function coarsen(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Main towns of O'Higgins, to name the area around a point. Approximate centres. */
const TOWNS: [string, number, number][] = [
  ["Rancagua", -34.17, -70.74],
  ["Machalí", -34.18, -70.65],
  ["Graneros", -34.07, -70.73],
  ["Codegua", -34.04, -70.67],
  ["Mostazal", -33.98, -70.71],
  ["Doñihue", -34.23, -70.96],
  ["Coltauco", -34.29, -71.08],
  ["Requínoa", -34.29, -70.82],
  ["Rengo", -34.4, -70.86],
  ["Malloa", -34.45, -70.95],
  ["San Vicente", -34.44, -71.08],
  ["Pichidegua", -34.36, -71.28],
  ["Peumo", -34.39, -71.17],
  ["Las Cabras", -34.29, -71.31],
  ["San Fernando", -34.58, -70.99],
  ["Chimbarongo", -34.71, -71.04],
  ["Nancagua", -34.66, -71.18],
  ["Santa Cruz", -34.64, -71.37],
  ["Peralillo", -34.48, -71.49],
  ["Marchigüe", -34.4, -71.62],
  ["Litueche", -34.12, -71.72],
  ["Pichilemu", -34.39, -72.0],
];

/** Name of the closest town if the point is within `maxKm` of it. */
export function nearestTown(lat: number, lon: number, maxKm = 8): string | null {
  let best: { name: string; km: number } | null = null;
  for (const [name, tLat, tLon] of TOWNS) {
    const km = distanceKm(lat, lon, tLat, tLon);
    if (!best || km < best.km) best = { name, km };
  }
  return best && best.km <= maxKm ? best.name : null;
}
