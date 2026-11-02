"use client";

import Link from "next/link";
import { useState } from "react";
import { promptInstall, useInstallKind } from "@/lib/install";
import { CheckIcon, ShareIcon } from "./Icons";
import { LogoMark } from "./Logo";

/** Install button or steps for this browser. Says nothing until the browser is known. */
export function InstallCard() {
  const kind = useInstallKind();
  const [declined, setDeclined] = useState(false);
  if (!kind) return null;

  if (kind === "installed") {
    return (
      <Box>
        <p className="flex items-center gap-2 text-[15px] font-semibold">
          <CheckIcon className="text-quiet" /> Ya estás usando la app instalada
        </p>
      </Box>
    );
  }

  if (kind === "prompt") {
    return (
      <Box>
        <button
          type="button"
          onClick={async () => setDeclined(!(await promptInstall()))}
          className="min-h-12 rounded-xl bg-accent text-[15px] font-semibold text-white"
        >
          Instalar Miranubes
        </button>
        <p className="text-[13px] text-soft">
          {declined
            ? "Si cambias de opinión, abre el menú ⋮ del navegador y toca «Instalar app»."
            : "Queda un ícono en tu pantalla de inicio y se abre como cualquier app."}
        </p>
      </Box>
    );
  }

  if (kind === "ios") {
    return (
      <Box>
        <Steps
          steps={[
            <>
              Toca <strong>Compartir</strong> <ShareIcon size={18} className="inline align-text-bottom text-quiet" /> en
              la barra del navegador.
            </>,
            <>
              Baja y toca <strong>Agregar a inicio</strong>.
            </>,
            <>
              Toca <strong>Agregar</strong>. Abre Miranubes desde el ícono nuevo.
            </>,
          ]}
        />
        <p className="text-[13px] text-soft">
          Si no ves «Agregar a inicio», abre esta página en Safari. En iPhone, las notificaciones solo llegan a la app
          instalada.
        </p>
      </Box>
    );
  }

  if (kind === "android") {
    return (
      <Box>
        <Steps
          steps={[
            <>
              Abre el menú del navegador (<strong>⋮</strong> o <strong>≡</strong>).
            </>,
            <>
              Toca <strong>Instalar app</strong> o <strong>Agregar a pantalla principal</strong>.
            </>,
            <>Abre Miranubes desde el ícono nuevo.</>,
          ]}
        />
        <p className="text-[13px] text-soft">Si no aparece la opción, abre esta página en Chrome.</p>
      </Box>
    );
  }

  return (
    <Box>
      <p className="text-[15px]">
        Miranubes está pensada para el teléfono. Escanea el código con la cámara y sigue los pasos que aparecen ahí.
      </p>
      <Link href="/instalar" className="text-sm font-semibold text-quiet">
        Ver el código QR
      </Link>
    </Box>
  );
}

function Box({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-quiet-line bg-quiet-bg p-4">
      <h2 className="flex items-center gap-2.5 text-[17px] font-semibold">
        <LogoMark size={20} /> Instala la app
      </h2>
      {children}
    </section>
  );
}

function Steps({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-2.5">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-3 text-[15px] leading-snug">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-semibold text-white">
            {i + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}
