import * as maplibregl from "maplibre-gl";

// MapLibre 6 loads its worker from a file next to its own script; once bundled that file is not
// there, so point it at the copy the bundler emits.
maplibregl.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);

export default maplibregl;
