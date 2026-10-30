"use client";

import { localDate, localTime } from "@/lib/status";
import { PlayIcon } from "./Icons";
import { useStatus } from "./StatusProvider";

/** Shown while the app replays the Requínoa tornado instead of live data. */
export function DemoBanner() {
  const { demo, setDemo, status } = useStatus();
  if (!demo) return null;
  return (
    <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-line bg-surface/95 px-3.5 py-2.5">
      <PlayIcon size={18} className="shrink-0 text-bolt" />
      <div className="grow text-[13px] text-soft">
        Repetición histórica: tornado de Requínoa
        {status && ` · ${localDate(status.data_until_utc)}, ${localTime(status.data_until_utc)}`}
      </div>
      <button
        type="button"
        onClick={() => setDemo(false)}
        className="min-h-11 shrink-0 rounded-lg px-2 text-[13px] font-semibold text-quiet"
      >
        Ver en vivo
      </button>
    </div>
  );
}
