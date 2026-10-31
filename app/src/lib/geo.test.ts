import { describe, expect, it } from "vitest";
import {
  activityAt,
  circleRing,
  coarsen,
  direction,
  distanceKm,
  insideObservedArea,
  lastFlashNear,
  nearestStorm,
  nearestTown,
  etaText,
  stormEta,
  stormTrend,
} from "./geo";
import { DEFAULT_BBOX, paintClouds } from "./cloud-image";
import { replayFrames } from "./replay";
import { shareMessage } from "./share";
import { dataState, normalizeStatus, type Status } from "./status";

const REQUINOA: [number, number] = [-34.29, -70.82];
const RANCAGUA: [number, number] = [-34.17, -70.74];

function status(overrides: Partial<Status> = {}): Status {
  return {
    schema_version: 2,
    algorithm_version: "2026.10-r1",
    health: {
      state: "healthy",
      problems: [],
      abi: { expected: 3, received: 3, latest_utc: "2026-10-26T20:20:20+00:00" },
      glm: { expected_files: 135, received_files: 135, latest_utc: "2026-10-26T20:30:00+00:00" },
    },
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
    cold_history: [],
    observed_bbox: { lat_min: -35.5, lat_max: -33.5, lon_min: -72.5, lon_max: -69.5 },
    recent_flashes: [],
    flash_cells_30min: [],
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

  it("computes no local state outside the monitored circle", () => {
    const pichilemu = activityAt(status({ recent_flashes: [[-34.39, -72.0]] }), -34.39, -72.0);
    expect(pichilemu.insideValidatedArea).toBe(false);
    expect(pichilemu.level).toBe("outside");
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
    expect(s.level).toBe("unknown"); // no health report: quiet cannot be confirmed
    expect(s.episode_start_utc).toBeNull();
    expect(s.flashes_per_5min[0].jump).toBe(false);
  });
});

describe("coarsen", () => {
  it("keeps about 1 km of precision", () => {
    expect(coarsen(-34.16543)).toBe(-34.17);
    expect(distanceKm(-34.16543, -70.74219, coarsen(-34.16543), coarsen(-70.74219))).toBeLessThan(1);
  });
});

describe("dataState", () => {
  const now = new Date("2026-10-26T20:40:00Z");
  it("is healthy only with complete, recent data", () => {
    expect(dataState(status({ data_until_utc: "2026-10-26T20:35:00Z" }), { demo: false, online: true, now })).toBe(
      "healthy",
    );
  });
  it("flags old data as stale", () => {
    expect(dataState(status({ data_until_utc: "2026-10-26T20:00:00Z" }), { demo: false, online: true, now })).toBe(
      "stale",
    );
  });
  it("reports pipeline gaps as degraded", () => {
    const degraded = status({ data_until_utc: "2026-10-26T20:35:00Z" });
    degraded.health = { ...degraded.health, state: "degraded", problems: ["glm_incomplete"] };
    expect(dataState(degraded, { demo: false, online: true, now })).toBe("degraded");
  });
  it("never presents cached data as current while offline, and marks the replay as historical", () => {
    expect(dataState(status(), { demo: false, online: false, now })).toBe("offline");
    expect(dataState(status(), { demo: true, online: true, now })).toBe("historical");
    expect(dataState(null, { demo: false, online: true, now })).toBe("unavailable");
  });
});

describe("regional context", () => {
  // Pichilemu, on the coast, ~110 km west of Requínoa: outside the alert circle.
  const COAST: [number, number, number] = [-34.39, -72.0, -41];

  it("finds storms outside the alert circle, with direction", () => {
    const nearest = nearestStorm(status({ cold_pixels: [COAST] }), ...REQUINOA);
    expect(nearest?.direction).toBe("oeste");
    expect(nearest!.km).toBeGreaterThan(100);
  });

  it("has no nearest storm when nothing is observed", () => {
    expect(nearestStorm(status(), ...REQUINOA)).toBeNull();
  });

  it("knows the observed box", () => {
    expect(insideObservedArea(status(), ...RANCAGUA)).toBe(true);
    expect(insideObservedArea(status(), -33.45, -70.66)).toBe(false); // Santiago
    expect(insideObservedArea(status({ observed_bbox: null }), ...RANCAGUA)).toBe(false);
  });
});

