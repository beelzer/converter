import { describe, expect, it } from "vitest";
import type { DwgWipeoutEntity } from "@mlightcad/libredwg-web";
import { renderWipeout } from "./wipeout";
import { Extents } from "../extents";
import { IDENTITY_MAT } from "../types";
import { asEntity } from "../__fixtures";

describe("renderWipeout", () => {
  const extents = () => {
    const e = new Extents();
    e.beginEntity();
    return e;
  };

  it("returns empty when there are fewer than three boundary points", () => {
    expect(
      renderWipeout(
        asEntity<DwgWipeoutEntity>({ clippingBoundaryPath: [{ x: 0, y: 0 }] }),
        IDENTITY_MAT,
        extents()
      )
    ).toBe("");
  });

  it("emits a white-filled <polygon> covering the boundary", () => {
    const svg = renderWipeout(
      asEntity<DwgWipeoutEntity>({
        position: { x: 0, y: 0 },
        uPixel: { x: 1, y: 0 },
        vPixel: { x: 0, y: 1 },
        clippingBoundaryPath: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 5 },
          { x: 0, y: 5 },
        ],
      }),
      IDENTITY_MAT,
      extents()
    );
    expect(svg).toBe(
      '<polygon points="0,0 10,0 10,5 0,5" fill="#ffffff" stroke="none" />'
    );
  });

  it("applies position + uPixel/vPixel basis to each boundary point", () => {
    // u = (2, 0), v = (0, 3) → boundary point (1, 1) lands at (position + 2, position + 3).
    const svg = renderWipeout(
      asEntity<DwgWipeoutEntity>({
        position: { x: 100, y: 200 },
        uPixel: { x: 2, y: 0 },
        vPixel: { x: 0, y: 3 },
        clippingBoundaryPath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
        ],
      }),
      IDENTITY_MAT,
      extents()
    );
    expect(svg).toContain("100,200");
    expect(svg).toContain("102,200");
    expect(svg).toContain("102,203");
  });
});
