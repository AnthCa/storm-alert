import type { Metadata } from "next";
import { ExternalIcon } from "@/components/Icons";
import { Note, PageShell } from "@/components/PageShell";
import { OFFICIAL_SOURCES } from "@/lib/official";

export const metadata: Metadata = { title: "Avisos oficiales · Miranubes" };

export default function OfficialPage() {
  return (
    <PageShell
      title="Avisos oficiales"
      intro="Los avisos y alertas oficiales los emiten la Dirección Meteorológica y SENAPRED. Siempre tienen prioridad sobre lo que muestra Miranubes."
    >
      <ul className="flex flex-col gap-3">
        {Object.values(OFFICIAL_SOURCES).map((source) => (
          <li key={source.short}>
            <a
              href={source.url}
              className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-fg"
            >
              <span className="flex grow flex-col gap-1">
                <span className="text-xs font-semibold tracking-wider text-muted">{source.short}</span>
                <span className="font-semibold">{source.name}</span>
                <span className="text-[13px] text-soft">{source.role}</span>
              </span>
              <ExternalIcon size={18} className="shrink-0 text-quiet" />
              <span className="sr-only">(abre el sitio oficial)</span>
            </a>
          </li>
        ))}
      </ul>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Oficial y experimental no son lo mismo</h2>
        <dl className="flex flex-col gap-3 text-sm leading-relaxed">
          <div>
            <dt className="font-semibold">Aviso o alerta oficial</dt>
            <dd className="text-soft">Lo emiten la DMC o SENAPRED. Indica un peligro reconocido y qué hacer.</dd>
          </div>
          <div>
            <dt className="font-semibold">Observación experimental de Miranubes</dt>
            <dd className="text-soft">
              Lo que el satélite observa ahora mismo. Es un sistema en prueba, sin validación oficial.
            </dd>
          </div>
        </dl>
      </section>

      <Note title="Por qué no mostramos los avisos aquí">
        Todavía no encontramos una forma estable y permitida de recibir los avisos oficiales. Copiarlos de sus sitios
        sería frágil, y un aviso oficial mal copiado es peor que no mostrarlo. Por ahora te llevamos directo a la
        fuente.
      </Note>
    </PageShell>
  );
}
