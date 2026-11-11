"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useNow, useStoredValue, useWide } from "@/lib/browser-store";
import {
  AROUND_KM,
  NEAR_KM,
  activityAt,
  etaText,
  insideObservedArea,
  lastFlashNear,
  lightningWithin,
  nearestStorm,
  nearestTown,
  stormEta,
  stormTrend,
  type Activity,
  type StormNearby,
  type Trend,
} from "@/lib/geo";
import { CLOUD_RAMP } from "@/lib/cloud-image";
import { replayFrames, type ReplayFrame } from "@/lib/replay";
import { ago, dataState, formatC, localTime, type DataState, type Status } from "@/lib/status";
import { BoltFilledIcon, CheckIcon, ChevronRightIcon, CloudIcon, InfoIcon, LocateIcon, PinIcon, PlayIcon, WarningIcon } from "./Icons";
import { AppHeader } from "./AppHeader";
import { DemoBanner } from "./DemoBanner";
import { CloudTrend, SavedPlacesTable, TimeStrip } from "./DesktopPanels";
import { ShareStatus } from "./ShareStatus";
import { SkyReport } from "./SkyReport";
import { useStatus } from "./StatusProvider";
import { WeatherDetails, WeatherLine } from "./WeatherNow";

// MapLibre needs the browser (WebGL), so the map is never server-rendered.
const StormMap = dynamic(() => import("./StormMap"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-bg" />,
});

const ALL_CLOUDS_KEY = "miranubes:all-clouds";

