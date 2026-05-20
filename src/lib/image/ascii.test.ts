import { describe, expect, it } from "vitest";
import {
  defaultOptions,
  gridToAnsi,
  gridToHtml,
  gridToHtmlDocument,
  type AsciiOptions,
  type AsciiResult,
} from "./ascii";

const opts = (overrides: Partial<AsciiOptions> = {}): AsciiOptions => ({
  ...defaultOptions(),
  ...overrides,
});

const monoGrid: AsciiResult = {
  text: "##\n  ",
  rows: 2,
  cols: 2,
  colors: null,
};

const colorGrid: AsciiResult = {
  text: "AB\nCD",
  rows: 2,
  cols: 2,
  colors: ["#ff0000", "#00ff00", "#0000ff", "#ffffff"],
};

describe("defaultOptions", () => {
  it("returns a sensible set of defaults", () => {
    const o = defaultOptions();
    expect(o.outputWidth).toBeGreaterThan(0);
    expect(o.charset).toBe("gradient");
    expect(o.color).toBe("mono");
    expect(o.invert).toBe(false);
    expect(o.background).toMatch(/^#[0-9a-f]{6}$/i);
    expect(o.foreground).toMatch(/^#[0-9a-f]{6}$/i);
    expect(o.fontSize).toBeGreaterThan(0);
  });
});

describe("gridToHtml — mono", () => {
  it("wraps the raw text in a <pre> with foreground + background", () => {
    const html = gridToHtml(monoGrid, opts({ foreground: "#abcdef", background: "#123456" }));
    expect(html).toContain("<pre");
    expect(html).toContain("color:#abcdef");
    expect(html).toContain("background:#123456");
    expect(html).toContain("##");
  });

  it("escapes ampersand and angle brackets in mono output", () => {
    const grid: AsciiResult = {
      text: "<&>",
      rows: 1,
      cols: 3,
      colors: null,
    };
    const html = gridToHtml(grid, opts());
    expect(html).toContain("&lt;");
    expect(html).toContain("&amp;");
    expect(html).toContain("&gt;");
    expect(html).not.toMatch(/<&>/);
  });
});

describe("gridToHtml — colour", () => {
  it("emits one <span style=color:…> per cell", () => {
    const html = gridToHtml(colorGrid, opts());
    expect((html.match(/<span/g) ?? []).length).toBe(4);
    expect(html).toContain('color:#ff0000');
    expect(html).toContain('color:#ffffff');
  });

  it("preserves newlines between rows", () => {
    const html = gridToHtml(colorGrid, opts());
    // The <span> stream contains a literal newline between row 1 and row 2.
    expect(html).toMatch(/<\/span>\n<span/);
  });

  it("escapes special characters inside coloured cells", () => {
    const grid: AsciiResult = {
      text: "<&",
      rows: 1,
      cols: 2,
      colors: ["#fff", "#000"],
    };
    const html = gridToHtml(grid, opts());
    expect(html).toContain("&lt;");
    expect(html).toContain("&amp;");
  });
});

describe("gridToHtmlDocument", () => {
  it("wraps the body in a full HTML document", () => {
    const doc = gridToHtmlDocument(monoGrid, opts());
    expect(doc).toContain("<!doctype html>");
    expect(doc).toContain("<html");
    expect(doc).toContain("<head>");
    expect(doc).toContain("</body>");
  });
});

describe("gridToAnsi", () => {
  it("returns plain text when there is no per-cell colour", () => {
    expect(gridToAnsi(monoGrid)).toBe(monoGrid.text);
  });

  it("emits 24-bit colour escapes per cell + a reset per row", () => {
    const ansi = gridToAnsi(colorGrid);
    // Each cell has a colour escape; each row ends with reset.
    expect(ansi).toContain("\x1b[38;2;255;0;0m");
    expect(ansi).toContain("\x1b[38;2;0;255;0m");
    expect(ansi).toContain("\x1b[0m");
    expect(ansi.split("\n")).toHaveLength(2);
  });
});
