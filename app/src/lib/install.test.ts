import { describe, expect, it } from "vitest";
import { installKind } from "./install";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15";

describe("installKind", () => {
  it("knows an installed app, whatever the browser", () => {
    expect(installKind(ANDROID, true, true)).toBe("installed");
  });

  it("prefers the native dialog when the browser offers it", () => {
    expect(installKind(ANDROID, false, true)).toBe("prompt");
  });

  it("gives manual steps on iPhone, iPad and other Android browsers", () => {
    expect(installKind(IPHONE, false, false)).toBe("ios");
    expect(installKind(`${MAC} Mobile`, false, false)).toBe("ios");
    expect(installKind(ANDROID, false, false)).toBe("android");
  });

  it("sends computers to the QR code", () => {
    expect(installKind(MAC, false, false)).toBe("desktop");
  });
});
