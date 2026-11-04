"use client";

import Link from "next/link";
import { useStoredValue } from "@/lib/browser-store";
import { distanceKm, nearestStorm } from "@/lib/geo";
import { PUSH_KEY, isLegacy, type LegacyAlerts, type StoredAlerts } from "@/lib/push-places";
import type { ReplayFrame } from "@/lib/replay";
import { formatC, localTime, type Status } from "@/lib/status";
import { PlayIcon } from "./Icons";

const FRAME_MS = 10 * 60_000;
// The cloud threshold of the storm colours (algorithm 2026.11-r1).
const COLD_TOP_C = -38;

/**
 * The last half hour under the map: one button per scan with its coldest top and the
 * lightning of the 10 minutes before it. A click replays from that scan.
 */
export function TimeStrip(props: {
  status: Status;
  frames: ReplayFrame[];
  playing: number | null;
  onPlay: (index: number) => void;
  onStop: () => void;
}) {
  const { status, frames, playing, onPlay, onStop } = props;
  const max = Math.max(1, ...status.flashes_per_5min.map((b) => b.count ?? 0));
  return (
    <section
      aria-label="Últimos 30 minutos"
      className="flex shrink-0 items-stretch gap-4 border-t border-line bg-surface px-5 py-3.5"
    >
      <button
        type="button"
        onClick={playing === null ? () => onPlay(0) : onStop}
        className="flex min-h-11 shrink-0 items-center gap-2 self-center rounded-xl bg-accent px-4 text-sm font-semibold whitespace-nowrap text-white"
      >
        {playing === null ? (
          <>
            <PlayIcon size={14} /> Repetir {frames.length > 1 ? Math.round((Date.parse(frames.at(-1)!.timeUtc) - Date.parse(frames[0].timeUtc)) / 60_000) : 0} min
          </>
        ) : (
          <>
            <span className="size-2.5 rounded-[2px] bg-white" aria-hidden="true" /> Detener
          </>
        )}
      </button>
      <ol className="grid grow gap-2" style={{ gridTemplateColumns: `repeat(${frames.length}, minmax(0, 1fr))` }}>
        {frames.map((frame, i) => {
          const at = Date.parse(frame.timeUtc);
          const bins = status.flashes_per_5min.filter((b) => {
            const start = Date.parse(b.start_utc);
            return start >= at - FRAME_MS && start < at;
          });
          const flashes = bins.reduce((sum, b) => sum + (b.count ?? 0), 0);
          const top = status.cloud_tops.find((t) => Math.abs(Date.parse(t.time_utc) - at) < 60_000);
          const current = playing === null ? i === frames.length - 1 : playing === i;
          return (
            <li key={frame.timeUtc}>
              <button
                type="button"
                onClick={() => onPlay(i)}
                aria-current={current ? "true" : undefined}
                aria-label={`Ver las ${localTime(frame.timeUtc)}: ${flashes} rayos en el área${top ? `, nube más fría ${formatC(top.min_bt_c)} grados` : ""}`}
                className={`flex w-full flex-col gap-1.5 rounded-xl border bg-bg px-2.5 py-2 text-left ${current ? "border-quiet" : "border-line"}`}
              >
                <span className="flex flex-wrap justify-between gap-x-2 font-mono text-xs text-soft">
                  <span>{localTime(frame.timeUtc)}</span>
                  <span>{top ? `${formatC(top.min_bt_c)}°` : "—"}</span>
                </span>
                <span className="flex h-6 items-end gap-0.5" aria-hidden="true">
                  {bins.map((b) => (
                    <span
                      key={b.start_utc}
                      className="min-h-0.5 grow rounded-t-sm bg-bolt"
                      style={{ height: `${Math.round(((b.count ?? 0) / max) * 100)}%` }}
                    />
                  ))}
                </span>
                <span className="text-[11px] text-muted">{flashes} rayos</span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** The places this phone or computer gets notifications for, with what is near each. */
export function SavedPlacesTable({ status }: { status: Status }) {
  const [alerts] = useStoredValue<StoredAlerts | LegacyAlerts | null>(PUSH_KEY, null);
  const places = alerts && !isLegacy(alerts) ? alerts.places : [];
  const dataEnd = Date.parse(status.data_until_utc);
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold">Tus lugares</h2>
        <Link href="/notificaciones" className="text-[13px] text-quiet">
          {places.length ? "Editar" : "Agregar"}
        </Link>
      </div>
      {places.length === 0 ? (
        <p className="text-[13px] text-soft">
          Con las notificaciones del piloto puedes seguir hasta 3 lugares: tu casa, la de tu familia o el colegio.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="px-3 py-2.5 font-medium">Lugar</th>
                <th className="px-2 py-2.5 font-medium">Actividad</th>
                <th className="px-3 py-2.5 text-right font-medium">Último rayo</th>
              </tr>
            </thead>
            <tbody>
              {places.map((place) => {
                const storm = nearestStorm(status, place.lat, place.lon);
                const near = storm && storm.km <= place.radius;
                const ages = status.flash_cells_30min
                  .filter(([lat, lon]) => distanceKm(place.lat, place.lon, lat, lon) <= place.radius)
                  .map(([, , age]) => age);
                const last = ages.length ? localTime(new Date(dataEnd - Math.min(...ages) * 60_000).toISOString()) : "—";
                return (
                  <tr key={`${place.lat},${place.lon},${place.name}`} className="border-t border-line">
                    <td className="px-3 py-3 font-semibold">{place.name}</td>
                    <td className={`px-2 py-3 ${near ? "text-convective" : "text-muted"}`}>
                      {near ? `${Math.round(storm.km)} km al ${storm.direction}` : "Sin actividad cerca"}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-soft">{last}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Coldest cloud top in the alert area per scan, against the storm threshold. */
export function CloudTrend({ status }: { status: Status }) {
  const tops = status.cloud_tops;
  if (tops.length < 2) return null;
  const values = tops.map((t) => t.min_bt_c);
  const low = Math.min(COLD_TOP_C - 4, ...values) - 2;
  const high = Math.max(COLD_TOP_C + 14, ...values) + 2;
  const W = 400;
  const H = 120;
  const x = (i: number) => 44 + (i * (W - 60)) / (tops.length - 1);
  const y = (c: number) => 10 + ((high - c) / (high - low)) * (H - 30);
  const first = tops[0];
  const lastTop = tops.at(-1)!;
  const crossed = values.some((v) => v <= COLD_TOP_C);
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[15px] font-semibold">Nube más fría en el área de alerta</h2>
      <svg
        role="img"
        aria-label={`La nube más fría pasó de ${formatC(first.min_bt_c)} a ${formatC(lastTop.min_bt_c)} grados entre las ${localTime(first.time_utc)} y las ${localTime(lastTop.time_utc)}.`}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
      >
        <line x1={44} x2={W - 10} y1={y(COLD_TOP_C)} y2={y(COLD_TOP_C)} stroke="#f5aa3c" strokeDasharray="4 4" />
        <text x={38} y={y(COLD_TOP_C) + 4} textAnchor="end" fill="#f5b95e" fontSize="11" fontFamily="var(--font-plex-mono)">
          −38°
        </text>
        <polyline
          points={tops.map((t, i) => `${x(i)},${y(t.min_bt_c)}`).join(" ")}
          fill="none"
          stroke="#d6dee7"
          strokeWidth="2.5"
        />
        {tops.map((t, i) => (
          <circle key={t.time_utc} cx={x(i)} cy={y(t.min_bt_c)} r="4" fill={t.min_bt_c <= COLD_TOP_C ? "#f5aa3c" : "#d6dee7"} />
        ))}
        <text x={x(0)} y={H - 4} textAnchor="middle" fill="#8a949f" fontSize="11" fontFamily="var(--font-plex-mono)">
          {localTime(first.time_utc)}
        </text>
        <text x={x(tops.length - 1)} y={H - 4} textAnchor="middle" fill="#8a949f" fontSize="11" fontFamily="var(--font-plex-mono)">
          {localTime(lastTop.time_utc)}
        </text>
      </svg>
      <p className="text-[13px] text-soft">
        Más fría = más alta. {crossed ? "Bajo la línea naranja" : "Desde la línea naranja"} se pinta como nube de tormenta
        {crossed ? "." : "; en esta media hora no llegó."}
      </p>
    </section>
  );
}

