import { localTime, type DataState, type Status } from "@/lib/status";
import { BoltIcon } from "./Icons";

const UPDATE_EVERY_MIN = 10;

/**
 * App name, the "experimental" label and the time of the data on screen.
 * `now` is the shared clock (useNow): 0 until hydrated, when the time is not shown yet.
 */
export function AppHeader({ status, state, now }: { status: Status | null; state: DataState; now: number }) {
  return (
    <header className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BoltIcon className="text-bolt" />
          <span className="text-[17px] font-bold tracking-tight">Storm Alert</span>
          <span className="rounded-md border border-line px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-soft">
            EXPERIMENTAL
          </span>
        </div>
        {status && now > 0 && state !== "historical" && <DataTime status={status} now={now} />}
      </div>
    </header>
  );
}

/**
 * When the data on screen was observed (the cloud scan, the older of the two sources).
 * After two missed runs it says so instead of showing a time that looks current.
 */
function DataTime({ status, now }: { status: Status; now: number }) {
  const due = new Date(status.data_until_utc).getTime() + UPDATE_EVERY_MIN * 60_000;
  const overdue = now > due + 5 * 60_000;
  return (
    <span className="rounded-full border border-line bg-surface/90 px-2.5 py-1.5 font-mono text-xs text-soft">
      {overdue ? "datos atrasados" : `datos ${localTime(status.latest_scan_utc)}`}
    </span>
  );
}
