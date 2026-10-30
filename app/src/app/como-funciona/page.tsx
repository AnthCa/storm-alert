import type { Metadata } from "next";
import { DemoLink } from "@/components/DemoLink";
import { BoltIcon, CloudIcon, CodeIcon } from "@/components/Icons";
import { Card, Note, PageShell } from "@/components/PageShell";

export const metadata: Metadata = { title: "Cómo funciona · Storm Alert O'Higgins" };

const LEVELS = [
  { name: "Tranquilo", dot: "bg-[#6cb8ff]", tone: "text-quiet", text: "No hay nubes de tormenta ni rayos cerca." },
  {
    name: "Nubes de tormenta",
    dot: "bg-convective",
    tone: "text-[#f5b95e]",
    text: "Hay nubes muy altas (topes de −38 °C o más fríos). Puede haber chubascos y rayos.",
  },
  {
    name: "Alerta de tormenta severa",
    dot: "bg-[#ff6b5b]",
    tone: "text-severe",
    text: "Nube muy alta y los rayos se disparan de golpe. Posible granizo, viento fuerte o tornado.",
  },
];

const TIMELINE = [
  { time: "16:20", dot: "bg-[#6cb8ff]", text: "Nube a −25 °C, sin rayos." },
  { time: "16:40", dot: "bg-[#ff6b5b]", text: "Primera alerta: la nube llega a −38 °C y los rayos se disparan." },
  { time: "17:10", dot: "bg-[#ff6b5b]", text: "99 rayos en 5 minutos; nube a −47 °C." },
  { time: "17:30", dot: "bg-fg", text: "Tornado en Requínoa." },
];

const STATS = [
  { value: "28", label: "días de octubre analizados" },
  { value: "7", label: "días con alerta, incluido el del tornado" },
  { value: "6 de 6", label: "otros días con alerta tenían aviso oficial de tormenta" },
  { value: "2", label: "días con granizo confirmado en Rancagua" },
];

export default function HowItWorksPage() {
  return (
    <PageShell
      title="Cómo funciona"
      intro="La región de O'Higgins no tiene radar meteorológico. Por eso usamos el satélite GOES-19 de la NOAA, que observa Chile todo el día y entrega sus datos gratis."
    >
      <section className="flex flex-col gap-2.5">
        <h2 className="text-lg font-semibold">Qué mira el satélite</h2>
        <div className="grid grid-cols-2 gap-2">
          <Card className="p-3.5">
            <CloudIcon className="text-convective" />
            <h3 className="font-semibold">Altura de las nubes</h3>
            <p className="text-[13px] leading-relaxed text-soft">
              Mientras más fría la parte de arriba, más alto subió la nube. Cada 10 min.
            </p>
          </Card>
          <Card className="p-3.5">
            <BoltIcon className="text-bolt" />
            <h3 className="font-semibold">Rayos</h3>
            <p className="text-[13px] leading-relaxed text-soft">
              Cada destello que ve el satélite. Si se disparan de golpe, la tormenta se intensifica.
            </p>
          </Card>
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="text-lg font-semibold">Los tres niveles</h2>
        {LEVELS.map((level) => (
          <Card key={level.name} className="flex-row items-start p-3.5">
            <span className={`mt-1 size-3.5 shrink-0 rounded-full ${level.dot}`} aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <h3 className={`font-semibold ${level.tone}`}>{level.name}</h3>
              <p className="text-[13px] leading-relaxed text-soft">{level.text}</p>
            </div>
          </Card>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">El caso Requínoa</h2>
        <p className="text-sm leading-relaxed text-soft">
          El 26 de octubre de 2026 un tornado EF2 afectó a cerca de 70 viviendas en Requínoa. Nadie lo anunció. Esto
          es lo que el satélite ya mostraba:
        </p>
        <ol>
          {TIMELINE.map((event) => (
            <li key={event.time} className="flex gap-3.5">
              <div className="flex w-3.5 flex-col items-center">
                <span className={`mt-1 size-3 rounded-full ${event.dot}`} aria-hidden="true" />
                <span className="w-0.5 grow bg-line" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-0.5 pb-4">
                <span className="font-mono text-[13px] text-muted">{event.time}</span>
                <span className="text-[15px] leading-snug">{event.text}</span>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex items-baseline gap-2.5 rounded-2xl border border-[#7a2a22] bg-severe-bg p-3.5">
          <span className="font-mono text-3xl text-severe">50 min</span>
          <span className="text-sm text-[#f3d3ce]">de anticipación entre la primera alerta y el tornado</span>
        </div>
        <DemoLink />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">¿Se equivoca mucho?</h2>
        <p className="text-sm leading-relaxed text-soft">
          Probamos la misma regla en todos los días de octubre de 2026, sin ajustarla.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {STATS.map((stat) => (
            <Card key={stat.label} className="gap-1 p-3.5">
              <span className="font-mono text-2xl">{stat.value}</span>
              <span className="text-[13px] leading-snug text-soft">{stat.label}</span>
            </Card>
          ))}
        </div>
      </section>

      <Note title="Límites que debes conocer">
        Detecta tormentas severas, no tornados en particular. Los datos llegan cada 10 minutos y pueden tardar unos
        minutos más. Por ahora está validado alrededor de Requínoa. No reemplaza las alertas oficiales de SENAPRED ni
        de la Dirección Meteorológica.
      </Note>

      <footer className="flex flex-col gap-2 text-[13px] text-muted">
        <p>Datos: NOAA GOES-19 (ABI y GLM), públicos y gratuitos. Mapa: OpenFreeMap y OpenStreetMap.</p>
        <a
          href="https://github.com/AnthCa/storm-alert"
          className="flex min-h-11 items-center gap-1.5 text-sm text-quiet"
        >
          <CodeIcon size={18} /> Proyecto abierto: ver el código y la investigación
        </a>
      </footer>
    </PageShell>
  );
}
