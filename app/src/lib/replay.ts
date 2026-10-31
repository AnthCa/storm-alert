import type { Status } from "./status";

/** One scan of the replay: cold tops and the flashes of the 10 minutes before it. */
export interface ReplayFrame {
  timeUtc: string;
  cold: [number, number, number][];
  flashes: [number, number][];
}

const FLASH_WINDOW_MS = 10 * 60_000;

/**
 * The earlier scans shipped in status.json plus the latest one, oldest first.
 * Flashes per frame come from the 30-minute flash cells (latest flash per ~2 km cell),
 * so a busy cell shows its last flash only; the latest frame uses the exact recent flashes.
 */
export function replayFrames(status: Status): ReplayFrame[] {
  const dataEnd = Date.parse(status.data_until_utc);
  const flashesBefore = (time: number): [number, number][] =>
    status.flash_cells_30min
      .filter(([, , age]) => {
        const at = dataEnd - age * 60_000;
        return at <= time && at > time - FLASH_WINDOW_MS;
      })
      .map(([lat, lon]) => [lat, lon]);

  const earlier = status.cold_history.map((scan) => ({
    timeUtc: scan.time_utc,
    cold: scan.cells,
    flashes: flashesBefore(Date.parse(scan.time_utc)),
  }));
  return [...earlier, { timeUtc: status.latest_scan_utc, cold: status.cold_pixels, flashes: status.recent_flashes }];
}
