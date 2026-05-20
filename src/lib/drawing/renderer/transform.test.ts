import { describe, expect, it } from "vitest";
import {
  matrixToSvg,
  multiply,
  rotation,
  scale,
  scaleMagnitude,
  transformPoint,
  translation,
} from "./transform";
import { IDENTITY_MAT, type Mat3 } from "./types";

const approx = (actual: number, expected: number, tolerance = 1e-9) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
};

describe("translation / rotation / scale", () => {
  it("translation by (10, 20) moves origin to (10, 20)", () => {
    const t = translation(10, 20);
    const p = transformPoint(t, 0, 0);
    expect(p).toEqual({ x: 10, y: 20 });
  });

  it("rotation by π/2 sends (1, 0) to (0, 1)", () => {
    const r = rotation(Math.PI / 2);
    const p = transformPoint(r, 1, 0);
    approx(p.x, 0);
    approx(p.y, 1);
  });

  it("scale doubles each axis independently", () => {
    const s = scale(2, 3);
    const p = transformPoint(s, 4, 5);
    expect(p).toEqual({ x: 8, y: 15 });
  });
});

describe("multiply", () => {
  it("identity * M = M", () => {
    const m: Mat3 = [2, 0, 5, 0, 3, 7, 0, 0, 1];
    expect(multiply(IDENTITY_MAT, m)).toEqual(m);
    expect(multiply(m, IDENTITY_MAT)).toEqual(m);
  });

  it("composes translate-then-scale in the right order", () => {
    // INSERT applies translate(insertion) · rotate · scale.
    // For pt (1, 1), scale by 2 → (2, 2), then translate by (10, 20) → (12, 22).
    const composed = multiply(translation(10, 20), scale(2, 2));
    const p = transformPoint(composed, 1, 1);
    expect(p).toEqual({ x: 12, y: 22 });
  });
});

describe("scaleMagnitude", () => {
  it("returns 1 for the identity", () => {
    expect(scaleMagnitude(IDENTITY_MAT)).toBe(1);
  });

  it("returns the geometric mean for non-uniform scales", () => {
    // sx=2, sy=8 → det = 16 → sqrt = 4.
    expect(scaleMagnitude(scale(2, 8))).toBeCloseTo(4, 6);
  });

  it("never returns 0 (callers divide by it)", () => {
    // A degenerate matrix with det = 0 should fall through to 1.
    const zero: Mat3 = [0, 0, 0, 0, 0, 0, 0, 0, 1];
    expect(scaleMagnitude(zero)).toBe(1);
  });
});

describe("matrixToSvg", () => {
  it("returns empty string for identity (CSS-optimal: no attribute emitted)", () => {
    expect(matrixToSvg(IDENTITY_MAT)).toBe("");
  });

  it("emits SVG-style column-major matrix(a,b,c,d,e,f)", () => {
    // Build [a,c,e, b,d,f, 0,0,1] equivalent.
    const m: Mat3 = [2, 3, 10, 4, 5, 20, 0, 0, 1];
    expect(matrixToSvg(m)).toBe("matrix(2,4,3,5,10,20)");
  });

  it("clips trailing zeros in numeric serialisation", () => {
    const t = translation(10, 20);
    expect(matrixToSvg(t)).toBe("matrix(1,0,0,1,10,20)");
  });
});
