import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = {
  title: "Privacidad · Miranubes",
  description:
    "Qué ubicación usa Miranubes, dónde se guarda, qué terceros reciben solicitudes técnicas y cómo funcionan las notificaciones.",
  alternates: { canonical: "/privacidad" },
};

const SECTIONS = [
  {
    title: "Qué ubicación usamos y por qué",
    body: "Solo la que tú eliges: tocando el mapa o con el botón «Usar mi ubicación». La usamos para calcular qué tan lejos está la actividad observada. Nunca pedimos tu ubicación al abrir la app.",
  },
  {
    title: "Dónde se guarda y con qué precisión",
    body: "En este dispositivo (almacenamiento del navegador), redondeada a unos 1 km. Los cálculos se hacen en tu teléfono o computador. Solo si activas las notificaciones del piloto enviamos puntos aproximados a nuestra base de datos (ver «Notificaciones»).",
  },
  {
    title: "Cuánto tiempo se conserva",
    body: "Hasta que la borres con «Borrar ubicación» o borres los datos del sitio en tu navegador. No guardamos un historial de lugares.",
  },
  {
    title: "Qué terceros reciben solicitudes técnicas",
    body: "Al cargar el mapa, tu navegador pide las imágenes del mapa a OpenFreeMap, el relieve a Amazon Web Services y los datos meteorológicos a GitHub Pages, y la app se sirve desde Vercel. Como en cualquier sitio web, esos servicios reciben tu dirección IP y qué partes del mapa se pidieron. No les enviamos tu ubicación guardada.",
  },
  {
    title: "Estadísticas de visitas",
    body: "Contamos visitas con Vercel Web Analytics, que no usa cookies ni identifica a las personas: registra la página vista, el país y el tipo de dispositivo y navegador. No incluye tu ubicación guardada.",
  },
  {
    title: "Notificaciones",
    body: "Son voluntarias y, por ahora, solo para personas invitadas a un piloto. Si las activas guardamos en nuestra base de datos (Supabase, región São Paulo) el punto aproximado (~1 km) de cada lugar que elijas (hasta 3), el radio, la dirección técnica de notificación de tu navegador y la hora de los últimos avisos enviados, para no repetirlos. Los nombres que les pones a tus lugares (por ejemplo, «Casa de mis papás») quedan solo en tu teléfono: nunca los recibimos. Los avisos se envían a través del servicio de notificaciones de tu navegador (Google, Apple o Mozilla). Al tocar «Desactivar» se borra tu suscripción.",
  },
  {
    title: "Lo que no hacemos",
    body: "No usamos tu ubicación para estadísticas ni publicidad, no tenemos cuentas de usuario y no vendemos datos. No guardamos un historial de lugares: si cambias tu punto, se reemplaza el anterior.",
  },
];

export default function PrivacyPage() {
  return (
    <PageShell title="Privacidad" intro="Última actualización: 31 de octubre de 2026.">
      {SECTIONS.map((section) => (
        <section key={section.title} className="flex flex-col gap-1.5">
          <h2 className="text-lg font-semibold">{section.title}</h2>
          <p className="text-[15px] leading-relaxed text-soft">{section.body}</p>
        </section>
      ))}
      <p className="text-sm text-soft">
        Preguntas o solicitudes: abre un issue en{" "}
        <a href="https://github.com/AnthCa/storm-alert/issues" className="text-quiet underline">
          github.com/AnthCa/storm-alert
        </a>
        .
      </p>
    </PageShell>
  );
}
