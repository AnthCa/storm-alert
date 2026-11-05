"use client";

import { useRef, useState, type MouseEvent, type ReactNode } from "react";
import { AROUND_KM, nearestTown } from "@/lib/geo";
import { DEMO_STATUS_URL, fetchStatus, type Status } from "@/lib/status";
import { panelPercent, project, unproject, verdictAt, type Tone, type Verdict } from "./radar-geo";

export interface PanelPlace {
  name: string;
  lat: number;
  lon: number;
}

const TONE: Record<Tone, string> = {
  severe: "text-severe",
  convective: "text-convective",
  quiet: "text-quiet",
  soft: "text-soft",
};

const RING = panelPercent(AROUND_KM) * 2;

/**
 * The interactive layer of the replay panel: put "your house" on the 26 October storm, by
 * tapping the map or picking a town, and read the answer the app gave there. The replay
 * data loads on the first choice; the first answer comes prerendered from the server.
 */
export function RadarHome({
  children,
  legend,
  places,
  start,
  initial,
}: {
  children: ReactNode;
  legend: ReactNode;
  places: PanelPlace[];
  start: PanelPlace;
  initial: Verdict;
}) {
  const [home, setHome] = useState(start);
  const [verdict, setVerdict] = useState(initial);
  const replay = useRef<Promise<Status> | null>(null);
  const latest = useRef(0);

  async function placeHome(next: PanelPlace) {
    setHome(next);
    const ticket = ++latest.current;
    replay.current ??= fetchStatus(DEMO_STATUS_URL);
    try {
      const status = await replay.current;
      if (ticket === latest.current) setVerdict(verdictAt(status, next.lat, next.lon));
    } catch {
      replay.current = null;
    }
  }

  function onMapClick(event: MouseEvent<HTMLButtonElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    // A keyboard press has no pointer position: keep the house where it is.
    if (event.detail === 0) return;
    const [lat, lon] = unproject(((event.clientX - box.left) / box.width) * 100, ((event.clientY - box.top) / box.height) * 100);
    const town = nearestTown(lat, lon, 15);
    void placeHome({ name: town ? `cerca de ${town}` : "punto marcado", lat, lon });
  }

  const [x, y] = project(home.lat, home.lon);

  return (
    <div className="flex w-full max-w-[560px] flex-col gap-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-[28px] border border-[#1c2733] bg-[#0d1219] shadow-[0_50px_100px_-40px_rgb(0_0_0/0.9)]">
        {children}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -translate-1/2 rounded-full border border-[#38d6e8]/45 transition-[left,top] duration-500 ease-out"
          style={{ left: `${x}%`, top: `${y}%`, width: `${RING}%`, height: `${RING}%` }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -translate-1/2 transition-[left,top] duration-500 ease-out"
          style={{ left: `${x}%`, top: `${y}%` }}
        >
          <span className="mn-ring absolute top-1/2 left-1/2 size-8 -translate-1/2 rounded-full border-2 border-[#38d6e8]" />
          <span className="block size-3.5 rounded-full border-[3px] border-white bg-accent" />
        </span>
        <button
          type="button"
          onClick={onMapClick}
          aria-label="Toca el mapa para poner tu casa"
          className="absolute inset-0 cursor-crosshair rounded-[28px] focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[#38d6e8]"
        />
        <div
          aria-live="polite"
          className="pointer-events-none absolute right-3 bottom-3 left-3 flex flex-col gap-0.5 rounded-2xl bg-[#0b0e13]/85 px-4 py-3 backdrop-blur-sm"
        >
          <span className="text-xs text-muted">Tu casa · {home.name}</span>
          <span className={`text-base font-semibold sm:text-lg ${TONE[verdict.tone]}`}>{verdict.title}</span>
          <span className="text-[13px] text-soft sm:text-sm">{verdict.advice}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] text-muted">Pon tu casa en:</span>
        {places.map((place) => (
          <button
            key={place.name}
            type="button"
            onClick={() => void placeHome(place)}
            aria-pressed={home.name === place.name}
            className="min-h-11 rounded-full border border-[#263040] px-3.5 text-sm text-soft transition-colors hover:border-[#38d6e8] hover:text-fg aria-pressed:border-[#38d6e8] aria-pressed:bg-[#38d6e8]/10 aria-pressed:text-fg"
          >
            {place.name}
          </button>
        ))}
        <span className="text-[13px] text-muted">o toca el mapa.</span>
      </div>
      {legend}
    </div>
  );
}
