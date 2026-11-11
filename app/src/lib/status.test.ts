import { describe, expect, it } from "vitest";
import { focusStatus, normalizeStatus, zoneFor, type Zone } from "./status";

const zone = (name: string, center: [number, number], level: Zone["level"], extra: Partial<Zone> = {}): Zone => ({
  name,
  center,
  level,
  alerts_utc: [],
  episode_start_utc: null,
  coldest_top_c: -20,
  flashes_per_5min: [],
  cloud_tops: [],
  ...extra,
});

const ZONES = [
  zone("Rancagua", [-34.17, -70.74], "quiet"),
  zone("Requínoa", [-34.29, -70.82], "deep_convection"),
  zone("Pichilemu", [-34.39, -72.0], "severe", {
    alerts_utc: ["2026-11-10T03:40:00+00:00"],
    episode_start_utc: "2026-11-10T03:40:00+00:00",
    coldest_top_c: -52.1,
    flashes_per_5min: [{ start_utc: "2026-11-10T03:40:00+00:00", count: 30, jump: true }],
    cloud_tops: [
      { time_utc: "2026-11-10T03:30:20+00:00", min_bt_c: null },
      { time_utc: "2026-11-10T03:40:20+00:00", min_bt_c: -52.1 },
    ],
  }),
];

const published = (zones: Zone[] = ZONES) =>
  normalizeStatus({ level: "deep_convection", data_until_utc: "2026-11-10T03:50:00+00:00", center: [-34.29, -70.82], coldest_top_c: -40, zones });

describe("alert zones", () => {
  it("gives a place the zone of its nearest town", () => {
    expect(zoneFor(published(), { lat: -34.18, lon: -70.7 })?.name).toBe("Rancagua");
    expect(zoneFor(published(), { lat: -34.4, lon: -71.9 })?.name).toBe("Pichilemu");
  });

  it("shows the most active zone when no place is set", () => {
    expect(zoneFor(published(), null)?.name).toBe("Pichilemu");
  });

  it("replaces Requínoa's reading with the viewer's zone", () => {
    const coast = focusStatus(published(), { lat: -34.4, lon: -71.9 });
    expect([coast.zone_name, coast.level, coast.center]).toEqual(["Pichilemu", "severe", [-34.39, -72.0]]);
    expect(coast.episode_start_utc).toBe("2026-11-10T03:40:00+00:00");
    expect(coast.coldest_top_c).toBe(-52.1);
    expect(coast.flashes_per_5min[0].count).toBe(30);
    // Scans with no cloud reading are dropped, not drawn as a temperature.
    expect(coast.cloud_tops).toEqual([{ time_utc: "2026-11-10T03:40:20+00:00", min_bt_c: -52.1 }]);

    const city = focusStatus(published(), { lat: -34.18, lon: -70.7 });
    expect([city.zone_name, city.level]).toEqual(["Rancagua", "quiet"]);
  });

  it("leaves files without zones as the single Requínoa zone", () => {
    const old = published([]);
    expect(zoneFor(old, null)).toBeNull();
    expect(focusStatus(old, { lat: -34.4, lon: -71.9 })).toBe(old);
    expect(old.zone_name).toBe("Requínoa");
  });
});
