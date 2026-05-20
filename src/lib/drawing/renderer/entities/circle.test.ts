import { describe, expect, it } from "vitest";
import type { DwgCircleEntity } from "@mlightcad/libredwg-web";
import { renderCircle } from "./circle";
import { Extents } from "../extents";
import { scale, translation, multiply } from "../transform";
import { IDENTITY_MAT } from "../types";
import { asEntity, makeContext } from "../__fixtures";

describe("renderCircle", () => {
  it("emits a <circle> with the world-space centre and radius", () => {
    const ctx = makeContext();
    const extents = new Extents();
    extents.beginEntity();
    const entity = asEntity<DwgCircleEntity>({
      layer: "0",
      center: { x: 10, y: 20 },
      radius: 5,
    });
    const svg = renderCircle(entity, ctx, IDENTITY_MAT, extents);
    expect(svg).toMatch(/^<circle cx="10" cy="20" r="5"/);
    expect(svg).toContain('fill="none"');
  });

  it("scales the radius by the parent matrix's scale magnitude", () => {
    const ctx = makeContext();
    const extents = new Extents();
    extents.beginEntity();
    const entity = asEntity<DwgCircleEntity>({
      layer: "0",
      center: { x: 0, y: 0 },
      radius: 5,
    });
    // 2× scale → radius doubles, centre stays (after translation accounted for).
    const svg = renderCircle(entity, ctx, multiply(translation(0, 0), scale(2, 2)), extents);
    expect(svg).toContain('r="10"');
  });

  it("expands extents by the circle's bbox", () => {
    const ctx = makeContext();
    const extents = new Extents();
    extents.beginEntity();
    const entity = asEntity<DwgCircleEntity>({
      layer: "0",
      center: { x: 10, y: 20 },
      radius: 5,
    });
    renderCircle(entity, ctx, IDENTITY_MAT, extents);
    extents.finalizeLastEntity();
    const box = extents.result();
    expect(box.minX).toBeLessThanOrEqual(5);
    expect(box.maxX).toBeGreaterThanOrEqual(15);
    expect(box.minY).toBeLessThanOrEqual(15);
    expect(box.maxY).toBeGreaterThanOrEqual(25);
  });
});