describe("storm trend", () => {
  const scan = (cells: [number, number, number][]) => ({ time_utc: "2026-10-26T19:50:20+00:00", cells });

  it("reports approaching storms with their earlier distance", () => {
    const trend = stormTrend(
      status({ cold_pixels: [[-34.39, -71.3, -45]], cold_history: [scan([[-34.39, -71.6, -42]])] }),
      ...REQUINOA,
    );
    expect(trend?.kind).toBe("approaching");
    expect(trend && "wasKm" in trend && trend.wasKm).toBeGreaterThan(70);
    expect(trend?.minutes).toBe(30);
  });

  it("reports receding storms", () => {
    const trend = stormTrend(
      status({ cold_pixels: [[-34.39, -71.6, -45]], cold_history: [scan([[-34.39, -71.3, -42]])] }),
      ...REQUINOA,
    );
    expect(trend?.kind).toBe("receding");
  });

  it("calls an impossible jump a change of clouds, not movement", () => {
    // 6 km to 59 km in 30 min would be over 100 km/h: the close clouds died out.
    const gone = stormTrend(
      status({ cold_pixels: [[-34.82, -70.82, -38.4]], cold_history: [scan([[-34.34, -70.82, -38.5]])] }),
      ...REQUINOA,
    );
    expect(gone?.kind).toBe("dissipated");
    const formed = stormTrend(
      status({ cold_pixels: [[-34.34, -70.82, -38.4]], cold_history: [scan([[-34.82, -70.82, -38.5]])] }),
      ...REQUINOA,
    );
    expect(formed?.kind).toBe("formed_closer");
  });

  it("treats moves within the cell size as steady", () => {
    const trend = stormTrend(
      status({ cold_pixels: [[-34.39, -71.3, -45]], cold_history: [scan([[-34.39, -71.33, -42]])] }),
      ...REQUINOA,
    );
    expect(trend?.kind).toBe("steady");
  });

  it("reports storms that formed since the earlier scan", () => {
    const trend = stormTrend(status({ cold_pixels: [[-34.39, -71.3, -45]], cold_history: [scan([])] }), ...REQUINOA);
    expect(trend).toEqual({ kind: "new", minutes: 30 });
  });

  it("has no trend without history or without storms", () => {
    expect(stormTrend(status({ cold_pixels: [[-34.39, -71.3, -45]] }), ...REQUINOA)).toBeNull();
    expect(stormTrend(status({ cold_history: [scan([[-34.39, -71.3, -42]])] }), ...REQUINOA)).toBeNull();
  });
});

describe("share message", () => {
  it("names the level and time but never a location", () => {
    const text = shareMessage(status({ level: "quiet" }));
    expect(text).toContain("sin actividad convectiva");
    expect(text).toContain("no oficial");
    expect(text).not.toMatch(/-34\.|-70\./);
  });
});

describe("arrival estimate", () => {
  // Points due west of Requínoa, `km` away along its latitude.
  const west = (km: number): [number, number, number] => [-34.29, -70.82 - km / 92, -42];
  const scans = (...kms: number[]) =>
    kms.map((km, i) => ({ time_utc: `2026-10-26T19:${String(20 + i * 10).padStart(2, "0")}:20+00:00`, cells: [west(km)] }));
  const at = (history: number[], nowKm: number) =>
    status({ cold_history: scans(...history), cold_pixels: [west(nowKm)], latest_scan_utc: "2026-10-26T19:50:20+00:00" });

  it("estimates arrival when the storm closes in steadily", () => {
    const eta = stormEta(at([130, 120, 110], 100), ...REQUINOA);
    expect(eta?.speedKmh).toBeCloseTo(60, 0);
    // 100 km at 60 km/h is 100 min, widened to the minimum -20 % / +25 % margin.
    expect(eta?.fromMin).toBeCloseTo(80, 0);
    expect(eta?.toMin).toBeCloseTo(125, 0);
    // Scan at 19:50 UTC (16:50 in Chile) + 80 to 125 min.
    expect(etaText(eta!, "2026-10-26T19:50:20+00:00")).toBe(
      "Se acercan a ~60 km/h. Si mantienen el ritmo, podrían llegar entre las 18:10 y las 19:00 (estimación, puede cambiar).",
    );
  });

  it("gives no estimate when a step is faster than a storm can travel", () => {
    expect(stormEta(at([140, 130, 120], 70), ...REQUINOA)).toBeNull();
  });

  it("gives no estimate when the distance jumps back and forth", () => {
    expect(stormEta(at([130, 110, 120], 100), ...REQUINOA)).toBeNull();
  });

  it("gives no estimate with too few scans, too far, too slow or already here", () => {
    expect(stormEta(at([110], 100), ...REQUINOA)).toBeNull();
    expect(stormEta(at([230, 220, 210], 200), ...REQUINOA)).toBeNull();
    expect(stormEta(at([103, 102, 101], 100), ...REQUINOA)).toBeNull();
    expect(stormEta(at([30, 20, 12], 5), ...REQUINOA)).toBeNull();
  });

  it("gives clock times from the scan, open-ended when the slow end is too far", () => {
    const scan = "2026-10-26T19:50:20+00:00";
    expect(etaText({ speedKmh: 61, fromMin: 38, toMin: 52 }, scan)).toContain("entre las 17:30 y las 17:40");
    expect(etaText({ speedKmh: 30, fromMin: 120, toMin: 400 }, scan)).toContain("después de las 18:50");
  });
});

