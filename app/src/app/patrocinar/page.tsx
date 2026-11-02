import type { Metadata } from "next";
import Link from "next/link";
import { Card, Note, PageShell } from "@/components/PageShell";

export const metadata: Metadata = { title: "Patrocinar · Miranubes" };

const CONTACT_EMAIL = "anthonycca8@gmail.com";

const WHAT = [
  {
    title: "Mapa de tormentas en vivo",
    text: "Nubes y rayos sobre O'Higgins desde el satélite GOES-19 de la NOAA, actualizado cada 10 minutos (nubes) y cada 20 segundos (rayos).",
  },
  {
    title: "Distancia a tu casa, tu campo o tu familia",
    text: "Cada persona ve a cuántos kilómetros está la actividad y si se acerca. Con el piloto de notificaciones, recibe avisos para hasta 3 lugares.",
  },
  {
    title: "Hecho en la región, después de Requínoa",
    text: "Nació tras el tornado del 26 de octubre de 2026. La región no tiene radar meteorológico: el satélite es la mejor vista que hay.",
  },
];

const OFFER = [
  "Mención «Presentado por» con tu nombre y logo en la sección Info de la app.",
  "Mención en los videos y publicaciones del proyecto en redes sociales.",
  "Un informe de cada temporada: cuánta gente usó la app y en qué días hubo tormentas.",
];

const FIT = [
  "Cooperativas agrícolas, viñas y exportadoras de fruta",
  "Corredoras de seguros y empresas locales",
  "Municipios y organizaciones de la región",
];

const RULES = [
  "El patrocinio nunca cambia qué se muestra ni cuándo se avisa. Las alertas siguen las mismas reglas para todos.",
  "Sin publicidad en el mapa ni en las notificaciones, y sin rastrear a nadie: tu marca no recibe datos de las personas.",
  "Miranubes sigue siendo una observación experimental, no un aviso oficial. El patrocinio no la presenta como otra cosa.",
  "Nos reservamos el derecho de no aceptar patrocinios que no calcen con una herramienta de seguridad.",
];

export default function SponsorPage() {
  return (
    <PageShell
      title="Patrocina Miranubes"
      intro="Una app gratuita que muestra en vivo las tormentas sobre la región de O'Higgins. Con tu apoyo sigue siendo gratis para todos."
    >
      <section className="flex flex-col gap-2.5">
        <h2 className="text-lg font-semibold">Qué es</h2>
        {WHAT.map((item) => (
          <Card key={item.title} className="gap-1 p-3.5">
            <h3 className="font-semibold">{item.title}</h3>
            <p className="text-[13px] leading-relaxed text-soft">{item.text}</p>
          </Card>
        ))}
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="text-lg font-semibold">Qué recibe tu organización</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-[15px] leading-snug">
          {OFFER.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="text-[13px] leading-relaxed text-muted">
          El proyecto está en un piloto. No inventamos cifras de alcance: te mostramos los números reales de visitas al
          momento de conversar.
        </p>
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="text-lg font-semibold">Para quién tiene sentido</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-[15px] leading-snug">
          {FIT.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <Note title="Reglas que no cambian">
        {RULES.map((rule) => (
          <span key={rule} className="mb-1.5 block last:mb-0">
            {rule}
          </span>
        ))}
      </Note>

      <section className="flex flex-col gap-2.5">
        <h2 className="text-lg font-semibold">Conversemos</h2>
        <p className="text-sm leading-relaxed text-soft">
          Escríbeme y vemos juntos qué forma de apoyo tiene sentido para tu organización.
        </p>
        <a
          href={`mailto:${CONTACT_EMAIL}?subject=Patrocinio%20Miranubes`}
          className="flex min-h-12 items-center justify-center rounded-xl bg-accent text-[15px] font-semibold text-white"
        >
          Escribir un correo
        </a>
        <p className="text-center font-mono text-sm text-muted">{CONTACT_EMAIL}</p>
      </section>

      <Link href="/como-funciona" className="flex min-h-11 items-center text-sm text-quiet">
        Cómo funciona Miranubes y sus límites
      </Link>
    </PageShell>
  );
}
