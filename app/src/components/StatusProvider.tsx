"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useOnline, useStoredValue } from "@/lib/browser-store";
import { coarsen } from "@/lib/geo";
import { DEMO_STATUS_URL, LIVE_STATUS_URL, fetchStatus, type Status } from "@/lib/status";

const POLL_MS = 60_000;
const LOCATION_KEY = "storm-alert:location";
const DEMO_KEY = "storm-alert:demo";

export interface Place {
  lat: number;
  lon: number;
  source: "gps" | "map";
}

type LocateResult = "ok" | "denied" | "unavailable";

interface StatusContextValue {
  status: Status | null;
  error: string | null;
  demo: boolean;
  setDemo: (on: boolean) => void;
  online: boolean;
  place: Place | null;
  setPlace: (place: Place) => void;
  clearPlace: () => void;
  locate: () => Promise<LocateResult>;
}

const StatusContext = createContext<StatusContextValue | null>(null);

export function StatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Demo mode lasts while the tab is open, so it survives navigating between screens.
  const [demo, setDemoFlag] = useStoredValue(DEMO_KEY, false, "session");
  const [storedPlace, storePlace] = useStoredValue<Place | null>(LOCATION_KEY, null);
  const online = useOnline();

  // Only a ~1 km location is ever kept, on this device. Older precise values are coarsened on read.
  const place = storedPlace && { ...storedPlace, lat: coarsen(storedPlace.lat), lon: coarsen(storedPlace.lon) };
  const setPlace = useCallback(
    (next: Place) => storePlace({ ...next, lat: coarsen(next.lat), lon: coarsen(next.lon) }),
    [storePlace],
  );
  const clearPlace = useCallback(() => storePlace(null), [storePlace]);

  // A shared link like /?demo=requinoa opens straight into the demo.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("demo")) setDemoFlag(true);
  }, [setDemoFlag]);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetchStatus(demo ? DEMO_STATUS_URL : LIVE_STATUS_URL)
        .then((s) => {
          if (cancelled) return;
          setStatus(s);
          setError(null);
        })
        .catch((e: Error) => !cancelled && setError(e.message));
    load();
    if (demo) return () => void (cancelled = true);
    const timer = setInterval(load, POLL_MS);
    // Phones freeze timers in background tabs; refresh as soon as the app is visible again.
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", load);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", load);
    };
  }, [demo]);

  const setDemo = useCallback(
    (on: boolean) => {
      setStatus(null);
      setDemoFlag(on);
      if (!on && window.location.search.includes("demo")) window.history.replaceState(null, "", window.location.pathname);
    },
    [setDemoFlag],
  );

  const locate = useCallback(
    () =>
      new Promise<LocateResult>((resolve) => {
        if (!("geolocation" in navigator)) return resolve("unavailable");
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setPlace({ lat: pos.coords.latitude, lon: pos.coords.longitude, source: "gps" });
            resolve("ok");
          },
          (err) => resolve(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
          { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
        );
      }),
    [setPlace],
  );

  return (
    <StatusContext.Provider value={{ status, error, demo, setDemo, online, place, setPlace, clearPlace, locate }}>
      {children}
    </StatusContext.Provider>
  );
}

export function useStatus(): StatusContextValue {
  const value = useContext(StatusContext);
  if (!value) throw new Error("useStatus must be used inside <StatusProvider>");
  return value;
}
