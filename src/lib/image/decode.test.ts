// Browser-mode test (jsdom can't decode images). Verifies the full decode
// pipeline against real fixture files served via Vite's URL imports.

import { describe, expect, it } from "vitest";
import { decodeImage } from "./decode";

// `?url` makes Vite serve the file from the test server; we then fetch it
// inside the browser and wrap it in a File for decodeImage to consume.
import alphaPngUrl from "../../../e2e/fixtures/image/alpha.png?url";
import gradientPngUrl from "../../../e2e/fixtures/image/gradient.png?url";
import sampleWebpUrl from "../../../e2e/fixtures/image/sample.webp?url";
import photoJpgUrl from "../../../e2e/fixtures/image/photo-no-exif.jpg?url";

async function fetchAsFile(url: string, name: string, type: string): Promise<File> {
  const res = await fetch(url);
  const bytes = await res.arrayBuffer();
  return new File([bytes], name, { type });
}

describe("decodeImage", () => {
  it("decodes a PNG with alpha to ImageBitmap + dimensions", async () => {
    const file = await fetchAsFile(alphaPngUrl, "alpha.png", "image/png");
    const decoded = await decodeImage(file);
    expect(decoded.width).toBeGreaterThan(0);
    expect(decoded.height).toBeGreaterThan(0);
    // Native createImageBitmap path → ImageBitmap, not ImageData.
    expect(decoded.source.constructor.name).toBe("ImageBitmap");
  });

  it("decodes a JPEG", async () => {
    const file = await fetchAsFile(photoJpgUrl, "photo.jpg", "image/jpeg");
    const decoded = await decodeImage(file);
    expect(decoded.width).toBeGreaterThan(0);
    expect(decoded.height).toBeGreaterThan(0);
  });

  it("decodes a WebP", async () => {
    const file = await fetchAsFile(sampleWebpUrl, "sample.webp", "image/webp");
    const decoded = await decodeImage(file);
    expect(decoded.width).toBeGreaterThan(0);
    expect(decoded.height).toBeGreaterThan(0);
  });

  it("decodes a gradient PNG and reports correct dimensions", async () => {
    const file = await fetchAsFile(gradientPngUrl, "gradient.png", "image/png");
    const decoded = await decodeImage(file);
    expect(decoded.width).toBe(1920);
    expect(decoded.height).toBe(1080);
  });

  it("rejects unrecognised file types with a clear error", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "mystery.bin", { type: "application/octet-stream" });
    await expect(decodeImage(file)).rejects.toThrow(/Unrecognized/);
  });
});
