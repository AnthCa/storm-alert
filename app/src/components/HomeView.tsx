"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { useNow } from "@/lib/browser-store";
import {
  AROUND_KM,
  NEAR_KM,
  activityAt,
  insideObservedArea,
  nearestStorm,
  nearestTown,
  stormTrend,
  type Activity,
  type StormNearby,
  type Trend,
} from "@/lib/geo";
import { ago, dataState, formatC, localTime, type DataState, type Status } from "@/lib/status";
import { ChevronRightIcon, CloudIcon, InfoIcon, LocateIcon, PinIcon, WarningIcon } from "./Icons";
import { AppHeader } from "./AppHeader";
import { DemoBanner } from "./DemoBanner";
import { ShareStatus } from "./ShareStatus";
import { useStatus } from "./StatusProvider";

// MapLibre needs the browser (WebGL), so the map is never server-rendered.
const StormMap = dynamic(() => import("./StormMap"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-bg" />,
});

export function HomeView() {
  const { status, error, demo, online, place, setPlace, clearPlace, locate } = useStatus();
  const [locateMessage, setLocateMessage] = useState<string | null>(null);
  // The map comes first: the sheet stays short unless the viewer asks for details.
  const [expanded, setExpanded] = useState(false);
  const now = useNow();
  // Before hydration (now = 0) data counts as current; the clock corrects it a moment later.
  const state = dataState(status, { demo, online, now: now ? new Date(now) : undefined });
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
        <StormMap
          status={status}
          place={place}
          onPick={(lat, lon) => setPlace({ lat, lon, source: "map" })}
          summaryId="storm-summary"
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2.5 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <AppHeader status={status} state={state} now={now} />
        <DemoBanner />
        <StateBanner status={status} state={state} error={error} now={now} hasPlace={!!place} />
      </div>

      <section
        id="storm-summary"
        className="absolute inset-x-0 bottom-18 z-10 flex flex-col gap-2.5 rounded-t-[22px] border-t border-line bg-surface px-4 pt-1 pb-3"
        aria-label="Actividad en tu ubicación"
        aria-live="polite"
      >
        <button
          type="button"
          onClick={handleLocate}
          aria-label="Usar mi ubicación"
          className="absolute -top-16 right-4 flex size-12 items-center justify-center rounded-full border border-line bg-surface"
        >
          <LocateIcon />
        </button>
        {status && (
          <p className="pointer-events-none absolute -top-9 left-4 rounded-lg bg-bg/80 px-2 py-1 text-xs text-soft">
            Nubes de las {localTime(status.latest_scan_utc)} · rayos hasta las {localTime(status.data_until_utc)}
          </p>
        )}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls="storm-details"
          aria-label={expanded ? "Ocultar detalles" : "Ver detalles"}
          className="flex min-h-6 w-full items-center justify-center"
        >
          <span className="h-1 w-10 rounded-full bg-[#3a424d]" aria-hidden="true" />
        </button>
        {place && activity && status ? (
          <PlaceSummary
            activity={activity}
            status={status}
            state={state}
            place={place}
            town={nearestTown(place.lat, place.lon)}
            detailed={expanded}
            onClear={clearPlace}
          />
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex grow flex-col gap-0.5">
              <h2 className="text-lg font-bold tracking-tight">¿Dónde estás?</h2>
              <p className="text-[13px] text-soft">Usa tu ubicación o toca el mapa.</p>
            </div>
            <button
              type="button"
              onClick={handleLocate}
              className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-accent px-3.5 text-sm font-semibold text-white"
            >
              <LocateIcon size={18} /> Ubicarme
            </button>
          </div>
        )}
        {locateMessage && (
          <p className="text-[13px] text-soft" role="status">
            {locateMessage}
          </p>
        )}
        {expanded && (
          <div id="storm-details" className="flex flex-col gap-3">
            {status && (
              <Stats status={status} activity={activity} current={state === "healthy" || state === "degraded"} />
            )}
            <Legend />
            {status && state === "healthy" && <ShareStatus status={status} />}
          </div>
        )}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls="storm-details"
          className="flex min-h-9 items-center justify-center gap-1 text-[13px] font-semibold text-quiet"
        >
          {expanded ? "Ocultar detalles" : "Ver detalles"}
          <ChevronRightIcon size={14} className={expanded ? "-rotate-90" : "rotate-90"} />
        </button>
      </section>
    </main>
  );
}

const PROBLEM_TEXT: Record<string, string> = {
  glm_incomplete: "faltan datos de rayos",
  glm_late: "los datos de rayos están atrasados",
  abi_incomplete: "faltan imágenes de nubes",
  abi_late: "las imágenes de nubes están atrasadas",
  health_not_reported: "el procesador no informó la calidad de los datos",
};

function problemsText(status: Status): string {
  const parts = status.health.problems.map((p) => PROBLEM_TEXT[p]).filter(Boolean);
  return parts.length ? `${parts.join(", ")}.` : "";
}

