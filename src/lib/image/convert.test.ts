import { describe, expect, it } from "vitest";
import { closeDecoded, convertImage } from "./convert";
import { decodeImage } from "./decode";
import alphaPngUrl from "../../../e2e/fixtures/image/alpha.png?url";

async function fetchAsFile(url: string, name: string, type: string): Promise<File> {
  const res = await fetch(url);
  return new File([await res.arrayBuffer()], name, { type });
}

describe("convertImage", () => {
  it("converts PNG → JPEG and renames with the new extension", async () => {
    const file = await fetchAsFile(alphaPngUrl, "alpha.png", "image/png");
    const result = await convertImage(file, "jpeg", 0.9);
    expect(result.blob.type).toBe("image/jpeg");
    expect(result.name).toBe("alpha.jpg");
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it("converts PNG → WebP", async () => {
    const file = await fetchAsFile(alphaPngUrl, "alpha.png", "image/png");
    const result = await convertImage(file, "webp");
    expect(result.blob.type).toBe("image/webp");
    expect(result.name.endsWith(".webp")).toBe(true);
  });

  it("returns dimensions matching the decoded source", async () => {
    const file = await fetchAsFile(alphaPngUrl, "alpha.png", "image/png");
    const decoded = await decodeImage(file);
    const result = await convertImage(file, "png");
    expect(result.width).toBe(decoded.width);
    expect(result.height).toBe(decoded.height);
    closeDecoded(decoded);
  });

  it("closeDecoded is a no-op for ImageData sources", async () => {
    // Synthesise an ImageData-backed decoded image to exercise the non-bitmap
    // branch of closeDecoded.
    const data = new ImageData(2, 2);
    closeDecoded({ source: data, width: 2, height: 2 });
    // No throw, no side effect — passes by virtue of completing.
    expect(true).toBe(true);
  });
});
