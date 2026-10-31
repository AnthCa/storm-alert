import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { BottomNav } from "@/components/BottomNav";
import { ServiceWorker } from "@/components/ServiceWorker";
import { StatusProvider } from "@/components/StatusProvider";
import { TitleBadge } from "@/components/TitleBadge";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["500"],
});

export const metadata: Metadata = {
  title: "Storm Alert O'Higgins",
  description: "Tormentas severas en la región de O'Higgins, en vivo desde el satélite GOES-19.",
  applicationName: "Storm Alert",
  appleWebApp: { capable: true, title: "Storm Alert", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0e1116",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${plexSans.variable} ${plexMono.variable} antialiased`}>
      <body className="min-h-dvh font-sans">
        <StatusProvider>
          {children}
          <BottomNav />
          <TitleBadge />
        </StatusProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
