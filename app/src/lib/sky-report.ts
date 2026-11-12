/**
 * "¿Qué ves ahora?": the viewer tells what the sky is doing at their place, so the
 * satellite can be checked against the ground (infra/supabase/sky_reports.sql).
 * Anonymous: the ~1 km point the app already keeps, what was seen and what the app showed.
 */
import { nearestStorm } from "./geo";
import { rpc } from "./push";
import type { Status } from "./status";

export const SKY_OPTIONS = [
  { key: "clear", label: "Despejado" },
  { key: "partly", label: "Sol y nubes" },
  { key: "cloudy", label: "Nublado" },
  { key: "rain", label: "Lluvia" },
  { key: "heavy_rain", label: "Lluvia fuerte" },
  { key: "hail", label: "Granizo" },
  { key: "thunder", label: "Truenos" },
  { key: "lightning", label: "Rayos" },
  { key: "wind", label: "Viento fuerte" },
] as const;
export type SkyKind = (typeof SKY_OPTIONS)[number]["key"];

/** One report per place every ten minutes, the pace of the satellite. */
export const REPORT_EVERY_MS = 10 * 60_000;

/** How much of the sky is covered: one answer at most. */
const SKY_COVER: SkyKind[] = ["clear", "partly", "cloudy"];

/**
 * A clear sky cannot come with anything else, and the sky has one cover at a time:
 * choosing one replaces the other. Sun and clouds can still come with a shower.
 */
export function toggleKind(selected: SkyKind[], kind: SkyKind): SkyKind[] {
  if (selected.includes(kind)) return selected.filter((k) => k !== kind);
  if (kind === "clear") return ["clear"];
  const others = selected.filter((k) => k !== "clear" && !(SKY_COVER.includes(kind) && SKY_COVER.includes(k)));
  return [...others, kind];
}

export function canReport(lastSentMs: number | null, nowMs: number): boolean {
  return lastSentMs === null || nowMs - lastSentMs >= REPORT_EVERY_MS;
}

/** The report, with what the app was showing at that moment. */
export function reportBody(place: { lat: number; lon: number }, seen: SkyKind[], status: Status) {
  const storm = nearestStorm(status, place.lat, place.lon);
  return {
    lat: place.lat,
    lon: place.lon,
    seen,
    app_level: status.level,
    app_data_until: status.data_until_utc,
    app_nearest_km: storm ? Math.round(storm.km) : null,
  };
}

export async function sendReport(place: { lat: number; lon: number }, seen: SkyKind[], status: Status): Promise<void> {
  await rpc("report_sky", reportBody(place, seen, status));
}
