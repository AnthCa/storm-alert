import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/share";

// Public pages only; the map's own state lives in the browser.
const PAGES: [path: string, priority: number, changeFrequency: "always" | "monthly" | "yearly"][] = [
  ["/", 1, "always"],
  ["/conoce", 0.9, "monthly"],
  ["/como-funciona", 0.8, "monthly"],
  ["/instalar", 0.7, "yearly"],
  ["/oficiales", 0.6, "yearly"],
  ["/notificaciones", 0.5, "monthly"],
  ["/patrocinar", 0.4, "yearly"],
  ["/privacidad", 0.3, "yearly"],
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map(([path, priority, changeFrequency]) => ({ url: `${APP_URL}${path}`, priority, changeFrequency }));
}
