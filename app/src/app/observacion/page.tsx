import type { Metadata } from "next";
import { ObservationView } from "@/components/ObservationView";

export const metadata: Metadata = {
  title: "Observación · Miranubes",
  description:
    "Detalle de la actividad convectiva observada por el satélite GOES-19 cerca de Requínoa. Observación experimental, no oficial.",
  alternates: { canonical: "/observacion" },
};

export default function ObservationPage() {
  return <ObservationView />;
}
