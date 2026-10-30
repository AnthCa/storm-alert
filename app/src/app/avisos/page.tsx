import type { Metadata } from "next";
import { AlertsSettings } from "@/components/AlertsSettings";

export const metadata: Metadata = { title: "Avisos · Storm Alert O'Higgins" };

export default function AlertsPage() {
  return <AlertsSettings />;
}
