import type { Metadata } from "next";
import { ObservationView } from "@/components/ObservationView";

export const metadata: Metadata = {
  title: "Observación · Miranubes",
  description:
    "Detalle de las tormentas eléctricas que observa el satélite GOES-19 en O'Higgins. Observación experimental, no oficial.",
  alternates: { canonical: "/observacion" },
};

export default function ObservationPage() {
  return <ObservationView />;
}
