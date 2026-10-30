import type { Metadata } from "next";
import Link from "next/link";
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
    name: "Actividad convectiva intensa",
    dot: "bg-[#ff6b5b]",
    tone: "text-severe",
    text: "Nube muy alta y los rayos se disparan de golpe. Puede traer granizo, viento fuerte o, rara vez, un tornado. Es una observación experimental, no un aviso oficial.",
  },
  {
    name: "Datos incompletos",
    dot: "bg-[#7a8491]",
    tone: "text-soft",
    text: "Faltan datos o están atrasados. En ese caso nunca decimos «sin tormentas»: decimos que no podemos confirmar el estado.",
  },
];

const TIMELINE = [
  { time: "16:20", dot: "bg-[#6cb8ff]", text: "Nube a −25 °C, sin rayos." },
  {
    time: "16:40",
    dot: "bg-[#ff6b5b]",
    text: "La nube llega a −38 °C y los rayos se disparan: aquí la regla habría marcado actividad intensa.",
  },
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
          El 26 de octubre de 2026 un tornado, clasificado de forma preliminar como EF2, afectó a cerca de 70
          viviendas en Requínoa. Nadie lo anunció. Al revisar después los datos del satélite, esto es lo que ya
          mostraban:
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
          <span className="font-mono text-3xl text-severe">~50 min</span>
          <span className="text-sm text-[#f3d3ce]">
            antes del tornado apareció la señal, según el análisis posterior. Nadie recibió ese aviso: el sistema aún
            no existía.
          </span>
        </div>
        <DemoLink />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">¿Se equivoca mucho?</h2>
        <p className="text-sm leading-relaxed text-soft">
          Probamos la misma regla en todos los días de octubre de 2026, sin ajustarla después de ver los resultados.
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

      <p className="-mt-3 text-[13px] leading-relaxed text-muted">
        Es un solo tornado y un solo mes. No alcanza para estimar con qué frecuencia acierta o se equivoca.
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Cobertura y versión</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted">Área monitoreada</dt>
          <dd>50 km alrededor de Requínoa</dd>
          <dt className="text-muted">Actualización</dt>
          <dd>cada 10 minutos (nubes) y cada 20 segundos (rayos)</dd>
          <dt className="text-muted">Algoritmo</dt>
          <dd className="font-mono">2026.10-r1</dd>
          <dt className="text-muted">Revisado</dt>
          <dd>30 de octubre de 2026</dd>
        </dl>
      </section>

      <Note title="Límites que debes conocer">
        Observa actividad convectiva intensa; no predice tornados. Los datos pueden tardar unos minutos más en llegar,
        y si faltan, lo decimos. Fuera de los 50 km alrededor de Requínoa no calculamos nada. No reemplaza los avisos
        oficiales de SENAPRED ni de la Dirección Meteorológica.
      </Note>

      <footer className="flex flex-col gap-2 text-[13px] text-muted">
        <p>Datos: NOAA GOES-19 (ABI y GLM), públicos y gratuitos. Mapa: OpenFreeMap y OpenStreetMap.</p>
        <Link href="/privacidad" className="flex min-h-11 items-center text-sm text-quiet">
          Política de privacidad
        </Link>
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
