import type { Metadata } from "next";
import { AlertView } from "@/components/AlertView";

export const metadata: Metadata = { title: "Alerta · Storm Alert O'Higgins" };

export default function AlertPage() {
  return <AlertView />;
}
