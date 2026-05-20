import { describe, expect, it } from "vitest";
import { generateFaviconBundle } from "./favicon";
import solidRedUrl from "../../../e2e/fixtures/image/solid-red.png?url";

async function fetchAsFile(url: string, name: string, type: string): Promise<File> {
  const res = await fetch(url);
  return new File([await res.arrayBuffer()], name, { type });
}

describe("generateFaviconBundle", () => {
  it("produces 11 PNG sizes + a multi-image ICO + a webmanifest", async () => {
    const file = await fetchAsFile(solidRedUrl, "logo.png", "image/png");
    const result = await generateFaviconBundle(file, "Test Site");

    const names = result.entries.map((e) => e.name);
    expect(names).toContain("favicon.ico");
    expect(names).toContain("site.webmanifest");
    expect(names).toContain("apple-touch-icon.png");
    expect(names).toContain("android-chrome-192x192.png");
    expect(names).toContain("android-chrome-512x512.png");
    expect(names).toContain("favicon-16x16.png");
    expect(names).toContain("favicon-32x32.png");
    expect(names).toContain("favicon-48x48.png");
    // 11 PNG sizes + ICO + manifest = 13 entries.
    expect(result.entries).toHaveLength(13);
  }, 30_000);

  it("webmanifest contains the supplied site name as JSON", async () => {
    const file = await fetchAsFile(solidRedUrl, "logo.png", "image/png");
    const result = await generateFaviconBundle(file, "DCLN Tools");
    const manifest = result.entries.find((e) => e.name === "site.webmanifest")!;
    const parsed = JSON.parse(new TextDecoder().decode(manifest.bytes));
    expect(parsed.name).toBe("DCLN Tools");
    expect(parsed.short_name).toBe("DCLN Tools");
    expect(parsed.icons).toHaveLength(2);
  }, 30_000);

  it("ICO bytes start with the ICONDIR header (0,0,1,0)", async () => {
    const file = await fetchAsFile(solidRedUrl, "logo.png", "image/png");
    const result = await generateFaviconBundle(file);
    const ico = result.entries.find((e) => e.name === "favicon.ico")!;
    expect(ico.bytes[0]).toBe(0);
    expect(ico.bytes[1]).toBe(0);
    expect(ico.bytes[2]).toBe(1); // type = ICO
    expect(ico.bytes[3]).toBe(0);
    // Number of images in the ICO directory.
    const view = new DataView(
      ico.bytes.buffer,
      ico.bytes.byteOffset,
      ico.bytes.byteLength
    );
    expect(view.getUint16(4, true)).toBe(3); // 16, 32, 48 → three entries
  }, 30_000);
});
