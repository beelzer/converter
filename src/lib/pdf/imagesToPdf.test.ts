import { describe, expect, it } from "vitest";
import { imagesToPdf, type ImageInput } from "./imagesToPdf";
import { readPageCount } from "./split";
import alphaPngUrl from "../../../e2e/fixtures/image/alpha.png?url";
import photoJpgUrl from "../../../e2e/fixtures/image/photo-no-exif.jpg?url";

const fetchAsBytes = async (url: string) => (await fetch(url)).arrayBuffer();

describe("imagesToPdf", () => {
  it("rejects an empty input list", async () => {
    await expect(imagesToPdf([])).rejects.toThrow(/No images/);
  });

  it("creates a one-page PDF from a single PNG", async () => {
    const input: ImageInput = {
      bytes: await fetchAsBytes(alphaPngUrl),
      mime: "image/png",
      name: "alpha.png",
    };
    const result = await imagesToPdf([input]);
    expect(result.pageCount).toBe(1);
    expect(result.filename).toBe("alpha.pdf");
    expect(new TextDecoder().decode(result.bytes.slice(0, 4))).toBe("%PDF");
    // Round-trip through readPageCount confirms it's a real PDF.
    const copy = new Uint8Array(result.bytes).buffer;
    expect(await readPageCount(copy)).toBe(1);
  }, 30_000);

  it("creates one page per image when mixing PNG + JPEG inputs", async () => {
    const inputs: ImageInput[] = [
      {
        bytes: await fetchAsBytes(alphaPngUrl),
        mime: "image/png",
        name: "alpha.png",
      },
      {
        bytes: await fetchAsBytes(photoJpgUrl),
        mime: "image/jpeg",
        name: "photo.jpg",
      },
    ];
    const result = await imagesToPdf(inputs);
    expect(result.pageCount).toBe(2);
  }, 30_000);

  it("derives the output filename from the first image", async () => {
    const inputs: ImageInput[] = [
      {
        bytes: await fetchAsBytes(photoJpgUrl),
        mime: "image/jpeg",
        name: "vacation.jpg",
      },
    ];
    const result = await imagesToPdf(inputs);
    expect(result.filename).toBe("vacation.pdf");
  }, 30_000);
});