function StateBanner(props: {
  status: Status | null;
  state: DataState;
  error: string | null;
  now: number;
  /** With a place set, the sheet already gives the distance to the nearest storm. */
  hasPlace: boolean;
}) {
  const { status, state, error, now, hasPlace } = props;
  if (!status) {
    return (
      <Banner tone="neutral" title={error ? "No pudimos cargar los datos" : "Cargando datos del satélite…"}>
        {error ? "No podemos confirmar el estado actual. Reintentando…" : null}
      </Banner>
    );
  }
  if (state === "offline") {
    return (
      <Banner tone="neutral" title="Sin conexión">
        Mostrando los últimos datos guardados, de las {localTime(status.data_until_utc)} {now > 0 && `(${ago(status.data_until_utc, new Date(now))})`}.
        No son actuales.
      </Banner>
    );
  }
  if (state === "stale") {
    return (
      <Banner tone="neutral" title="Datos atrasados" icon="warning">
        No llegan datos nuevos desde las {localTime(status.data_until_utc)}. No podemos confirmar el estado actual.
      </Banner>
    );
  }

  const partial = state === "degraded" ? ` Datos parciales: ${problemsText(status)}` : "";
  if (status.level === "severe") {
    return (
      <Link
        href="/observacion"
        className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-severe-strong px-3.5 py-3 text-white"
      >
        <WarningIcon />
        <div className="flex grow flex-col gap-0.5">
          <div className="text-[15px] font-bold">Actividad convectiva intensa observada</div>
          <div className="text-[13px]">
            Observación experimental cerca de Requínoa. Revisa los avisos oficiales.{partial}
          </div>
        </div>
        <ChevronRightIcon size={18} />
      </Link>
    );
  }
  if (status.level === "deep_convection") {
    return (
      <Banner tone="convective" title="Nubes de tormenta en el área monitoreada">
        Puede haber chubascos y rayos. Sin actividad intensa observada.{partial}
      </Banner>
    );
  }
  if (status.level === "unknown" || state !== "healthy") {
    return (
      <Banner tone="neutral" title="Datos incompletos" icon="warning">
        No podemos confirmar el estado actual: {problemsText(status) || "la información está incompleta."}
      </Banner>
    );
  }
  const regional = nearestStorm(status, ...status.center);
  if (regional && regional.km > status.radius_km) {
    return (
      <Banner tone="quiet" title="Sin actividad observada en el área de alerta">
        {!hasPlace &&
          `Hay nubes de tormenta a ${Math.round(regional.km)} km al ${regional.direction} de Requínoa, fuera de los ${status.radius_km} km que vigilamos. `}
        <ForecastNote />
      </Banner>
    );
  }
  return (
    <Banner tone="quiet" title="Sin actividad observada ahora">
      En los {status.radius_km} km alrededor de Requínoa. <ForecastNote />
    </Banner>
  );
}

/** "Quiet" describes this moment only; it must not read as an all-clear for the afternoon. */
function ForecastNote() {
  return (
    <>
      No descarta tormentas más tarde.{" "}
      <Link href="/oficiales" className="font-semibold text-quiet underline underline-offset-2">
        Revisa los pronósticos oficiales
      </Link>
      .
    </>
  );
}

function Banner({
  tone,
  title,
  icon,
  children,
}: {
  tone: "quiet" | "convective" | "neutral";
  title: string;
  icon?: "warning";
  children?: React.ReactNode;
}) {
  const styles = {
    quiet: "border-quiet-line bg-quiet-bg",
    convective: "border-[#6b4a14] bg-[#2e2210]",
    neutral: "border-line bg-surface/95",
  }[tone];
  const Icon = icon === "warning" ? WarningIcon : tone === "quiet" ? InfoIcon : CloudIcon;
  const iconColor = tone === "quiet" ? "text-quiet" : tone === "convective" ? "text-convective" : "text-soft";
  return (
    <div className={`pointer-events-auto flex items-center gap-3 rounded-2xl border px-3.5 py-3 ${styles}`} role="status">
      <Icon className={`shrink-0 ${iconColor}`} />
      <div className="flex flex-col gap-0.5">
        <div className="text-[15px] font-semibold">{title}</div>
        {children && <div className="text-[13px] text-soft">{children}</div>}
      </div>
    </div>
  );
}

/** "Se acercan: hace 30 min estaban a 62 km." Observed movement of the closest cold tops. */
function trendText(trend: Trend | null): string | null {
  if (!trend) return null;
  if (trend.kind === "new") return `Se formaron en los últimos ${trend.minutes} min.`;
  if (trend.kind === "steady") return `Sin desplazamiento claro en ${trend.minutes} min.`;
  const verb = trend.kind === "approaching" ? "Se acercan" : "Se alejan";
  return `${verb}: hace ${trend.minutes} min estaban a ${Math.round(trend.wasKm)} km.`;
}

function stormLine(storm: StormNearby | null, trend: Trend | null, prefix: string): string {
  if (!storm) return "El satélite no ve nubes de tormenta en la región.";
  return [`${prefix}: ${Math.round(storm.km)} km al ${storm.direction}.`, trendText(trend)].filter(Boolean).join(" ");
}

