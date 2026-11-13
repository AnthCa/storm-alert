"use client";

import { useState } from "react";
import { useStoredValue } from "@/lib/browser-store";
import { SUPABASE_CONFIGURED } from "@/lib/push";
import { SKY_OPTIONS, canReport, sendReport, toggleKind, type SkyKind } from "@/lib/sky-report";
import type { Status } from "@/lib/status";

const LAST_KEY = "miranubes:last-sky-report";

/**
 * "¿Qué ves ahora?": one tap to open, a few chips, send. The reports are not shown to
 * anyone: they are the ground truth the satellite is checked against.
 */
export function SkyReport({
  place,
  status,
  now,
  compact = false,
}: {
  place: { lat: number; lon: number };
  status: Status;
  now: number;
  /** Phones: a small link beside "Ver detalles", so the sheet leaves the map visible. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<SkyKind[]>([]);
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [lastSent, setLastSent] = useStoredValue<number | null>(LAST_KEY, null);

  if (!SUPABASE_CONFIGURED) return null;
  if (now > 0 && !canReport(lastSent, now)) {
    return (
      <p className="text-[13px] text-soft" role="status">
        {compact ? "Gracias por tu reporte" : "Gracias por contarnos lo que ves. Nos ayuda a medir cuánto acierta el satélite."}
      </p>
    );
  }
  if (!open) {
    if (compact) {
      return (
        <button type="button" onClick={() => setOpen(true)} className="flex min-h-9 items-center text-[13px] font-semibold text-accent">
          ¿Qué ves en el cielo?
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 items-center justify-center rounded-xl border border-line bg-surface-2 px-3.5 text-sm font-semibold"
      >
        ¿Qué ves ahora en el cielo?
      </button>
    );
  }

  async function submit() {
    setState("sending");
    try {
      await sendReport(place, seen, status);
      setLastSent(Date.now());
      setOpen(false);
      setSeen([]);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex w-full flex-col gap-2.5 rounded-xl border border-line bg-surface-2 p-3" role="group" aria-label="¿Qué ves ahora en el cielo?">
      <p className="text-sm font-semibold">¿Qué ves ahora en el cielo?</p>
      <div className="flex flex-wrap gap-2">
        {SKY_OPTIONS.map(({ key, label }) => {
          const on = seen.includes(key);
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              onClick={() => setSeen(toggleKind(seen, key))}
              className={`min-h-11 rounded-full border px-3.5 text-sm font-semibold ${on ? "border-accent bg-accent text-white" : "border-line bg-surface"}`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <p className="text-[13px] text-muted">
        Anónimo: enviamos lo que marcas y tu punto aproximado (~1 km), sin tu nombre ni tu teléfono.
      </p>
      {state === "error" && (
        <p className="text-[13px] text-severe" role="alert">
          No pudimos enviarlo. Revisa tu conexión e inténtalo otra vez.
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={seen.length === 0 || state === "sending"}
          onClick={submit}
          className="min-h-11 grow rounded-xl bg-accent px-3.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {state === "sending" ? "Enviando…" : "Enviar"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-11 px-3 text-sm font-semibold text-quiet">
          Cancelar
        </button>
      </div>
    </div>
  );
}