export function HomeView() {
  const { status, error, demo, online, place, setPlace, clearPlace, locate } = useStatus();
  const [locateMessage, setLocateMessage] = useState<string | null>(null);
  // A tap on the map while exploring it must not move a place that is already set:
  // it waits here until the viewer confirms.
  const [pendingMove, setPendingMove] = useState<{ lat: number; lon: number } | null>(null);
  // The map comes first: the sheet stays short unless the viewer asks for details.
  const [expanded, setExpanded] = useState(false);
  // Replay of the last scans: the frames are taken when it starts, so new data does not cut it.
  const [replay, setReplay] = useState<{ frames: ReplayFrame[]; index: number } | null>(null);
  // The map (MapLibre) is the heaviest part of the page: load it once the status text has
  // had its chance to paint, so the answer people came for shows first.
  const [mapReady, setMapReady] = useState(false);
  useEffect(() => {
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(() => setMapReady(true), { timeout: 1200 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(() => setMapReady(true), 300);
    return () => clearTimeout(id);
  }, []);
  // The grey "sky from above" layer is on unless the viewer turned it off.
  const [allClouds, setAllClouds] = useStoredValue(ALL_CLOUDS_KEY, true);
  // Wide screens: map and time strip on the left, an always-open detail panel on the right.
  const wide = useWide();
  const detailed = expanded || wide;

  useEffect(() => {
    if (!replay) return;
    const last = replay.index === replay.frames.length - 1;
    const timer = setTimeout(
      () => setReplay(last ? null : { ...replay, index: replay.index + 1 }),
      last ? REPLAY_HOLD_MS : REPLAY_STEP_MS,
    );
    return () => clearTimeout(timer);
  }, [replay]);
  const now = useNow();
  // Before hydration (now = 0) data counts as current; the clock corrects it a moment later.
  const state = dataState(status, { demo, online, now: now ? new Date(now) : undefined });
  const activity = status && place ? activityAt(status, place.lat, place.lon) : null;
  const frames = status && state !== "historical" ? replayFrames(status) : [];
  // Current conditions only make sense for live data at a chosen place.
  const stormWithLightning =
    !!activity &&
    (activity.level === "over" || activity.level === "near") &&
    !!place &&
    !!status &&
    lightningWithin(status, place.lat, place.lon, AROUND_KM);
  const weather =
    place && status && !demo && state !== "historical"
      ? {
          lat: place.lat,
          lon: place.lon,
          town: nearestTown(place.lat, place.lon),
          refreshKey: status.data_until_utc,
          hideRain: stormWithLightning,
        }
      : null;

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

  const locateButton = (
    <button
      type="button"
      onClick={handleLocate}
      aria-label="Usar mi ubicación"
      className={`absolute flex size-12 items-center justify-center rounded-full border border-line bg-surface ${wide ? "right-4 bottom-4" : "-top-16 right-4"}`}
    >
      <LocateIcon />
    </button>
  );

  return (
    <main className="relative h-dvh overflow-hidden lg:flex lg:pt-16">
      <h1 className="sr-only">Miranubes: tormentas y rayos en vivo sobre O&apos;Higgins</h1>
      <div className="absolute inset-x-0 top-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:relative lg:inset-auto lg:flex lg:min-w-0 lg:grow lg:flex-col">
        <div className="relative size-full lg:min-h-0 lg:grow">
          {mapReady && (
            <StormMap
              status={status}
              place={place}
              onPick={(lat, lon, dragged) => {
                if (place && !dragged) return setPendingMove({ lat, lon });
                setPendingMove(null);
                setPlace({ lat, lon, source: "map" });
              }}
              summaryId="storm-summary"
              replay={replay ? replay.frames[replay.index] : null}
              allClouds={allClouds}
              current={state === "healthy" || state === "degraded"}
            />
          )}

          {/* Keeps whatever floats on top readable over any part of the map. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-bg/85 via-bg/40 to-transparent" />
          <div
            id="map-top-overlay"
            className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2.5 px-4 pt-[max(1rem,env(safe-area-inset-top))] lg:max-w-3xl"
          >
            <AppHeader status={status} state={state} now={now} />
            <DemoBanner />
            <StateBanner status={status} state={state} error={error} now={now} hasPlace={!!place} />
          </div>
          {wide && locateButton}
        </div>
        {wide && status && frames.length >= 2 && (
          <TimeStrip
            status={status}
            frames={frames}
            playing={replay ? replay.index : null}
            onPlay={(index) => setReplay({ frames, index })}
            onStop={() => setReplay(null)}
          />
        )}
      </div>

      <section
        id="storm-summary"
        className="absolute inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 flex flex-col gap-2.5 rounded-t-[22px] border-t border-line bg-surface px-4 pt-1 pb-3 lg:static lg:w-[380px] lg:shrink-0 xl:w-[420px] lg:gap-5 lg:overflow-y-auto lg:rounded-none lg:border-t-0 lg:border-l lg:bg-bg lg:p-5"
        aria-label="Actividad en tu ubicación"
      >
        {!wide && locateButton}
        {!wide && frames.length >= 2 && (
          <ReplayButton
            frames={frames}
            playing={replay ? replay.frames[replay.index] : null}
            onPlay={() => setReplay({ frames, index: 0 })}
            onStop={() => setReplay(null)}
          />
        )}
        {!wide && (
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
        )}
        {wide && status && (
          <p className="text-[13px] text-soft">
            Datos de nubes {localTime(status.latest_scan_utc)} · rayos {localTime(status.data_until_utc)}
          </p>
        )}
        {pendingMove && (
          <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2" role="group" aria-label="Mover tu ubicación">
            <span className="grow text-sm">¿Mover tu ubicación a ese punto?</span>
            <button
              type="button"
              onClick={() => {
                setPlace({ ...pendingMove, source: "map" });
                setPendingMove(null);
              }}
              className="min-h-11 rounded-lg bg-accent px-3.5 text-sm font-semibold text-white"
            >
              Mover
            </button>
            <button type="button" onClick={() => setPendingMove(null)} className="min-h-11 px-2 text-sm font-semibold text-quiet">
              No
            </button>
          </div>
        )}
        {place && activity && status ? (
          <PlaceSummary
            activity={activity}
            status={status}
            state={state}
            place={place}
            town={nearestTown(place.lat, place.lon)}
            detailed={detailed}
            onClear={clearPlace}
          />
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex grow flex-col gap-0.5">
              <h2 className="text-lg font-bold tracking-tight">¿Dónde estás?</h2>
              <p className="text-[13px] text-soft">Usa tu ubicación o {wide ? "haz clic en" : "toca"} el mapa.</p>
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
        {weather && (wide ? <WeatherDetails {...weather} /> : !expanded && <WeatherLine {...weather} />)}
        {/* Only for live data inside the mapped area: a report must match what the app shows. */}
        {place && status && (state === "healthy" || state === "degraded") && insideObservedArea(status, place.lat, place.lon) && (
          <SkyReport place={place} status={status} now={now} />
        )}
        {locateMessage && (
          <p className="text-[13px] text-soft" role="status">
            {locateMessage}
          </p>
        )}
        {wide && status && (
          <Stats status={status} activity={activity} current={state === "healthy" || state === "degraded"} />
        )}
        {wide && status && <SavedPlacesTable status={status} />}
        {wide && status && <CloudTrend status={status} />}
        <Legend allClouds={allClouds} onToggleClouds={() => setAllClouds(!allClouds)} />
        <div id="storm-details" className="collapsible -mt-2.5 lg:-mt-5" data-open={detailed} inert={!detailed}>
          <div>
            {/* Capped on phones so the sheet never grows past the screen and hides its own close button. */}
            <div className="flex max-h-[40dvh] flex-col gap-3 overflow-y-auto overscroll-contain pt-2.5 lg:max-h-none lg:overflow-visible lg:pt-5">
              <p className="text-[13px] text-soft">
                Colores de las nubes: más fría = más alta = tormenta más intensa. Naranja desde −38 °C (nube de
                tormenta), rojo desde −44 °C, rojo oscuro bajo −50 °C y magenta en los topes más fríos. En gris, el resto de las nubes: más blancas mientras más altas. Datos de nubes de las{" "}
                {status ? localTime(status.latest_scan_utc) : "—"} y de rayos hasta las{" "}
                {status ? localTime(status.data_until_utc) : "—"}.
              </p>
              {weather && !wide && <WeatherDetails {...weather} />}
              {status && !wide && (
                <Stats status={status} activity={activity} current={state === "healthy" || state === "degraded"} />
              )}
              {status && state === "healthy" && <ShareStatus status={status} />}
            </div>
          </div>
        </div>
        {wide ? (
          <p className="text-xs leading-relaxed text-muted">
            Observación experimental. No reemplaza los avisos de SENAPRED ni de la Dirección Meteorológica.
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-controls="storm-details"
            className="flex min-h-9 items-center justify-center gap-1 text-[13px] font-semibold text-quiet"
          >
            {expanded ? "Ocultar detalles" : "Ver detalles"}
            <ChevronRightIcon size={14} className={`transition-transform duration-300 ${expanded ? "-rotate-90" : "rotate-90"}`} />
          </button>
        )}
      </section>
    </main>
  );
}

const REPLAY_STEP_MS = 1800;
const REPLAY_HOLD_MS = 2500;

/** Plays the last scans on the map; while playing it shows the time of the frame on screen. */
function ReplayButton(props: {
  frames: ReplayFrame[];
  playing: ReplayFrame | null;
  onPlay: () => void;
  onStop: () => void;
}) {
  const { frames, playing, onPlay, onStop } = props;
  const minutes = Math.round((Date.parse(frames.at(-1)!.timeUtc) - Date.parse(frames[0].timeUtc)) / 60_000);
  return (
    <button
      type="button"
      onClick={playing ? onStop : onPlay}
      aria-label={playing ? "Detener repetición" : `Ver los últimos ${minutes} minutos en el mapa`}
      className="absolute -top-16 left-4 flex h-12 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold"
    >
      {playing ? (
        <>
          <span className="size-2.5 rounded-[2px] bg-fg" aria-hidden="true" />
          <span className="font-mono text-base" aria-live="polite">
            {localTime(playing.timeUtc)}
          </span>
        </>
      ) : (
        <>
          <PlayIcon size={16} className="text-bolt" />
          Últimos {minutes} min
        </>
      )}
    </button>
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
            Observación experimental cerca de {status.zone_name}. Revisa los avisos oficiales.{partial}
          </div>
        </div>
        <ChevronRightIcon size={18} />
      </Link>
    );
  }
  // Cold tops alone are often just high cloud: "storm" only with lightning in the area.
  const areaLightning = lightningWithin(status, ...status.center, status.radius_km);
  // Lightning under tops warmer than the cold-cloud threshold: the level stays quiet, but
  // the area is not "without activity".
  const warmLightning = status.level === "quiet" && areaLightning && state === "healthy";
  // With a place set, the sheet carries the detail: the banner shrinks to one line.
  if (hasPlace && (status.level === "deep_convection" || status.level === "quiet")) {
    const title = warmLightning
      ? "Área de alerta: hay rayos, sin nubes muy frías"
      : status.level === "quiet"
        ? "Área de alerta: sin actividad ahora"
        : areaLightning
          ? "Área de alerta: tormenta con rayos"
          : "Área de alerta: nubes muy frías, sin rayos";
    return (
      <CompactBanner tone={status.level === "quiet" && !warmLightning ? "quiet" : "convective"} title={title} />
    );
  }
  if (status.level === "deep_convection") {
    return areaLightning ? (
      <Banner tone="convective" title="Tormenta con rayos en el área monitoreada">
        Hubo rayos en la última media hora. Sin actividad intensa observada.{partial}
      </Banner>
    ) : (
      <Banner tone="convective" title="Nubes muy frías en el área monitoreada">
        Sin rayos: puede llover o no. Sin actividad intensa observada.{partial}
      </Banner>
    );
  }
  if (warmLightning) {
    return (
      <Banner tone="convective" title="Rayos en el área monitoreada">
        Sin nubes muy frías: son tormentas de nubes más bajas. Mantente atento por si se acercan.
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
  // No place set and every town's zone is quiet: the answer is about the region.
  if (status.zones.length > 0) {
    return (
      <Banner tone="quiet" title="Sin actividad observada ahora">
        En ninguna de las {status.zones.length} comunas de O&apos;Higgins que vigilamos. <ForecastNote />
      </Banner>
    );
  }
  const regional = nearestStorm(status, ...status.center);
  if (regional && regional.km > status.radius_km) {
    return (
      <Banner tone="quiet" title="Sin actividad observada en el área de alerta">
        {`Hay nubes de tormenta a ${Math.round(regional.km)} km al ${regional.direction} de ${status.zone_name}, fuera de sus ${status.radius_km} km de alerta. `}
        <ForecastNote />
      </Banner>
    );
  }
  return (
    <Banner tone="quiet" title="Sin actividad observada ahora">
      En los {status.radius_km} km alrededor de {status.zone_name}. <ForecastNote />
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

/** One line: the state of the alert area, and the way to the official warnings. */
function CompactBanner({ tone, title }: { tone: "quiet" | "convective"; title: string }) {
  const styles = tone === "quiet" ? "border-quiet-line bg-quiet-bg" : "border-[#6b4a14] bg-[#2e2210]";
  const Icon = tone === "quiet" ? InfoIcon : CloudIcon;
  return (
    <div
      className={`pointer-events-auto flex items-center gap-2.5 rounded-2xl border px-3.5 py-2 ${styles}`}
      role="status"
    >
      <Icon size={18} className={`shrink-0 ${tone === "quiet" ? "text-quiet" : "text-convective"}`} />
      <span className="grow text-sm font-semibold">{title}</span>
      <Link href="/oficiales" className="flex min-h-9 shrink-0 items-center gap-0.5 text-[13px] font-semibold text-quiet">
        Avisos oficiales <ChevronRightIcon size={14} />
      </Link>
    </div>
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
  if (trend.kind === "dissipated")
    return `Las que estaban a ${Math.round(trend.wasKm)} km hace ${trend.minutes} min se deshicieron.`;
  if (trend.kind === "formed_closer") return `Se formaron más cerca en los últimos ${trend.minutes} min.`;
  const verb = trend.kind === "approaching" ? "Se acercan" : "Se alejan";
  return `${verb}: hace ${trend.minutes} min estaban a ${Math.round(trend.wasKm)} km.`;
}

function stormLine(storm: StormNearby | null, movement: string | null, prefix: string): string {
  if (!storm) return "El satélite no ve nubes de tormenta en la región.";
  return [`${prefix}: ${Math.round(storm.km)} km al ${storm.direction}.`, movement].filter(Boolean).join(" ");
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
  const eta = stormEta(status, place.lat, place.lon);
  // A steady approach gets an arrival range; otherwise just the observed movement.
  const movement = eta ? etaText(eta, status.latest_scan_utc) : trendText(stormTrend(status, place.lat, place.lon));
  const observed = insideObservedArea(status, place.lat, place.lon);
  const flash = observed ? lastFlashNear(status, place.lat, place.lon) : null;
  let title: string;
  let advice: string;
  let context: string | null = null;
  let tone: string;
  // How often it rained under the same signal (scoring s2): set only where it applies.
  let rain: "alta" | "media" | null = null;

  if (level === "outside" && observed) {
    title = storm ? `Nubes de tormenta a ${Math.round(storm.km)} km` : "Sin nubes de tormenta cerca";
    advice = storm
      ? [`Al ${storm.direction} de ti.`, movement].filter(Boolean).join(" ")
      : "El satélite no ve nubes de tormenta en la región.";
    context = `Estás a más de ${status.radius_km} km de ${status.zone_name}, la comuna más cercana con nivel de alerta: aquí solo mostramos lo que ve el satélite. Revisa los avisos oficiales.`;
    tone = storm && storm.km <= AROUND_KM ? "text-convective" : "text-soft";
  } else if (level === "outside") {
    title = "Fuera del área monitoreada";
    advice = `Por ahora solo observamos la zona de O'Higgins. Revisa los avisos oficiales para tu zona.`;
    tone = "text-soft";
  } else if (level === "over" && activity.flashesNear > 0) {
    title = "Tormenta con rayos sobre tu zona";
    advice = "Entra a un lugar cerrado.";
    tone = "text-severe";
    rain = "alta";
  } else if ((level === "over" || level === "near") && nearest && !lightningWithin(status, place.lat, place.lon, AROUND_KM)) {
    // Cold tops without a single flash nearby: often just a grey sky of high cloud.
    title = level === "over" ? "Nubes muy frías sobre tu zona" : `Nubes muy frías a ${Math.round(nearest.km)} km al ${nearest.direction}`;
    advice = ["Sin rayos: puede llover o no. Si aparecen rayos, este aviso cambia.", level === "near" ? movement : null]
      .filter(Boolean)
      .join(" ");
    tone = "text-convective-soft";
    rain = "media";
  } else if ((level === "over" || level === "near") && nearest) {
    title = `Tormenta con rayos a ${Math.round(nearest.km)} km al ${nearest.direction}`;
    advice =
      status.level === "severe"
        ? "Se está intensificando. Si estás al aire libre, busca refugio."
        : (movement ?? "Hubo rayos en la última media hora. Mantente atento por si se acerca.");
    tone = status.level === "severe" ? "text-severe" : "text-convective";
    rain = "alta";
  } else if (state === "healthy" && flash) {
    // No flash in the last 10 minutes, but one within the safety distance in the last 30.
    title = "Rayos recientes cerca de ti";
    advice = "La tormenta puede seguir activa aunque no veas rayos ahora.";
    tone = "text-convective";
  } else if (state === "healthy") {
    title = `Sin actividad a menos de ${AROUND_KM} km`;
    advice = storm
      ? stormLine(storm, movement, "Nubes de tormenta más cercanas")
      : "El satélite no ve nubes de tormenta en la región.";
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
      {/* Only the headline is announced when it changes; the whole sheet would be read every minute. */}
      <h2 className={`text-xl font-bold tracking-tight ${tone}`} aria-live="polite">
        {title}
      </h2>
      {flash && current && (
        <p className="flex gap-1.5 text-sm font-semibold text-bolt">
          <BoltFilledIcon size={14} className="mt-[3px] shrink-0" />
          <span>
            Último rayo detectado a unos {Math.round(flash.km)} km al {flash.direction}, a las {localTime(flash.atUtc)}. Si no caen
            más, quédate bajo techo hasta las {localTime(flash.safeAfterUtc)}.
          </span>
        </p>
      )}
      <p className="text-sm text-soft">{advice}</p>
      {rain && current && <RainLikelihood level={rain} detailed={detailed} />}
      {context && current && (detailed || level !== "outside") && <p className="text-[13px] text-soft">{context}</p>}
      {!current && (level !== "outside" || observed) && (
        <p className="text-[13px] text-muted">Según datos de las {localTime(status.data_until_utc)}.</p>
      )}
    </div>
  );
}

/**
 * How often it really rained under this signal, scored against NASA IMERG on 572 days
 * (research scoring s2): 83-88 % with lightning under cold tops, 43-50 % without.
 */
function RainLikelihood({ level, detailed }: { level: "alta" | "media"; detailed: boolean }) {
  const high = level === "alta";
  return (
    <div className="mt-1 flex flex-col gap-1">
      <span
        className={`self-start rounded-full border px-2 py-0.5 text-[11px] font-bold tracking-wide ${high ? "border-[#7a2a22] bg-severe-bg text-[#ffb4a8]" : "border-line bg-surface-2 text-soft"}`}
      >
        PROBABILIDAD {high ? "ALTA" : "MEDIA"} DE LLUVIA
      </span>
      {detailed && (
        <p className="text-[13px] text-soft">
          {high
            ? "Con rayos bajo nubes así, llovió en 8 de cada 10 casos medidos."
            : "Con nubes así pero sin rayos, llovió cerca de la mitad de las veces."}{" "}
          <Link href="/como-funciona#confiable" className="font-semibold text-quiet">
            ¿Cómo lo medimos?
          </Link>
        </p>
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

const CLOUD_GRADIENT = `linear-gradient(to right, ${CLOUD_RAMP.map(([, [r, g, b], a]) => `rgba(${r},${g},${b},${a / 255})`).join(", ")})`;

/** Always visible: the colours are the map's main message, so they need words next to them. */
function Legend({ allClouds, onToggleClouds }: { allClouds: boolean; onToggleClouds: () => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex items-center gap-2 text-xs text-soft"
        aria-label="Leyenda: nubes de −38 a −62 grados, más frías más intensas; rayo amarillo, rayos de los últimos 5 minutos; rayo apagado, de hace 5 a 10 minutos"
      >
        <span className="shrink-0">Nubes</span>
        <span className="font-mono text-muted">−38°</span>
        <span className="h-2 min-w-12 grow rounded-full" style={{ background: CLOUD_GRADIENT }} aria-hidden="true" />
        <span className="font-mono text-muted">−62°</span>
        <span className="ml-2 flex shrink-0 items-center gap-1">
          <BoltFilledIcon size={12} className="text-[#FFE14D]" />
          Rayo ahora
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <BoltFilledIcon size={12} className="text-[#B9A96A]" />
          hace 5–10 min
        </span>
      </div>
      <button
        type="button"
        aria-pressed={allClouds}
        onClick={onToggleClouds}
        className="flex min-h-9 items-center gap-2 self-start text-xs text-soft"
      >
        <span
          className={`flex size-4 items-center justify-center rounded border ${allClouds ? "border-quiet bg-quiet text-bg" : "border-line"}`}
          aria-hidden="true"
        >
          {allClouds && <CheckIcon size={12} />}
        </span>
        <span className="h-2 w-5 rounded-full bg-[#d6dee7]/60" aria-hidden="true" />
        Todas las nubes, en gris
      </button>
    </div>
  );
}
