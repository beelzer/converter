import { describe, expect, it } from "vitest";
import { mergePdfs } from "./merge";
import { readPageCount } from "./split";
import multiPagePdfUrl from "../../../e2e/fixtures/pdf/multi-page.pdf?url";
import rotatedPdfUrl from "../../../e2e/fixtures/pdf/rotated.pdf?url";

const fetchAsBytes = async (url: string) => (await fetch(url)).arrayBuffer();

describe("mergePdfs", () => {
  it("rejects an empty input list with a clear error", async () => {
    await expect(mergePdfs([])).rejects.toThrow(/No PDFs/);
  });

  it("merges two PDFs and returns the combined page count", async () => {
    const a = await fetchAsBytes(multiPagePdfUrl);
    const b = await fetchAsBytes(rotatedPdfUrl);
    const aCount = await readPageCount(a);
    const bCount = await readPageCount(b);
    const result = await mergePdfs([a, b]);
    expect(result.pageCount).toBe(aCount + bCount);
    expect(new TextDecoder().decode(result.bytes.slice(0, 4))).toBe("%PDF");
  }, 30_000);

  it("a single-input merge is effectively a copy", async () => {
    const a = await fetchAsBytes(multiPagePdfUrl);
    const aCount = await readPageCount(a);
    const result = await mergePdfs([a]);
    expect(result.pageCount).toBe(aCount);
  }, 30_000);
});
