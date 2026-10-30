"use client";

import { useEffect } from "react";

/** Registers public/sw.js in production so the app installs and opens offline. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Without a service worker the app still works online.
    });
  }, []);
  return null;
}
