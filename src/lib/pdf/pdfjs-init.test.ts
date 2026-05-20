import { describe, expect, it } from "vitest";
import { getPdfjs } from "./pdfjs-init";

describe("getPdfjs", () => {
  it("returns the pdfjs module with GlobalWorkerOptions configured", async () => {
    const pdfjs = await getPdfjs();
    expect(pdfjs).toBeTruthy();
    expect(pdfjs.GlobalWorkerOptions).toBeTruthy();
    expect(typeof pdfjs.GlobalWorkerOptions.workerSrc).toBe("string");
    expect(pdfjs.GlobalWorkerOptions.workerSrc).not.toBe("");
  });

  it("subsequent calls return the same initialised module without re-setting the worker", async () => {
    const a = await getPdfjs();
    const before = a.GlobalWorkerOptions.workerSrc;
    const b = await getPdfjs();
    expect(b).toBe(a);
    expect(b.GlobalWorkerOptions.workerSrc).toBe(before);
  });
});
