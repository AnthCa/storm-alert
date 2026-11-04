import type { Metadata } from "next";
import Link from "next/link";
import { BellIcon, BoltIcon, CloudIcon, LockIcon, PinIcon, PlayIcon } from "@/components/Icons";
import { CountUp, Reveal } from "@/components/landing/Motion";
import { RadarPanel } from "@/components/landing/RadarPanel";
import { LogoMark, Wordmark } from "@/components/Logo";
import { APP_URL } from "@/lib/share";

const TITLE = "Miranubes · El cielo de O'Higgins, en vivo desde el satélite";
const DESCRIPTION =
  "Nació después del tornado de Requínoa: una app gratuita que muestra en vivo las nubes de tormenta y los rayos sobre O'Higgins, y avisa cerca de los lugares de tu gente.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/conoce" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/conoce",
    images: [{ url: "/promo/og.jpg", width: 1200, height: 630, alt: "Mapa de Miranubes con una tormenta y rayos sobre Requínoa" }],
    locale: "es_CL",
    type: "website",
  },
};

// Structured data for search engines: what the app is, where it works, that it is free.
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Miranubes",
  url: `${APP_URL}/`,
  description: DESCRIPTION,
  applicationCategory: "WeatherApplication",
  operatingSystem: "Android, iOS, navegador web",
  inLanguage: "es-CL",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "CLP" },
  areaServed: { "@type": "AdministrativeArea", name: "Región del Libertador General Bernardo O'Higgins, Chile" },
  image: `${APP_URL}/promo/og.jpg`,
};

const TICKER = [
  ["GOES-19", "75,2° O", "text-[#8be9f5]"],
  ["NUBES", "cada 10 min", "text-[#d6dee7]"],
  ["RAYOS", "cada 20 s", "text-bolt"],
  ["UMBRAL", "−38 °C", "text-convective"],
  ["LLUVIA", "NASA IMERG", "text-quiet"],
  ["ÁREA", "50 km de Requínoa", "text-[#8be9f5]"],
] as const;

// The 26 October storm as the satellite saw it (see /como-funciona).
const FRAMES = [
  {
    time: "16:20",
    top: "−25 °C",
    rays: "sin rayos",
    text: "Nube a −25 °C, sin rayos.",
    size: "30%",
    cloud: "radial-gradient(closest-side, rgb(214 222 231 / 0.45), transparent)",
    flashes: 0,
    border: "border-[#1c2733]",
  },
  {
    time: "16:40",
    top: "−38 °C",
    rays: "se disparan",
    text: "La nube llega a −38 °C y los rayos se disparan: aquí la regla habría marcado actividad intensa.",
    size: "46%",
    cloud: "radial-gradient(closest-side, rgb(245 170 60 / 0.9), rgb(244 105 80 / 0.55) 55%, rgb(214 222 231 / 0.18) 80%, transparent)",
    flashes: 5,
    border: "border-[#6b4f1f]",
  },
  {
    time: "17:10",
    top: "−47 °C",
    rays: "99 en 5 min",
    text: "99 rayos en 5 minutos; nube a −47 °C.",
    size: "64%",
    cloud: "radial-gradient(closest-side, rgb(205 40 32 / 0.95), rgb(244 105 80 / 0.55) 55%, rgb(214 222 231 / 0.18) 80%, transparent)",
    flashes: 14,
    border: "border-[#7a2a22]",
  },
  {
    time: "17:30",
    top: "tornado",
    rays: "Requínoa",
    text: "Tornado en Requínoa. Cerca de 70 viviendas afectadas.",
    size: "70%",
    cloud: "radial-gradient(closest-side, rgb(210 70 210 / 0.95), rgb(244 105 80 / 0.55) 55%, rgb(214 222 231 / 0.18) 80%, transparent)",
    flashes: 10,
    border: "border-severe",
  },
];

