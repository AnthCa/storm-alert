"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

// Browser state (localStorage, URL) read through useSyncExternalStore: the server and the
// first client render see the fallback, then React re-renders with the stored value.

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  window.addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
    window.removeEventListener("popstate", listener);
  };
}

type Area = "local" | "session";
const storage = (area: Area) => (area === "local" ? localStorage : sessionStorage);

function readItem(area: Area, key: string): string | null {
  try {
    return storage(area).getItem(key);
  } catch {
    return null; // Private mode or blocked storage.
  }
}

/**
 * A JSON value persisted in localStorage (or sessionStorage, which lasts while the tab is
 * open), shared by every component using the same key.
 */
export function useStoredValue<T>(key: string, fallback: T, area: Area = "local"): [T, (value: T) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => readItem(area, key),
    () => null,
  );
  const value = useMemo(() => {
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }, [raw, fallback]);
  const setValue = useCallback(
    (next: T) => {
      try {
        storage(area).setItem(key, JSON.stringify(next));
      } catch {
        // The value just won't persist.
      }
      notify();
    },
    [key, area],
  );
  return [value, setValue];
}
