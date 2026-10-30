"use client";

import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { NEAR_KM, circleRing } from "@/lib/geo";
import type { Status } from "@/lib/status";
import type { Place } from "./StatusProvider";

// Free vector tiles, no API key (https://openfreemap.org).
const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const REQUINOA: [number, number] = [-70.82, -34.29];

type Feature = GeoJSON.Feature<GeoJSON.Geometry, Record<string, number>>;
const collection = (features: Feature[]): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features });
const point = (lat: number, lon: number, props: Record<string, number> = {}): Feature => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [lon, lat] },
  properties: props,
});
const ring = (lat: number, lon: number, km: number): Feature => ({
  type: "Feature",
  geometry: { type: "Polygon", coordinates: [circleRing(lat, lon, km)] },
  properties: {},
});

function stormData(status: Status | null) {
  return {
    cold: collection((status?.cold_pixels ?? []).map(([lat, lon, t]) => point(lat, lon, { t }))),
    flashes: collection((status?.recent_flashes ?? []).map(([lat, lon]) => point(lat, lon))),
    area: collection(status ? [ring(status.center[0], status.center[1], status.radius_km)] : []),
  };
}

function markerElement(className: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = className;
  return el;
}

interface Props {
  status: Status | null;
  place: Place | null;
  onPick: (lat: number, lon: number) => void;
}

export default function StormMap({ status, place, onPick }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const me = useRef<maplibregl.Marker | null>(null);
  const ready = useRef(false);
  const latest = useRef({ status, place, onPick });
  latest.current = { status, place, onPick };

  useEffect(() => {
    if (!container.current) return;
    const m = new maplibregl.Map({
      container: container.current,
      style: STYLE_URL,
      center: REQUINOA,
      zoom: 8.4,
      minZoom: 6,
      maxZoom: 12,
      attributionControl: { compact: true },
    });
    map.current = m;

    m.on("load", () => {
      const data = stormData(latest.current.status);
      m.addSource("area", { type: "geojson", data: data.area });
      m.addSource("cold", { type: "geojson", data: data.cold });
      m.addSource("flashes", { type: "geojson", data: data.flashes });
      m.addSource("me-ring", { type: "geojson", data: collection([]) });

      m.addLayer({
        id: "area",
        type: "line",
        source: "area",
        paint: { "line-color": "#7A8491", "line-width": 1.5, "line-dasharray": [3, 3] },
      });
      m.addLayer({
        id: "cold",
        type: "circle",
        source: "cold",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 2, 10, 6, 12, 12],
          "circle-color": ["step", ["get", "t"], "#C2261B", -50, "#F0644F", -44, "#F2A53A"],
          "circle-opacity": 0.75,
        },
      });
      m.addLayer({
        id: "flashes",
        type: "circle",
        source: "flashes",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 1.5, 11, 3.5],
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-color": "#FFE14D",
          "circle-stroke-width": 1.5,
        },
      });
      m.addLayer({ id: "me-ring-fill", type: "fill", source: "me-ring", paint: { "fill-color": "#6CB8FF", "fill-opacity": 0.08 } });
      m.addLayer({ id: "me-ring-line", type: "line", source: "me-ring", paint: { "line-color": "#6CB8FF", "line-width": 1.5 } });

      new maplibregl.Marker({ element: markerElement("requinoa-marker") }).setLngLat(REQUINOA).addTo(m);
      ready.current = true;
      syncStorm();
      syncPlace();
    });

    m.on("click", (e) => latest.current.onPick(e.lngLat.lat, e.lngLat.lng));

    return () => {
      ready.current = false;
      m.remove();
      map.current = null;
      me.current = null;
    };
    // The map is created once; data changes flow through the effects below.
  }, []);

  function syncStorm() {
    const m = map.current;
    if (!m || !ready.current) return;
    const data = stormData(latest.current.status);
    (m.getSource("area") as GeoJSONSource).setData(data.area);
    (m.getSource("cold") as GeoJSONSource).setData(data.cold);
    (m.getSource("flashes") as GeoJSONSource).setData(data.flashes);
  }

  function syncPlace() {
    const m = map.current;
    const p = latest.current.place;
    if (!m || !ready.current || !p) return;
    if (!me.current) {
      me.current = new maplibregl.Marker({ element: markerElement("me-marker"), draggable: true })
        .setLngLat([p.lon, p.lat])
        .addTo(m);
      me.current.on("drag", () => {
        const { lat, lng } = me.current!.getLngLat();
        (m.getSource("me-ring") as GeoJSONSource).setData(collection([ring(lat, lng, NEAR_KM)]));
      });
      me.current.on("dragend", () => {
        const { lat, lng } = me.current!.getLngLat();
        latest.current.onPick(lat, lng);
      });
    }
    me.current.setLngLat([p.lon, p.lat]);
    (m.getSource("me-ring") as GeoJSONSource).setData(collection([ring(p.lat, p.lon, NEAR_KM)]));
    if (p.source === "gps") m.easeTo({ center: [p.lon, p.lat], zoom: Math.max(m.getZoom(), 9) });
  }

  useEffect(syncStorm, [status]);
  useEffect(syncPlace, [place]);

  // Sized, not positioned: maplibre-gl.css sets `position: relative` on the container and,
  // being unlayered CSS, beats Tailwind's `absolute inset-0`, which left the map 0 px tall.
  return <div ref={container} className="size-full" role="application" aria-label="Mapa de tormentas" />;
}
