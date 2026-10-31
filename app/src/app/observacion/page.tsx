import type { Metadata } from "next";
import { ObservationView } from "@/components/ObservationView";

export const metadata: Metadata = { title: "Observación · Miranubes" };

export default function ObservationPage() {
  return <ObservationView />;
}
