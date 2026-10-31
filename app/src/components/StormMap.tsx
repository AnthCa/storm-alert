"use client";

import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { NEAR_KM, circleRing, nearestStorm } from "@/lib/geo";
import type { ReplayFrame } from "@/lib/replay";
import type { Bbox, Status } from "@/lib/status";
import type { Place } from "./StatusProvider";

// Free vector tiles, no API key (https://openfreemap.org).
const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const REQUINOA: [number, number] = [-70.82, -34.29];

type Feature = GeoJSON.Feature<GeoJSON.Geometry, Record<string, number | string>>;
const collection = (features: Feature[]): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features });
const point = (lat: number, lon: number, props: Record<string, number | string> = {}): Feature => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [lon, lat] },
  properties: props,
});
const ring = (lat: number, lon: number, km: number): Feature => ({
  type: "Feature",
  geometry: { type: "Polygon", coordinates: [circleRing(lat, lon, km)] },
  properties: {},
});

/** Everything outside the monitored circle, drawn as a dim mask: a polygon with the circle as its hole. */
function outsideMask(lat: number, lon: number, km: number): Feature {
  const world: [number, number][] = [
    [-180, -85],
    [180, -85],
    [180, 85],
    [-180, 85],
    [-180, -85],
  ];
  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [world, circleRing(lat, lon, km).reverse()] },
    properties: {},
  };
}

/** Edge of the area where clouds and flashes are mapped: beyond it the map is blank, not clear. */
function boxOutline(box: Bbox): Feature {
  const { lat_min, lat_max, lon_min, lon_max } = box;
  return {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: [
        [lon_min, lat_min],
        [lon_max, lat_min],
        [lon_max, lat_max],
        [lon_min, lat_max],
        [lon_min, lat_min],
      ],
    },
    properties: {},
  };
}

/** Live data, or one frame of the replay while it plays. */
function stormData(status: Status | null, replay: ReplayFrame | null) {
  const cold = replay?.cold ?? status?.cold_pixels ?? [];
  const flashes = replay?.flashes ?? status?.recent_flashes ?? [];
  return {
    cold: collection(cold.map(([lat, lon, t]) => point(lat, lon, { t }))),
    flashes: collection(flashes.map(([lat, lon]) => point(lat, lon))),
    area: collection(status ? [ring(status.center[0], status.center[1], status.radius_km)] : []),
    outside: collection(status ? [outsideMask(status.center[0], status.center[1], status.radius_km)] : []),
    observed: collection(status?.observed_bbox ? [boxOutline(status.observed_bbox)] : []),
  };
}

/** Rings around the viewer, to read distances on the map at a glance. */
const DISTANCE_RINGS_KM = [25, 50, 100];
const KM_PER_DEG_LAT = 111.2;
const LABEL_FONT = ["Noto Sans Regular"];

/** Distance rings and a line to the closest storm, with their labels. */
function placeData(status: Status | null, lat: number, lon: number) {
  const rings = DISTANCE_RINGS_KM.map((km) => ({
    type: "Feature" as const,
    geometry: { type: "LineString" as const, coordinates: circleRing(lat, lon, km) },
    properties: { km },
  }));
  const labels = DISTANCE_RINGS_KM.map((km) => point(lat + km / KM_PER_DEG_LAT, lon, { label: `${km} km` }));
  const storm = status && nearestStorm(status, lat, lon);
  const line: Feature[] = storm
    ? [
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [
              [lon, lat],
              [storm.lon, storm.lat],
            ],
          },
          properties: {},
        },
        point((lat + storm.lat) / 2, (lon + storm.lon) / 2, { label: `${Math.round(storm.km)} km` }),
      ]
    : [];
  return {
    near: collection([ring(lat, lon, NEAR_KM)]),
    rings: collection([...rings, ...labels]),
    stormLine: collection(line),
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
  /** Id of the text that summarises the map for screen readers. */
  summaryId: string;
  /** A replay frame to show instead of the live data, or null. */
  replay: ReplayFrame | null;
}

