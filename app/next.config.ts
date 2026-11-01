import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const STATUS_ORIGIN = "https://anthca.github.io";
const MAP_ORIGIN = "https://tiles.openfreemap.org";
// Elevation tiles for the shaded relief (AWS Open Data).
const RELIEF_ORIGIN = "https://s3.amazonaws.com";
// The push pilot subscribes through Supabase; empty when the pilot is not configured.
const PUSH_ORIGIN = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "";

// CSP without nonces keeps every page static (fast, no serverless cost on the free plan).
// Accepted risk: 'unsafe-inline' scripts. The app renders no user-generated content.
// MapLibre needs blob: workers and WebGL; map tiles, glyphs and sprites come from OpenFreeMap,
// elevation tiles from AWS Open Data.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${MAP_ORIGIN} ${RELIEF_ORIGIN}`,
  "font-src 'self'",
  `connect-src 'self' ${STATUS_ORIGIN} ${MAP_ORIGIN} ${RELIEF_ORIGIN} ${PUSH_ORIGIN}`.trim(),
  "worker-src 'self' blob:",
  "child-src blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    return [
      // Routes renamed when "alerts" became "observations" (experimental, not official).
      { source: "/alerta", destination: "/observacion", permanent: true },
      { source: "/avisos", destination: "/notificaciones", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=(), usb=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // The browser must always check for a new service worker.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
