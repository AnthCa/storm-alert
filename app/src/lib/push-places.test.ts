import { describe, expect, it } from "vitest";
import { isLegacy, toDraft, toPlace } from "./push-places";

const HERE = { lat: -34.1712, lon: -70.7449 };

describe("notification places", () => {
  it("places a town at its centre and names it after the town when unnamed", () => {
    expect(toPlace({ name: "  ", where: "Rengo" }, null, 25)).toEqual({ name: "Rengo", lat: -34.4, lon: -70.86, radius: 25 });
  });

  it("keeps the given name, trimmed and with single spaces", () => {
    expect(toPlace({ name: " Casa de   mis papás ", where: "San Fernando" }, null, 10)?.name).toBe("Casa de mis papás");
  });

  it("uses the marked point, coarsened to ~1 km", () => {
    expect(toPlace({ name: "Colegio", where: "here" }, HERE, 25)).toEqual({ name: "Colegio", lat: -34.17, lon: -70.74, radius: 25 });
  });

  it("has no place for the marked point when nothing is marked", () => {
    expect(toPlace({ name: "Mi casa", where: "here" }, null, 25)).toBeNull();
  });

  it("round-trips a saved point without moving it to the currently marked one", () => {
    const saved = { name: "Mi casa", lat: -34.2, lon: -70.9, radius: 25 as const };
    const draft = toDraft(saved);
    expect(draft.where).toBe("kept");
    expect(toPlace(draft, HERE, 25)).toEqual(saved);
    expect(toDraft({ ...saved, lat: -34.29, lon: -70.82 }).where).toBe("Requínoa");
  });

  it("recognises the single-place format of older versions", () => {
    expect(isLegacy({ radius: 25, place: "Rancagua" })).toBe(true);
    expect(isLegacy({ places: [] })).toBe(false);
    expect(isLegacy(null)).toBe(false);
  });
});
