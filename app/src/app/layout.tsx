import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import { BottomNav } from "@/components/BottomNav";
import { ServiceWorker } from "@/components/ServiceWorker";
import { StatusProvider } from "@/components/StatusProvider";
import { TitleBadge } from "@/components/TitleBadge";
import { APP_URL } from "@/lib/share";
import { LIVE_STATUS_URL } from "@/lib/status";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Brand typeface, for the wordmark only.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["500"],
});

const DESCRIPTION =
  "Nubes de tormenta y rayos sobre la región de O'Higgins, en vivo desde el satélite GOES-19, con la distancia a tu casa y a los lugares de tu gente. Gratis y experimental.";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: "Miranubes · Tormentas en vivo para O'Higgins",
  description: DESCRIPTION,
  applicationName: "Miranubes",
  keywords: ["tormentas", "rayos", "O'Higgins", "Rancagua", "Requínoa", "satélite", "GOES-19", "tornado", "Chile", "clima"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "es_CL",
    siteName: "Miranubes",
    title: "Miranubes · Tormentas en vivo para O'Higgins",
    description: DESCRIPTION,
    url: "/",
    images: [{ url: "/promo/og.jpg", width: 1200, height: 630, alt: "Mapa de Miranubes con una tormenta y rayos sobre Requínoa" }],
  },
  twitter: { card: "summary_large_image", images: ["/promo/og.jpg"] },
  // "black", not "black-translucent": with the translucent bar and viewport-fit=cover,
  // iOS 26 home-screen apps end short of the screen bottom and lift the tab bar.
  appleWebApp: { capable: true, title: "Miranubes", statusBarStyle: "black" },
};

export const viewport: Viewport = {
  themeColor: "#0e1116",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Marks that JavaScript runs (scroll reveals hide content only then), and keeps Chrome's
// install dialog, which may fire before React hydrates, for the "Instalar" button.
// Starts the live status download while the page is still parsing, instead of after
// React hydrates; StatusProvider takes it over (src/components/StatusProvider.tsx).
const EARLY_STATUS = `window.__earlyStatus=fetch(${JSON.stringify(LIVE_STATUS_URL)},{cache:"no-store"}).then(function(r){return r.ok?r.json():null}).catch(function(){return null});`;

const KEEP_INSTALL_PROMPT = `document.documentElement.classList.add("js");addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__installPrompt=e;dispatchEvent(new Event("miranubes:installable"))});addEventListener("appinstalled",function(){window.__installPrompt=null})`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CL" suppressHydrationWarning className={`${plexSans.variable} ${plexMono.variable} ${spaceGrotesk.variable} antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: EARLY_STATUS + KEEP_INSTALL_PROMPT }} />
      </head>
      <body className="min-h-dvh font-sans">
        <StatusProvider>
          {children}
          <BottomNav />
          <TitleBadge />
        </StatusProvider>
        <ServiceWorker />
        {/* Cookieless page-view counts; no location or personal data. */}
        <Analytics />
      </body>
    </html>
  );
}
