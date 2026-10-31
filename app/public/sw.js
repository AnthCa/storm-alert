// Miranubes service worker: lets the installed app open offline with the last data it saw.
const CACHE = "storm-alert-v3";
const SHELL = ["/", "/observacion", "/oficiales", "/notificaciones", "/como-funciona", "/privacidad", "/demo/requinoa-2026-10-26.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Network first, cache as fallback: storm data must be fresh whenever there is a connection.
async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: request.mode === "navigate" });
    if (cached) return cached;
    throw new Error(`offline and not cached: ${request.url}`);
  }
}

// Hashed build assets never change, so the cached copy is always right.
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.pathname.endsWith("status.json") || request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  } else if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
  }
  // Everything else (map tiles, fonts) goes straight to the network.
});
