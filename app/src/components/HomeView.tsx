"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { AROUND_KM, NEAR_KM, activityAt, nearestTown, type Activity } from "@/lib/geo";
import { STALE_AFTER_MIN, formatC, localTime, minutesOld, type Status } from "@/lib/status";
import { BoltIcon, CheckIcon, ChevronRightIcon, CloudIcon, LocateIcon, PinIcon, WarningIcon } from "./Icons";
import { DemoBanner } from "./DemoBanner";
import { useStatus } from "./StatusProvider";

// MapLibre needs the browser (WebGL), so the map is never server-rendered.
const StormMap = dynamic(() => import("./StormMap"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-bg" />,
});

export function HomeView() {
  const { status, error, demo, place, setPlace, locate } = useStatus();
  const [locateMessage, setLocateMessage] = useState<string | null>(null);
  const activity = status && place ? activityAt(status, place.lat, place.lon) : null;

  async function handleLocate() {
    setLocateMessage("Buscando tu ubicación…");
    const result = await locate();
    setLocateMessage(
      result === "ok"
        ? null
        : result === "denied"
          ? "No diste permiso de ubicación. Toca el mapa para marcar dónde estás."
          : "No pudimos obtener tu ubicación. Toca el mapa para marcarla.",
    );
  }

  return (
    <main className="relative h-dvh overflow-hidden">
      <div className="absolute inset-x-0 top-0 bottom-18">
        <StormMap status={status} place={place} onPick={(lat, lon) => setPlace({ lat, lon, source: "map" })} />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2.5 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BoltIcon className="text-bolt" />
            <span className="text-[17px] font-bold tracking-tight">Storm Alert</span>
            <span className="text-[13px] text-muted">O&apos;Higgins</span>
          </div>
          {status && (
            <span className="rounded-full border border-line bg-surface/90 px-2.5 py-1.5 font-mono text-xs text-soft">
              {localTime(status.data_until_utc)} · próx. {localTime(nextUpdate(status))}
            </span>
          )}
        </header>
        <DemoBanner />
        <RegionBanner
          status={status}
          error={error}
          demo={demo}
          insideArea={activity?.insideValidatedArea ?? true}
        />
      </div>

      <section
        className="absolute inset-x-0 bottom-18 z-10 flex flex-col gap-3.5 rounded-t-[22px] border-t border-line bg-surface px-4 pt-2.5 pb-4"
        aria-label="Actividad en tu ubicación"
      >
        <button
          type="button"
          onClick={handleLocate}
          aria-label="Usar mi ubicación"
          className="absolute -top-16 right-4 flex size-12 items-center justify-center rounded-full border border-line bg-surface"
        >
          <LocateIcon />
        </button>
        <div className="h-1 w-10 self-center rounded-full bg-[#3a424d]" />
        {place && activity && status ? (
          <PlaceSummary activity={activity} status={status} town={nearestTown(place.lat, place.lon)} />
        ) : (
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold tracking-tight">¿Dónde estás?</h2>
            <p className="text-sm text-soft">Te mostramos qué tan cerca está la tormenta más próxima.</p>
            <button
              type="button"
              onClick={handleLocate}
              className="mt-1 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent font-semibold text-white"
            >
              <LocateIcon size={20} /> Usar mi ubicación
            </button>
            <p className="text-center text-[13px] text-muted">o toca el mapa para marcarla</p>
          </div>
        )}
        {locateMessage && <p className="text-[13px] text-soft">{locateMessage}</p>}
        {status && <Stats status={status} activity={activity} />}
        <Legend />
      </section>
    </main>
  );
}

function nextUpdate(status: Status): string {
  return new Date(new Date(status.data_until_utc).getTime() + 10 * 60_000).toISOString();
}

