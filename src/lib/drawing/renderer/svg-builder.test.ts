import { describe, expect, it } from "vitest";
import { escapeXml, fmt, strokeAttrs } from "./svg-builder";

describe("fmt", () => {
  it("rounds to 4 decimal places", () => {
    expect(fmt(1.23456789)).toBe("1.2346");
  });

  it("strips trailing zeros and decimal point when integer-equivalent", () => {
    expect(fmt(2)).toBe("2");
    expect(fmt(2.0)).toBe("2");
    expect(fmt(2.1)).toBe("2.1");
  });

  it("returns '0' for non-finite values", () => {
    expect(fmt(NaN)).toBe("0");
    expect(fmt(Infinity)).toBe("0");
    expect(fmt(-Infinity)).toBe("0");
  });
});

describe("escapeXml", () => {
  it("escapes XML-significant characters", () => {
    expect(escapeXml("<a href=\"x\" />")).toBe(
      "&lt;a href=&quot;x&quot; /&gt;"
    );
  });

  it("escapes ampersand first to avoid double-escaping", () => {
    expect(escapeXml("a & b < c")).toBe("a &amp; b &lt; c");
  });

  it("escapes single quotes for attribute safety", () => {
    expect(escapeXml("it's")).toBe("it&#39;s");
  });
});

describe("strokeAttrs", () => {
  it("emits stroke + fill='none' but not stroke-width (inherited from <g>)", () => {
    expect(strokeAttrs({ color: "#ff0000", width: 0.5, dasharray: null })).toBe(
      ' stroke="#ff0000" fill="none"'
    );
  });

  it("adds stroke-dasharray when provided", () => {
    expect(
      strokeAttrs({ color: "#000", width: 0.25, dasharray: "5 2 5 2" })
    ).toBe(' stroke="#000" fill="none" stroke-dasharray="5 2 5 2"');
  });
});
