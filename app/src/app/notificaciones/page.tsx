import type { Metadata } from "next";
import { AlertsSettings } from "@/components/AlertsSettings";

export const metadata: Metadata = { title: "Notificaciones · Storm Alert O'Higgins" };

export default function NotificationsPage() {
  return <AlertsSettings />;
}
