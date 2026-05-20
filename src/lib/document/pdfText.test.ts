import { describe, expect, it } from "vitest";
import { extractPdfText } from "./pdfText";
import multiPagePdfUrl from "../../../e2e/fixtures/pdf/multi-page.pdf?url";

async function fetchAsFile(url: string, name: string, type: string): Promise<File> {
  const res = await fetch(url);
  return new File([await res.arrayBuffer()], name, { type });
}

describe("extractPdfText", () => {
  it("extracts text from every page of a multi-page PDF", async () => {
    const file = await fetchAsFile(multiPagePdfUrl, "multi.pdf", "application/pdf");
    const result = await extractPdfText(file);
    expect(result.pages.length).toBeGreaterThan(0);
    // Joined output should be at least the sum of page string lengths (plus
    // separators).
    expect(result.joined.length).toBeGreaterThanOrEqual(
      result.pages.reduce((a, p) => a + p.length, 0)
    );
  }, 30_000);

  it("includes a page-break separator between pages in joined output", async () => {
    const file = await fetchAsFile(multiPagePdfUrl, "multi.pdf", "application/pdf");
    const result = await extractPdfText(file);
    if (result.pages.length > 1) {
      expect(result.joined).toContain("--- page break ---");
    }
  }, 30_000);

  it("reports progress incrementally as pages are processed", async () => {
    const file = await fetchAsFile(multiPagePdfUrl, "multi.pdf", "application/pdf");
    const progressUpdates: number[] = [];
    await extractPdfText(file, (p) => progressUpdates.push(p));
    expect(progressUpdates.length).toBeGreaterThan(0);
    // Last progress value should be exactly 1 (final page complete).
    expect(progressUpdates[progressUpdates.length - 1]).toBeCloseTo(1, 6);
    // Updates should be monotonically increasing.
    for (let i = 1; i < progressUpdates.length; i++) {
      expect(progressUpdates[i]).toBeGreaterThan(progressUpdates[i - 1]);
    }
  }, 30_000);
});