describe("lightning safety", () => {
  it("reports the latest close flash and when the 30-minute wait ends", () => {
    const flash = lastFlashNear(
      status({
        flash_cells_30min: [
          [-34.29, -70.88, 12], // ~5.5 km west, 12 min before 20:30 UTC
          [-34.29, -70.84, 20], // closer but older
          [-34.29, -71.2, 1], // newest but ~35 km away
        ],
      }),
      ...REQUINOA,
    );
    expect(flash?.direction).toBe("oeste");
    expect(flash!.km).toBeGreaterThan(5);
    expect(flash?.atUtc).toBe("2026-10-26T20:18:00.000Z");
    expect(flash?.safeAfterUtc).toBe("2026-10-26T20:48:00.000Z");
  });

  it("is null without close flashes", () => {
    expect(lastFlashNear(status({ flash_cells_30min: [[-34.29, -71.2, 1]] }), ...REQUINOA)).toBeNull();
  });
});

describe("replay", () => {
  it("lists earlier scans then the latest, with the flashes of the 10 minutes before each", () => {
    const frames = replayFrames(
      status({
        data_until_utc: "2026-10-26T20:30:00+00:00",
        latest_scan_utc: "2026-10-26T20:20:20+00:00",
        cold_history: [{ time_utc: "2026-10-26T20:00:20+00:00", cells: [[-34.3, -70.9, -40]] }],
        cold_pixels: [[-34.3, -70.85, -45]],
        recent_flashes: [[-34.3, -70.84]],
        flash_cells_30min: [
          [-34.3, -70.95, 25], // 20:05: after the 20:00 scan
          [-34.3, -70.96, 32], // 19:58: within 10 min before 20:00
        ],
      }),
    );
    expect(frames.map((f) => f.timeUtc)).toEqual(["2026-10-26T20:00:20+00:00", "2026-10-26T20:20:20+00:00"]);
    expect(frames[0].flashes).toEqual([[-34.3, -70.96]]);
    expect(frames[1]).toMatchObject({ cold: [[-34.3, -70.85, -45]], flashes: [[-34.3, -70.84]] });
  });
});

describe("cloud image", () => {
  const box = { lat_min: -34.4, lat_max: -34.2, lon_min: -70.9, lon_max: -70.7 };
  const at = (img: ReturnType<typeof paintClouds>, lat: number, lon: number) => {
    const x = Math.floor((lon - box.lon_min) / 0.01);
    const y = Math.floor((box.lat_max - lat) / 0.01);
    return Array.from(img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));
  };

  it("fills each pixel's footprint and leaves the rest transparent", () => {
    const img = paintClouds([[-34.3, -70.8, -40]], box);
    expect([img.width, img.height]).toEqual([20, 20]);
    expect(at(img, -34.3, -70.8)).toEqual([242, 165, 58, 225]);
    expect(at(img, -34.25, -70.75)[3]).toBe(0);
  });

  it("keeps the colder pixel where two overlap", () => {
    const img = paintClouds(
      [
        [-34.3, -70.8, -52],
        [-34.301, -70.801, -39],
      ],
      box,
    );
    expect(at(img, -34.3, -70.8).slice(0, 3)).toEqual([194, 38, 27]);
  });

  it("covers the pipeline's mapped area by default", () => {
    expect(paintClouds([], DEFAULT_BBOX)).toMatchObject({ width: 300, height: 200 });
  });
});