function PlaceSummary(props: {
  activity: Activity;
  status: Status;
  state: DataState;
  place: { lat: number; lon: number };
  town: string | null;
  /** The long outside-area explanation only shows with the details open. */
  detailed: boolean;
  onClear: () => void;
}) {
  const { activity, status, state, place, town, detailed, onClear } = props;
  const { level, nearest } = activity;
  const current = state === "healthy" || state === "degraded";
  const storm = nearestStorm(status, place.lat, place.lon);
  const trend = stormTrend(status, place.lat, place.lon);
  const observed = insideObservedArea(status, place.lat, place.lon);
  let title: string;
  let advice: string;
  let context: string | null = null;
  let tone: string;

  if (level === "outside" && observed) {
    title = storm ? `Nubes de tormenta a ${Math.round(storm.km)} km` : "Sin nubes de tormenta cerca";
    advice = storm
      ? [`Al ${storm.direction} de ti.`, trendText(trend)].filter(Boolean).join(" ")
      : "El satélite no ve nubes de tormenta en la región.";
    context = `Estás fuera del área de alerta (${status.radius_km} km alrededor de Requínoa): aquí solo mostramos lo que ve el satélite. Revisa los avisos oficiales.`;
    tone = storm && storm.km <= AROUND_KM ? "text-convective" : "text-soft";
  } else if (level === "outside") {
    title = "Fuera del área monitoreada";
    advice = `Por ahora solo observamos la zona de O'Higgins y alertamos ${status.radius_km} km alrededor de Requínoa. Revisa los avisos oficiales para tu zona.`;
    tone = "text-soft";
  } else if (level === "over") {
    title = "Actividad sobre tu zona";
    advice = "Hay rayos muy cerca. Entra a un lugar cerrado.";
    tone = "text-severe";
  } else if (level === "near" && nearest) {
    title = `Actividad a ${Math.round(nearest.km)} km al ${nearest.direction}`;
    advice =
      status.level === "severe"
        ? "Se está intensificando. Si estás al aire libre, busca refugio."
        : "Mantente atento por si se acerca.";
    context = trendText(trend);
    tone = status.level === "severe" ? "text-severe" : "text-convective";
  } else if (state === "healthy") {
    title = `Sin actividad a menos de ${AROUND_KM} km`;
    advice = "Revisamos el satélite cada 10 minutos.";
    context = storm ? stormLine(storm, trend, "Nubes de tormenta más cercanas") : null;
    tone = "text-quiet";
  } else {
    title = "No podemos confirmar el estado";
    advice = "Los datos están incompletos o atrasados.";
    tone = "text-soft";
  }

  return (
    <div className="flex flex-col gap-0.5">
      <div className="-my-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[13px] text-muted">
          <PinIcon size={14} className="text-quiet" />
          Tu ubicación{town ? ` · ${town}` : ""}
        </div>
        <button type="button" onClick={onClear} aria-label="Borrar ubicación" className="min-h-11 px-1 text-[13px] text-quiet">
          Borrar
        </button>
      </div>
      <h2 className={`text-xl font-bold tracking-tight ${tone}`}>{title}</h2>
      <p className="text-sm text-soft">{advice}</p>
      {context && current && (detailed || level !== "outside") && <p className="text-[13px] text-soft">{context}</p>}
      {!current && (level !== "outside" || observed) && (
        <p className="text-[13px] text-muted">Según datos de las {localTime(status.data_until_utc)}.</p>
      )}
    </div>
  );
}

/** When the data is stale, offline or historical, the numbers are dimmed and carry their time. */
function Stats({ status, activity, current }: { status: Status; activity: Activity | null; current: boolean }) {
  const bins = status.flashes_per_5min;
  const last = bins.at(-1)?.count ?? null;
  const previous = bins.at(-2)?.count ?? null;
  const trend = last !== null && previous !== null ? (last > previous ? " ↑" : last < previous ? " ↓" : "") : "";
  const inside = activity?.insideValidatedArea ?? false;
  const asOf = `a las ${localTime(status.data_until_utc)}`;
  return (
    <div className={`grid grid-cols-3 gap-2 ${current ? "" : "opacity-70"}`}>
      <Stat
        label={`Rayos a ${NEAR_KM} km`}
        value={activity && inside ? String(activity.flashesNear) : "—"}
        note={current ? "últimos 10 min" : asOf}
      />
      <Stat
        label="Nube más fría"
        value={
          inside && activity?.coldestAroundC != null
            ? `${formatC(activity.coldestAroundC)}°`
            : `${formatC(status.coldest_top_c)}°`
        }
        note={current ? (inside && activity?.coldestAroundC != null ? `a ${AROUND_KM} km de ti` : "área monitoreada") : asOf}
      />
      <Stat
        label="Rayos área"
        value={last === null ? "—" : `${last}${trend}`}
        note={last === null ? "sin datos" : current ? "cada 5 min" : asOf}
        highlight={status.level === "severe"}
      />
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
    { label: "Área monitoreada", className: "border-[1.5px] border-dashed border-[#7a8491]" },
  ];
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-soft" aria-label="Leyenda del mapa">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span className={`size-2.5 rounded-full ${item.className}`} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
