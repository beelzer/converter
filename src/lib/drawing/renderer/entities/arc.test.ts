import { describe, expect, it } from "vitest";
import type { DwgArcEntity } from "@mlightcad/libredwg-web";
import { renderArc } from "./arc";
import { Extents } from "../extents";
import { IDENTITY_MAT } from "../types";
import { asEntity, makeContext } from "../__fixtures";

describe("renderArc", () => {
  it("emits a <path> with M then A (arc) command", () => {
    const ctx = makeContext();
    const extents = new Extents();
    extents.beginEntity();
    // A quarter-circle from angle 0° to 90°, radius 10, centre (0, 0).
    const entity = asEntity<DwgArcEntity>({
      layer: "0",
      center: { x: 0, y: 0 },
      radius: 10,
      startAngle: 0,
      endAngle: 90,
    });
    const svg = renderArc(entity, ctx, IDENTITY_MAT, extents);
    expect(svg).toMatch(/^<path d="M 10 0 A 10 10 0 0 1 /);
    // Endpoint at (0, 10) — tolerate fp rounding.
    expect(svg).toMatch(/A 10 10 0 0 1 [-0]?\.?\d* 10/);
  });

  it("normalises an end-angle that wraps below the start (e.g. 350° → 10°)", () => {
    const ctx = makeContext();
    const extents = new Extents();
    extents.beginEntity();
    const entity = asEntity<DwgArcEntity>({
      layer: "0",
      center: { x: 0, y: 0 },
      radius: 5,
      startAngle: 350,
      endAngle: 10, // sweeps through 0°
    });
    const svg = renderArc(entity, ctx, IDENTITY_MAT, extents);
    // The function should still produce a valid <path A …> output.
    expect(svg).toContain("<path d=\"M ");
    expect(svg).toContain(" A 5 5 0 ");
  });

  it("flips the large-arc flag when the sweep exceeds 180°", () => {
    const ctx = makeContext();
    const extents = new Extents();
    extents.beginEntity();
    const entity = asEntity<DwgArcEntity>({
      layer: "0",
      center: { x: 0, y: 0 },
      radius: 5,
      startAngle: 0,
      endAngle: 270,
    });
    const svg = renderArc(entity, ctx, IDENTITY_MAT, extents);
    // …A r r 0 largeArc sweep …
    const match = svg.match(/A \S+ \S+ 0 (\d) (\d)/);
    expect(match?.[1]).toBe("1"); // largeArc
    expect(match?.[2]).toBe("1"); // sweep is always 1 after CCW normalisation
  });
});
