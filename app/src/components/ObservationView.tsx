"use client";

import Link from "next/link";
import { useNow } from "@/lib/browser-store";
import { activityAt } from "@/lib/geo";
import { dataState, formatC, localTime, type Status } from "@/lib/status";
import { OFFICIAL_SOURCES } from "@/lib/official";
import { BoltFilledIcon, ChevronRightIcon, CloudIcon } from "./Icons";
import { Card, Note, PageShell } from "./PageShell";
import { useStatus } from "./StatusProvider";

const GENERAL_ADVICE = [
  "Entra a un lugar cerrado y aléjate de las ventanas.",
  "Si puedes hacerlo sin riesgo, protege tu vehículo del granizo.",
  "No te refugies bajo árboles ni cerca de cercas o líneas eléctricas.",
];

export function ObservationView() {
  const { status, place, demo, online } = useStatus();
  const now = useNow();
  if (!status) {
    return (
      <PageShell title="Observación">
        <p className="text-soft" role="status">
          Cargando datos del satélite…
        </p>
      </PageShell>
    );
  }

  const state = dataState(status, { demo, online, now: now ? new Date(now) : undefined });
  const severe = status.level === "severe";
  const activity = place ? activityAt(status, place.lat, place.lon) : null;
  const { title, intro } = headline(status, state);

  return (
    <PageShell title={title} intro={intro}>
      {severe && (
        <div className="-mt-2 flex flex-col gap-3">
          <span className="flex items-center gap-1.5 self-start rounded-full border border-[#7a2a22] bg-severe-bg px-2.5 py-1.5 text-xs font-bold tracking-wider text-severe">
            OBSERVACIÓN EXPERIMENTAL
          </span>
          <div className="grid grid-cols-2 gap-2">
            <Fact
              label="Detectada desde"
              value={status.episode_start_utc ? localTime(status.episode_start_utc) : "—"}
            />
            <Fact
              label="Distancia a ti"
              value={
                activity?.level === "outside"
                  ? "Fuera del área"
                  : activity?.nearest
                    ? `${Math.round(activity.nearest.km)} km al ${activity.nearest.direction}`
                    : "Marca tu ubicación"
              }
            />
          </div>
        </div>
      )}

      <OfficialCheck />
      <LightningChart status={status} />
      <CloudTops status={status} />

      {severe && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Recomendaciones generales</h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-[15px] leading-relaxed">
            {GENERAL_ADVICE.map((advice) => (
              <li key={advice}>{advice}</li>
            ))}
          </ul>
          <a href={OFFICIAL_SOURCES.senapred.url} className="flex min-h-11 items-center gap-1 text-[15px] text-quiet">
            Recomendaciones oficiales de SENAPRED <ChevronRightIcon size={16} />
          </a>
        </section>
      )}

      <Note title="Lo que esta observación no puede decir">
        El satélite detecta actividad convectiva intensa, pero no distingue si habrá granizo, viento fuerte o un
        tornado. Para eso hace falta radar, y la región no lo tiene. No es un aviso oficial: sigue las indicaciones de
        SENAPRED y la Dirección Meteorológica.
      </Note>

      <Link href="/" className="flex min-h-13 items-center justify-center rounded-2xl bg-accent font-semibold text-white">
        Ver en el mapa
      </Link>
    </PageShell>
  );
}

function headline(status: Status, state: ReturnType<typeof dataState>): { title: string; intro: string } {
  if (status.level === "severe") {
    return {
      title: "Actividad convectiva intensa",
      intro:
        state === "historical"
          ? "Observación histórica del 26 de octubre de 2026 cerca de Requínoa."
          : "El satélite observa una tormenta que se intensifica cerca de Requínoa.",
    };
  }
  if (state === "stale" || state === "offline" || state === "unavailable" || status.level === "unknown") {
    return {
      title: "No podemos confirmar el estado",
      intro: "Los datos están incompletos o atrasados. Revisa los avisos oficiales.",
    };
  }
  if (status.level === "deep_convection") {
    return {
      title: "Nubes de tormenta, sin actividad intensa",
      intro: "Hay nubes de tormenta en el área monitoreada, pero los rayos no muestran una intensificación brusca.",
    };
  }
  return {
    title: "Sin actividad convectiva detectada",
    intro: `En el área monitoreada: ${status.radius_km} km alrededor de Requínoa.`,
  };
}

