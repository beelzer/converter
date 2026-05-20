import { describe, expect, it } from "vitest";
import type { DwgMTextEntity } from "@mlightcad/libredwg-web";
import { renderMText } from "./mtext";
import { Extents } from "../extents";
import { IDENTITY_MAT } from "../types";
import { asEntity, makeContext } from "../__fixtures";

const baseEntity = (text: string): Partial<DwgMTextEntity> => ({
  layer: "0",
  text,
  insertionPoint: { x: 0, y: 0 } as DwgMTextEntity["insertionPoint"],
  direction: { x: 0, y: 0 } as DwgMTextEntity["direction"],
  rotation: 0,
  textHeight: 10,
  lineSpacing: 1,
  rectWidth: 200,
  attachmentPoint: 5, // middle center
});

describe("renderMText", () => {
  const ctx = makeContext();
  const extents = () => {
    const e = new Extents();
    e.beginEntity();
    return e;
  };

  it("returns empty string for empty text", () => {
    const entity = asEntity<DwgMTextEntity>({ ...baseEntity(""), layer: "0" });
    expect(renderMText(entity, ctx, IDENTITY_MAT, extents())).toBe("");
  });

  it("wraps text in <text><tspan> elements", () => {
    const entity = asEntity<DwgMTextEntity>(baseEntity("Hello"));
    const svg = renderMText(entity, ctx, IDENTITY_MAT, extents());
    expect(svg).toContain("<text");
    expect(svg).toContain("<tspan");
    expect(svg).toContain("Hello");
  });

  it("converts \\P to line breaks (separate tspans per line)", () => {
    const entity = asEntity<DwgMTextEntity>(baseEntity("Line 1\\PLine 2\\PLine 3"));
    const svg = renderMText(entity, ctx, IDENTITY_MAT, extents());
    expect(svg).toContain("Line 1");
    expect(svg).toContain("Line 2");
    expect(svg).toContain("Line 3");
    // Three <tspan>s: one per line.
    expect((svg.match(/<tspan/g) ?? []).length).toBe(3);
  });

  it("strips formatting codes like \\f / \\H / \\C / \\Q", () => {
    const entity = asEntity<DwgMTextEntity>(baseEntity("\\fArial|b0|i0;\\H2.5;\\C1;Red header"));
    const svg = renderMText(entity, ctx, IDENTITY_MAT, extents());
    expect(svg).toContain("Red header");
    expect(svg).not.toContain("\\f");
    expect(svg).not.toContain("\\H");
    expect(svg).not.toContain("\\C");
    expect(svg).not.toContain(";");
  });

  it("unwraps stacking codes \\S<expr>; to keep just the expression", () => {
    const entity = asEntity<DwgMTextEntity>(baseEntity("Fraction \\S1/2; here"));
    const svg = renderMText(entity, ctx, IDENTITY_MAT, extents());
    expect(svg).toContain("Fraction 1/2 here");
  });

  it("strips group delimiters { and }", () => {
    const entity = asEntity<DwgMTextEntity>(baseEntity("{\\fArial;Hello} world"));
    const svg = renderMText(entity, ctx, IDENTITY_MAT, extents());
    expect(svg).toContain("Hello world");
    expect(svg).not.toContain("{");
    expect(svg).not.toContain("}");
  });

  it("escapes XML-significant characters in the text content", () => {
    const entity = asEntity<DwgMTextEntity>(baseEntity("a < b & c > d"));
    const svg = renderMText(entity, ctx, IDENTITY_MAT, extents());
    expect(svg).toContain("a &lt; b &amp; c &gt; d");
  });

  it("falls back to a sensible anchor when attachmentPoint is unknown", () => {
    const entity = asEntity<DwgMTextEntity>({
      ...baseEntity("Hello"),
      attachmentPoint: 99 as DwgMTextEntity["attachmentPoint"], // unknown
    });
    const svg = renderMText(entity, ctx, IDENTITY_MAT, extents());
    expect(svg).toContain('text-anchor="start"');
    expect(svg).toContain('dominant-baseline="alphabetic"');
  });
});
