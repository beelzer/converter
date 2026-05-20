import { describe, expect, it } from "vitest";
import { Extents } from "./extents";
import { IDENTITY_MAT } from "./types";

describe("Extents — basic expansion", () => {
  it("returns a unit-square placeholder when nothing was expanded", () => {
    const e = new Extents();
    e.finalizeLastEntity();
    expect(e.result()).toEqual({ minX: 0, minY: 0, maxX: 1, maxY: 1 });
  });

  it("brackets a single entity with begin / finalize", () => {
    const e = new Extents();
    e.beginEntity();
    e.expand(0, 0);
    e.expand(10, 20);
    e.finalizeLastEntity();
    const box = e.result();
    // Padding adds 2% on each side (or 1 for zero-sized axes).
    expect(box.minX).toBeLessThan(0);
    expect(box.minY).toBeLessThan(0);
    expect(box.maxX).toBeGreaterThan(10);
    expect(box.maxY).toBeGreaterThan(20);
  });

  it("transforms points through a matrix in expandPoint", () => {
    const e = new Extents();
    e.beginEntity();
    e.expandPoint({ x: 1, y: 1 }, IDENTITY_MAT);
    e.expandPoint({ x: 2, y: 3 }, IDENTITY_MAT);
    e.finalizeLastEntity();
    const box = e.result();
    expect(box.minX).toBeLessThanOrEqual(1);
    expect(box.maxY).toBeGreaterThanOrEqual(3);
  });

  it("ignores non-finite coordinates without throwing", () => {
    const e = new Extents();
    e.beginEntity();
    e.expand(NaN, NaN);
    e.expand(Infinity, Infinity);
    e.expand(5, 5);
    e.finalizeLastEntity();
    const box = e.result();
    expect(Number.isFinite(box.minX)).toBe(true);
    expect(Number.isFinite(box.maxY)).toBe(true);
  });

  it("expandCircle covers the circle's bounding square", () => {
    const e = new Extents();
    e.beginEntity();
    e.expandCircle(10, 20, 5, IDENTITY_MAT);
    e.finalizeLastEntity();
    const box = e.result();
    // Centre 10,20 radius 5 → world bbox 5..15 × 15..25 (plus padding).
    expect(box.minX).toBeLessThanOrEqual(5);
    expect(box.maxX).toBeGreaterThanOrEqual(15);
    expect(box.minY).toBeLessThanOrEqual(15);
    expect(box.maxY).toBeGreaterThanOrEqual(25);
  });
});

describe("Extents — outlierIndices", () => {
  it("returns an empty set when there are fewer than 4 entities", () => {
    const e = new Extents();
    e.beginEntity();
    e.expand(0, 0);
    e.expand(1, 1);
    e.beginEntity();
    e.expand(2, 2);
    e.finalizeLastEntity();
    expect(e.outlierIndices().size).toBe(0);
  });

  it("flags entities whose bbox diagonal is >100× the median", () => {
    const e = new Extents();
    // Five small entities, each with diagonal ~1.4.
    for (let i = 0; i < 5; i++) {
      e.beginEntity();
      e.expand(0, 0);
      e.expand(1, 1);
    }
    // One outlier with diagonal ~14142.
    e.beginEntity();
    e.expand(0, 0);
    e.expand(10_000, 10_000);
    e.finalizeLastEntity();
    const outliers = e.outlierIndices();
    expect(outliers.size).toBe(1);
    expect(outliers.has(5)).toBe(true);
  });

  it("excludes outlier indices from the combined result", () => {
    const e = new Extents();
    for (let i = 0; i < 5; i++) {
      e.beginEntity();
      e.expand(0, 0);
      e.expand(1, 1);
    }
    e.beginEntity();
    e.expand(0, 0);
    e.expand(10_000, 10_000);
    e.finalizeLastEntity();
    const outliers = e.outlierIndices();
    const box = e.result(outliers);
    // The combined bbox should reflect the small entities, not the giant outlier.
    expect(box.maxX).toBeLessThan(100);
    expect(box.maxY).toBeLessThan(100);
  });
});
