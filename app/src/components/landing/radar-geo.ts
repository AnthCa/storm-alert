import { AROUND_KM, activityAt, lightningWithin, nearestStorm } from "@/lib/geo";
import type { Status } from "@/lib/status";

/** The landing's replay panel is centred on Requínoa, the alert area's centre. */
export const PANEL_CENTER: [number, number] = [-34.29, -70.82];
/** Half the panel's width on the ground. */
export const HALF_KM = 58;
const KM_PER_DEG_LAT = 111.2;
const KM_PER_DEG_LON = 111.32 * Math.cos((PANEL_CENTER[0] * Math.PI) / 180);

/** Latitude and longitude to panel percentages (0-100, y down). */
export function project(lat: number, lon: number): [number, number] {
  const x = 50 + (((lon - PANEL_CENTER[1]) * KM_PER_DEG_LON) / HALF_KM) * 50;
  const y = 50 - (((lat - PANEL_CENTER[0]) * KM_PER_DEG_LAT) / HALF_KM) * 50;
  return [Math.round(x * 100) / 100, Math.round(y * 100) / 100];
}

export function unproject(x: number, y: number): [number, number] {
  const lat = PANEL_CENTER[0] - (((y - 50) / 50) * HALF_KM) / KM_PER_DEG_LAT;
  const lon = PANEL_CENTER[1] + (((x - 50) / 50) * HALF_KM) / KM_PER_DEG_LON;
  return [lat, lon];
}

/** A distance on the ground as a share of the panel's width, in percent. */
export const panelPercent = (km: number) => (km / HALF_KM) * 50;

export type Tone = "severe" | "convective" | "quiet" | "soft";

export interface Verdict {
  title: string;
  advice: string;
  tone: Tone;
}

/**
 * The map page's headline for a point, from the same activity rules, trimmed to the cases
 * a single replayed scan can produce (no movement or data-health lines).
 */
export function verdictAt(status: Status, lat: number, lon: number): Verdict {
  const { level, nearest, flashesNear } = activityAt(status, lat, lon);
  const storm = nearestStorm(status, lat, lon);
  if (level === "outside") {
    return storm
      ? {
          title: `Nubes de tormenta a ${Math.round(storm.km)} km`,
          advice: `Al ${storm.direction}. Estás fuera del área de alerta de ${status.radius_km} km alrededor de Requínoa.`,
          tone: storm.km <= AROUND_KM ? "convective" : "soft",
        }
      : { title: "Sin nubes de tormenta cerca", advice: "Estás fuera del área de alerta.", tone: "soft" };
  }
  if (level === "over" && flashesNear > 0) {
    return { title: "Actividad sobre tu zona", advice: "Hay rayos muy cerca. Entra a un lugar cerrado.", tone: "severe" };
  }
  if ((level === "over" || level === "near") && nearest && !lightningWithin(status, lat, lon, AROUND_KM)) {
    return {
      title: level === "over" ? "Nubes muy frías sobre tu zona" : `Nubes muy frías a ${Math.round(nearest.km)} km al ${nearest.direction}`,
      advice: "Sin rayos por ahora: pueden ser solo nubes altas o traer lluvia.",
      tone: "convective",
    };
  }
  if ((level === "over" || level === "near") && nearest) {
    return {
      title: `Actividad a ${Math.round(nearest.km)} km al ${nearest.direction}`,
      advice:
        status.level === "severe"
          ? "Se está intensificando. Si estás al aire libre, busca refugio."
          : "Hubo rayos en la última media hora. Mantente atento por si se acerca.",
      tone: status.level === "severe" ? "severe" : "convective",
    };
  }
  return {
    title: `Sin actividad a menos de ${AROUND_KM} km`,
    advice: storm
      ? `Nubes de tormenta más cercanas: ${Math.round(storm.km)} km al ${storm.direction}.`
      : "El satélite no ve nubes de tormenta en la región.",
    tone: "quiet",
  };
}
