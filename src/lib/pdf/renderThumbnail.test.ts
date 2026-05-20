import { describe, expect, it } from "vitest";
import { openThumbnailRenderer } from "./renderThumbnail";
import multiPagePdfUrl from "../../../e2e/fixtures/pdf/multi-page.pdf?url";

const fetchAsBytes = async (url: string) => (await fetch(url)).arrayBuffer();

describe("openThumbnailRenderer", () => {
  it("exposes pageCount matching the PDF", async () => {
    const renderer = await openThumbnailRenderer(await fetchAsBytes(multiPagePdfUrl));
    try {
      expect(renderer.pageCount).toBeGreaterThan(0);
    } finally {
      await renderer.destroy();
    }
  }, 30_000);

  it("renders a page as a data: URL", async () => {
    const renderer = await openThumbnailRenderer(await fetchAsBytes(multiPagePdfUrl));
    try {
      const dataUrl = await renderer.renderPage(1, 200);
      expect(dataUrl.startsWith("data:image/jpeg;base64,")).toBe(true);
      expect(dataUrl.length).toBeGreaterThan(100);
    } finally {
      await renderer.destroy();
    }
  }, 30_000);

  it("renders different sizes for different targetWidths", async () => {
    const renderer = await openThumbnailRenderer(await fetchAsBytes(multiPagePdfUrl));
    try {
      const small = await renderer.renderPage(1, 100);
      const big = await renderer.renderPage(1, 400);
      expect(big.length).toBeGreaterThan(small.length);
    } finally {
      await renderer.destroy();
    }
  }, 30_000);
});
