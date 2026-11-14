import { describe, expect, it } from "vitest";
import { skyAlpha } from "./cloud-image";

describe("skyAlpha", () => {
  it("hides warm tops when cloud is only guessed from temperature", () => {
    expect(skyAlpha(13)).toBe(0);
  });

  it("keeps low cloud confirmed by NOAA's mask faintly visible", () => {
    expect(skyAlpha(13, true)).toBeGreaterThan(0);
    expect(skyAlpha(13, true)).toBeLessThan(skyAlpha(-35, true));
  });

  it("draws cold tops the same either way", () => {
    expect(skyAlpha(-35, true)).toBe(skyAlpha(-35));
  });
});
