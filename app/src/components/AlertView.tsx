"use client";

import Link from "next/link";
import { activityAt } from "@/lib/geo";
import { formatC, localTime, type Status } from "@/lib/status";
import { BoltFilledIcon, BoltIcon } from "./Icons";
import { Card, Note, PageShell } from "./PageShell";
import { useStatus } from "./StatusProvider";

const STEPS = [
  "Entra a un lugar cerrado y aléjate de las ventanas.",
  "Si puedes hacerlo sin riesgo, protege tu vehículo del granizo.",
  "Si ves una nube con forma de embudo, ve a la habitación más interior del piso más bajo.",
  "No te refugies bajo árboles ni cerca de cercas o líneas eléctricas.",
];

export function AlertView() {
  const { status, place } = useStatus();
  if (!status) {
    return (
      <PageShell title="Alerta">
        <p className="text-soft">Cargando datos del satélite…</p>
      </PageShell>
    );
  }

  const severe = status.level === "severe";
  const activity = place ? activityAt(status, place.lat, place.lon) : null;
  return (
    <PageShell
      title={severe ? "Tormenta severa intensificándose" : "No hay alertas activas"}
      intro={
        severe
          ? "Posible granizo, viento fuerte o tornado en el sector de Requínoa, Rengo y Rancagua."
          : status.level === "deep_convection"
            ? "Hay nubes de tormenta en la región, pero los rayos no muestran una intensificación brusca."
            : "El satélite no detecta tormentas en la región."
      }
    >
      {severe && (
        <div className="-mt-2 flex flex-col gap-3">
          <span className="flex items-center gap-1.5 self-start rounded-full bg-severe-strong px-2.5 py-1.5 text-xs font-bold tracking-wider text-white">
            <BoltIcon size={14} /> ALERTA ACTIVA
          </span>
          <div className="grid grid-cols-2 gap-2">
            <Fact label="Emitida" value={status.episode_start_utc ? localTime(status.episode_start_utc) : "—"} />
            <Fact
              label="Distancia a ti"
              value={
                activity?.nearest
                  ? `${Math.round(activity.nearest.km)} km al ${activity.nearest.direction}`
                  : "Marca tu ubicación"
              }
            />
          </div>
        </div>
      )}

      <LightningChart status={status} />
      <CloudTops status={status} />

      {severe && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Qué hacer ahora</h2>
          <ol className="flex flex-col gap-3">
            {STEPS.map((step, i) => (
              <li key={step} className="flex items-start gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 font-mono text-sm text-severe">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-[15px] leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <Note title="Lo que esta alerta no puede decir">
        El satélite detecta tormentas severas, pero no distingue si va a caer granizo o si se formará un tornado.
        Para eso hace falta radar, y la región no lo tiene. Sigue siempre las indicaciones de SENAPRED y la
        Dirección Meteorológica.
      </Note>

      <Link href="/" className="flex min-h-13 items-center justify-center rounded-2xl bg-accent font-semibold text-white">
        Ver en el mapa
      </Link>
    </PageShell>
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
  const max = Math.max(1, ...bins.map((b) => b.count));
  const labels = [bins[0], bins[Math.floor(bins.length / 2)], bins[bins.length - 1]];
  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Rayos cada 5 minutos</h2>
        <span className="text-xs text-muted">a 50 km de Requínoa</span>
      </div>
      <div
        className="flex h-36 items-end gap-1 border-b border-[#3a424d]"
        role="img"
        aria-label={`Rayos cada 5 minutos: ${bins.map((b) => b.count).join(", ")}`}
      >
        {bins.map((b) => (
          <div key={b.start_utc} className="flex h-full grow flex-col items-center justify-end gap-1">
            {b.jump && <BoltFilledIcon size={10} className="text-bolt" />}
            <div
              className={`w-full rounded-t-[3px] ${b.count >= 80 ? "bg-[#ff6b5b]" : b.count > 0 ? "bg-convective" : "bg-[#3a424d]"}`}
              style={{ height: `${Math.max(2, (b.count / max) * 118)}px` }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between font-mono text-[11px] text-muted">
        {labels.map((b) => (
          <span key={b.start_utc}>{localTime(b.start_utc)}</span>
        ))}
      </div>
      <p className="flex items-center gap-1.5 text-[13px] text-soft">
        <BoltFilledIcon className="text-bolt" /> Salto de rayos: la actividad eléctrica se dispara de golpe
      </p>
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
