import { describe, expect, it } from "vitest";
import { REPORT_EVERY_MS, canReport, reportBody, toggleKind } from "./sky-report";
import { normalizeStatus } from "./status";

describe("sky reports", () => {
  it("adds and removes what was seen", () => {
    expect(toggleKind(["rain"], "thunder")).toEqual(["rain", "thunder"]);
    expect(toggleKind(["rain", "thunder"], "rain")).toEqual(["thunder"]);
  });

  it("keeps a clear sky apart from everything else", () => {
    expect(toggleKind(["rain", "hail"], "clear")).toEqual(["clear"]);
    expect(toggleKind(["clear"], "rain")).toEqual(["rain"]);
  });

  it("allows one report every ten minutes", () => {
    expect(canReport(null, 0)).toBe(true);
    expect(canReport(1_000, 1_000 + REPORT_EVERY_MS - 1)).toBe(false);
    expect(canReport(1_000, 1_000 + REPORT_EVERY_MS)).toBe(true);
  });

  it("sends the place, what was seen and what the app showed", () => {
    const status = normalizeStatus({
      level: "deep_convection",
      data_until_utc: "2026-11-10T03:30:00+00:00",
      cold_pixels: [[-34.28, -70.74, -45]],
    });
    expect(reportBody({ lat: -34.17, lon: -70.74 }, ["thunder"], status)).toEqual({
      lat: -34.17,
      lon: -70.74,
      seen: ["thunder"],
      app_level: "deep_convection",
      app_data_until: "2026-11-10T03:30:00+00:00",
      app_nearest_km: 12,
    });
  });

  it("has no distance when the satellite sees no storm", () => {
    const status = normalizeStatus({ level: "quiet", data_until_utc: "2026-11-10T03:30:00+00:00", health: { state: "healthy", problems: [], abi: { expected: 3, received: 3, latest_utc: null }, glm: { expected_files: 1, received_files: 1, latest_utc: null } } });
    expect(reportBody({ lat: -34.17, lon: -70.74 }, ["clear"], status).app_nearest_km).toBeNull();
  });
});
