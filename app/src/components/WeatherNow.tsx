"use client";

import { useEffect, useState } from "react";
import { fetchWeather, rainOutlook, type Weather } from "@/lib/weather";

const SOURCE =
  "Modelo Open-Meteo, no un termómetro en tu calle: puede diferir 1 o 2 grados. La lluvia de la próxima hora resume el modelo según cuánto acertó en O'Higgins desde 2025; con chubascos de tormenta acierta menos.";

const deg = (c: number) => `${Math.round(c)}°`;
const kmh = (v: number) => `${Math.round(v)} km/h`;
const mm = (v: number) => `${v.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mm`;

/** Current conditions at the place; refreshed with the storm data (every status update). */
function useWeather(lat: number, lon: number, refreshKey: string): Weather | null {
  const [weather, setWeather] = useState<{ key: string; value: Weather | null } | null>(null);
  const key = `${lat},${lon}`;
  useEffect(() => {
    let live = true;
    fetchWeather(lat, lon).then((value) => {
      if (live && value) setWeather({ key: `${lat},${lon}`, value });
    });
    return () => {
      live = false;
    };
  }, [lat, lon, refreshKey]);
  // A value for another place is never shown while the new one loads.
  return weather?.key === key ? weather.value : null;
}

interface Props {
  lat: number;
  lon: number;
  town: string | null;
  /** Changes with each new status, so the conditions refresh alongside the map. */
  refreshKey: string;
  /** A storm with lightning is overhead or near: what the satellite sees beats the model's rain forecast. */
  hideRain?: boolean;
}

/** The full block inside "Ver detalles" and on the desktop panel. */
export function WeatherDetails({ lat, lon, town, refreshKey, hideRain }: Props) {
  const w = useWeather(lat, lon, refreshKey);
  if (!w) return null;
  const items: [string, string][] = [
    ["Temperatura", deg(w.tempC)],
    ["Sensación", deg(w.feelsC)],
    ["Humedad", `${Math.round(w.humidity)} %`],
    ["Viento", `${kmh(w.windKmh)} ${w.windFrom}`],
    ["Ráfagas", kmh(w.gustKmh)],
    ["Lluvia, 1 h", mm(w.rainMm)],
  ];
  return (
    <section aria-labelledby="weather-now" className="flex flex-col gap-2.5 rounded-xl bg-surface-2 p-3">
      <h3 id="weather-now" className="text-[13px] font-semibold text-soft">
        El tiempo ahora{town ? ` en ${town}` : ""} <span className="font-normal text-muted">· {w.at}</span>
      </h3>
      <dl className="grid grid-cols-3 gap-x-2 gap-y-3">
        {items.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <dt className="text-[13px] text-muted">{label}</dt>
            <dd className="text-base font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      {w.rainChance !== null && !hideRain && (
        <p className="text-sm">
          <span className="text-muted">Próxima hora: </span>
          <span className="font-semibold">{rainOutlook(w.rainChance)}</span>
        </p>
      )}
      <p className="text-[13px] leading-snug text-muted">{SOURCE}</p>
    </section>
  );
}
