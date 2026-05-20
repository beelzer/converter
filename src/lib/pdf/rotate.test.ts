import { describe, expect, it } from "vitest";
import { rotatePdf } from "./rotate";
import { readPageCount } from "./split";
import multiPagePdfUrl from "../../../e2e/fixtures/pdf/multi-page.pdf?url";

const fetchAsBytes = async (url: string) => (await fetch(url)).arrayBuffer();

describe("rotatePdf", () => {
  it("rotates every page when no page list is given", async () => {
    const bytes = await fetchAsBytes(multiPagePdfUrl);
    const result = await rotatePdf(bytes, "doc.pdf", 90, "");
    expect(result.totalPageCount).toBe(await readPageCount(bytes));
    expect(result.rotatedPageCount).toBe(result.totalPageCount);
    expect(result.filename).toBe("doc-rotated.pdf");
  }, 30_000);

  it("rotates only the listed pages when given a range", async () => {
    const bytes = await fetchAsBytes(multiPagePdfUrl);
    const result = await rotatePdf(bytes, "doc.pdf", 180, "1");
    expect(result.rotatedPageCount).toBe(1);
  }, 30_000);

  it("deduplicates duplicate page references in the input", async () => {
    const bytes = await fetchAsBytes(multiPagePdfUrl);
    const result = await rotatePdf(bytes, "doc.pdf", 90, "1, 1, 1");
    expect(result.rotatedPageCount).toBe(1);
  }, 30_000);

  it("returns a valid PDF byte stream", async () => {
    const bytes = await fetchAsBytes(multiPagePdfUrl);
    const result = await rotatePdf(bytes, "doc.pdf", 270, "");
    expect(new TextDecoder().decode(result.bytes.slice(0, 4))).toBe("%PDF");
  }, 30_000);

  it("rejects an out-of-bounds page in the input list", async () => {
    const bytes = await fetchAsBytes(multiPagePdfUrl);
    await expect(rotatePdf(bytes, "doc.pdf", 90, "999")).rejects.toThrow();
  }, 30_000);
});
