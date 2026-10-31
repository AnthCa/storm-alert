import type { Bbox } from "./status";

/** Image cell size: finer than the ~2 km satellite pixels, so their shapes survive. */
export const GRID_DEG = 0.01;
/** Ground footprint drawn per satellite pixel; a bit over the ~2 km spacing closes gaps. */
const PIXEL_KM = 2.4;
const KM_PER_DEG_LAT = 111.2;
const ALPHA = 225;

/** Mapped area when status.json does not say (schema < 3); matches the pipeline's BBOX. */
export const DEFAULT_BBOX: Bbox = { lat_min: -35.5, lat_max: -33.5, lon_min: -72.5, lon_max: -69.5 };

/** Same steps as the legend: −38 to −44 °C, −44 to −50 °C, below −50 °C. */
export function cloudColor(tempC: number): [number, number, number] {
  if (tempC < -50) return [194, 38, 27];
  if (tempC < -44) return [240, 100, 79];
  return [242, 165, 58];
}

export interface CloudImage {
  width: number;
  height: number;
  /** RGBA, row 0 at the north edge of the box. */
  data: Uint8ClampedArray<ArrayBuffer>;
}

/**
 * Paints cold cloud-top pixels into an RGBA image over `box`. Each pixel fills its ground
 * footprint; colder pixels are painted last so a storm's core is never covered. The map
 * then interpolates the image linearly, which gives soft edges without blending tiles.
 */
export function paintClouds(pixels: [number, number, number][], box: Bbox): CloudImage {
  const width = Math.round((box.lon_max - box.lon_min) / GRID_DEG);
  const height = Math.round((box.lat_max - box.lat_min) / GRID_DEG);
  const data = new Uint8ClampedArray(width * height * 4);
  const halfY = PIXEL_KM / 2 / KM_PER_DEG_LAT / GRID_DEG;

  for (const [lat, lon, tempC] of [...pixels].sort((a, b) => b[2] - a[2])) {
    const halfX = halfY / Math.cos((lat * Math.PI) / 180);
    const cx = (lon - box.lon_min) / GRID_DEG;
    const cy = (box.lat_max - lat) / GRID_DEG;
    const [r, g, b] = cloudColor(tempC);
    for (let y = Math.max(0, Math.round(cy - halfY)); y < Math.min(height, Math.round(cy + halfY)); y++) {
      for (let x = Math.max(0, Math.round(cx - halfX)); x < Math.min(width, Math.round(cx + halfX)); x++) {
        const i = (y * width + x) * 4;
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = ALPHA;
      }
    }
  }
  return { width, height, data };
}