const FEATURES = [
  { Icon: CloudIcon, tone: "text-convective", title: "Nubes y tormentas en vivo", text: "Todas las nubes en gris y, en color, las de tormenta. Cada 10 minutos." },
  { Icon: BoltIcon, tone: "text-bolt", title: "Rayos cada 20 segundos", text: "La distancia al más cercano y cuánto esperar bajo techo después del último." },
  { Icon: PinIcon, tone: "text-quiet", title: "Los lugares de tu gente", text: "Hasta 3: tu casa, el colegio, la casa de tus papás." },
  { Icon: BellIcon, tone: "text-[#8be9f5]", title: "Avisos cuando hay rayos cerca", text: "Aunque no tengas la app abierta. Solo decimos «tormenta» si hubo rayos. Piloto con invitación." },
  { Icon: PlayIcon, tone: "text-bolt", title: "De dónde vino y hacia dónde va", text: "Repite la última media hora en el mapa." },
  { Icon: LockIcon, tone: "text-[#d6dee7]", title: "Tu ubicación no sale del teléfono", text: "Los cálculos se hacen en tu equipo. Los nombres de tus lugares nunca nos llegan." },
];

// Held-out season, scoring s1 (research/requinoa-2026/PRECISION_PLAN.md).
const SCORES = [
  { value: 95, text: "de las lluvias fuertes tenían nubes de tormenta encima", bar: "bg-[linear-gradient(to_right,#f5aa3c,#cd2820)]" },
  { value: 84, text: "de las lluvias tenían nubes de tormenta encima", bar: "bg-[linear-gradient(to_right,#f5aa3c,#f46950)]" },
  { value: 47, text: "de las veces con nubes de tormenta, llovió", bar: "bg-[linear-gradient(to_right,#8cc8ff,#38d6e8)]" },
];

const kicker = "font-mono text-xs tracking-[0.14em]";
const h2 = "font-brand text-[clamp(32px,4vw,48px)] leading-[1.05] font-bold tracking-[-0.03em]";

/** Flash positions inside a story frame, spread without randomness. */
const flashSpots = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ x: 36 + ((i * 37) % 30), y: 40 + ((i * 53) % 32), d: (i * 0.7) % 6 }));

