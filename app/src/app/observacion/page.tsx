import type { Metadata } from "next";
import { ObservationView } from "@/components/ObservationView";

export const metadata: Metadata = { title: "Observación · Storm Alert O'Higgins" };

export default function ObservationPage() {
  return <ObservationView />;
}
