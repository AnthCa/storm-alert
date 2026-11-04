import type { Metadata } from "next";
import Link from "next/link";
import { BellIcon, BoltIcon, CloudIcon, LockIcon, PinIcon, PlayIcon } from "@/components/Icons";
import { LogoMark, Wordmark } from "@/components/Logo";

const TITLE = "Miranubes · El cielo de O'Higgins, en vivo desde el satélite";
const DESCRIPTION =
  "Nació después del tornado de Requínoa: una app gratuita que muestra en vivo las nubes de tormenta y los rayos sobre O'Higgins, y avisa cerca de los lugares de tu gente.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://miranubes.vercel.app/conoce",
    images: [{ url: "https://miranubes.vercel.app/promo/og.jpg", width: 1200, height: 630 }],
    locale: "es_CL",
    type: "website",
  },
};

const STORY = [
  {
    when: "26 de octubre de 2026, 17:30",
    text: "Un tornado, clasificado de forma preliminar como EF2, afecta a cerca de 70 viviendas en Requínoa. Nadie lo había anunciado.",
  },
  {
    when: "Esa misma tarde",
    text: "La región de O'Higgins no tiene radar meteorológico. Lo único que miraba esa tormenta desde arriba era el satélite GOES-19, cuyos datos son públicos y gratuitos.",
  },
  {
    when: "Después",
    text: "Revisando esos datos, la señal ya estaba: nubes cada vez más altas y rayos que se disparaban de golpe, unos 50 minutos antes del tornado. Nadie recibió ese aviso, porque el sistema no existía.",
  },
  {
    when: "Hoy",
    text: "Miranubes pone ese mismo cielo en tu teléfono, en vivo. No para asustar: para que sepas si de verdad viene algo hacia tu casa, el colegio de los niños o la casa de tus papás.",
  },
];

const FEATURES = [
  {
    Icon: CloudIcon,
    tone: "text-convective",
    title: "Nubes y tormentas en vivo",
    text: "Todas las nubes en gris y, en color, las de tormenta: más frías y altas, más intensas. Se actualiza cada 10 minutos.",
  },
  {
    Icon: BoltIcon,
    tone: "text-bolt",
    title: "Rayos cada 20 segundos",
    text: "Cada rayo que ve el satélite, con la distancia al más cercano y cuánto esperar bajo techo después del último.",
  },
  {
    Icon: PinIcon,
    tone: "text-quiet",
    title: "Los lugares de tu gente",
    text: "Marca hasta 3 lugares: tu casa, el colegio, la casa de tus papás. Ves qué tan lejos está la actividad de cada uno.",
  },
  {
    Icon: BellIcon,
    tone: "text-quiet",
    title: "Avisos cuando hay rayos cerca",
    text: "Te avisamos aunque no tengas la app abierta. Solo decimos «tormenta» si hubo rayos. Por ahora es un piloto con invitación.",
  },
  {
    Icon: PlayIcon,
    tone: "text-bolt",
    title: "De dónde vino y hacia dónde va",
    text: "Repite la última media hora en el mapa y mira si la tormenta se acerca o se aleja.",
  },
  {
    Icon: LockIcon,
    tone: "text-soft",
    title: "Tu ubicación no sale del teléfono",
    text: "Los cálculos se hacen en tu equipo. Los nombres de tus lugares nunca llegan a nuestros servidores.",
  },
];

const SCORES = [
  { value: "95%", text: "de las lluvias fuertes tenían nubes de tormenta encima." },
  { value: "84%", text: "de las lluvias tenían nubes de tormenta encima." },
  { value: "47%", text: "de las veces con nubes de tormenta, llovió. La otra mitad eran solo nubes altas." },
];

