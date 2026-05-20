import { describe, expect, it } from "vitest";
import type { DwgLeaderEntity } from "@mlightcad/libredwg-web";
import { arrowhead, renderLeader } from "./leader";
import { Extents } from "../extents";
import { IDENTITY_MAT } from "../types";
import { asEntity, makeContext } from "../__fixtures";

describe("renderLeader", () => {
  const ctx = makeContext();
  const extents = () => {
    const e = new Extents();
    e.beginEntity();
    return e;
  };

  it("returns empty string when there are fewer than two vertices", () => {
    expect(
      renderLeader(asEntity<DwgLeaderEntity>({ vertices: [] }), ctx, IDENTITY_MAT, extents())
    ).toBe("");
    expect(
      renderLeader(asEntity<DwgLeaderEntity>({ vertices: [{ x: 0, y: 0 }] }), ctx, IDENTITY_MAT, extents())
    ).toBe("");
  });

  it("emits a <path> of M…L… through the vertex sequence and an arrowhead by default", () => {
    const svg = renderLeader(
      asEntity<DwgLeaderEntity>({
        layer: "0",
        vertices: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 20, y: 10 },
        ],
        textHeight: 1,
      }),
      ctx,
      IDENTITY_MAT,
      extents()
    );
    expect(svg).toContain('<path d="M 0 0 L 10 0 L 20 10');
    // Arrowhead = <polygon …>
    expect(svg).toContain("<polygon");
  });

  it("omits the arrowhead when isArrowheadEnabled is explicitly false", () => {
    const svg = renderLeader(
      asEntity<DwgLeaderEntity>({
        layer: "0",
        vertices: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        isArrowheadEnabled: false,
      }),
      ctx,
      IDENTITY_MAT,
      extents()
    );
    expect(svg).not.toContain("<polygon");
    expect(svg).toContain("<path");
  });
});

describe("arrowhead helper", () => {
  it("draws a filled triangle pointing at the tip", () => {
    const out = arrowhead({ x: 0, y: 0 }, { x: 10, y: 0 }, 1, "#000000", 1);
    expect(out).toMatch(/^<polygon points="0,0 /);
    expect(out).toContain('fill="#000000"');
    expect(out).toContain('stroke="none"');
  });

  it("scales arrow size with textHeight × scale magnitude", () => {
    const small = arrowhead({ x: 0, y: 0 }, { x: 100, y: 0 }, 1, "#000", 1);
    const big = arrowhead({ x: 0, y: 0 }, { x: 100, y: 0 }, 5, "#000", 1);
    // Pull out the second polygon vertex x value; it scales with arrowLen.
    const smallX = parseFloat(small.match(/points="0,0 ([\d.-]+),/)?.[1] ?? "0");
    const bigX = parseFloat(big.match(/points="0,0 ([\d.-]+),/)?.[1] ?? "0");
    expect(bigX).toBeCloseTo(smallX * 5, 4);
  });
});