let webglSupport: boolean | null = null;

/** Old phones, or browsers with hardware acceleration off, have no WebGL and cannot draw the map. */
function supportsWebGL(): boolean {
  if (webglSupport === null) {
    try {
      const canvas = document.createElement("canvas");
      webglSupport = !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
    } catch {
      webglSupport = false;
    }
  }
  return webglSupport;
}

const never = () => () => {};

/**
 * Room the banner on top and the sheet below take over the map,
 * measured live: their height changes with the text and with "Ver detalles".
 */
function framePadding(m: maplibregl.Map) {
  const map = m.getContainer().getBoundingClientRect();
  const top = document.getElementById("map-top-overlay")?.getBoundingClientRect().bottom ?? map.top + 200;
  const sheet = document.getElementById("storm-summary")?.getBoundingClientRect().top ?? map.bottom - 200;
  const margin = 32;
  // Markers are drawn centred on their point: leave room so they are not cut by the overlays.
  const clearance = 56;
  const vertical = { top: Math.max(0, top - map.top) + clearance, bottom: Math.max(0, map.bottom - sheet) + clearance };
  // On very short screens, keep at least a third of the map for the framed area.
  const spare = map.height - vertical.top - vertical.bottom;
  const shrink = spare < map.height / 3 ? (map.height / 3 - spare) / 2 : 0;
  return {
    top: Math.max(margin, vertical.top - shrink),
    bottom: Math.max(margin, vertical.bottom - shrink),
    left: margin,
    right: margin,
  };
}

/** Storms farther than this from the viewer are not worth zooming the map out for. */
const STORM_FRAME_KM = 150;

export default function StormMap(props: Props) {
  const webgl = useSyncExternalStore(never, supportsWebGL, () => true);
  if (!webgl) {
    return (
      <div className="flex size-full items-center justify-center px-8 pb-40 text-center text-sm text-soft" role="note">
        Este dispositivo no puede mostrar el mapa. El estado y las distancias de abajo siguen funcionando.
      </div>
    );
  }
  return <LiveMap {...props} />;
}

