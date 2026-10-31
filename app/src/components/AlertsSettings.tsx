"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { useStoredValue } from "@/lib/browser-store";
import { nearestTown } from "@/lib/geo";
import {
  PUSH_RADII,
  pushSupport,
  subscribe,
  testNotification,
  unsubscribe,
  type PushRadius,
  type PushSupport,
} from "@/lib/push";
import { LockIcon } from "./Icons";
import { LogoMark } from "./Logo";
import { Note, PageShell } from "./PageShell";
import { useStatus } from "./StatusProvider";

const PUSH_KEY = "miranubes:push";

const RADIUS_HINT: Record<PushRadius, string> = {
  10: "Solo tormentas casi encima. Menos avisos.",
  25: "Recomendado: tiempo suficiente para prepararte.",
  50: "Toda la zona. Más avisos, algunos lejanos.",
};

const ERRORS: Record<string, string> = {
  "invalid-code": "Ese código de piloto no es válido. Revísalo e inténtalo de nuevo.",
  denied: "No diste permiso de notificaciones. Actívalo en los ajustes del navegador o de la app.",
};

interface Active {
  radius: PushRadius;
  place: string;
}

const never = () => () => {};

export function AlertsSettings() {
  const { place } = useStatus();
  const support = useSyncExternalStore<PushSupport | null>(never, pushSupport, () => null);
  const [active, setActive] = useStoredValue<Active | null>(PUSH_KEY, null);
  const [radius, setRadius] = useState<PushRadius>(25);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function activate() {
    if (!place) return;
    setBusy(true);
    setMessage(null);
    try {
      await subscribe({ code, lat: place.lat, lon: place.lon, radius });
      setActive({ radius, place: nearestTown(place.lat, place.lon) ?? "tu ubicación" });
    } catch (error) {
      const { name, message } = error as Error;
      // Android browsers deliver web push through Google; phones without Google services
      // (recent Huawei, for one) cannot receive it at all.
      if (name === "AbortError" && /push service/i.test(message)) {
        setMessage(
          "Este teléfono no puede recibir notificaciones web: en Android llegan a través de los servicios de Google, que algunos equipos (como los Huawei recientes) no tienen. Estamos preparando otra forma de avisarte.",
        );
        return;
      }
      // During the pilot the technical reason is shown too, so testers can report it.
      setMessage(ERRORS[message] ?? `No pudimos activarlas. Inténtalo de nuevo en un momento. (${name}: ${message})`);
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    setBusy(true);
    await unsubscribe().catch(() => undefined);
    setActive(null);
    setBusy(false);
  }

  return (
    <PageShell
      title="Notificaciones"
      intro="Piloto para personas invitadas: te avisamos cuando el satélite observa tormentas cerca de ti, aunque no tengas la app abierta."
    >
      <section className="flex flex-col gap-2">
        <h2 className="text-xs tracking-wider text-muted">ASÍ SE VE UNA NOTIFICACIÓN</h2>
        <div className="flex items-start gap-3 rounded-[18px] bg-[#e9ecf0] px-3.5 py-3 text-[#14181d]">
          <div className="flex size-[38px] shrink-0 items-center justify-center rounded-[9px] bg-[#0b1220]">
            <LogoMark size={16} compact />
          </div>
          <div className="flex grow flex-col gap-0.5">
            <div className="flex justify-between text-xs text-[#4a535e]">
              <span>MIRANUBES</span>
              <span>ahora</span>
            </div>
            <div className="text-[15px] font-semibold">Nubes de tormenta a 12 km al sur</div>
            <div className="text-sm text-[#2e353d]">
              Dentro de tus 25 km, con topes de hasta −45 °C. Observación experimental, no es un aviso oficial.
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[17px] font-semibold">Cuándo te avisamos</h2>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-relaxed text-soft">
          <li>
            <strong className="text-fg">Actividad intensa</strong> cerca de Requínoa: una vez por episodio.
          </li>
          <li>
            <strong className="text-fg">Un rayo a menos de 15 km</strong>: como máximo cada 30 minutos.
          </li>
          <li>
            <strong className="text-fg">Nubes de tormenta dentro de tu radio</strong>: como máximo una vez por hora.
          </li>
        </ul>
        <p className="text-[13px] text-muted">
          Si los datos del satélite están atrasados, no enviamos nada. Nunca reemplaza los avisos de SENAPRED ni de la
          DMC.
        </p>
      </section>

      {support === "install" && (
        <Note title="Primero instala la app">
          En iPhone, las notificaciones solo llegan a la app instalada. Toca Compartir y luego &quot;Agregar a
          inicio&quot;, abre Miranubes desde ese ícono y vuelve a esta pantalla.
        </Note>
      )}
      {(support === "unsupported" || support === "unconfigured") && (
        <Note title="No disponible aquí">
          {support === "unsupported"
            ? "Este navegador no permite notificaciones web. Prueba con Chrome en Android o con la app instalada en iPhone."
            : "El piloto de notificaciones todavía no está activo en esta versión."}
        </Note>
      )}

      {support === "ok" && active && (
        <section className="flex flex-col gap-3 rounded-2xl border border-quiet-line bg-quiet-bg p-4">
          <h2 className="text-[17px] font-semibold">Notificaciones activas</h2>
          <p className="text-[15px] text-soft">
            Para {active.place}, en un radio de {active.radius} km.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => testNotification()}
              className="min-h-12 rounded-xl border border-line bg-surface text-sm font-semibold"
            >
              Enviar una prueba
            </button>
            <button
              type="button"
              onClick={deactivate}
              disabled={busy}
              className="min-h-12 rounded-xl border border-line bg-surface text-sm font-semibold text-severe"
            >
              Desactivar
            </button>
          </div>
          <p className="text-[13px] text-muted">Para cambiar el lugar o el radio, desactiva y vuelve a activar.</p>
        </section>
      )}

      {support === "ok" && !active && !place && (
        <Note title="Marca tu ubicación primero">
          Las notificaciones se calculan para un punto aproximado.{" "}
          <Link href="/" className="font-semibold text-quiet underline">
            Ir al mapa
          </Link>{" "}
          y usa &quot;Ubicarme&quot; o toca el mapa.
        </Note>
      )}

      {support === "ok" && !active && place && (
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            activate();
          }}
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="pilot-code" className="text-[17px] font-semibold">
              Código de piloto
            </label>
            <input
              id="pilot-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoCapitalize="characters"
              autoComplete="off"
              placeholder="NUBES-XXXXXX"
              required
              // 16px or more: iOS Safari zooms into smaller inputs and leaves the page shifted.
              className="min-h-12 w-full min-w-0 rounded-xl border border-line bg-surface px-3.5 font-mono text-base tracking-wider"
            />
          </div>

          {/* min-w-0: a fieldset otherwise never shrinks below its content and widens the page. */}
          <fieldset className="flex min-w-0 flex-col gap-2.5">
            <legend className="mb-2.5 text-[17px] font-semibold">
              Avisarme si hay tormentas a menos de
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {PUSH_RADII.map((km) => (
                <button
                  key={km}
                  type="button"
                  aria-pressed={radius === km}
                  onClick={() => setRadius(km)}
                  className={`min-h-12 rounded-xl text-[15px] font-semibold ${radius === km ? "bg-accent text-white" : "border border-line bg-surface"}`}
                >
                  {km} km
                </button>
              ))}
            </div>
            <p className="text-[13px] text-muted">
              {RADIUS_HINT[radius]} Desde {nearestTown(place.lat, place.lon) ?? "tu ubicación marcada"}.
            </p>
          </fieldset>

          <p className="flex items-start gap-2.5 text-[13px] leading-relaxed text-soft">
            <LockIcon size={18} className="mt-0.5 shrink-0 text-quiet" />
            <span>
              Guardamos solo tu punto aproximado (~1 km), el radio y la dirección técnica de notificación de este
              teléfono. Al desactivar se borran.{" "}
              <Link href="/privacidad" className="text-quiet underline">
                Política de privacidad
              </Link>
            </span>
          </p>

          {message && (
            <p role="alert" className="rounded-xl border border-[#7a2a22] bg-severe-bg px-3.5 py-3 text-sm text-severe">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || code.trim().length < 6}
            className="min-h-13 rounded-2xl bg-accent font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Activando…" : "Activar notificaciones"}
          </button>
        </form>
      )}
    </PageShell>
  );
}