export default function AboutPage() {
  return (
    <main className="overflow-x-clip bg-[#0b0e13] pb-28 lg:pt-16 lg:pb-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c") }}
      />
      <section className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-14 px-[clamp(16px,4vw,32px)] pt-[max(1.5rem,env(safe-area-inset-top))] pb-[72px] lg:pt-14">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-6">
          <div className="flex items-center gap-2.5 lg:hidden">
            <LogoMark size={22} compact />
            <Wordmark className="text-[22px]" />
          </div>
          <span className={`${kicker} mn-in flex items-center gap-2.5 text-[#8be9f5]`}>
            <span aria-hidden="true" className="size-[7px] rounded-full bg-severe shadow-[0_0_10px_#ff8a7a]" />
            GOES-19 · BANDA 13 · EN VIVO
          </span>
          {/* The headline and its paragraph paint at once: they are what people wait for (LCP). */}
          <h1 className="font-brand text-[clamp(42px,6vw,68px)] leading-none font-bold tracking-[-0.035em]">
            El cielo de O&apos;Higgins, <span className="text-convective">en vivo</span> desde el satélite.
          </h1>
          <p className="max-w-[540px] text-[19px] leading-relaxed text-[#b9c3cf]">
            Nubes de tormenta, rayos y qué tan lejos están de tu casa, del colegio de los niños o de la casa de tus papás.
            Nació después del tornado de Requínoa.
          </p>
          <div className="mn-in" style={{ animationDelay: "400ms" }}>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/"
                className="flex min-h-[52px] items-center rounded-[14px] bg-accent px-6 font-semibold text-white shadow-[0_0_44px_-8px_rgb(31_107_209/0.9)] transition hover:shadow-[0_0_56px_-4px_rgb(31_107_209/1)]"
              >
                Abrir el mapa en vivo
              </Link>
              <Link
                href="/instalar"
                className="flex min-h-[52px] items-center rounded-[14px] border border-line px-6 font-semibold transition hover:border-[#1d4a57]"
              >
                Instalar en el teléfono
              </Link>
            </div>
          </div>
          <p className="text-[13px] text-muted">Gratis · Experimental: no reemplaza los avisos de SENAPRED ni de la DMC.</p>
        </div>
        <div className="mn-in flex min-w-0 flex-[1_1_320px] justify-center" style={{ animationDelay: "200ms" }}>
          <RadarPanel />
        </div>
      </section>

      <div className="overflow-hidden border-y border-[#18212b] bg-[#0d1219]">
        <ul className="mn-ticker flex w-max gap-12 py-4 font-mono text-[13px] whitespace-nowrap text-muted">
          {[...TICKER, ...TICKER].map(([k, v, tone], i) => (
            <li key={i} aria-hidden={i >= TICKER.length ? "true" : undefined}>
              <span className={tone}>{k}</span> {v}
            </li>
          ))}
        </ul>
      </div>

      <section className="mx-auto flex max-w-[1240px] flex-col gap-10 px-[clamp(16px,4vw,32px)] pt-28 pb-10">
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex max-w-[640px] flex-col gap-3.5">
            <span className={`${kicker} text-severe`}>POR QUÉ NACIÓ · 26 DE OCTUBRE DE 2026</span>
            <h2 className={h2}>El satélite vio crecer la tormenta del tornado de Requínoa.</h2>
            <p className="text-[17px] leading-relaxed text-[#b9c3cf]">
              La región no tiene radar meteorológico. Revisando después los datos públicos del GOES-19, la señal ya estaba
              ahí. Nadie la recibió: el sistema no existía.
            </p>
          </div>
          <div className="flex items-baseline gap-3 rounded-[18px] border border-[#5a2620] bg-[#1d1211] px-5 py-4">
            <span className="font-brand text-[44px] font-bold text-severe">~50 min</span>
            <span className="max-w-[200px] text-sm leading-snug text-[#f3d3ce]">
              de señal antes del tornado, en el análisis posterior
            </span>
          </div>
        </Reveal>
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FRAMES.map((frame, i) => (
            <Reveal
              key={frame.time}
              as="li"
              delay={i * 120}
              className={`flex flex-col overflow-hidden rounded-[20px] border bg-[#0d1219] ${frame.border}`}
            >
              <div aria-hidden="true" className="relative aspect-[4/3] overflow-hidden bg-[#0f151d]">
                <div
                  className="absolute top-[55%] left-1/2 aspect-[1.2] -translate-1/2 rounded-full"
                  style={{ width: frame.size, background: frame.cloud }}
                />
                {flashSpots(frame.flashes).map((p) => (
                  <span
                    key={`${p.x}-${p.y}`}
                    className="mn-blip absolute size-1 rounded-full bg-[#fff6c2] shadow-[0_0_8px_3px_rgb(255_225_77/0.6)]"
                    style={{ left: `${p.x}%`, top: `${p.y}%`, animationDelay: `${p.d}s` }}
                  />
                ))}
                <span className="absolute top-2.5 left-3 font-mono text-xs">{frame.time}</span>
              </div>
              <div className="flex flex-col gap-1.5 p-4">
                <div className="flex gap-3 font-mono text-[13px]">
                  <span className="text-convective">{frame.top}</span>
                  <span className="text-bolt">{frame.rays}</span>
                </div>
                <p className="text-[15px] leading-snug text-[#d5dce4]">{frame.text}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </section>

      <section className="mx-auto flex max-w-[1240px] flex-col gap-9 px-[clamp(16px,4vw,32px)] pt-24 pb-10">
        <Reveal className="flex max-w-[640px] flex-col gap-3.5">
          <span className={`${kicker} text-[#8be9f5]`}>QUÉ PUEDES HACER</span>
          <h2 className={h2}>Ver el cielo como lo ve el satélite.</h2>
        </Reveal>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ Icon, tone, title, text }, i) => (
            <Reveal
              key={title}
              delay={(i % 3) * 110}
              className="flex flex-col gap-3.5 rounded-[20px] border border-[#1c2733] bg-[linear-gradient(180deg,#0f151d,#0b0e13)] p-6 transition-colors hover:border-[#1d4a57]"
            >
              <span className={`flex size-[52px] items-center justify-center rounded-[14px] border border-[#1d4a57] bg-[#38d6e8]/5 ${tone}`}>
                <Icon />
              </span>
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="text-[15px] leading-relaxed text-soft">{text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-12 px-[clamp(16px,4vw,32px)] pt-24 pb-10">
        <Reveal className="flex min-w-0 flex-[1_1_320px] flex-col gap-3.5">
          <span className={`${kicker} text-convective`}>¿QUÉ TAN CONFIABLE ES?</span>
          <h2 className={h2}>Medido contra la lluvia de la NASA. Con sus errores.</h2>
          <p className="text-[17px] leading-relaxed text-[#b9c3cf]">
            De abril a octubre de 2026, con reglas fijadas antes de ver los resultados. Mide la señal de nubes de tormenta,
            no los tornados: con uno solo no se puede medir eso. Funciona peor en la costa.
          </p>
        </Reveal>
        <Reveal
          delay={120}
          className="flex min-w-0 flex-[1_1_320px] flex-col gap-6 rounded-3xl border border-[#1c2733] bg-[#0d1219] p-7"
        >
          {SCORES.map((score) => (
            <div key={score.value} className="flex flex-col gap-2.5">
              <div className="flex items-baseline gap-3.5">
                <span className="font-brand text-[44px] font-bold tracking-tight">
                  <CountUp value={score.value} suffix="%" />
                </span>
                <span className="text-[15px] leading-snug text-[#b9c3cf]">{score.text}</span>
              </div>
              <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-[#18212b]">
                <div className={`mn-bar h-full rounded-full ${score.bar}`} style={{ width: `${score.value}%` }} />
              </div>
            </div>
          ))}
        </Reveal>
      </section>

      <section className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-12 px-[clamp(16px,4vw,32px)] py-24">
        <Reveal className="flex flex-[0_1_300px] justify-center">
          <video
            src="/promo/miranubes.mp4"
            poster="/promo/poster.webp"
            controls
            playsInline
            preload="none"
            className="aspect-[9/16] w-[280px] rounded-[34px] border-[6px] border-[#1c232d] bg-surface shadow-[0_50px_90px_-40px_rgb(0_0_0/0.95),0_0_80px_-30px_rgb(245_185_94/0.5)]"
            aria-label="Video de presentación de Miranubes, con narración"
          />
        </Reveal>
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
          <Reveal className="flex flex-col gap-2.5 rounded-[22px] border border-quiet-line bg-[#0f1b28] p-6">
            <h2 className="text-[22px] font-semibold text-[#b8dcff]">Lo que no es</h2>
            <p className="text-base leading-relaxed text-[#d5dce4]">
              No es un aviso oficial ni un pronóstico: muestra lo que el satélite está viendo ahora. No predice tornados ni
              mide granizo. Para alertas oficiales, sigue a SENAPRED y a la Dirección Meteorológica de Chile.
            </p>
            <Link href="/oficiales" className="font-semibold text-[#38d6e8]">
              Ver los avisos oficiales ›
            </Link>
          </Reveal>
          <Reveal
            delay={120}
            className="flex flex-wrap items-center gap-3.5 rounded-[22px] border border-[#1c2733] bg-[#0d1219] p-6"
          >
            <div className="flex flex-[1_1_260px] flex-col gap-1.5">
              <h2 className="text-[22px] font-semibold">Hecho en O&apos;Higgins, gratis</h2>
              <p className="text-[15px] leading-relaxed text-soft">
                Lo hace una sola persona. Si te sirve, compártelo con tu gente.
              </p>
            </div>
            <a
              href="https://link.mercadopago.cl/miranubes"
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[46px] items-center rounded-xl border border-line px-4.5 font-semibold"
            >
              Invítame un café
            </a>
            <Link href="/patrocinar" className="flex min-h-[46px] items-center rounded-xl border border-line px-4.5 font-semibold">
              Patrocinar
            </Link>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-[#18212b]">
        <div className="mx-auto flex max-w-[1240px] flex-wrap justify-between gap-4 px-[clamp(16px,4vw,32px)] py-7 text-[13px] text-muted">
          <span>Datos: NOAA GOES-19 y NASA IMERG, públicos y gratuitos. Mapa: OpenFreeMap y OpenStreetMap.</span>
          <span className="flex gap-4">
            <Link href="/como-funciona" className="text-[#38d6e8]">
              Cómo funciona
            </Link>
            <Link href="/privacidad" className="text-[#38d6e8]">
              Privacidad
            </Link>
          </span>
        </div>
      </footer>
    </main>
  );
}