function RegionBanner(props: { status: Status | null; error: string | null; demo: boolean; insideArea: boolean }) {
  const { status, error, demo, insideArea } = props;
  if (!status) {
    return (
      <div className="pointer-events-auto rounded-2xl border border-line bg-surface/95 px-3.5 py-3 text-sm text-soft">
        {error ? "No pudimos cargar los datos del satélite. Reintentando…" : "Cargando datos del satélite…"}
      </div>
    );
  }
  const age = minutesOld(status);
  // A replay is old by definition; only live data can be stale.
  const stale = !demo && age > STALE_AFTER_MIN && (
    <div className="text-[13px]">Datos de hace {age < 120 ? `${age} min` : `${Math.round(age / 60)} h`}</div>
  );

  if (status.level === "severe") {
    return (
      <Link
        href="/alerta"
        className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-severe-strong px-3.5 py-3 text-white"
      >
        <WarningIcon />
        <div className="flex grow flex-col gap-0.5">
          <div className="text-[15px] font-bold">
            {insideArea ? "Tormenta severa en tu zona" : "Tormenta severa cerca de Requínoa"}
          </div>
          <div className="text-[13px]">Posible granizo, viento fuerte o tornado</div>
          {stale}
        </div>
        <ChevronRightIcon size={18} />
      </Link>
    );
  }
  if (status.level === "deep_convection") {
    return (
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-[#6b4a14] bg-[#2e2210] px-3.5 py-3">
        <CloudIcon className="text-convective" />
        <div className="flex flex-col gap-0.5">
          <div className="text-[15px] font-semibold">Nubes de tormenta en la región</div>
          <div className="text-[13px] text-soft">Puede haber chubascos y rayos. Sin alerta por ahora.</div>
          {stale}
        </div>
      </div>
    );
  }
  return (
    <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-quiet-line bg-quiet-bg px-3.5 py-3">
      <CheckIcon className="text-quiet" />
      <div className="flex flex-col gap-0.5">
        <div className="text-[15px] font-semibold">Sin tormentas en la región</div>
        <div className="text-[13px] text-soft">El satélite no detecta nubes de tormenta ni rayos.</div>
        {stale}
      </div>
    </div>
  );
}

function PlaceSummary({ activity, status, town }: { activity: Activity; status: Status; town: string | null }) {
  const { level, nearest } = activity;
  const severe = status.level === "severe";
  let title: string;
  let advice: string;
  let tone: string;
  if (level === "over") {
    title = "Tormenta sobre tu zona";
    advice = "Hay rayos muy cerca. Entra a un lugar cerrado.";
    tone = "text-severe";
  } else if (level === "near" && nearest) {
    title = `Tormenta a ${Math.round(nearest.km)} km al ${nearest.direction}`;
    advice = severe
      ? "Se está intensificando. Si estás al aire libre, busca refugio."
      : "Mantente atento por si se acerca.";
    tone = severe ? "text-severe" : "text-convective";
  } else {
    title = `Sin tormentas a menos de ${AROUND_KM} km`;
    advice = "Revisamos el satélite cada 10 minutos.";
    tone = "text-quiet";
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[13px] text-muted">
        <PinIcon size={14} className="text-quiet" />
        Tu ubicación{town ? ` · ${town}` : ""}
      </div>
      <h2 className={`text-2xl font-bold tracking-tight ${tone}`}>{title}</h2>
      <p className="text-sm text-soft">{advice}</p>
      {!activity.insideValidatedArea && (
        <p className="text-[13px] text-muted">Fuera del área validada (50 km de Requínoa): úsalo como referencia.</p>
      )}
    </div>
  );
}

function Stats({ status, activity }: { status: Status; activity: Activity | null }) {
  const bins = status.flashes_per_5min;
  const last = bins.at(-1)?.count ?? 0;
  const previous = bins.at(-2)?.count ?? 0;
  const trend = last > previous ? " ↑" : last < previous ? " ↓" : "";
  return (
    <div className="grid grid-cols-3 gap-2">
      <Stat label={`Rayos a ${NEAR_KM} km`} value={activity ? String(activity.flashesNear) : "—"} note="últimos 10 min" />
      <Stat
        label="Nube más fría"
        value={activity?.coldestAroundC != null ? `${formatC(activity.coldestAroundC)}°` : `${formatC(status.coldest_top_c)}°`}
        note={activity?.coldestAroundC != null ? `a ${AROUND_KM} km de ti` : "en la zona"}
      />
      <Stat label="Rayos zona" value={`${last}${trend}`} note="cada 5 min" highlight={status.level === "severe"} />
    </div>
  );
}

function Stat({ label, value, note, highlight }: { label: string; value: string; note: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-surface-2 p-2.5">
      <div className="text-xs text-muted">{label}</div>
      <div className={`font-mono text-lg ${highlight ? "text-severe" : ""}`}>{value}</div>
      <div className="text-[11px] text-muted">{note}</div>
    </div>
  );
}

function Legend() {
  const items = [
    { label: "Rayo", className: "border-[1.5px] border-bolt" },
    { label: "Nube de tormenta", className: "bg-convective" },
    { label: "Fuerte", className: "bg-[#f0644f]" },
    { label: "Núcleo", className: "bg-[#c2261b]" },
  ];
  return (
    <ul className="flex flex-wrap gap-3 text-xs text-soft" aria-label="Leyenda del mapa">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span className={`size-2 rounded-full ${item.className}`} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
