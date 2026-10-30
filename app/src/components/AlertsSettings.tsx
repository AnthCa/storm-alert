"use client";

import Link from "next/link";
import { useStoredValue } from "@/lib/browser-store";
import { BoltIcon, CheckIcon, LockIcon, LocateIcon, PinIcon } from "./Icons";
import { Note } from "./PageShell";
import { PageShell } from "./PageShell";

const SETTINGS_KEY = "storm-alert:alert-settings";
const RADII = [10, 25, 50] as const;
type Radius = (typeof RADII)[number];

const RADIUS_HINT: Record<Radius, string> = {
  10: "Solo tormentas casi encima. Menos avisos.",
  25: "Recomendado: tiempo suficiente para prepararte.",
  50: "Toda la zona. Más avisos, algunos lejanos.",
};

interface Settings {
  radius: Radius;
  where: "point" | "commune";
  clouds: boolean;
  allClear: boolean;
}

const DEFAULTS: Settings = { radius: 25, where: "commune", clouds: false, allClear: false };

export function AlertsSettings() {
  const [stored, setStored] = useStoredValue<Partial<Settings>>(SETTINGS_KEY, DEFAULTS);
  const settings: Settings = { ...DEFAULTS, ...stored };
  const update = (patch: Partial<Settings>) => setStored({ ...settings, ...patch });

  return (
    <PageShell
      title="Notificaciones"
      intro="Cuando estén listas, te avisaremos si observamos actividad convectiva intensa cerca de ti, aunque no tengas la app abierta."
    >
      <Note title="Todavía no enviamos notificaciones">
        Las estamos preparando. Puedes dejar listas tus preferencias: quedan guardadas solo en este dispositivo. Las
        notificaciones de Storm Alert serán observaciones experimentales y no reemplazan los avisos oficiales.
      </Note>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs tracking-wider text-muted">ASÍ SE VERÁ UNA NOTIFICACIÓN</h2>
        <div className="flex items-start gap-3 rounded-[18px] bg-[#e9ecf0] px-3.5 py-3 text-[#14181d]">
          <div className="flex size-[38px] shrink-0 items-center justify-center rounded-[9px] bg-bg text-bolt">
            <BoltIcon />
          </div>
          <div className="flex grow flex-col gap-0.5">
            <div className="flex justify-between text-xs text-[#4a535e]">
              <span>STORM ALERT</span>
              <span>ahora</span>
            </div>
            <div className="text-[15px] font-semibold">Actividad convectiva intensa cerca de Rengo</div>
            <div className="text-sm text-[#2e353d]">
              Observada a 18 km, a las 17:40. Sistema experimental; revisa los avisos de la DMC y SENAPRED.
            </div>
          </div>
        </div>
      </section>

      <fieldset className="flex flex-col gap-2.5" role="radiogroup">
        <legend className="mb-2.5 text-[17px] font-semibold">Dónde</legend>
        <Choice
          selected={settings.where === "commune"}
          onSelect={() => update({ where: "commune" })}
          icon={<PinIcon size={20} />}
          title="Una comuna"
          detail="La tuya o la de tu familia. No usa GPS."
        />
        <Choice
          selected={settings.where === "point"}
          onSelect={() => update({ where: "point" })}
          icon={<LocateIcon size={20} />}
          title="Un punto fijo"
          detail="Tu ubicación de hoy, redondeada a ~1 km. No te sigue."
        />
      </fieldset>

      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 text-[17px] font-semibold">Notificarme si la actividad está a menos de</legend>
        <div className="grid grid-cols-3 gap-2">
          {RADII.map((km) => {
            const on = settings.radius === km;
            return (
              <button
                key={km}
                type="button"
                aria-pressed={on}
                onClick={() => update({ radius: km })}
                className={`min-h-12 rounded-xl text-[15px] font-semibold ${on ? "bg-accent text-white" : "border border-line bg-surface"}`}
              >
                {km} km
              </button>
            );
          })}
        </div>
        <p className="text-[13px] text-muted">{RADIUS_HINT[settings.radius]}</p>
      </fieldset>

      <fieldset className="flex flex-col">
        <legend className="mb-1.5 text-[17px] font-semibold">Qué notificaciones quieres</legend>
        <Toggle checked disabled title="Actividad convectiva intensa cerca" detail="Siempre activo" />
        <Toggle
          checked={settings.clouds}
          onChange={(clouds) => update({ clouds })}
          title="Nubes de tormenta cerca"
          detail="Más temprano y más frecuente"
        />
        <Toggle
          checked={settings.allClear}
          onChange={(allClear) => update({ allClear })}
          title="Fin de la actividad"
          detail="Solo con datos completos que lo confirmen"
          last
        />
      </fieldset>

      <p className="flex items-start gap-2.5 text-[13px] leading-relaxed text-soft">
        <LockIcon size={18} className="mt-0.5 shrink-0 text-quiet" />
        <span>
          Guardaremos solo tu comuna o un punto aproximado (~1 km) para saber cuándo avisarte. No la compartimos con
          nadie y podrás borrarla cuando quieras.{" "}
          <Link href="/privacidad" className="text-quiet underline">
            Política de privacidad
          </Link>
        </span>
      </p>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled
          className="min-h-13 rounded-2xl bg-accent font-semibold text-white disabled:opacity-60"
        >
          Activar avisos
        </button>
        <p className="text-center text-[13px] text-muted">
          Disponible pronto. En iPhone, para recibirlas deberás agregar la app a la pantalla de inicio.
        </p>
      </div>
    </PageShell>
  );
}

function Choice(props: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={props.selected}
      onClick={props.onSelect}
      className={`flex min-h-14 items-center gap-3 rounded-2xl px-3.5 text-left ${
        props.selected ? "border-[1.5px] border-accent bg-quiet-bg" : "border border-line bg-surface"
      }`}
    >
      <span className={props.selected ? "text-quiet" : "text-muted"}>{props.icon}</span>
      <span className="flex grow flex-col">
        <span className="text-[15px]">{props.title}</span>
        <span className="text-[13px] text-muted">{props.detail}</span>
      </span>
      {props.selected && <CheckIcon size={20} className="text-quiet" />}
    </button>
  );
}

function Toggle(props: {
  checked: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
  title: string;
  detail: string;
  last?: boolean;
}) {
  return (
    <label className={`flex min-h-14 items-center gap-3 ${props.last ? "" : "border-b border-line"}`}>
      <input
        type="checkbox"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(e) => props.onChange?.(e.target.checked)}
        className="size-5.5 accent-accent"
      />
      <span className="flex flex-col">
        <span className="text-[15px]">{props.title}</span>
        <span className="text-[13px] text-muted">{props.detail}</span>
      </span>
    </label>
  );
}
