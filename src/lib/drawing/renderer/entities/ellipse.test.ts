import { describe, expect, it } from "vitest";
import type { DwgEllipseEntity } from "@mlightcad/libredwg-web";
import { renderEllipse } from "./ellipse";
import { Extents } from "../extents";
import { IDENTITY_MAT } from "../types";
import { asEntity, makeContext } from "../__fixtures";

const TWO_PI = Math.PI * 2;

describe("renderEllipse — full ellipse", () => {
  it("wraps an <ellipse> in a transformed <g> when start=0 and end=2π", () => {
    const ctx = makeContext();
    const extents = new Extents();
    extents.beginEntity();
    const entity = asEntity<DwgEllipseEntity>({
      layer: "0",
      center: { x: 0, y: 0 },
      majorAxisEndPoint: { x: 10, y: 0 }, // major axis aligned with X
      axisRatio: 0.5, // minor = 5
      startAngle: 0,
      endAngle: TWO_PI,
    });
    const svg = renderEllipse(entity, ctx, IDENTITY_MAT, extents);
    expect(svg).toMatch(/^<g transform="matrix\(/);
    expect(svg).toContain('<ellipse cx="0" cy="0" rx="10" ry="5"');
    expect(svg).toMatch(/<\/g>$/);
  });

  it("returns empty string when the major axis collapses to zero", () => {
    const ctx = makeContext();
    const extents = new Extents();
    extents.beginEntity();
    const entity = asEntity<DwgEllipseEntity>({
      layer: "0",
      center: { x: 0, y: 0 },
      majorAxisEndPoint: { x: 0, y: 0 },
      axisRatio: 0.5,
      startAngle: 0,
      endAngle: TWO_PI,
    });
    expect(renderEllipse(entity, ctx, IDENTITY_MAT, extents)).toBe("");
  });
});

describe("renderEllipse — partial ellipse", () => {
  it("emits a <path> with an A command for arc segments", () => {
    const ctx = makeContext();
    const extents = new Extents();
    extents.beginEntity();
    const entity = asEntity<DwgEllipseEntity>({
      layer: "0",
      center: { x: 0, y: 0 },
      majorAxisEndPoint: { x: 10, y: 0 },
      axisRatio: 0.5,
      startAngle: 0,
      endAngle: Math.PI, // half ellipse
    });
    const svg = renderEllipse(entity, ctx, IDENTITY_MAT, extents);
    expect(svg).toContain("<path d=\"M ");
    expect(svg).toContain(" A 10 5 0 ");
  });
});
