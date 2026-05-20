import { describe, expect, it } from "vitest";
import {
  clamp,
  cmykToRgb,
  formatCmyk,
  formatHex,
  formatHsl,
  formatOklch,
  formatRgb,
  hslToRgb,
  oklchToRgb,
  parseAny,
  parseHex,
  rgbToCmyk,
  rgbToHex,
  rgbToHsl,
  rgbToOklch,
  round,
  type Rgb,
} from "./convert";

const approx = (actual: number, expected: number, tolerance = 0.5) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
};

const RGB_BLACK: Rgb = { r: 0, g: 0, b: 0, a: 1 };
const RGB_WHITE: Rgb = { r: 255, g: 255, b: 255, a: 1 };
const RGB_RED: Rgb = { r: 255, g: 0, b: 0, a: 1 };
const RGB_GREEN: Rgb = { r: 0, g: 255, b: 0, a: 1 };
const RGB_BLUE: Rgb = { r: 0, g: 0, b: 255, a: 1 };
const RGB_TEAL: Rgb = { r: 38, g: 166, b: 154, a: 1 }; // arbitrary mid-saturation colour

describe("parseHex", () => {
  it("accepts 3/4/6/8-digit hex with or without #", () => {
    expect(parseHex("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseHex("fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseHex("#FFF8")).toEqual({ r: 255, g: 255, b: 255, a: 8 / 15 });
    expect(parseHex("#102030")).toEqual({ r: 0x10, g: 0x20, b: 0x30, a: 1 });
    expect(parseHex("#10203040")).toMatchObject({ r: 0x10, g: 0x20, b: 0x30 });
  });

  it("rejects non-hex / wrong-length input", () => {
    expect(parseHex("zzz")).toBeNull();
    expect(parseHex("#12")).toBeNull();
    expect(parseHex("#12345")).toBeNull();
    expect(parseHex("")).toBeNull();
  });
});

describe("rgbToHex / formatHex", () => {
  it("zero-pads each channel", () => {
    expect(rgbToHex({ r: 1, g: 2, b: 3, a: 1 })).toBe("#010203");
  });

  it("appends alpha only when alpha < 1 (or when explicitly requested)", () => {
    expect(rgbToHex({ r: 255, g: 0, b: 0, a: 1 })).toBe("#ff0000");
    expect(rgbToHex({ r: 255, g: 0, b: 0, a: 0.5 })).toMatch(/^#ff0000[0-9a-f]{2}$/);
    expect(rgbToHex({ r: 255, g: 0, b: 0, a: 1 }, true)).toMatch(/^#ff0000ff$/);
  });

  it("clamps + rounds out-of-range values", () => {
    expect(rgbToHex({ r: -5, g: 300, b: 128.6, a: 1 })).toBe("#00ff81");
  });

  it("formatHex matches rgbToHex without alpha", () => {
    expect(formatHex(RGB_TEAL)).toBe(rgbToHex(RGB_TEAL, false));
  });
});

describe("rgbToHsl ⇄ hslToRgb round-trip", () => {
  for (const sample of [RGB_BLACK, RGB_WHITE, RGB_RED, RGB_GREEN, RGB_BLUE, RGB_TEAL]) {
    it(`round-trips ${rgbToHex(sample)}`, () => {
      const hsl = rgbToHsl(sample);
      const round = hslToRgb(hsl);
      approx(round.r, sample.r);
      approx(round.g, sample.g);
      approx(round.b, sample.b);
    });
  }

  it("computes the expected pure-red HSL values", () => {
    const hsl = rgbToHsl(RGB_RED);
    expect(hsl.h).toBe(0);
    approx(hsl.s, 100, 0.01);
    approx(hsl.l, 50, 0.01);
  });
});

describe("rgbToCmyk ⇄ cmykToRgb round-trip", () => {
  it("pure black maps to k=100", () => {
    expect(rgbToCmyk(RGB_BLACK)).toEqual({ c: 0, m: 0, y: 0, k: 100 });
  });

  it("pure red maps to m=y=100, k=0", () => {
    const cmyk = rgbToCmyk(RGB_RED);
    approx(cmyk.c, 0);
    approx(cmyk.m, 100);
    approx(cmyk.y, 100);
    approx(cmyk.k, 0);
  });

  it("round-trips arbitrary RGB", () => {
    const cmyk = rgbToCmyk(RGB_TEAL);
    const back = cmykToRgb(cmyk);
    approx(back.r, RGB_TEAL.r);
    approx(back.g, RGB_TEAL.g);
    approx(back.b, RGB_TEAL.b);
  });
});

describe("rgbToOklch ⇄ oklchToRgb round-trip", () => {
  for (const sample of [RGB_BLACK, RGB_WHITE, RGB_RED, RGB_GREEN, RGB_BLUE, RGB_TEAL]) {
    it(`round-trips ${rgbToHex(sample)}`, () => {
      const oklch = rgbToOklch(sample);
      const back = oklchToRgb(oklch);
      approx(back.r, sample.r, 0.9);
      approx(back.g, sample.g, 0.9);
      approx(back.b, sample.b, 0.9);
    });
  }

  it("places hue inside [0, 360)", () => {
    const o = rgbToOklch({ r: 100, g: 50, b: 200, a: 1 });
    expect(o.h).toBeGreaterThanOrEqual(0);
    expect(o.h).toBeLessThan(360);
  });
});

describe("formatters", () => {
  it("format strings use CSS Color Module Level 4 syntax with space separators", () => {
    expect(formatRgb({ r: 255, g: 0, b: 0, a: 1 })).toBe("rgb(255 0 0)");
    expect(formatRgb({ r: 255, g: 0, b: 0, a: 0.5 })).toMatch(/^rgb\(255 0 0 \/ 0\.5\)$/);
    expect(formatHsl({ h: 120, s: 100, l: 50, a: 1 })).toBe("hsl(120 100% 50%)");
    expect(formatCmyk({ c: 0, m: 100, y: 100, k: 0 })).toBe("cmyk(0% 100% 100% 0%)");
    expect(formatOklch({ l: 0.5, c: 0.2, h: 30, a: 1 })).toMatch(/^oklch\(50%/);
  });
});

describe("parseAny", () => {
  it("dispatches on the leading function name / hex prefix", () => {
    expect(parseAny("#ff0000")).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    const fromRgb = parseAny("rgb(255 0 0)")!;
    expect(fromRgb.r).toBe(255);
    expect(fromRgb.g).toBe(0);
    expect(fromRgb.b).toBe(0);

    const fromHsl = parseAny("hsl(0 100% 50%)")!;
    approx(fromHsl.r, 255);
    approx(fromHsl.g, 0);
    approx(fromHsl.b, 0);
  });

  it("returns null on garbage / empty input", () => {
    expect(parseAny("")).toBeNull();
    expect(parseAny("nope")).toBeNull();
    expect(parseAny("rgb()")).toBeNull();
  });
});

describe("clamp / round helpers", () => {
  it("clamps to range", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(7, 0, 10)).toBe(7);
  });

  it("rounds to N decimal places", () => {
    expect(round(1.2345, 2)).toBe(1.23);
    expect(round(1.235, 2)).toBe(1.24);
    expect(round(1, 0)).toBe(1);
  });
});
