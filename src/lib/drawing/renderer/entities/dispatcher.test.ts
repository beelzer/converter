import { describe, expect, it } from "vitest";
import type { DwgEntity } from "@mlightcad/libredwg-web";
import { renderEntity } from "./dispatcher";
import { Extents } from "../extents";
import { IDENTITY_MAT } from "../types";
import { asEntity, makeContext } from "../__fixtures";

const ctx = makeContext();
const extents = () => {
  const e = new Extents();
  e.beginEntity();
  return e;
};
const pattern = { next: 0 };

const dispatch = (entity: Partial<DwgEntity> & { type: string }) =>
  renderEntity(asEntity<DwgEntity>(entity), ctx, IDENTITY_MAT, extents(), pattern);

describe("renderEntity dispatcher", () => {
  it("dispatches LINE", () => {
    const svg = dispatch({
      type: "LINE",
      layer: "0",
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 1, y: 0 },
    } as never);
    expect(svg).toContain("<line ");
  });

  it("dispatches CIRCLE", () => {
    const svg = dispatch({
      type: "CIRCLE",
      layer: "0",
      center: { x: 0, y: 0 },
      radius: 5,
    } as never);
    expect(svg).toContain("<circle ");
  });

  it("dispatches ARC", () => {
    const svg = dispatch({
      type: "ARC",
      layer: "0",
      center: { x: 0, y: 0 },
      radius: 5,
      startAngle: 0,
      endAngle: 90,
    } as never);
    expect(svg).toContain("<path");
    expect(svg).toContain(" A ");
  });

  it("dispatches POINT", () => {
    const svg = dispatch({
      type: "POINT",
      layer: "0",
      position: { x: 0, y: 0 },
    } as never);
    expect(svg).toContain("<circle ");
  });

  it("dispatches SOLID and TRACE to the same renderer", () => {
    const make = (type: string) =>
      dispatch({
        type,
        layer: "0",
        corner1: { x: 0, y: 0 },
        corner2: { x: 1, y: 0 },
        corner3: { x: 0, y: 1 },
        corner4: { x: 1, y: 1 },
      } as never);
    expect(make("SOLID")).toContain("<polygon");
    expect(make("TRACE")).toContain("<polygon");
  });

  it("dispatches LWPOLYLINE", () => {
    const svg = dispatch({
      type: "LWPOLYLINE",
      layer: "0",
      flag: 0,
      vertices: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    } as never);
    expect(svg).toContain("<path");
  });

  it("dispatches POLYLINE2D / POLYLINE alias / POLYLINE3D", () => {
    const verts2d = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
    const verts3d = [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }];
    expect(dispatch({ type: "POLYLINE2D", layer: "0", flag: 0, vertices: verts2d } as never)).toContain("<path");
    expect(dispatch({ type: "POLYLINE", layer: "0", flag: 0, vertices: verts2d } as never)).toContain("<path");
    expect(dispatch({ type: "POLYLINE3D", layer: "0", flag: 0, vertices: verts3d } as never)).toContain("<path");
  });

  it("dispatches TEXT and MTEXT", () => {
    expect(
      dispatch({
        type: "TEXT",
        layer: "0",
        text: "Hi",
        startPoint: { x: 0, y: 0 },
        rotation: 0,
        textHeight: 10,
        halign: 0,
        valign: 0,
        xScale: 1,
      } as never)
    ).toContain("<text");
    expect(
      dispatch({
        type: "MTEXT",
        layer: "0",
        text: "Hi",
        insertionPoint: { x: 0, y: 0 },
        direction: { x: 0, y: 0 },
        rotation: 0,
        textHeight: 10,
        lineSpacing: 1,
        rectWidth: 100,
        attachmentPoint: 5,
      } as never)
    ).toContain("<text");
  });

  it("dispatches LEADER and WIPEOUT", () => {
    expect(
      dispatch({
        type: "LEADER",
        layer: "0",
        vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
        textHeight: 1,
      } as never)
    ).toContain("<path");
    expect(
      dispatch({
        type: "WIPEOUT",
        layer: "0",
        position: { x: 0, y: 0 },
        uPixel: { x: 1, y: 0 },
        vPixel: { x: 0, y: 1 },
        clippingBoundaryPath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
        ],
      } as never)
    ).toContain("<polygon");
  });

  it("dispatches ELLIPSE", () => {
    const svg = dispatch({
      type: "ELLIPSE",
      layer: "0",
      center: { x: 0, y: 0 },
      majorAxisEndPoint: { x: 10, y: 0 },
      axisRatio: 0.5,
      startAngle: 0,
      endAngle: Math.PI * 2,
    } as never);
    expect(svg).toContain("<ellipse");
  });

  it("dispatches SPLINE (control-polygon fallback)", () => {
    const svg = dispatch({
      type: "SPLINE",
      layer: "0",
      flag: 0,
      degree: 0,
      controlPoints: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }],
      knots: [],
      fitPoints: [],
    } as never);
    expect(svg).toContain("<path");
  });

  it("returns empty string for unsupported entity types (3DFACE, XLINE, IMAGE, etc.)", () => {
    expect(dispatch({ type: "3DFACE", layer: "0" } as never)).toBe("");
    expect(dispatch({ type: "XLINE", layer: "0" } as never)).toBe("");
    expect(dispatch({ type: "IMAGE", layer: "0" } as never)).toBe("");
    expect(dispatch({ type: "ATTDEF", layer: "0" } as never)).toBe("");
  });
});
