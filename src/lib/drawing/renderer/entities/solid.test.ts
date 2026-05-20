import { describe, expect, it } from "vitest";
import type { DwgSolidEntity } from "@mlightcad/libredwg-web";
import { renderSolid } from "./solid";
import { Extents } from "../extents";
import { IDENTITY_MAT } from "../types";
import { asEntity, makeContext } from "../__fixtures";

describe("renderSolid", () => {
  it("emits a filled <polygon> in c1-c2-c4-c3 winding order (not c1-c2-c3-c4)", () => {
    const ctx = makeContext();
    const extents = new Extents();
    extents.beginEntity();
    const entity = asEntity<DwgSolidEntity>({
      layer: "0",
      corner1: { x: 0, y: 0 },
      corner2: { x: 10, y: 0 },
      corner3: { x: 0, y: 10 },
      corner4: { x: 10, y: 10 },
    });
    const svg = renderSolid(entity, ctx, IDENTITY_MAT, extents);
    // Points must list c1, c2, c4, c3 — DXF SOLID winding is intentionally
    // non-quadrilateral order.
    expect(svg).toContain('points="0,0 10,0 10,10 0,10"');
    expect(svg).toContain("<polygon");
    expect(svg).toContain("fill=");
  });

  it("falls back corner4 = corner3 when corner4 is missing (triangle SOLID)", () => {
    const ctx = makeContext();
    const extents = new Extents();
    extents.beginEntity();
    const entity = asEntity<DwgSolidEntity>({
      layer: "0",
      corner1: { x: 0, y: 0 },
      corner2: { x: 10, y: 0 },
      corner3: { x: 5, y: 8 },
      // corner4 omitted
    });
    const svg = renderSolid(entity, ctx, IDENTITY_MAT, extents);
    // c4 should mirror c3, producing 0,0 10,0 5,8 5,8.
    expect(svg).toContain('points="0,0 10,0 5,8 5,8"');
  });

  it("expands extents to cover all four corners", () => {
    const ctx = makeContext();
    const extents = new Extents();
    extents.beginEntity();
    const entity = asEntity<DwgSolidEntity>({
      layer: "0",
      corner1: { x: 0, y: 0 },
      corner2: { x: 10, y: 0 },
      corner3: { x: 0, y: 10 },
      corner4: { x: 10, y: 10 },
    });
    renderSolid(entity, ctx, IDENTITY_MAT, extents);
    extents.finalizeLastEntity();
    const box = extents.result();
    expect(box.minX).toBeLessThanOrEqual(0);
    expect(box.minY).toBeLessThanOrEqual(0);
    expect(box.maxX).toBeGreaterThanOrEqual(10);
    expect(box.maxY).toBeGreaterThanOrEqual(10);
  });
});
