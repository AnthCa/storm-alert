import { describe, expect, it } from "vitest";
import { activityAt, circleRing, direction, distanceKm, nearestTown } from "./geo";
import { normalizeStatus, type Status } from "./status";

const REQUINOA: [number, number] = [-34.29, -70.82];
const RANCAGUA: [number, number] = [-34.17, -70.74];

function status(overrides: Partial<Status> = {}): Status {
  return {
    generated_utc: "2026-10-26T20:31:00+00:00",
    data_until_utc: "2026-10-26T20:30:00+00:00",
    level: "severe",
    alerts_utc: [],
    episode_start_utc: null,
    latest_scan_utc: "2026-10-26T20:20:20+00:00",
    coldest_top_c: -48.8,
    coldest_km_from_requinoa: 16,
    radius_km: 50,
    center: REQUINOA,
    flashes_per_5min: [],
    cloud_tops: [],
    cold_pixels: [],
    recent_flashes: [],
    ...overrides,
  };
}

describe("distance and direction", () => {
  it("measures Rancagua to Requínoa at about 15 km", () => {
    expect(distanceKm(...RANCAGUA, ...REQUINOA)).toBeGreaterThan(14);
    expect(distanceKm(...RANCAGUA, ...REQUINOA)).toBeLessThan(16);
  });

  it("finds Requínoa south-southwest of Rancagua", () => {
    expect(direction(...RANCAGUA, ...REQUINOA)).toBe("suroeste");
    expect(direction(...REQUINOA, -34.0, -70.82)).toBe("norte");
  });

  it("closes the circle ring", () => {
    const ring = circleRing(...REQUINOA, 50);
    expect(ring[0][0]).toBeCloseTo(ring[ring.length - 1][0]);
    expect(distanceKm(...REQUINOA, ring[10][1], ring[10][0])).toBeCloseTo(50, 0);
  });
});

describe("activityAt", () => {
  it("is clear with no storm data", () => {
    const a = activityAt(status(), ...RANCAGUA);
    expect(a.level).toBe("clear");
    expect(a.nearest).toBeNull();
  });

  it("counts lightning as the nearest storm, not only cold tops", () => {
    const a = activityAt(
      status({ cold_pixels: [[-34.4, -70.8, -45]], recent_flashes: [[-34.28, -70.8]] }),
      ...RANCAGUA,
    );
    expect(a.level).toBe("near");
    expect(a.nearest?.km).toBeLessThan(15);
    expect(a.flashesNear).toBe(0);
  });

  it("is over you when lightning falls within 10 km", () => {
    const a = activityAt(status({ recent_flashes: [[-34.2, -70.75]] }), ...RANCAGUA);
    expect(a.level).toBe("over");
    expect(a.flashesNear).toBe(1);
  });

  it("flags points outside the validated 50 km circle", () => {
    expect(activityAt(status(), -34.39, -72.0).insideValidatedArea).toBe(false);
    expect(activityAt(status(), ...RANCAGUA).insideValidatedArea).toBe(true);
  });
});

describe("nearestTown", () => {
  it("names the town only when close enough", () => {
    expect(nearestTown(-34.165, -70.742)).toBe("Rancagua");
    expect(nearestTown(-35.5, -72.5)).toBeNull();
  });
});

describe("normalizeStatus", () => {
  it("fills fields missing from older status.json files", () => {
    const s = normalizeStatus({
      level: "quiet",
      data_until_utc: "2026-10-30T00:48:00+00:00",
      flashes_per_5min: [{ start_utc: "2026-10-30T00:40:00+00:00", count: 0 } as never],
    });
    expect(s.cloud_tops).toEqual([]);
    expect(s.episode_start_utc).toBeNull();
    expect(s.flashes_per_5min[0].jump).toBe(false);
  });
});
