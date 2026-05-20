import { describe, expect, it } from "vitest";
import type { DwgLineEntity } from "@mlightcad/libredwg-web";
import { renderLine } from "./line";
import { Extents } from "../extents";
import { translation } from "../transform";
import { IDENTITY_MAT } from "../types";
import { asEntity, makeContext } from "../__fixtures";

describe("renderLine", () => {
  it("emits an <line> element with the world-space endpoints", () => {
    const ctx = makeContext();
    const extents = new Extents();
    extents.beginEntity();
    const entity = asEntity<DwgLineEntity>({
      layer: "0",
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 10, y: 5 },
    });
    const svg = renderLine(entity, ctx, IDENTITY_MAT, extents);
    expect(svg).toMatch(/^<line x1="0" y1="0" x2="10" y2="5"/);
    expect(svg).toContain("fill=\"none\"");
    expect(svg).toContain("stroke=");
  });

  it("transforms endpoints through the parent matrix", () => {
    const ctx = makeContext();
    const extents = new Extents();
    extents.beginEntity();
    const entity = asEntity<DwgLineEntity>({
      layer: "0",
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 10, y: 0 },
    });
    const svg = renderLine(entity, ctx, translation(100, 200), extents);
    expect(svg).toContain('x1="100"');
    expect(svg).toContain('y1="200"');
    expect(svg).toContain('x2="110"');
    expect(svg).toContain('y2="200"');
  });

  it("expands the extents to cover both endpoints", () => {
    const ctx = makeContext();
    const extents = new Extents();
    extents.beginEntity();
    const entity = asEntity<DwgLineEntity>({
      layer: "0",
      startPoint: { x: -5, y: -3 },
      endPoint: { x: 15, y: 8 },
    });
    renderLine(entity, ctx, IDENTITY_MAT, extents);
    extents.finalizeLastEntity();
    const box = extents.result();
    expect(box.minX).toBeLessThanOrEqual(-5);
    expect(box.minY).toBeLessThanOrEqual(-3);
    expect(box.maxX).toBeGreaterThanOrEqual(15);
    expect(box.maxY).toBeGreaterThanOrEqual(8);
  });
});
