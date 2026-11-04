import type { Metadata } from "next";
import { InstallCard } from "@/components/InstallCard";
import { Card, PageShell } from "@/components/PageShell";

export const metadata: Metadata = {
  title: "Instalar · Miranubes",
  description:
    "Instala Miranubes en tu teléfono Android o iPhone desde el navegador, sin tienda de apps, con un ícono en tu pantalla de inicio.",
  alternates: { canonical: "/instalar" },
};

const WHY = [
  { title: "Se abre al instante", text: "Un ícono en tu pantalla de inicio, a pantalla completa, sin buscar la página." },
  { title: "Notificaciones en iPhone", text: "Apple solo entrega los avisos a la app instalada." },
  { title: "Sin tienda de apps", text: "Se instala desde el navegador. No pide permisos al instalarse y se actualiza sola." },
];

export default function InstallPage() {
  return (
    <PageShell title="Instalar Miranubes" intro="Es la misma página que ya conoces, pero con su ícono en tu teléfono.">
      <InstallCard />

      <section className="flex flex-col gap-2.5">
        <h2 className="text-lg font-semibold">Por qué instalarla</h2>
        {WHY.map((item) => (
          <Card key={item.title} className="gap-1 p-3.5">
            <h3 className="font-semibold">{item.title}</h3>
            <p className="text-[13px] leading-relaxed text-soft">{item.text}</p>
          </Card>
        ))}
      </section>

      <section className="flex flex-col items-center gap-3">
        <h2 className="self-start text-lg font-semibold">Compártela</h2>
        <p className="self-start text-sm leading-relaxed text-soft">
          Muéstrale este código a alguien: lo escanea con la cámara y llega a esta misma página.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element -- a static SVG needs no optimisation */}
        <img
          src="/qr-instalar.svg"
          alt="Código QR a miranubes.vercel.app/instalar"
          width={220}
          height={220}
          className="rounded-2xl bg-white"
        />
        <p className="font-mono text-sm text-muted">miranubes.vercel.app/instalar</p>
      </section>
    </PageShell>
  );
}