export default function AboutPage() {
  return (
    <main className="pb-28 lg:pt-16 lg:pb-0">
      <section className="mx-auto flex max-w-6xl flex-wrap items-center gap-10 px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-14 lg:pt-14">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-5">
          <div className="flex items-center gap-2.5 lg:hidden">
            <LogoMark size={22} compact />
            <Wordmark className="text-[22px]" />
          </div>
          <span className="self-start rounded-md border border-line px-2 py-1 text-[11px] font-semibold tracking-wide text-soft">
            EXPERIMENTAL · GRATIS · HECHO EN O&apos;HIGGINS
          </span>
          <h1 className="text-[40px] leading-[1.05] font-bold tracking-tight lg:text-[56px]">
            El cielo de O&apos;Higgins, en vivo desde el satélite.
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-soft">
            ¿Anunciaron lluvia y no llegó? ¿O llegó sin aviso? Miranubes te muestra qué hay de verdad en el cielo ahora:
            nubes de tormenta, rayos y qué tan lejos están de los tuyos.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="flex min-h-12 items-center rounded-xl bg-accent px-5 text-[15px] font-semibold text-white"
            >
              Abrir el mapa
            </Link>
            <Link
              href="/instalar"
              className="flex min-h-12 items-center rounded-xl border border-line bg-surface px-5 text-[15px] font-semibold"
            >
              Instalar en el teléfono
            </Link>
          </div>
        </div>
        <div className="flex flex-[1_1_300px] justify-center">
          <video
            src="/promo/miranubes.mp4"
            poster="/promo/poster.jpg"
            controls
            playsInline
            preload="none"
            className="aspect-[9/16] w-full max-w-[320px] rounded-[28px] border border-line bg-surface shadow-2xl"
            aria-label="Video de presentación de Miranubes, con narración"
          />
        </div>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-10 px-5 py-14">
          <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-3">
            <h2 className="text-3xl font-bold tracking-tight">Por qué nació</h2>
            <p className="text-[15px] leading-relaxed text-soft">
              Después de Requínoa quedó una pregunta: ¿se podía haber visto venir esa tormenta con datos que ya son
              públicos? La respuesta fue sí, y de ahí salió Miranubes.
            </p>
          </div>
          <ol className="flex min-w-0 flex-[2_1_480px] flex-col">
            {STORY.map((step, i) => (
              <li key={step.when} className="flex gap-4">
                <div className="flex w-4 flex-col items-center">
                  <span
                    className={`mt-1.5 size-3.5 shrink-0 rounded-full ${i === 0 ? "bg-severe" : i === STORY.length - 1 ? "bg-quiet" : "bg-convective"}`}
                    aria-hidden="true"
                  />
                  {i < STORY.length - 1 && <span className="w-0.5 grow bg-line" aria-hidden="true" />}
                </div>
                <div className="flex flex-col gap-1 pb-7">
                  <span className="font-mono text-[13px] text-muted">{step.when}</span>
                  <p className="text-[16px] leading-relaxed">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-14">
        <h2 className="text-3xl font-bold tracking-tight">Qué puedes hacer</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ Icon, tone, title, text }) => (
            <div key={title} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5">
              <Icon className={tone} />
              <h3 className="text-[17px] font-semibold">{title}</h3>
              <p className="text-sm leading-relaxed text-soft">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-14">
          <div className="flex max-w-3xl flex-col gap-3">
            <h2 className="text-3xl font-bold tracking-tight">¿Qué tan confiable es?</h2>
            <p className="text-[15px] leading-relaxed text-soft">
              Comparamos las nubes de tormenta que muestra la app con la lluvia registrada por la NASA entre abril y
              octubre de 2026, con reglas fijadas antes de ver los resultados. Publicamos lo bueno y lo malo.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {SCORES.map((score) => (
              <div key={score.value} className="flex flex-col gap-2 rounded-2xl border border-line bg-bg p-5">
                <span className="font-mono text-4xl">{score.value}</span>
                <span className="text-sm leading-relaxed text-soft">{score.text}</span>
              </div>
            ))}
          </div>
          <p className="max-w-3xl text-[13px] leading-relaxed text-muted">
            Mide la señal de nubes de tormenta, no los avisos de actividad intensa ni los tornados: con un solo tornado no
            se puede medir eso. Funciona peor en la costa. Por eso la app solo dice «tormenta» cuando hubo rayos.
          </p>
        </div>
      </section>

      <section className="mx-auto flex max-w-6xl flex-wrap gap-6 px-5 py-14">
        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-3 rounded-2xl border border-quiet-line bg-quiet-bg p-6">
          <h2 className="text-xl font-semibold text-[#b8dcff]">Lo que no es</h2>
          <p className="text-[15px] leading-relaxed text-[#d5dce4]">
            No es un aviso oficial ni un pronóstico: muestra lo que el satélite está viendo ahora. No predice tornados ni
            mide granizo. Para alertas oficiales, sigue a SENAPRED y a la Dirección Meteorológica de Chile.
          </p>
          <Link href="/oficiales" className="text-sm font-semibold text-quiet">
            Ver los avisos oficiales
          </Link>
        </div>
        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-3 rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-xl font-semibold">Apoya el proyecto</h2>
          <p className="text-[15px] leading-relaxed text-soft">
            Miranubes es gratis y lo hace una sola persona en O&apos;Higgins. Si te sirve, compártelo con tu gente.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://link.mercadopago.cl/miranubes"
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center rounded-xl border border-line bg-bg px-4 text-sm font-semibold"
            >
              Invítame un café
            </a>
            <Link
              href="/patrocinar"
              className="flex min-h-11 items-center rounded-xl border border-line bg-bg px-4 text-sm font-semibold"
            >
              Patrocinar
            </Link>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-line px-5 py-8 text-[13px] text-muted">
        <span>Datos: NOAA GOES-19 y NASA IMERG, públicos y gratuitos. Mapa: OpenFreeMap y OpenStreetMap.</span>
        <span className="flex gap-4">
          <Link href="/como-funciona" className="text-quiet">
            Cómo funciona
          </Link>
          <Link href="/privacidad" className="text-quiet">
            Privacidad
          </Link>
        </span>
      </footer>
    </main>
  );
}
