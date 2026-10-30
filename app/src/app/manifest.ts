import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Storm Alert O'Higgins",
    short_name: "Storm Alert",
    description: "Tormentas severas en la región de O'Higgins, en vivo desde el satélite GOES-19.",
    lang: "es-CL",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0e1116",
    theme_color: "#0e1116",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
