"use client";

import { useSyncExternalStore } from "react";

/**
 * How this browser can install the app:
 * - installed: already running from the home screen;
 * - prompt: Chrome-like browsers that offer the native install dialog (beforeinstallprompt);
 * - ios: iPhone or iPad, installed by hand from the share menu;
 * - android: another Android browser, installed from its own menu;
 * - desktop: a computer, where the app is better opened on the phone.
 */
export type InstallKind = "installed" | "prompt" | "ios" | "android" | "desktop";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// The layout's inline script keeps the event: Chrome may fire it before React hydrates.
declare global {
  interface Window {
    __installPrompt?: InstallPromptEvent | null;
  }
}

export const INSTALL_EVENT = "miranubes:installable";

export function installKind(ua: string, standalone: boolean, canPrompt: boolean): InstallKind {
  if (standalone) return "installed";
  if (canPrompt) return "prompt";
  // iPadOS reports itself as a Mac; touch tells them apart.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && /Mobile/.test(ua))) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

function subscribe(listener: () => void) {
  const standalone = window.matchMedia("(display-mode: standalone)");
  window.addEventListener(INSTALL_EVENT, listener);
  window.addEventListener("appinstalled", listener);
  standalone.addEventListener("change", listener);
  return () => {
    window.removeEventListener(INSTALL_EVENT, listener);
    window.removeEventListener("appinstalled", listener);
    standalone.removeEventListener("change", listener);
  };
}

function current(): InstallKind {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const touchMac = /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
  const ua = touchMac ? `${navigator.userAgent} Mobile` : navigator.userAgent;
  return installKind(ua, standalone, Boolean(window.__installPrompt));
}

/** The install kind for this browser; null on the server and during hydration. */
export function useInstallKind(): InstallKind | null {
  return useSyncExternalStore(subscribe, current, () => null);
}

/** Opens the browser's install dialog. True when the person accepted. */
export async function promptInstall(): Promise<boolean> {
  const event = window.__installPrompt;
  if (!event) return false;
  // The event can only be used once.
  window.__installPrompt = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  window.dispatchEvent(new Event(INSTALL_EVENT));
  return outcome === "accepted";
}