function LiveMap({ status, place, onPick, summaryId, replay }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const me = useRef<maplibregl.Marker | null>(null);
  const ready = useRef(false);
  // Once the viewer pans or zooms by hand, new data no longer moves the map.
  const userMoved = useRef(false);
  // The status is polled every minute; only a new pipeline run should reframe the map.
  const framedRun = useRef<string | null>(null);
  const latest = useRef({ status, place, onPick, replay });
  latest.current = { status, place, onPick, replay };

  useEffect(() => {
    if (!container.current) return;
    let m: maplibregl.Map;
    try {
      m = new maplibregl.Map({
        container: container.current,
        style: STYLE_URL,
        center: REQUINOA,
        zoom: 8.4,
        minZoom: 6,
        maxZoom: 12,
        attributionControl: { compact: true },
      });
    } catch {
      // A map that fails to start must not take the status and distances down with it.
      return;
    }
    map.current = m;

    m.on("load", () => {
      const data = stormData(latest.current.status, latest.current.replay);
      m.addSource("outside", { type: "geojson", data: data.outside });
      m.addSource("area", { type: "geojson", data: data.area });
      m.addSource("observed", { type: "geojson", data: data.observed });
      m.addSource("cold", { type: "geojson", data: data.cold });
      m.addSource("flashes", { type: "geojson", data: data.flashes });
      m.addSource("me-ring", { type: "geojson", data: collection([]) });
      m.addSource("me-rings", { type: "geojson", data: collection([]) });
      m.addSource("storm-line", { type: "geojson", data: collection([]) });

      m.addLayer({
        id: "outside",
        type: "fill",
        source: "outside",
        paint: { "fill-color": "#0e1116", "fill-opacity": 0.55 },
      });
      m.addLayer({
        id: "area",
        type: "line",
        source: "area",
        paint: { "line-color": "#7A8491", "line-width": 1.5, "line-dasharray": [3, 3] },
      });
      m.addLayer({
        id: "area-label",
        type: "symbol",
        source: "area",
        layout: {
          "symbol-placement": "line",
          "symbol-spacing": 400,
          "text-field": "Área de alerta",
          "text-font": LABEL_FONT,
          "text-size": 11,
        },
        paint: { "text-color": "#A9B2BC", "text-halo-color": "#0e1116", "text-halo-width": 1.5 },
      });
      m.addLayer({
        id: "observed",
        type: "line",
        source: "observed",
        paint: { "line-color": "#7A8491", "line-width": 1, "line-opacity": 0.6, "line-dasharray": [1, 3] },
      });
      m.addLayer({
        id: "observed-label",
        type: "symbol",
        source: "observed",
        layout: {
          "symbol-placement": "line",
          "symbol-spacing": 350,
          "text-field": "Sin datos fuera de este recuadro",
          "text-font": LABEL_FONT,
          "text-size": 10,
          "text-offset": [0, -0.8],
        },
        paint: { "text-color": "#8A949F", "text-halo-color": "#0e1116", "text-halo-width": 1.5 },
      });
      m.addLayer({
        id: "cold",
        type: "circle",
        source: "cold",
        // Colder tops on top, so a storm's core stays visible inside its anvil.
        layout: { "circle-sort-key": ["-", 0, ["get", "t"]] },
        paint: {
          // Each pixel drawn at its ground size (~1.5 km radius, doubling per zoom level) and
          // softened, so neighbouring pixels merge into one cloud shape instead of dots.
          "circle-radius": ["interpolate", ["exponential", 2], ["zoom"], 6, 1.2, 12, 50],
          "circle-blur": ["interpolate", ["linear"], ["zoom"], 6, 0.3, 10, 0.7],
          "circle-color": ["step", ["get", "t"], "#C2261B", -50, "#F0644F", -44, "#F2A53A"],
          "circle-opacity": 0.7,
        },
      });
      m.addLayer({
        id: "flashes-glow",
        type: "circle",
        source: "flashes",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 5, 11, 12],
          "circle-color": "#FFE14D",
          "circle-opacity": 0.25,
          "circle-blur": 1,
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
      m.addLayer({
        id: "me-rings",
        type: "line",
        source: "me-rings",
        filter: ["==", ["geometry-type"], "LineString"],
        paint: { "line-color": "#6CB8FF", "line-width": 1, "line-opacity": 0.35 },
      });
      m.addLayer({
        id: "me-ring-labels",
        type: "symbol",
        source: "me-rings",
        filter: ["==", ["geometry-type"], "Point"],
        layout: { "text-field": ["get", "label"], "text-font": LABEL_FONT, "text-size": 11 },
        paint: { "text-color": "#9CCBFF", "text-halo-color": "#0e1116", "text-halo-width": 1.5 },
      });
      m.addLayer({
        id: "storm-line",
        type: "line",
        source: "storm-line",
        filter: ["==", ["geometry-type"], "LineString"],
        paint: { "line-color": "#F2A53A", "line-width": 1.5, "line-dasharray": [2, 2] },
      });
      m.addLayer({
        id: "storm-line-label",
        type: "symbol",
        source: "storm-line",
        filter: ["==", ["geometry-type"], "Point"],
        layout: { "text-field": ["get", "label"], "text-font": LABEL_FONT, "text-size": 13 },
        paint: { "text-color": "#FFD08A", "text-halo-color": "#0e1116", "text-halo-width": 2 },
      });
      m.addLayer({ id: "me-ring-fill", type: "fill", source: "me-ring", paint: { "fill-color": "#6CB8FF", "fill-opacity": 0.08 } });
      m.addLayer({ id: "me-ring-line", type: "line", source: "me-ring", paint: { "line-color": "#6CB8FF", "line-width": 1.5 } });

      new maplibregl.Marker({ element: markerElement("requinoa-marker") }).setLngLat(REQUINOA).addTo(m);
      ready.current = true;
      syncStorm();
      syncPlace();
    });

    m.on("click", (e) => {
      userMoved.current = true; // a hand-picked place stays where the viewer is looking
      latest.current.onPick(e.lngLat.lat, e.lngLat.lng);
    });
    m.on("movestart", (e) => {
      if ((e as { originalEvent?: Event }).originalEvent) userMoved.current = true;
    });

    return () => {
      ready.current = false;
      m.remove();
      map.current = null;
      me.current = null;
    };
    // The map is created once; data changes flow through the effects below, and the
    // sync functions read the latest props through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function syncStorm() {
    const m = map.current;
    if (!m || !ready.current) return;
    const data = stormData(latest.current.status, latest.current.replay);
    (m.getSource("outside") as GeoJSONSource).setData(data.outside);
    (m.getSource("area") as GeoJSONSource).setData(data.area);
    (m.getSource("observed") as GeoJSONSource).setData(data.observed);
    (m.getSource("cold") as GeoJSONSource).setData(data.cold);
    (m.getSource("flashes") as GeoJSONSource).setData(data.flashes);
    const p = latest.current.place;
    if (p) {
      drawPlace(m, p.lat, p.lon);
      const run = latest.current.status?.generated_utc ?? null;
      if (!userMoved.current && !latest.current.replay && run !== framedRun.current) {
        framedRun.current = run;
        frame(m, p);
      }
    }
  }

  function drawPlace(m: maplibregl.Map, lat: number, lon: number) {
    const data = placeData(latest.current.status, lat, lon);
    (m.getSource("me-ring") as GeoJSONSource).setData(data.near);
    (m.getSource("me-rings") as GeoJSONSource).setData(data.rings);
    (m.getSource("storm-line") as GeoJSONSource).setData(data.stormLine);
  }

  /** Frames the viewer and the closest storm together, clear of the banner and the sheet. */
  function frame(m: maplibregl.Map, p: Place) {
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 800;
    const status = latest.current.status;
    const storm = status && nearestStorm(status, p.lat, p.lon);
    if (storm && storm.km <= STORM_FRAME_KM) {
      m.fitBounds(
        [
          [Math.min(p.lon, storm.lon), Math.min(p.lat, storm.lat)],
          [Math.max(p.lon, storm.lon), Math.max(p.lat, storm.lat)],
        ],
        { padding: framePadding(m), maxZoom: 10, duration },
      );
    } else {
      m.easeTo({ center: [p.lon, p.lat], zoom: Math.max(m.getZoom(), 9), duration });
    }
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
        drawPlace(m, lat, lng);
      });
      me.current.on("dragend", () => {
        userMoved.current = true;
        const { lat, lng } = me.current!.getLngLat();
        latest.current.onPick(lat, lng);
      });
    }
    me.current.setLngLat([p.lon, p.lat]);
    drawPlace(m, p.lat, p.lon);
    if (p.source === "gps") {
      // Asking for the location again is asking to see it: follow the data from here on.
      userMoved.current = false;
      frame(m, p);
    }
  }

  useEffect(syncStorm, [status, replay]);
  useEffect(syncPlace, [place]);

  // Sized, not positioned: maplibre-gl.css sets `position: relative` on the container and,
  // being unlayered CSS, beats Tailwind's `absolute inset-0`, which left the map 0 px tall.
  // The map is visual; its content is summarised in text (summaryId) for screen readers.
  return (
    <div
      ref={container}
      className="size-full"
      role="region"
      aria-label="Mapa de actividad convectiva. Toca para marcar tu ubicación."
      aria-describedby={summaryId}
    />
  );
}
