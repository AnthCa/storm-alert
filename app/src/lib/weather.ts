/**
 * Current conditions at the viewer's place from Open-Meteo (free, no key, CC BY 4.0).
 * Model data, not a station reading. Only a coarse point leaves the device: the place is
 * rounded to a ~5 km grid before the request, so the same cell serves many viewers.
 */

export const WEATHER_ORIGIN = "https://api.open-meteo.com";
/** Grid step for the point sent to Open-Meteo (0.05° ≈ 5.5 km north-south). */
const COARSE_DEG = 0.05;
/** Open-Meteo refreshes current conditions every 15 minutes. */
const FRESH_MS = 10 * 60 * 1000;

export interface Weather {
  tempC: number;
  feelsC: number;
  humidity: number;
  windKmh: number;
  gustKmh: number;
  /** Where the wind comes from, as a short Spanish compass point (N, NE, …, NO). */
  windFrom: string;
  /** Rain over the last hour, from the four last 15-minute steps. */
  rainMm: number;
  /** Local time of the model step the values belong to, "HH:MM". */
  at: string;
}

export function coarsePoint(lat: number, lon: number): [number, number] {
  const snap = (v: number) => Math.round(Math.round(v / COARSE_DEG) * COARSE_DEG * 100) / 100;
  return [snap(lat), snap(lon)];
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];

export function compassFrom(degrees: number): string {
  return COMPASS[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
}

export function weatherUrl(lat: number, lon: number): string {
  const [cLat, cLon] = coarsePoint(lat, lon);
  const params = new URLSearchParams({
    latitude: String(cLat),
    longitude: String(cLon),
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    minutely_15: "precipitation",
    past_minutely_15: "4",
    forecast_minutely_15: "0",
    wind_speed_unit: "kmh",
    timezone: "America/Santiago",
  });
  return `${WEATHER_ORIGIN}/v1/forecast?${params}`;
}

interface OpenMeteoResponse {
  current?: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    wind_gusts_10m: number;
  };
  minutely_15?: { precipitation?: (number | null)[] };
}

export function parseWeather(raw: OpenMeteoResponse): Weather | null {
  const c = raw.current;
  if (!c || typeof c.temperature_2m !== "number") return null;
  const rain = (raw.minutely_15?.precipitation ?? []).reduce<number>((sum, mm) => sum + (mm ?? 0), 0);
  return {
    tempC: c.temperature_2m,
    feelsC: c.apparent_temperature,
    humidity: c.relative_humidity_2m,
    windKmh: c.wind_speed_10m,
    gustKmh: c.wind_gusts_10m,
    windFrom: compassFrom(c.wind_direction_10m),
    rainMm: Math.round(rain * 10) / 10,
    at: c.time.slice(11, 16),
  };
}

const cache = new Map<string, { at: number; value: Promise<Weather | null> }>();

/** One request per coarse cell every ten minutes, shared by every part of the page. */
export function fetchWeather(lat: number, lon: number): Promise<Weather | null> {
  const url = weatherUrl(lat, lon);
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < FRESH_MS) return hit.value;
  const value = fetch(url)
    .then((r) => (r.ok ? r.json() : null))
    .then((raw) => (raw ? parseWeather(raw) : null))
    .catch(() => null)
    .then((weather) => {
      // A failed request is retried on the next call instead of being cached.
      if (!weather) cache.delete(url);
      return weather;
    });
  cache.set(url, { at: Date.now(), value });
  return value;
}
