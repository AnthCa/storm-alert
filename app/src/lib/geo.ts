import type { Status } from "./status";

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

export type LocalLevel = "over" | "near" | "clear";

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
  const level: LocalLevel =
    flashesNear > 0 || (found && found.km <= 5) ? "over" : found && found.km <= AROUND_KM ? "near" : "clear";
  const [centerLat, centerLon] = status.center;
  return {
    level,
    flashesNear,
    nearest: found,
    coldestAroundC,
    insideValidatedArea: distanceKm(lat, lon, centerLat, centerLon) <= status.radius_km,
  };
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
