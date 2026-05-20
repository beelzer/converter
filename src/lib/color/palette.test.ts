import { describe, expect, it } from "vitest";
import { HARMONIES, HARMONY_LABEL, harmony } from "./palette";
import { rgbToHsl, type Rgb } from "./convert";

const RED: Rgb = { r: 255, g: 0, b: 0, a: 1 };

describe("HARMONIES + HARMONY_LABEL", () => {
  it("has a label for every harmony kind", () => {
    for (const kind of HARMONIES) {
      expect(HARMONY_LABEL[kind]).toBeTruthy();
    }
  });
});

describe("harmony arity", () => {
  it("complementary returns 2 colours", () => {
    expect(harmony(RED, "complementary")).toHaveLength(2);
  });

  it("analogous returns 3", () => {
    expect(harmony(RED, "analogous")).toHaveLength(3);
  });

  it("triadic returns 3", () => {
    expect(harmony(RED, "triadic")).toHaveLength(3);
  });

  it("tetradic returns 4", () => {
    expect(harmony(RED, "tetradic")).toHaveLength(4);
  });

  it("split-complementary returns 3", () => {
    expect(harmony(RED, "split-complementary")).toHaveLength(3);
  });

  it("monochromatic returns 5 brightness steps", () => {
    expect(harmony(RED, "monochromatic")).toHaveLength(5);
  });
});

describe("harmony geometry", () => {
  it("complementary rotates the hue by 180°", () => {
    const [base, complement] = harmony(RED, "complementary");
    expect(rgbToHsl(base).h).toBeCloseTo(0, 1);
    expect(rgbToHsl(complement).h).toBeCloseTo(180, 1);
  });

  it("triadic spaces hues by 120°", () => {
    const [a, b, c] = harmony(RED, "triadic").map(rgbToHsl);
    expect(a.h).toBeCloseTo(0, 1);
    expect(b.h).toBeCloseTo(120, 1);
    expect(c.h).toBeCloseTo(240, 1);
  });

  it("tetradic spaces hues by 90°", () => {
    const hues = harmony(RED, "tetradic").map((c) => rgbToHsl(c).h);
    expect(hues[0]).toBeCloseTo(0, 1);
    expect(hues[1]).toBeCloseTo(90, 1);
    expect(hues[2]).toBeCloseTo(180, 1);
    expect(hues[3]).toBeCloseTo(270, 1);
  });

  it("monochromatic keeps hue constant but varies lightness", () => {
    const swatches = harmony(RED, "monochromatic").map(rgbToHsl);
    // Hue can shift slightly when l hits 0/100 because s collapses — accept either 0 or NaN.
    for (const s of swatches) {
      if (!Number.isNaN(s.h)) expect(s.h).toBeCloseTo(0, 1);
    }
    // Lightnesses should be in ascending order.
    const ls = swatches.map((s) => s.l);
    for (let i = 1; i < ls.length; i++) {
      expect(ls[i]).toBeGreaterThanOrEqual(ls[i - 1] - 0.5);
    }
  });
});
