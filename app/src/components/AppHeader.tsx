import { ago, localTime, type DataState, type Status } from "@/lib/status";
import { BoltIcon } from "./Icons";

const UPDATE_EVERY_MIN = 10;

/**
 * App name, the "experimental" label and how old each source is.
 * `now` is the shared clock (useNow): 0 until hydrated, when ages are not shown yet.
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
        {status && now > 0 && state !== "historical" && <NextUpdate status={status} now={now} />}
      </div>
      {status && now > 0 && state !== "historical" && <SourceAges status={status} now={new Date(now)} />}
    </header>
  );
}

function NextUpdate({ status, now }: { status: Status; now: number }) {
  const due = new Date(status.data_until_utc).getTime() + UPDATE_EVERY_MIN * 60_000;
  // A "next update" time in the past would claim freshness the data does not have.
  const overdue = now > due + 5 * 60_000;
  return (
    <span className="rounded-full border border-line bg-surface/90 px-2.5 py-1.5 font-mono text-xs text-soft">
      {overdue ? "actualización atrasada" : `próx. ~${localTime(new Date(due).toISOString())}`}
    </span>
  );
}

function SourceAges({ status, now }: { status: Status; now: Date }) {
  const abi = status.health.abi.latest_utc ?? status.latest_scan_utc;
  const glm = status.health.glm.latest_utc ?? status.data_until_utc;
  return (
    <p className="pointer-events-auto self-start rounded-lg bg-bg/80 px-2 py-1 text-xs text-soft">
      Nubes {ago(abi, now)} · Rayos {ago(glm, now)}
    </p>
  );
}
