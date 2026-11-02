import { TOWNS, coarsen, nearestTown } from "./geo";
import { placeName, type PushPlace, type PushRadius } from "./push";

/**
 * Where a place is: one of the towns, the point marked on the map ("here"), or the point
 * a saved place already had ("kept"), so editing names never moves a place by accident.
 */
export type Where = "here" | "kept" | (typeof TOWNS)[number][0];

export interface PlaceDraft {
  name: string;
  where: Where;
  kept?: { lat: number; lon: number };
}

/** What this phone remembers about its notifications. */
export interface StoredAlerts {
  places: PushPlace[];
}

/** Older versions stored one place by its label, without the point. */
export interface LegacyAlerts {
  radius: PushRadius;
  place: string;
}

export function isLegacy(value: StoredAlerts | LegacyAlerts | null): value is LegacyAlerts {
  return value !== null && !("places" in value);
}

export function townAt(lat: number, lon: number): string | null {
  return TOWNS.find(([, tLat, tLon]) => tLat === lat && tLon === lon)?.[0] ?? null;
}

/** The point a draft refers to, if it is known. */
export function draftPoint(draft: PlaceDraft, here: { lat: number; lon: number } | null) {
  const town = TOWNS.find(([name]) => name === draft.where);
  if (town) return { lat: town[1], lon: town[2] };
  return (draft.where === "here" ? here : draft.kept) ?? null;
}

/** The draft as a place to send, or null when its point is unknown. Unnamed places take the town's name. */
export function toPlace(draft: PlaceDraft, here: { lat: number; lon: number } | null, radius: PushRadius): PushPlace | null {
  const point = draftPoint(draft, here);
  if (!point) return null;
  const lat = coarsen(point.lat);
  const lon = coarsen(point.lon);
  const fallback = townAt(lat, lon) ?? nearestTown(lat, lon) ?? "Mi ubicación";
  return { name: placeName(draft.name) || fallback, lat, lon, radius };
}

/** A saved place back as a draft: its town when it sits on one, else its own point. */
export function toDraft(place: PushPlace): PlaceDraft {
  const town = townAt(place.lat, place.lon);
  return town ? { name: place.name, where: town } : { name: place.name, where: "kept", kept: { lat: place.lat, lon: place.lon } };
}
