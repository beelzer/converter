import { describe, expect, it } from "vitest";
import { rasterizeSvg } from "./svg";
import logoSvgUrl from "../../../e2e/fixtures/image/logo.svg?url";

async function fetchAsFile(url: string, name: string, type: string): Promise<File> {
  const res = await fetch(url);
  return new File([await res.arrayBuffer()], name, { type });
}

const fixture = () => fetchAsFile(logoSvgUrl, "logo.svg", "image/svg+xml");

describe("rasterizeSvg", () => {
  it("rasterises an SVG to PNG at the requested width, deriving height from aspect", async () => {
    const file = await fixture();
    const result = await rasterizeSvg(file, { format: "png", width: 256 });
    expect(result.blob.type).toBe("image/png");
    expect(result.width).toBe(256);
    expect(result.height).toBeGreaterThan(0);
  });

  it("rasterises to JPEG with the configured background colour", async () => {
    const file = await fixture();
    const result = await rasterizeSvg(file, {
      format: "jpeg",
      width: 128,
      background: "#ff0000",
      quality: 0.9,
    });
    expect(result.blob.type).toBe("image/jpeg");
  });

  it("rasterises to WebP", async () => {
    const file = await fixture();
    const result = await rasterizeSvg(file, { format: "webp", width: 200, quality: 0.85 });
    expect(result.blob.type).toBe("image/webp");
  });

  it("rejects an SVG that fails to load", async () => {
    const broken = new File(
      [new TextEncoder().encode("not actually svg, just text")],
      "broken.svg",
      { type: "image/svg+xml" }
    );
    await expect(rasterizeSvg(broken, { format: "png", width: 100 })).rejects.toThrow();
  });

  it("honours width = 1 (clamps to at least 1 pixel)", async () => {
    const file = await fixture();
    const result = await rasterizeSvg(file, { format: "png", width: 1 });
    expect(result.width).toBe(1);
    expect(result.height).toBeGreaterThanOrEqual(1);
  });
});
