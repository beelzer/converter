import { describe, expect, it } from "vitest";
import type { DwgTextEntity } from "@mlightcad/libredwg-web";
import { renderText } from "./text";
import { Extents } from "../extents";
import { IDENTITY_MAT } from "../types";
import { asEntity, makeContext } from "../__fixtures";

const baseEntity = (text: string, overrides: Partial<DwgTextEntity> = {}): Partial<DwgTextEntity> => ({
  layer: "0",
  text,
  startPoint: { x: 0, y: 0 } as DwgTextEntity["startPoint"],
  rotation: 0,
  textHeight: 10,
  halign: 0,
  valign: 0,
  xScale: 1,
  ...overrides,
});

describe("renderText", () => {
  const ctx = makeContext();
  const extents = () => {
    const e = new Extents();
    e.beginEntity();
    return e;
  };

  it("returns empty string for empty text", () => {
    expect(renderText(asEntity<DwgTextEntity>(baseEntity("")), ctx, IDENTITY_MAT, extents())).toBe("");
  });

  it("wraps the text content in a transformed <g><text>", () => {
    const svg = renderText(
      asEntity<DwgTextEntity>(baseEntity("Hello")),
      ctx,
      IDENTITY_MAT,
      extents()
    );
    expect(svg).toMatch(/^<g transform="matrix\(/);
    expect(svg).toContain(">Hello</text>");
  });

  it("maps halign to text-anchor", () => {
    const left = renderText(asEntity<DwgTextEntity>(baseEntity("X", { halign: 0 })), ctx, IDENTITY_MAT, extents());
    const center = renderText(asEntity<DwgTextEntity>(baseEntity("X", { halign: 1 })), ctx, IDENTITY_MAT, extents());
    const right = renderText(asEntity<DwgTextEntity>(baseEntity("X", { halign: 2 })), ctx, IDENTITY_MAT, extents());
    expect(left).toContain('text-anchor="start"');
    expect(center).toContain('text-anchor="middle"');
    expect(right).toContain('text-anchor="end"');
  });

  it("maps valign to dominant-baseline", () => {
    const base = renderText(asEntity<DwgTextEntity>(baseEntity("X", { valign: 0 })), ctx, IDENTITY_MAT, extents());
    const top = renderText(asEntity<DwgTextEntity>(baseEntity("X", { valign: 3 })), ctx, IDENTITY_MAT, extents());
    expect(base).toContain('dominant-baseline="alphabetic"');
    expect(top).toContain('dominant-baseline="hanging"');
  });

  it("escapes XML-significant characters", () => {
    const svg = renderText(asEntity<DwgTextEntity>(baseEntity("<&>")), ctx, IDENTITY_MAT, extents());
    expect(svg).toContain("&lt;&amp;&gt;");
  });

  it("falls back to alignment defaults for unknown halign/valign codes", () => {
    const svg = renderText(
      asEntity<DwgTextEntity>(
        baseEntity("X", {
          halign: 99 as unknown as DwgTextEntity["halign"],
          valign: 99 as unknown as DwgTextEntity["valign"],
        })
      ),
      ctx,
      IDENTITY_MAT,
      extents()
    );
    expect(svg).toContain('text-anchor="start"');
    expect(svg).toContain('dominant-baseline="alphabetic"');
  });

  it("uses endPoint when halign signals Aligned/Middle/Fit and endPoint is present", () => {
    const svg = renderText(
      asEntity<DwgTextEntity>(
        baseEntity("X", {
          halign: 4,
          startPoint: { x: 0, y: 0 } as DwgTextEntity["startPoint"],
          endPoint: { x: 100, y: 200 } as DwgTextEntity["endPoint"],
        })
      ),
      ctx,
      IDENTITY_MAT,
      extents()
    );
    // The transform matrix encodes the endPoint as the translation component.
    expect(svg).toMatch(/matrix\(.*100,(?:200|-200)\)/);
  });
});
