import { describe, expect, it } from "vitest";
import { coarsePoint, compassFrom, parseWeather, rainOutlook, weatherUrl } from "./weather";

describe("weather", () => {
  it("sends only a point rounded to the 0.05° grid", () => {
    expect(coarsePoint(-34.1712, -70.7449)).toEqual([-34.15, -70.75]);
    const url = new URL(weatherUrl(-34.1712, -70.7449));
    expect(url.searchParams.get("latitude")).toBe("-34.15");
    expect(url.searchParams.get("longitude")).toBe("-70.75");
  });

  it("names where the wind comes from", () => {
    expect(compassFrom(0)).toBe("N");
    expect(compassFrom(270)).toBe("O");
    expect(compassFrom(225)).toBe("SO");
    expect(compassFrom(350)).toBe("N");
    expect(compassFrom(-90)).toBe("O");
  });

  it("reads current conditions and sums the last hour of rain", () => {
    const weather = parseWeather({
      current: {
        time: "2026-11-05T17:45",
        temperature_2m: 18.4,
        apparent_temperature: 16.1,
        relative_humidity_2m: 64,
        wind_speed_10m: 22.3,
        wind_direction_10m: 268,
        wind_gusts_10m: 38,
      },
      minutely_15: { precipitation: [0.2, null, 0.3, 0.05] },
      hourly: {
        time: ["17:00", "18:00", "19:00", "20:00"].map((t) => `2026-11-05T${t}`),
        precipitation_probability: [90, 20, 45, 80],
      },
    });
    expect(weather).toEqual({
      tempC: 18.4,
      feelsC: 16.1,
      humidity: 64,
      windKmh: 22.3,
      gustKmh: 38,
      windFrom: "O",
      rainMm: 0.6,
      rainChance: 45,
      at: "17:45",
    });
  });

  it("leaves the rain chance out when the model sends none", () => {
    expect(parseWeather({ current: { time: "2026-11-05T17:45", temperature_2m: 18, apparent_temperature: 17, relative_humidity_2m: 50, wind_speed_10m: 5, wind_direction_10m: 0, wind_gusts_10m: 9 } })?.rainChance).toBeNull();
  });

  it("puts the chance of rain into the bands the scoring supports", () => {
    expect([0, 1, 30, 31, 90, 91, 100].map(rainOutlook)).toEqual([
      "sin lluvia prevista",
      "lluvia poco probable",
      "lluvia poco probable",
      "lluvia posible",
      "lluvia posible",
      "lluvia probable",
      "lluvia probable",
    ]);
  });

  it("returns nothing for an answer without current conditions", () => {
    expect(parseWeather({})).toBeNull();
  });
});
