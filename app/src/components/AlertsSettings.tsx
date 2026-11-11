"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { useStoredValue } from "@/lib/browser-store";
import { TOWNS, nearestTown } from "@/lib/geo";
import {
  MAX_PLACES,
  PLACE_NAME_MAX,
  PUSH_RADII,
  pushSupport,
  savePlaces,
  testNotification,
  unsubscribe,
  type PushPlace,
  type PushRadius,
  type PushSupport,
} from "@/lib/push";
import {
  PUSH_KEY,
  draftPoint,
  isLegacy,
  toDraft,
  toPlace,
  type LegacyAlerts,
  type PlaceDraft,
  type StoredAlerts,
  type Where,
} from "@/lib/push-places";
import { LockIcon } from "./Icons";
import { InstallCard } from "./InstallCard";
import { LogoMark } from "./Logo";
import { Note, PageShell } from "./PageShell";
import { useStatus } from "./StatusProvider";

// MapLibre is heavy: load the picker only when someone opens it.
const PlacePicker = dynamic(() => import("./PlacePicker"), { ssr: false });

const RADIUS_HINT: Record<PushRadius, string> = {
  10: "Solo tormentas casi encima. Menos avisos.",
  25: "Recomendado: tiempo suficiente para prepararte.",
  50: "Toda la zona. Más avisos, algunos lejanos.",
};

const NAME_EXAMPLES = ["Mi casa", "Colegio de los niños", "Casa de mis papás"];

const ERRORS: Record<string, string> = {
  "invalid-code": "Ese código de piloto no es válido. Revísalo e inténtalo de nuevo.",
  denied: "No diste permiso de notificaciones. Actívalo en los ajustes del navegador o de la app.",
};

const never = () => () => {};

function whereLabel(place: PushPlace): string {
  return nearestTown(place.lat, place.lon, 15) ?? "punto marcado";
}

