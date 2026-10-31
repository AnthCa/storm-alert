/**
 * Web Push pilot (invited testers only). The browser subscribes with the VAPID public key
 * and the subscription goes to Supabase through pilot_subscribe, which checks the pilot
 * code (infra/supabase/push_pilot.sql). The pipeline sends the notifications.
 */

/** Public half of the VAPID pair; the private half is a GitHub Actions secret. */
export const VAPID_PUBLIC_KEY =
  "BLp7r6K8GCyYUGvL9X51sryG_XIddRbHhgf3VTlCmwBze-SOKZWsKOqCHut6njIBDFGGqaFZOYfzYHliMgmxsQE";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
// The anon key is public by design: the database only exposes the pilot functions to it.
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const PUSH_RADII = [10, 25, 50] as const;
export type PushRadius = (typeof PUSH_RADII)[number];

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

async function rpc(name: string, body: Record<string, unknown>): Promise<void> {
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

export async function subscribe(options: { code: string; lat: number; lon: number; radius: PushRadius }) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("denied");
  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY),
    }));
  const keys = subscription.toJSON().keys ?? {};
  try {
    await rpc("pilot_subscribe", {
      code: options.code.trim().toUpperCase(),
      endpoint: subscription.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      lat: options.lat,
      lon: options.lon,
      radius_km: options.radius,
    });
  } catch (error) {
    await subscription.unsubscribe();
    throw error;
  }
}

export async function unsubscribe() {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await rpc("pilot_unsubscribe", { endpoint: subscription.endpoint }).catch(() => undefined);
  await subscription.unsubscribe();
}

/** A local notification, to check that this device shows them. Nothing leaves the phone. */
export async function testNotification() {
  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification("Miranubes: prueba", {
    body: "Así te llegarán los avisos. Observación experimental, no es un aviso oficial.",
    icon: "/icons/icon-192.png",
    tag: "test",
  });
}
