"use client";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { TOWNS, nearestTown } from "@/lib/geo";

// Same free tiles as the storm map (https://openfreemap.org).
const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const RANCAGUA: [number, number] = [-70.74, -34.17];
// Close enough to read street names; the place is still kept at ~1 km.
const STREET_ZOOM = 14;

interface Props {
  initial: { lat: number; lon: number } | null;
  onPick: (point: { lat: number; lon: number }) => void;
  onCancel: () => void;
}

/**
 * Full-screen map with a fixed pin in the middle: people move the map until the pin sits
 * on the place. Nothing typed, nothing sent anywhere: only the map tiles are downloaded.
 */
export default function PlacePicker({ initial, onPick, onCancel }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [center, setCenter] = useState(initial ?? { lat: RANCAGUA[1], lon: RANCAGUA[0] });
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!container.current) return;
    const m = new maplibregl.Map({
      container: container.current,
      style: STYLE_URL,
      center: initial ? [initial.lon, initial.lat] : RANCAGUA,
      zoom: initial ? STREET_ZOOM : 9,
      minZoom: 6,
      maxZoom: 17,
      attributionControl: { compact: true },
    });
    m.on("move", () => {
      const { lat, lng } = m.getCenter();
      setCenter({ lat, lon: lng });
    });
    map.current = m;
    // The page behind must not scroll while the picker is open.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      m.remove();
    };
    // The picker opens once per place; later changes to `initial` are not followed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function flyTo(lat: number, lon: number, zoom = STREET_ZOOM - 1) {
    map.current?.flyTo({ center: [lon, lat], zoom, duration: 800 });
  }

  function locate() {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        flyTo(pos.coords.latitude, pos.coords.longitude, STREET_ZOOM + 1);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  const town = nearestTown(center.lat, center.lon, 15);

  return (
    <div role="dialog" aria-modal="true" aria-label="Elegir lugar en el mapa" className="fixed inset-0 z-[60] flex flex-col bg-bg">
      <div className="flex flex-col gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <h2 className="text-[17px] font-semibold">Mueve el mapa hasta que el pin quede sobre el lugar</h2>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <label className="sr-only" htmlFor="picker-town">
            Ir a una comuna
          </label>
          <select
            id="picker-town"
            defaultValue=""
            onChange={(event) => {
              const found = TOWNS.find(([name]) => name === event.target.value);
              if (found) flyTo(found[1], found[2]);
            }}
            className="min-h-12 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-base"
          >
            <option value="" disabled>
              Ir a una comuna…
            </option>
            {TOWNS.map(([name]) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={locate}
            disabled={locating}
            className="min-h-12 rounded-xl border border-line bg-surface px-3 text-sm font-semibold text-quiet disabled:opacity-60"
          >
            {locating ? "Buscando…" : "Estoy aquí"}
          </button>
        </div>
      </div>

      <div className="relative min-h-0 grow">
        {/* Sized by height, not inset: MapLibre's own CSS makes its container position: relative. */}
        <div ref={container} className="h-full w-full" />
        {/* The pin's tip marks the map centre. */}
        <svg
          aria-hidden
          width="36"
          height="48"
          viewBox="0 0 36 48"
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full drop-shadow-lg"
        >
          <path
            d="M18 47C18 47 33 29.5 33 18A15 15 0 0 0 3 18C3 29.5 18 47 18 47Z"
            fill="var(--color-signal)"
            stroke="#0b1220"
            strokeWidth="2"
          />
          <circle cx="18" cy="18" r="5.5" fill="#0b1220" />
        </svg>
      </div>

      <div className="flex flex-col gap-2.5 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <p className="text-sm text-soft">
          {town ? `Cerca de ${town}` : "Fuera de las comunas principales"} · se guarda con una precisión de ~1 km
        </p>
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-12 rounded-xl border border-line bg-surface px-4 text-[15px] font-semibold"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onPick(center)}
            className="min-h-12 rounded-xl bg-accent text-[15px] font-semibold text-white"
          >
            Usar este punto
          </button>
        </div>
      </div>
    </div>
  );
}
