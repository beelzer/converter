import { describe, expect, it } from "vitest";
import { resizeImage } from "./resize";
import gradientPngUrl from "../../../e2e/fixtures/image/gradient.png?url";

async function fetchAsFile(url: string, name: string, type: string): Promise<File> {
  const res = await fetch(url);
  return new File([await res.arrayBuffer()], name, { type });
}

const fixture = () => fetchAsFile(gradientPngUrl, "gradient.png", "image/png");

describe("resizeImage", () => {
  it("fits the image inside max dims preserving aspect ratio", async () => {
    const file = await fixture(); // 1920×1080
    const result = await resizeImage(file, { maxWidth: 800, maxHeight: 800 });
    expect(result.width).toBe(800);
    expect(result.height).toBe(450); // 800 / (1920/1080)
    expect(result.originalWidth).toBe(1920);
    expect(result.originalHeight).toBe(1080);
  });

  it("returns the same dimensions when max dims exceed source and preventUpscale is set", async () => {
    const file = await fixture();
    const result = await resizeImage(file, {
      maxWidth: 5000,
      maxHeight: 5000,
      preventUpscale: true,
    });
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
  });

  it("upscales when preventUpscale is omitted", async () => {
    const file = await fixture();
    const result = await resizeImage(file, { maxWidth: 5000, maxHeight: 5000 });
    expect(result.width).toBeGreaterThan(1920);
  });

  it("names the output with the new dimensions and inferred extension", async () => {
    const file = await fixture();
    const result = await resizeImage(file, { maxWidth: 200, maxHeight: 200 });
    expect(result.name).toMatch(/^gradient-200x\d+\.png$/);
  });

  it("converts to a different output format when requested", async () => {
    const file = await fixture();
    const result = await resizeImage(file, {
      maxWidth: 400,
      maxHeight: 400,
      outputFormat: "jpeg",
      quality: 0.85,
    });
    expect(result.blob.type).toBe("image/jpeg");
    expect(result.name.endsWith(".jpg")).toBe(true);
  });
});
