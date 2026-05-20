import { describe, expect, it } from "vitest";
import { pdfToImages } from "./pdfToImages";
import multiPagePdfUrl from "../../../e2e/fixtures/pdf/multi-page.pdf?url";

const fetchAsBytes = async (url: string) => (await fetch(url)).arrayBuffer();

describe("pdfToImages", () => {
  it("renders every page as PNG when no page list is given", async () => {
    const bytes = await fetchAsBytes(multiPagePdfUrl);
    const result = await pdfToImages(bytes, "doc.pdf", {
      format: "png",
      scale: 1,
    });
    expect(result.pages.length).toBe(result.sourcePageCount);
    // First two bytes of a PNG are 0x89 0x50.
    expect(result.pages[0].bytes[0]).toBe(0x89);
    expect(result.pages[0].bytes[1]).toBe(0x50);
    expect(result.pages[0].name).toMatch(/^doc-page-\d+\.png$/);
  }, 60_000);

  it("renders only the requested pages when given a page list", async () => {
    const bytes = await fetchAsBytes(multiPagePdfUrl);
    const result = await pdfToImages(bytes, "doc.pdf", {
      format: "jpeg",
      scale: 1,
      pages: "1",
    });
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].pageNumber).toBe(1);
    expect(result.pages[0].name.endsWith(".jpg")).toBe(true);
    // JPEG SOI marker: FF D8.
    expect(result.pages[0].bytes[0]).toBe(0xff);
    expect(result.pages[0].bytes[1]).toBe(0xd8);
  }, 60_000);

  it("scale affects output pixel dimensions linearly", async () => {
    const bytes = await fetchAsBytes(multiPagePdfUrl);
    const small = await pdfToImages(bytes, "doc.pdf", {
      format: "png",
      scale: 1,
      pages: "1",
    });
    const big = await pdfToImages(bytes, "doc.pdf", {
      format: "png",
      scale: 2,
      pages: "1",
    });
    expect(big.pages[0].width).toBeCloseTo(small.pages[0].width * 2, 0);
    expect(big.pages[0].height).toBeCloseTo(small.pages[0].height * 2, 0);
  }, 60_000);

  it("reports progress incrementally", async () => {
    const bytes = await fetchAsBytes(multiPagePdfUrl);
    const updates: Array<[number, number]> = [];
    await pdfToImages(bytes, "doc.pdf", {
      format: "png",
      scale: 1,
      onProgress: (done, total) => updates.push([done, total]),
    });
    expect(updates.length).toBeGreaterThan(0);
    expect(updates[updates.length - 1][0]).toBe(updates[updates.length - 1][1]);
  }, 60_000);
});
