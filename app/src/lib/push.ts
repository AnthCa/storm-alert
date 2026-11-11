/**
 * Web Push pilot (invited testers only). The browser subscribes with the VAPID public key
 * and the subscription goes to Supabase through pilot_set_places, which checks the pilot
 * code (infra/supabase/push_places.sql). The pipeline sends the notifications.
 */

/** Public half of the VAPID pair; the private half is a GitHub Actions secret. */
export const VAPID_PUBLIC_KEY =
  "BLp7r6K8GCyYUGvL9X51sryG_XIddRbHhgf3VTlCmwBze-SOKZWsKOqCHut6njIBDFGGqaFZOYfzYHliMgmxsQE";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
// The anon key is public by design: the database only exposes the pilot functions to it.
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const PUSH_RADII = [10, 25, 50] as const;
export type PushRadius = (typeof PUSH_RADII)[number];

/** Places per phone: home, a school, the parents' house. The database allows up to 3. */
export const MAX_PLACES = 3;
export const PLACE_NAME_MAX = 30;

/** A place to watch. The name stays on this phone; the server gets the point and radius. */
export interface PushPlace {
  name: string;
  lat: number;
  lon: number;
  radius: PushRadius;
}

// Read by the service worker (public/sw.js) to name the place in each notification.
const PLACES_CACHE = "miranubes-places";
const PLACES_URL = "/__places.json";

/**
 * ok: can subscribe here. install: an iPhone browser tab; iOS only delivers web push to
 * an app added to the home screen. unsupported: no push in this browser.
 * unconfigured: the pilot keys are not set in this build.
 */
export type PushSupport = "ok" | "install" | "unsupported" | "unconfigured";

export function pushSupport(): PushSupport {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return "unconfigured";
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  if (ios && !standalone) return "install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }
  return "ok";
}

/** VAPID keys travel base64url-encoded; PushManager wants the raw bytes. */
export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Whether this build knows the Supabase project (the pilot and the sky reports need it). */
export const SUPABASE_CONFIGURED = !!SUPABASE_URL && !!SUPABASE_ANON_KEY;

export async function rpc(name: string, body: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    // The apikey header alone selects the anon role; publishable keys (sb_publishable_…)
    // are not JWTs and must not go in an Authorization header.
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text.includes("invalid pilot code") ? "invalid-code" : `rpc ${name} ${response.status}`);
  }
}

async function storePlaceNames(names: string[] | null) {
  const cache = await caches.open(PLACES_CACHE);
  if (names) await cache.put(PLACES_URL, Response.json(names));
  else await cache.delete(PLACES_URL);
}

/**
 * Subscribes this browser if needed and replaces its list of places. A browser that is
 * already subscribed does not need the pilot code again.
 */
export async function savePlaces(options: { code: string; places: PushPlace[] }) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("denied");
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const wasSubscribed = existing !== null;
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY),
    }));
  const keys = subscription.toJSON().keys ?? {};
  try {
    await rpc("pilot_set_places", {
      code: options.code.trim().toUpperCase(),
      endpoint: subscription.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      places: options.places.map(({ lat, lon, radius }) => ({ lat, lon, radius_km: radius })),
    });
  } catch (error) {
    if (!wasSubscribed) await subscription.unsubscribe();
    throw error;
  }
  await storePlaceNames(options.places.map((place) => placeName(place.name)));
}

export function placeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").slice(0, PLACE_NAME_MAX);
}

export async function unsubscribe() {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await rpc("pilot_unsubscribe", { endpoint: subscription.endpoint }).catch(() => undefined);
  await subscription.unsubscribe();
  await storePlaceNames(null).catch(() => undefined);
}

/**
 * Local notifications, one per saved place and named as real ones will be, to check that
 * this device shows them and knows the names. Nothing leaves the phone.
 */
export async function testNotification() {
  const registration = await navigator.serviceWorker.ready;
  const response = await (await caches.open(PLACES_CACHE)).match(PLACES_URL);
  const names: string[] = response ? await response.json() : [];
  const body = "Así te llegarán los avisos. Observación experimental, no es un aviso oficial.";
  if (!names.length) {
    await registration.showNotification("Miranubes: prueba", { body, icon: "/icons/icon-192.png", tag: "test" });
    return;
  }
  for (const [slot, name] of names.entries()) {
    await registration.showNotification(`Prueba: nubes muy frías a 12 km al sur de ${name}`, {
      body,
      icon: "/icons/icon-192.png",
      tag: `test-${slot}`,
    });
  }
}
