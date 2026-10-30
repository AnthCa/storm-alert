/** Shape of status.json, written every 10 minutes by research/requinoa-2026 (realtime.py). */
export type Level = "quiet" | "deep_convection" | "severe";

export interface FlashBin {
  start_utc: string;
  count: number;
  jump: boolean;
}

export interface CloudTop {
  time_utc: string;
  min_bt_c: number;
}

export interface Status {
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
  /** [lat, lon] of flashes in the last 10 minutes. */
  recent_flashes: [number, number][];
}

export const LIVE_STATUS_URL =
  process.env.NEXT_PUBLIC_STATUS_URL ?? "https://anthca.github.io/storm-alert/status.json";

/** Snapshot of 26 Oct 2026, 17:30 local, when the Requínoa tornado touched down. */
export const DEMO_STATUS_URL = "/demo/requinoa-2026-10-26.json";

/** Data older than this is flagged as stale (the pipeline runs every 10 minutes). */
export const STALE_AFTER_MIN = 30;

export async function fetchStatus(url: string): Promise<Status> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`status.json returned ${response.status}`);
  return normalizeStatus(await response.json());
}

/** Fills fields that older pipeline versions did not write, so the UI never reads undefined. */
export function normalizeStatus(raw: Partial<Status> & Pick<Status, "level" | "data_until_utc">): Status {
  return {
    ...raw,
    alerts_utc: raw.alerts_utc ?? [],
    episode_start_utc: raw.episode_start_utc ?? null,
    flashes_per_5min: (raw.flashes_per_5min ?? []).map((b) => ({ ...b, jump: b.jump ?? false })),
    cloud_tops: raw.cloud_tops ?? [],
    cold_pixels: raw.cold_pixels ?? [],
    recent_flashes: raw.recent_flashes ?? [],
  } as Status;
}

export function minutesOld(status: Status, now: Date = new Date()): number {
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
