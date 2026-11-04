import type { Metadata } from "next";
import { AlertsSettings } from "@/components/AlertsSettings";

export const metadata: Metadata = {
  title: "Notificaciones · Miranubes",
  description:
    "Avisos de rayos y nubes de tormenta cerca de tu casa y de hasta 3 lugares de tu gente. Piloto con invitación.",
  alternates: { canonical: "/notificaciones" },
};

export default function NotificationsPage() {
  return <AlertsSettings />;
}
