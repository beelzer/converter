import { describe, expect, it } from "vitest";
import { contrastRatio, relativeLuminance, wcag } from "./contrast";
import type { Rgb } from "./convert";

const rgb = (r: number, g: number, b: number): Rgb => ({ r, g, b, a: 1 });

describe("relativeLuminance", () => {
  it("returns 0 for pure black and 1 for pure white", () => {
    expect(relativeLuminance(rgb(0, 0, 0))).toBeCloseTo(0, 4);
    expect(relativeLuminance(rgb(255, 255, 255))).toBeCloseTo(1, 4);
  });

  it("uses the Rec. 709 weights — green contributes most", () => {
    const r = relativeLuminance(rgb(255, 0, 0));
    const g = relativeLuminance(rgb(0, 255, 0));
    const b = relativeLuminance(rgb(0, 0, 255));
    expect(g).toBeGreaterThan(r);
    expect(r).toBeGreaterThan(b);
  });
});

describe("contrastRatio", () => {
  it("black on white = 21:1, the WCAG maximum", () => {
    const ratio = contrastRatio(rgb(0, 0, 0), rgb(255, 255, 255));
    expect(ratio).toBeCloseTo(21, 0);
  });

  it("identical foreground/background = 1:1", () => {
    expect(contrastRatio(rgb(50, 100, 150), rgb(50, 100, 150))).toBeCloseTo(1, 4);
  });

  it("is symmetric — swapping fg/bg yields the same ratio", () => {
    const a = contrastRatio(rgb(255, 100, 50), rgb(40, 40, 40));
    const b = contrastRatio(rgb(40, 40, 40), rgb(255, 100, 50));
    expect(a).toBeCloseTo(b, 6);
  });
});

describe("wcag verdict", () => {
  it("black on white passes everything", () => {
    const v = wcag(rgb(0, 0, 0), rgb(255, 255, 255));
    expect(v.aaNormal).toBe(true);
    expect(v.aaLarge).toBe(true);
    expect(v.aaaNormal).toBe(true);
    expect(v.aaaLarge).toBe(true);
  });

  it("identical colours fail everything", () => {
    const v = wcag(rgb(120, 120, 120), rgb(120, 120, 120));
    expect(v.aaNormal).toBe(false);
    expect(v.aaLarge).toBe(false);
    expect(v.aaaNormal).toBe(false);
    expect(v.aaaLarge).toBe(false);
  });

  it("a mid-grey on white passes AA large but not AA normal", () => {
    // #808080 (128/255) on white yields a contrast ratio around 3.95.
    const v = wcag(rgb(0x80, 0x80, 0x80), rgb(255, 255, 255));
    expect(v.aaLarge).toBe(true);
    expect(v.aaNormal).toBe(false);
    expect(v.ratio).toBeGreaterThan(3);
    expect(v.ratio).toBeLessThan(4.5);
  });
});
