import type { Bbox } from "./status";

/**
 * Image cell size (~0.5 km): fine enough that the blurred edge stays smooth on screen
 * even where the map scales the image without interpolating.
 */
export const GRID_DEG = 0.005;
/** Ground footprint drawn per satellite pixel; over the ~2-2.3 km spacing so rows never leave gaps. */
const PIXEL_KM = 3;
/** Box-blur radius in cells and passes: three passes approximate a Gaussian (~2 km soft edge). */
const BLUR_RADIUS = 2;
const BLUR_PASSES = 3;
const KM_PER_DEG_LAT = 111.2;

/** Mapped area when status.json does not say (schema < 3); matches the pipeline's BBOX. */
export const DEFAULT_BBOX: Bbox = {
  lat_min: -35.5,
  lat_max: -33.5,
  lon_min: -72.5,
  lon_max: -69.5,
};

/**
 * Continuous colour ramp by cloud-top temperature, as in enhanced infrared imagery:
 * orange at the −38 °C storm threshold, red, dark red, then magenta for the coldest
 * overshooting tops. Warmer tops are also more transparent, so the core stands out.
 */
export const CLOUD_RAMP: [number, [number, number, number], number][] = [
  [-38, [245, 170, 60], 175],
  [-44, [244, 105, 80], 200],
  [-50, [205, 40, 32], 220],
  [-56, [150, 20, 70], 230],
  [-62, [210, 70, 210], 235],
];

export function cloudColor(tempC: number): [number, number, number, number] {
  const ramp = CLOUD_RAMP;
  if (tempC >= ramp[0][0]) return [...ramp[0][1], ramp[0][2]];
  for (let i = 1; i < ramp.length; i++) {
    const [t1, c1, a1] = ramp[i];
    if (tempC >= t1) {
      const [t0, c0, a0] = ramp[i - 1];
      const f = (t0 - tempC) / (t0 - t1);
      const mix = (x: number, y: number) => Math.round(x + (y - x) * f);
      return [mix(c0[0], c1[0]), mix(c0[1], c1[1]), mix(c0[2], c1[2]), mix(a0, a1)];
    }
  }
  const last = ramp[ramp.length - 1];
  return [...last[1], last[2]];
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
export function paintClouds(
  pixels: [number, number, number][],
  box: Bbox,
): CloudImage {
  const width = Math.round((box.lon_max - box.lon_min) / GRID_DEG);
  const height = Math.round((box.lat_max - box.lat_min) / GRID_DEG);
  const data = new Uint8ClampedArray(width * height * 4);
  const halfY = PIXEL_KM / 2 / KM_PER_DEG_LAT / GRID_DEG;

  for (const [lat, lon, tempC] of [...pixels].sort((a, b) => b[2] - a[2])) {
    const halfX = halfY / Math.cos((lat * Math.PI) / 180);
    const cx = (lon - box.lon_min) / GRID_DEG;
    const cy = (box.lat_max - lat) / GRID_DEG;
    const [r, g, b, alpha] = cloudColor(tempC);
    for (
      let y = Math.max(0, Math.round(cy - halfY));
      y < Math.min(height, Math.round(cy + halfY));
      y++
    ) {
      for (
        let x = Math.max(0, Math.round(cx - halfX));
        x < Math.min(width, Math.round(cx + halfX));
        x++
      ) {
        const i = (y * width + x) * 4;
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = alpha;
      }
    }
  }
  return { width, height, data: smooth(data, width, height) };
}

/**
 * Soft edges and colour transitions: a separable box blur on premultiplied RGBA, so
 * transparent cells do not bleed black into the clouds.
 */
function smooth(
  data: Uint8ClampedArray<ArrayBuffer>,
  width: number,
  height: number,
): Uint8ClampedArray<ArrayBuffer> {
  const n = width * height;
  let buf = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const a = data[i * 4 + 3] / 255;
    buf[i * 4] = data[i * 4] * a;
    buf[i * 4 + 1] = data[i * 4 + 1] * a;
    buf[i * 4 + 2] = data[i * 4 + 2] * a;
    buf[i * 4 + 3] = data[i * 4 + 3];
  }
  for (let pass = 0; pass < BLUR_PASSES; pass++) {
    buf = blurAxis(buf, width, height, 1, 0);
    buf = blurAxis(buf, width, height, 0, 1);
  }
  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const a = buf[i * 4 + 3];
    if (a < 1) continue;
    const k = 255 / a;
    out[i * 4] = buf[i * 4] * k;
    out[i * 4 + 1] = buf[i * 4 + 1] * k;
    out[i * 4 + 2] = buf[i * 4 + 2] * k;
    out[i * 4 + 3] = a;
  }
  return out;
}

function blurAxis(
  src: Float32Array<ArrayBuffer>,
  width: number,
  height: number,
  dx: number,
  dy: number,
): Float32Array<ArrayBuffer> {
  const dst = new Float32Array(src.length);
  const span = 2 * BLUR_RADIUS + 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      for (let k = -BLUR_RADIUS; k <= BLUR_RADIUS; k++) {
        const sx = x + k * dx;
        const sy = y + k * dy;
        if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
        const i = (sy * width + sx) * 4;
        dst[o] += src[i] / span;
        dst[o + 1] += src[i + 1] / span;
        dst[o + 2] += src[i + 2] / span;
        dst[o + 3] += src[i + 3] / span;
      }
    }
  }
  return dst;
}
