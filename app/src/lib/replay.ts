import type { Status } from "./status";

/** One scan of the replay: cold tops and the flashes of the 10 minutes before it. */
export interface ReplayFrame {
  timeUtc: string;
  cold: [number, number, number][];
  flashes: [number, number][];
  /** [lat, lon, minutes before the scan] of the last flash per ~2 km cell in the 10 minutes before it. */
  cells: [number, number, number][];
}

const FLASH_WINDOW_MIN = 10;
const FLASH_WINDOW_MS = FLASH_WINDOW_MIN * 60_000;
/** A flash this recent means the storm is active now, not just where it has been. */
export const FRESH_FLASH_MIN = 5;

/** Flash cells struck in the last 10 minutes, with their age. */
export function flashCells(status: Status): [number, number, number][] {
  return status.flash_cells_30min.filter(([, , age]) => age <= FLASH_WINDOW_MIN);
}

/**
 * The earlier scans shipped in status.json plus the latest one, oldest first.
 * Flashes per frame come from the 30-minute flash cells (latest flash per ~2 km cell),
 * so a busy cell shows its last flash only; the latest frame uses the exact recent flashes.
 */
export function replayFrames(status: Status): ReplayFrame[] {
  const dataEnd = Date.parse(status.data_until_utc);
  // Cells struck in the 10 minutes before `time`, aged from that time.
  const cellsBefore = (time: number): [number, number, number][] =>
    status.flash_cells_30min
      .filter(([, , age]) => {
        const at = dataEnd - age * 60_000;
        return at <= time && at > time - FLASH_WINDOW_MS;
      })
      .map(([lat, lon, age]) => [lat, lon, Math.round((age - (dataEnd - time) / 60_000) * 10) / 10]);

  const earlier = status.cold_history.map((scan) => {
    const time = Date.parse(scan.time_utc);
    const cells = cellsBefore(time);
    return { timeUtc: scan.time_utc, cold: scan.cells, flashes: cells.map(([lat, lon]) => [lat, lon] as [number, number]), cells };
  });
  return [
    ...earlier,
    { timeUtc: status.latest_scan_utc, cold: status.cold_pixels, flashes: status.recent_flashes, cells: flashCells(status) },
  ];
}