export function AlertsSettings() {
  const { place: here } = useStatus();
  const support = useSyncExternalStore<PushSupport | null>(never, pushSupport, () => null);
  const [stored, setStored] = useStoredValue<StoredAlerts | LegacyAlerts | null>(PUSH_KEY, null);
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<PlaceDraft[]>([]);
  const [radius, setRadius] = useState<PushRadius>(25);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // A phone the server no longer knows (for example after clearing its data) needs the code again.
  const [needCode, setNeedCode] = useState(false);
  const [picking, setPicking] = useState<number | null>(null);

  const active = stored !== null;
  const showForm = support === "ok" && (!active || editing);
  // Before any edit the form starts with one place: the marked point if there is one.
  const rows: PlaceDraft[] = drafts.length ? drafts : [{ name: "", where: here ? "here" : "Rancagua" }];
  const places = rows.map((row) => toPlace(row, here, radius));
  const askCode = !active || needCode;
  const ready = places.every((p) => p !== null) && (!askCode || code.trim().length >= 6);

  function startEditing() {
    if (stored && !isLegacy(stored)) {
      setDrafts(stored.places.map(toDraft));
      setRadius(stored.places[0].radius);
    } else if (stored) {
      // Older versions kept no point: start from the marked one, named as before.
      setDrafts([{ name: stored.place, where: here ? "here" : "Rancagua" }]);
      setRadius(stored.radius);
    }
    setMessage(null);
    setEditing(true);
  }

  function updateRow(index: number, change: Partial<PlaceDraft>) {
    setDrafts(rows.map((row, i) => (i === index ? { ...row, ...change } : row)));
  }

  async function save() {
    const list = places.filter((p): p is PushPlace => p !== null);
    if (list.length !== rows.length) return;
    setBusy(true);
    setMessage(null);
    try {
      await savePlaces({ code, places: list });
      setStored({ places: list });
      setEditing(false);
      setDrafts([]);
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
      if (message === "invalid-code") setNeedCode(true);
      // During the pilot the technical reason is shown too, so testers can report it.
      setMessage(ERRORS[message] ?? `No pudimos guardarlas. Inténtalo de nuevo en un momento. (${name}: ${message})`);
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    setBusy(true);
    await unsubscribe().catch(() => undefined);
    setStored(null);
    setEditing(false);
    setDrafts([]);
    setBusy(false);
  }

  const savedPlaces = stored && !isLegacy(stored) ? stored.places : null;

  return (
    <PageShell
      title="Notificaciones"
      intro="Piloto para personas invitadas: te avisamos cuando el satélite observa tormentas cerca de ti o de los lugares de tu gente, aunque no tengas la app abierta."
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
            <div className="text-[15px] font-semibold">
              Tormenta con rayos a 12 km al sur de Casa de mis papás
            </div>
            <div className="text-sm text-[#2e353d]">
              Hubo rayos cerca en la última media hora. Probabilidad alta de lluvia. Observación experimental, no es
              un aviso oficial.
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[17px] font-semibold">Cuándo te avisamos</h2>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-relaxed text-soft">
          <li>
            <strong className="text-fg">Actividad intensa</strong> cerca de la comuna más próxima a cada lugar: una vez
            por episodio.
          </li>
          <li>
            <strong className="text-fg">Un rayo a menos de 15 km</strong> de uno de tus lugares: al primero, y
            después como máximo una vez por hora mientras siga la tormenta.
          </li>
          <li>
            <strong className="text-fg">Nubes muy frías dentro de tu radio</strong>: una vez, y otra si aparecen
            rayos. Solo las llamamos tormenta si hay rayos; sin rayos pueden ser solo nubes altas o lluvia.
          </li>
          <li>
            <strong className="text-fg">Ya no hay rayos cerca</strong>: cuando pasan 30 minutos sin rayos dentro de
            tu radio, para que sepas que puedes volver a salir.
          </li>
        </ul>
        <p className="text-[13px] text-muted">
          Puedes vigilar hasta {MAX_PLACES} lugares. Si dos están a menos de 10 km, te llega un solo aviso. Si los datos
          del satélite están atrasados, no enviamos nada. Nunca reemplaza los avisos de SENAPRED ni de la DMC.
        </p>
      </section>

      {support === "install" && (
        <>
          <InstallCard />
          <p className="-mt-3 text-[13px] text-muted">Después vuelve a esta pantalla para activar los avisos.</p>
        </>
      )}
      {(support === "unsupported" || support === "unconfigured") && (
        <Note title="No disponible aquí">
          {support === "unsupported"
            ? "Este navegador no permite notificaciones web. Prueba con Chrome en Android o con la app instalada en iPhone."
            : "El piloto de notificaciones todavía no está activo en esta versión."}
        </Note>
      )}

      {support === "ok" && stored && !editing && (
        <section className="flex flex-col gap-3 rounded-2xl border border-quiet-line bg-quiet-bg p-4">
          <h2 className="text-[17px] font-semibold">Notificaciones activas</h2>
          {savedPlaces ? (
            <ul className="flex flex-col gap-1.5 text-[15px] text-soft">
              {savedPlaces.map((p, i) => (
                <li key={i}>
                  <strong className="text-fg">{p.name}</strong> · {whereLabel(p)}, {p.radius} km
                </li>
              ))}
            </ul>
          ) : (
            isLegacy(stored) && (
              <p className="text-[15px] text-soft">
                Para {stored.place}, en un radio de {stored.radius} km.
              </p>
            )
          )}
          <button
            type="button"
            onClick={startEditing}
            className="min-h-12 rounded-xl bg-accent text-sm font-semibold text-white"
          >
            {savedPlaces && savedPlaces.length < MAX_PLACES ? "Agregar o cambiar lugares" : "Cambiar lugares"}
          </button>
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
        </section>
      )}

      {showForm && (
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          {askCode && (
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
          )}

          <fieldset className="flex min-w-0 flex-col gap-3">
            <legend className="mb-1 text-[17px] font-semibold">Tus lugares</legend>
            <p className="text-[13px] text-muted">
              Tu casa, el colegio de tus hijos, la casa de tus papás: te avisamos por cada uno.
            </p>
            {rows.map((row, index) => {
              const missing = draftPoint(row, here) === null;
              return (
                <div key={index} className="flex min-w-0 flex-col gap-2 rounded-2xl border border-line bg-surface p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs tracking-wider text-muted">LUGAR {index + 1}</span>
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setDrafts(rows.filter((_, i) => i !== index))}
                        className="min-h-9 px-2 text-[13px] font-semibold text-severe"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                  <label className="sr-only" htmlFor={`place-name-${index}`}>
                    Nombre del lugar {index + 1}
                  </label>
                  <input
                    id={`place-name-${index}`}
                    value={row.name}
                    maxLength={PLACE_NAME_MAX}
                    onChange={(event) => updateRow(index, { name: event.target.value })}
                    placeholder={NAME_EXAMPLES[index] ?? "Nombre"}
                    autoComplete="off"
                    className="min-h-12 w-full min-w-0 rounded-xl border border-line bg-bg px-3.5 text-base"
                  />
                  <label className="sr-only" htmlFor={`place-where-${index}`}>
                    Dónde está el lugar {index + 1}
                  </label>
                  <select
                    id={`place-where-${index}`}
                    value={row.where}
                    onChange={(event) => updateRow(index, { where: event.target.value as Where })}
                    className="min-h-12 w-full min-w-0 rounded-xl border border-line bg-bg px-3 text-base"
                  >
                    <option value="here">
                      {here ? `Punto marcado en el mapa (${nearestTown(here.lat, here.lon, 15) ?? "sin comuna"})` : "Punto marcado en el mapa (no hay)"}
                    </option>
                    {row.kept && (
                      <option value="kept">
                        Punto elegido en el mapa ({nearestTown(row.kept.lat, row.kept.lon, 15) ?? "sin comuna"})
                      </option>
                    )}
                    {TOWNS.map(([town]) => (
                      <option key={town} value={town}>
                        {town}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setPicking(index)}
                    className="min-h-11 rounded-xl border border-quiet-line bg-quiet-bg text-[15px] font-semibold text-quiet"
                  >
                    {row.where === "kept" ? "Ajustar en el mapa" : "Elegir el punto exacto en el mapa"}
                  </button>
                  {missing && (
                    <p className="text-[13px] text-severe">
                      No hay un punto marcado.{" "}
                      <Link href="/" className="underline">
                        Márcalo en el mapa
                      </Link>{" "}
                      o elige una comuna.
                    </p>
                  )}
                </div>
              );
            })}
            {rows.length < MAX_PLACES && (
              <button
                type="button"
                onClick={() => setDrafts([...rows, { name: "", where: "Rancagua" }])}
                className="min-h-12 rounded-xl border border-dashed border-line text-[15px] font-semibold text-quiet"
              >
                + Agregar otro lugar
              </button>
            )}
          </fieldset>

          {/* min-w-0: a fieldset otherwise never shrinks below its content and widens the page. */}
          <fieldset className="flex min-w-0 flex-col gap-2.5">
            <legend className="mb-2.5 text-[17px] font-semibold">Avisarme si hay tormentas a menos de</legend>
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
            <p className="text-[13px] text-muted">{RADIUS_HINT[radius]} Para cada uno de tus lugares.</p>
          </fieldset>

          <p className="flex items-start gap-2.5 text-[13px] leading-relaxed text-soft">
            <LockIcon size={18} className="mt-0.5 shrink-0 text-quiet" />
            <span>
              Los nombres de tus lugares quedan solo en este teléfono. Guardamos el punto aproximado de cada uno (~1 km),
              el radio y la dirección técnica de notificación de este teléfono. Al desactivar se borran.{" "}
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
            disabled={busy || !ready}
            className="min-h-13 rounded-2xl bg-accent font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Guardando…" : active ? "Guardar lugares" : "Activar notificaciones"}
          </button>
          {picking !== null && (
            <PlacePicker
              initial={draftPoint(rows[picking], here)}
              onCancel={() => setPicking(null)}
              onPick={(point) => {
                updateRow(picking, { where: "kept", kept: point });
                setPicking(null);
              }}
            />
          )}
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setDrafts([]);
                setMessage(null);
              }}
              className="min-h-12 text-[15px] font-semibold text-quiet"
            >
              Cancelar
            </button>
          )}
        </form>
      )}
    </PageShell>
  );
}
