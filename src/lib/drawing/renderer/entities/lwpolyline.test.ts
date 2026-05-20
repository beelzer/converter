import { describe, expect, it } from "vitest";
import type { DwgLWPolylineVertex } from "@mlightcad/libredwg-web";
import { polylinePath } from "./lwpolyline";
import { Extents } from "../extents";
import { IDENTITY_MAT } from "../types";

const vert = (x: number, y: number, bulge = 0): DwgLWPolylineVertex =>
  ({ x, y, bulge } as unknown as DwgLWPolylineVertex);

describe("polylinePath", () => {
  it("returns an empty string for an empty vertex list", () => {
    const extents = new Extents();
    expect(polylinePath([], false, IDENTITY_MAT, extents)).toBe("");
  });

  it("emits M…L… for a straight polyline", () => {
    const extents = new Extents();
    extents.beginEntity();
    const d = polylinePath(
      [vert(0, 0), vert(10, 0), vert(10, 5)],
      false,
      IDENTITY_MAT,
      extents
    );
    expect(d).toMatch(/^M 0 0 L 10 0 L 10 5 $/);
  });

  it("closes the path with Z when closed=true", () => {
    const extents = new Extents();
    extents.beginEntity();
    const d = polylinePath(
      [vert(0, 0), vert(10, 0), vert(10, 5)],
      true,
      IDENTITY_MAT,
      extents
    );
    expect(d).toContain("L 0 0"); // last segment goes back to first
    expect(d.trim().endsWith("Z")).toBe(true);
  });

  it("renders a bulge segment as an SVG A (arc) command", () => {
    const extents = new Extents();
    extents.beginEntity();
    // Two vertices 10 units apart with a bulge of 1 (semicircle, theta = π).
    const d = polylinePath(
      [vert(0, 0, 1), vert(10, 0)],
      false,
      IDENTITY_MAT,
      extents
    );
    expect(d).toMatch(/^M 0 0 A /);
    // For bulge = 1, theta = 4·atan(1) = π, radius = chord/2 = 5, large-arc flag = 0.
    expect(d).toContain(" 5 5 0 ");
  });

  it("largeArc flag is set when |bulge| > 1", () => {
    const extents = new Extents();
    extents.beginEntity();
    const d = polylinePath(
      [vert(0, 0, 2), vert(10, 0)],
      false,
      IDENTITY_MAT,
      extents
    );
    // …A r r 0 largeArc sweep x y… → bulge=2 should produce largeArc=1.
    const arcMatch = d.match(/A [\d.]+ [\d.]+ 0 (\d) (\d)/);
    expect(arcMatch?.[1]).toBe("1");
  });

  it("sweep direction follows the sign of the bulge", () => {
    const extents = new Extents();
    extents.beginEntity();
    const ccw = polylinePath([vert(0, 0, 0.5), vert(10, 0)], false, IDENTITY_MAT, extents);
    const cw = polylinePath([vert(0, 0, -0.5), vert(10, 0)], false, IDENTITY_MAT, new Extents());
    const ccwSweep = ccw.match(/A [\d.]+ [\d.]+ 0 \d (\d)/)?.[1];
    const cwSweep = cw.match(/A [\d.]+ [\d.]+ 0 \d (\d)/)?.[1];
    expect(ccwSweep).toBe("1");
    expect(cwSweep).toBe("0");
  });
});
