import { describe, expect, it } from "vitest";
import type {
  DwgPolyline2dEntity,
  DwgPolyline3dEntity,
} from "@mlightcad/libredwg-web";
import { renderPolyline2d, renderPolyline3d } from "./polyline";
import { Extents } from "../extents";
import { IDENTITY_MAT } from "../types";
import { asEntity, makeContext } from "../__fixtures";

const vert = (x: number, y: number, bulge = 0) => ({ x, y, bulge });

describe("renderPolyline2d", () => {
  it("returns empty string for an empty vertex list", () => {
    const ctx = makeContext();
    const entity = asEntity<DwgPolyline2dEntity>({ flag: 0, vertices: [] });
    expect(renderPolyline2d(entity, ctx, IDENTITY_MAT, new Extents())).toBe("");
  });

  it("emits a <path> for an open polyline", () => {
    const ctx = makeContext();
    const extents = new Extents();
    extents.beginEntity();
    const entity = asEntity<DwgPolyline2dEntity>({
      layer: "0",
      flag: 0,
      vertices: [vert(0, 0), vert(10, 0), vert(10, 5)],
    });
    const svg = renderPolyline2d(entity, ctx, IDENTITY_MAT, extents);
    expect(svg).toMatch(/^<path d="M 0 0 L 10 0 L 10 5 /);
    expect(svg).not.toMatch(/Z/);
  });

  it("closes the path when the closed flag (bit 1) is set", () => {
    const ctx = makeContext();
    const extents = new Extents();
    extents.beginEntity();
    const entity = asEntity<DwgPolyline2dEntity>({
      layer: "0",
      flag: 1,
      vertices: [vert(0, 0), vert(10, 0), vert(10, 5)],
    });
    const svg = renderPolyline2d(entity, ctx, IDENTITY_MAT, extents);
    expect(svg).toMatch(/Z"/);
  });

  it("handles bulges by emitting A (arc) segments", () => {
    const ctx = makeContext();
    const extents = new Extents();
    extents.beginEntity();
    const entity = asEntity<DwgPolyline2dEntity>({
      layer: "0",
      flag: 0,
      vertices: [vert(0, 0, 1), vert(10, 0)],
    });
    const svg = renderPolyline2d(entity, ctx, IDENTITY_MAT, extents);
    expect(svg).toContain("A 5 5 0 ");
  });
});

describe("renderPolyline3d", () => {
  it("projects 3D vertices to XY and never emits arcs", () => {
    const ctx = makeContext();
    const extents = new Extents();
    extents.beginEntity();
    const entity = asEntity<DwgPolyline3dEntity>({
      layer: "0",
      flag: 0,
      vertices: [
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 0, z: 5 },
        { x: 10, y: 5, z: 3 },
      ],
    });
    const svg = renderPolyline3d(entity, ctx, IDENTITY_MAT, extents);
    expect(svg).toContain("M 0 0");
    expect(svg).toContain("L 10 0");
    expect(svg).toContain("L 10 5");
    expect(svg).not.toContain(" A ");
  });

  it("returns empty string for an empty 3D polyline", () => {
    const ctx = makeContext();
    const entity = asEntity<DwgPolyline3dEntity>({ flag: 0, vertices: [] });
    expect(renderPolyline3d(entity, ctx, IDENTITY_MAT, new Extents())).toBe("");
  });

  it("closes the 3D polyline when flag bit 1 is set", () => {
    const ctx = makeContext();
    const extents = new Extents();
    extents.beginEntity();
    const entity = asEntity<DwgPolyline3dEntity>({
      layer: "0",
      flag: 1,
      vertices: [
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
        { x: 10, y: 5, z: 0 },
      ],
    });
    const svg = renderPolyline3d(entity, ctx, IDENTITY_MAT, extents);
    expect(svg).toMatch(/Z"/);
  });
});
