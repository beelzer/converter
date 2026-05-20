import { describe, expect, it } from "vitest";
import type { DwgSplineEntity } from "@mlightcad/libredwg-web";
import { renderSpline } from "./spline";
import { Extents } from "../extents";
import { IDENTITY_MAT } from "../types";
import { asEntity, makeContext } from "../__fixtures";

describe("renderSpline — NURBS path", () => {
  const ctx = makeContext();
  const extents = () => {
    const e = new Extents();
    e.beginEntity();
    return e;
  };

  it("returns empty string when there are no control points or fit points", () => {
    expect(
      renderSpline(
        asEntity<DwgSplineEntity>({ flag: 0, degree: 3, controlPoints: [], knots: [], fitPoints: [] }),
        ctx,
        IDENTITY_MAT,
        extents()
      )
    ).toBe("");
  });

  it("emits a smooth polyline approximation for a valid NURBS curve", () => {
    // A degree-2 quadratic B-spline through three control points.
    const svg = renderSpline(
      asEntity<DwgSplineEntity>({
        layer: "0",
        flag: 0,
        degree: 2,
        controlPoints: [
          { x: 0, y: 0 },
          { x: 5, y: 10 },
          { x: 10, y: 0 },
        ],
        knots: [0, 0, 0, 1, 1, 1],
      }),
      ctx,
      IDENTITY_MAT,
      extents()
    );
    expect(svg).toContain("<path");
    // The path should have many L commands (sampled densely).
    const lCount = (svg.match(/L /g) ?? []).length;
    expect(lCount).toBeGreaterThan(10);
  });

  it("falls back to fit-point polyline when NURBS data is incomplete", () => {
    const svg = renderSpline(
      asEntity<DwgSplineEntity>({
        layer: "0",
        flag: 0,
        degree: 3,
        // No knots — NURBS path won't engage.
        controlPoints: [],
        knots: [],
        fitPoints: [
          { x: 0, y: 0 },
          { x: 5, y: 10 },
          { x: 10, y: 0 },
        ],
      }),
      ctx,
      IDENTITY_MAT,
      extents()
    );
    expect(svg).toContain("M 0 0 L 5 10 L 10 0");
  });

  it("falls back to the control polygon when neither NURBS nor fit points work", () => {
    const svg = renderSpline(
      asEntity<DwgSplineEntity>({
        layer: "0",
        flag: 0,
        degree: 0, // invalid — disables NURBS path
        controlPoints: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
          { x: 2, y: 0 },
        ],
        knots: [],
        fitPoints: [],
      }),
      ctx,
      IDENTITY_MAT,
      extents()
    );
    expect(svg).toContain("M 0 0 L 1 1 L 2 0");
  });

  it("closes the path with Z when the closed flag is set", () => {
    const svg = renderSpline(
      asEntity<DwgSplineEntity>({
        layer: "0",
        flag: 1,
        degree: 0,
        controlPoints: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 5, y: 10 },
        ],
        knots: [],
        fitPoints: [],
      }),
      ctx,
      IDENTITY_MAT,
      extents()
    );
    expect(svg).toMatch(/Z"/);
  });

  it("returns empty when fewer than 2 usable points exist", () => {
    expect(
      renderSpline(
        asEntity<DwgSplineEntity>({
          flag: 0,
          degree: 0,
          controlPoints: [{ x: 0, y: 0 }],
          knots: [],
          fitPoints: [],
        }),
        ctx,
        IDENTITY_MAT,
        extents()
      )
    ).toBe("");
  });
});