function OfficialCheck() {
  return (
    <Link
      href="/oficiales"
      className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-fg"
    >
      <CloudIcon className="shrink-0 text-quiet" />
      <span className="flex grow flex-col">
        <span className="font-semibold">¿Hay un aviso oficial?</span>
        <span className="text-[13px] text-soft">Revisa la Dirección Meteorológica y SENAPRED</span>
      </span>
      <ChevronRightIcon size={18} className="text-muted" />
    </Link>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="font-mono">{value}</div>
    </div>
  );
}

function LightningChart({ status }: { status: Status }) {
  const bins = status.flashes_per_5min;
  if (bins.length === 0) return null;
  const max = Math.max(1, ...bins.map((b) => b.count ?? 0));
  const labels = [bins[0], bins[Math.floor(bins.length / 2)], bins[bins.length - 1]];
  const described = bins
    .map((b) => `${localTime(b.start_utc)}: ${b.count === null ? "sin datos" : b.count}${b.jump ? " (salto)" : ""}`)
    .join("; ");
  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Rayos cada 5 minutos</h2>
        <span className="text-xs text-muted">a 50 km de Requínoa</span>
      </div>
      <div className="flex h-36 items-end gap-1 border-b border-[#3a424d]" role="img" aria-label={`Rayos cada 5 minutos. ${described}`}>
        {bins.map((b) => (
          <div key={b.start_utc} className="flex h-full grow flex-col items-center justify-end gap-1">
            {b.jump && <BoltFilledIcon size={10} className="text-bolt" />}
            {b.count === null ? (
              <div className="h-6 w-full rounded-t-[3px] border border-dashed border-[#5c6672]" />
            ) : (
              <div
                className={`w-full rounded-t-[3px] ${b.count >= 80 ? "bg-[#ff6b5b]" : b.count > 0 ? "bg-convective" : "bg-[#3a424d]"}`}
                style={{ height: `${Math.max(2, (b.count / max) * 118)}px` }}
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between font-mono text-[11px] text-muted">
        {labels.map((b) => (
          <span key={b.start_utc}>{localTime(b.start_utc)}</span>
        ))}
      </div>
      <ul className="flex flex-col gap-1 text-[13px] text-soft">
        <li className="flex items-center gap-1.5">
          <BoltFilledIcon className="text-bolt" /> Salto de rayos: la actividad eléctrica se dispara de golpe
        </li>
        {bins.some((b) => b.count === null) && (
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 border border-dashed border-[#5c6672]" aria-hidden="true" /> Sin
            datos: no sabemos cuántos rayos hubo
          </li>
        )}
      </ul>
    </Card>
  );
}

function topTone(c: number): string {
  if (c <= -48) return "bg-[#8e1b12] text-white";
  if (c <= -44) return "bg-[#6e231b] text-[#ffc4bb]";
  if (c <= -38) return "bg-[#5a3a12] text-[#ffd9a0]";
  return "bg-surface-2 text-soft";
}

function CloudTops({ status }: { status: Status }) {
  const tops = status.cloud_tops;
  if (tops.length === 0) return null;
  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Temperatura del tope de la nube</h2>
        <span className="text-xs text-muted">más fría = más alta</span>
      </div>
      <ul className="grid grid-cols-4 gap-2">
        {tops.map((t) => (
          <li key={t.time_utc} className={`flex flex-col items-center gap-1 rounded-lg px-1.5 py-2.5 ${topTone(t.min_bt_c)}`}>
            <span className="font-mono text-[15px]">{formatC(t.min_bt_c)}°</span>
            <span className="text-[11px]">{localTime(t.time_utc)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
