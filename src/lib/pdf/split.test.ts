import { describe, expect, it } from "vitest";
import { extractPages, parsePageList, readPageCount } from "./split";
import multiPagePdfUrl from "../../../e2e/fixtures/pdf/multi-page.pdf?url";

async function fetchAsBytes(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  return res.arrayBuffer();
}

describe("parsePageList — happy paths", () => {
  it("parses a single page", () => {
    expect(parsePageList("3", 10)).toEqual([2]);
  });

  it("parses a range", () => {
    expect(parsePageList("1-3", 10)).toEqual([0, 1, 2]);
  });

  it("parses multiple comma-separated segments preserving order", () => {
    expect(parsePageList("3, 1, 5-6", 10)).toEqual([2, 0, 4, 5]);
  });

  it("treats open-ended start as 1", () => {
    expect(parsePageList("-3", 10)).toEqual([0, 1, 2]);
  });

  it("treats open-ended end as pageCount", () => {
    expect(parsePageList("8-", 10)).toEqual([7, 8, 9]);
  });

  it("preserves duplicate page references (user may want a page twice)", () => {
    expect(parsePageList("1, 1, 1", 10)).toEqual([0, 0, 0]);
  });

  it("trims whitespace around segments", () => {
    expect(parsePageList("  1 ,  3 - 4 ", 10)).toEqual([0, 2, 3]);
  });
});

describe("parsePageList — error cases", () => {
  it("rejects empty input", () => {
    expect(() => parsePageList("", 10)).toThrow(/page or range/);
    expect(() => parsePageList("   ", 10)).toThrow(/page or range/);
  });

  it("rejects out-of-bounds pages", () => {
    expect(() => parsePageList("11", 10)).toThrow(/out of bounds/);
    expect(() => parsePageList("0", 10)).toThrow(/out of bounds/);
  });

  it("rejects out-of-bounds ranges", () => {
    expect(() => parsePageList("8-15", 10)).toThrow(/out of bounds/);
  });

  it("rejects reversed ranges", () => {
    expect(() => parsePageList("5-2", 10)).toThrow(/starts after/);
  });

  it("rejects a bare dash", () => {
    expect(() => parsePageList("-", 10)).toThrow(/needs a start or an end/);
  });

  it("rejects garbage segments", () => {
    expect(() => parsePageList("abc", 10)).toThrow();
    expect(() => parsePageList("1, foo, 3", 10)).toThrow();
  });
});

describe("readPageCount + extractPages — pdf-lib integration", () => {
  it("reads the page count of a real PDF", async () => {
    const bytes = await fetchAsBytes(multiPagePdfUrl);
    const count = await readPageCount(bytes);
    expect(count).toBeGreaterThan(0);
  }, 30_000);

  it("extracts a single page as a new 1-page PDF", async () => {
    const bytes = await fetchAsBytes(multiPagePdfUrl);
    const result = await extractPages(bytes, "doc.pdf", "1");
    expect(result.pageCount).toBe(1);
    expect(result.sourcePageCount).toBeGreaterThan(1);
    expect(result.filename).toBe("doc-pages.pdf");
    // pdf-lib output starts with %PDF.
    expect(new TextDecoder().decode(result.bytes.slice(0, 4))).toBe("%PDF");
  }, 30_000);

  it("extracts a range preserving page order from the input expression", async () => {
    const bytes = await fetchAsBytes(multiPagePdfUrl);
    const result = await extractPages(bytes, "doc.pdf", "2-3");
    expect(result.pageCount).toBe(2);
  }, 30_000);
});
