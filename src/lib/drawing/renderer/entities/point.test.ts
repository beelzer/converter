import { describe, expect, it } from "vitest";
import type { DwgPointEntity } from "@mlightcad/libredwg-web";
import { renderPoint } from "./point";
import { Extents } from "../extents";
import { translation } from "../transform";
import { IDENTITY_MAT } from "../types";
import { asEntity, makeContext } from "../__fixtures";

describe("renderPoint", () => {
  it("emits a tiny filled <circle> at the entity position", () => {
    const ctx = makeContext();
    const extents = new Extents();
    extents.beginEntity();
    const entity = asEntity<DwgPointEntity>({
      layer: "0",
      position: { x: 5, y: 7 },
    });
    const svg = renderPoint(entity, ctx, IDENTITY_MAT, extents);
    expect(svg).toMatch(/^<circle cx="5" cy="7" /);
    expect(svg).toContain("fill=");
    expect(svg).toContain('stroke="none"');
  });

  it("honours the parent translation", () => {
    const ctx = makeContext();
    const extents = new Extents();
    extents.beginEntity();
    const entity = asEntity<DwgPointEntity>({
      layer: "0",
      position: { x: 0, y: 0 },
    });
    const svg = renderPoint(entity, ctx, translation(100, 50), extents);
    expect(svg).toContain('cx="100"');
    expect(svg).toContain('cy="50"');
  });
});
