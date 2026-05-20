import { describe, expect, it } from "vitest";
import { decodeImage } from "./decode";
import { encodeImage } from "./encode";
import alphaPngUrl from "../../../e2e/fixtures/image/alpha.png?url";
import photoJpgUrl from "../../../e2e/fixtures/image/photo-no-exif.jpg?url";

async function fetchAsFile(url: string, name: string, type: string): Promise<File> {
  const res = await fetch(url);
  return new File([await res.arrayBuffer()], name, { type });
}

describe("encodeImage — native canvas formats", () => {
  it("encodes a decoded image as PNG", async () => {
    const file = await fetchAsFile(alphaPngUrl, "alpha.png", "image/png");
    const decoded = await decodeImage(file);
    const blob = await encodeImage(decoded, { format: "png" });
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBeGreaterThan(0);
  });

  it("encodes as JPEG with white background substitution", async () => {
    const file = await fetchAsFile(alphaPngUrl, "alpha.png", "image/png");
    const decoded = await decodeImage(file);
    const blob = await encodeImage(decoded, { format: "jpeg", quality: 0.9 });
    expect(blob.type).toBe("image/jpeg");
    expect(blob.size).toBeGreaterThan(0);
  });

  it("encodes as WebP", async () => {
    const file = await fetchAsFile(photoJpgUrl, "photo.jpg", "image/jpeg");
    const decoded = await decodeImage(file);
    const blob = await encodeImage(decoded, { format: "webp", quality: 0.8 });
    expect(blob.type).toBe("image/webp");
  });

  it("quality argument changes output size", async () => {
    const file = await fetchAsFile(photoJpgUrl, "photo.jpg", "image/jpeg");
    const decoded = await decodeImage(file);
    const high = await encodeImage(decoded, { format: "jpeg", quality: 0.95 });
    const low = await encodeImage(decoded, { format: "jpeg", quality: 0.3 });
    expect(high.size).toBeGreaterThan(low.size);
  });
});

// AVIF encode is covered end-to-end by Playwright (running against the
// production build, where @jsquash/avif's WASM is bundled by Vite). The
// dev-server fetch path in browser-mode Vitest doesn't reliably serve the
// codec's WASM blob, so we skip it here rather than ship a flaky test.
describe.skip("encodeImage — AVIF via @jsquash/avif (e2e-covered)", () => {
  it("encodes a decoded image as AVIF", async () => {
    const file = await fetchAsFile(alphaPngUrl, "alpha.png", "image/png");
    const decoded = await decodeImage(file);
    const blob = await encodeImage(decoded, { format: "avif", quality: 0.5 });
    expect(blob.type).toBe("image/avif");
    expect(blob.size).toBeGreaterThan(0);
  }, 30_000);
});
