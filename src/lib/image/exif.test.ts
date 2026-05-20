import { describe, expect, it } from "vitest";
import { readExifSummary, stripExifFromJpeg } from "./exif";
import photoWithExifUrl from "../../../e2e/fixtures/image/photo-with-exif.jpg?url";
import photoNoExifUrl from "../../../e2e/fixtures/image/photo-no-exif.jpg?url";
import alphaPngUrl from "../../../e2e/fixtures/image/alpha.png?url";

async function fetchAsFile(url: string, name: string, type: string): Promise<File> {
  const res = await fetch(url);
  return new File([await res.arrayBuffer()], name, { type });
}

describe("stripExifFromJpeg", () => {
  it("returns a JPEG blob smaller than (or equal to) the original", async () => {
    const file = await fetchAsFile(photoWithExifUrl, "photo.jpg", "image/jpeg");
    const stripped = await stripExifFromJpeg(file);
    expect(stripped.type).toBe("image/jpeg");
    expect(stripped.size).toBeLessThanOrEqual(file.size);
  });

  it("removes EXIF: re-reading the stripped blob returns no summary", async () => {
    const file = await fetchAsFile(photoWithExifUrl, "photo.jpg", "image/jpeg");
    const before = await readExifSummary(file);
    expect(before).not.toBeNull();
    const stripped = await stripExifFromJpeg(file);
    const after = await readExifSummary(
      new File([stripped], "stripped.jpg", { type: "image/jpeg" })
    );
    expect(after).toBeNull();
  });

  it("rejects non-JPEG inputs with a clear error", async () => {
    const png = await fetchAsFile(alphaPngUrl, "alpha.png", "image/png");
    await expect(stripExifFromJpeg(png)).rejects.toThrow(/JPEG/);
  });

  it("accepts .jpg / .jpeg by extension even when the mime is unset", async () => {
    const file = await fetchAsFile(photoNoExifUrl, "photo.jpg", "");
    const stripped = await stripExifFromJpeg(file);
    expect(stripped.type).toBe("image/jpeg");
  });
});

describe("readExifSummary", () => {
  it("returns null for a JPEG with no EXIF", async () => {
    const file = await fetchAsFile(photoNoExifUrl, "photo.jpg", "image/jpeg");
    const summary = await readExifSummary(file);
    expect(summary).toBeNull();
  });

  it("returns a populated summary for a JPEG with EXIF", async () => {
    const file = await fetchAsFile(photoWithExifUrl, "photo.jpg", "image/jpeg");
    const summary = await readExifSummary(file);
    expect(summary).not.toBeNull();
    expect(Object.keys(summary!).length).toBeGreaterThan(0);
  });
});
