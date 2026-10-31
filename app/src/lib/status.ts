/** Shape of status.json, written every 10 minutes by research/requinoa-2026 (realtime.py). */
/** "unknown": no storm signal, but the data is incomplete, so quiet cannot be confirmed. */
export type Level = "quiet" | "deep_convection" | "severe" | "unknown";

export interface SourceHealth {
  state: "healthy" | "degraded" | "unavailable";
  problems: string[];
  abi: { expected: number; received: number; latest_utc: string | null };
  glm: { expected_files: number; received_files: number; latest_utc: string | null };
}

export interface FlashBin {
  start_utc: string;
  /** null when the bin's GLM files did not all arrive: unknown, never zero. */
  count: number | null;
  jump: boolean;
}

export interface CloudTop {
  time_utc: string;
  min_bt_c: number;
}

export interface ColdScan {
  time_utc: string;
  /** [lat, lon, coldest C] per ~5 km cell, parallax-corrected. */
  cells: [number, number, number][];
}

export interface Bbox {
  lat_min: number;
  lat_max: number;
  lon_min: number;
  lon_max: number;
}

export interface Status {
  schema_version: number;
  algorithm_version: string;
  health: SourceHealth;
  generated_utc: string;
  data_until_utc: string;
  level: Level;
  alerts_utc: string[];
  episode_start_utc: string | null;
  latest_scan_utc: string;
  coldest_top_c: number;
  coldest_km_from_requinoa: number;
  radius_km: number;
  /** [lat, lon] of Requínoa. */
  center: [number, number];
  flashes_per_5min: FlashBin[];
  cloud_tops: CloudTop[];
  /** [lat, lon, brightness temperature in C], parallax-corrected, latest scan only. */
  cold_pixels: [number, number, number][];
  /** Thinned cold tops of up to three earlier scans, oldest first (schema 3+). */
  cold_history: ColdScan[];
  /** Area where clouds and flashes are mapped (schema 3+); wider than the alert circle. */
  observed_bbox: Bbox | null;
  /** [lat, lon] of flashes in the last 10 minutes. */
  recent_flashes: [number, number][];
}

export const LIVE_STATUS_URL =
  process.env.NEXT_PUBLIC_STATUS_URL ?? "https://anthca.github.io/storm-alert/status.json";

/** Snapshot of 26 Oct 2026, 17:30 local, when the Requínoa tornado touched down. */
export const DEMO_STATUS_URL = "/demo/requinoa-2026-10-26.json";

/** Data older than this is stale: the pipeline runs every 10 minutes, so two runs were missed. */
export const STALE_AFTER_MIN = 25;

export async function fetchStatus(url: string): Promise<Status> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`status.json returned ${response.status}`);
  return normalizeStatus(await response.json());
}

const UNKNOWN_HEALTH: SourceHealth = {
  state: "degraded",
  problems: ["health_not_reported"],
  abi: { expected: 0, received: 0, latest_utc: null },
  glm: { expected_files: 0, received_files: 0, latest_utc: null },
};

/** Fills fields that older pipeline versions did not write, so the UI never reads undefined.
 * A file without a health report cannot prove its data was complete, so it counts as degraded. */
export function normalizeStatus(raw: Partial<Status> & Pick<Status, "level" | "data_until_utc">): Status {
  const health = raw.health ?? UNKNOWN_HEALTH;
  return {
    ...raw,
    schema_version: raw.schema_version ?? 1,
    algorithm_version: raw.algorithm_version ?? "desconocida",
    health,
    level: raw.level === "quiet" && health.state !== "healthy" ? "unknown" : raw.level,
    alerts_utc: raw.alerts_utc ?? [],
    episode_start_utc: raw.episode_start_utc ?? null,
    flashes_per_5min: (raw.flashes_per_5min ?? []).map((b) => ({ ...b, jump: b.jump ?? false })),
    cloud_tops: raw.cloud_tops ?? [],
    cold_pixels: raw.cold_pixels ?? [],
    cold_history: raw.cold_history ?? [],
    observed_bbox: raw.observed_bbox ?? null,
    recent_flashes: raw.recent_flashes ?? [],
  } as Status;
}

export function minutesOld(status: Status, now: Date): number {
  return Math.round((now.getTime() - new Date(status.data_until_utc).getTime()) / 60_000);
}

const chileTime = new Intl.DateTimeFormat("es-CL", {
  timeZone: "America/Santiago",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const chileDate = new Intl.DateTimeFormat("es-CL", {
  timeZone: "America/Santiago",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "17:25" in Chile's local time. */
export function localTime(isoUtc: string): string {
  return chileTime.format(new Date(isoUtc));
}

export function localDate(isoUtc: string): string {
  return chileDate.format(new Date(isoUtc));
}

/** "-48.8" -> "−48.8" (typographic minus). */
export function formatC(value: number): string {
  return value.toFixed(1).replace("-", "−");
}

/**
 * What the viewer can trust right now.
 * historical: the Requínoa replay. stale: no new data for STALE_AFTER_MIN.
 * offline: the device has no connection, so this is the last data it saw.
 */
export type DataState = "healthy" | "degraded" | "stale" | "unavailable" | "offline" | "historical";

export function dataState(
  status: Status | null,
  { demo, online, now }: { demo: boolean; online: boolean; now?: Date },
): DataState {
  if (!status) return online ? "unavailable" : "offline";
  if (demo) return "historical";
  if (!online) return "offline";
  if (now && minutesOld(status, now) > STALE_AFTER_MIN) return "stale";
  return status.health.state;
}

/** "hace 8 min" / "hace 3 h" from an ISO time. */
export function ago(isoUtc: string, now: Date): string {
  const min = Math.max(0, Math.round((now.getTime() - new Date(isoUtc).getTime()) / 60_000));
  return min < 120 ? `hace ${min} min` : `hace ${Math.round(min / 60)} h`;
}
