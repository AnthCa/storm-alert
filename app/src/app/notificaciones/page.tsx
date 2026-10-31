import type { Metadata } from "next";
import { AlertsSettings } from "@/components/AlertsSettings";

export const metadata: Metadata = { title: "Notificaciones · Miranubes" };

export default function NotificationsPage() {
  return <AlertsSettings />;
}
