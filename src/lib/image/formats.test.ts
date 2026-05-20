import { describe, expect, it } from "vitest";
import {
  ACCEPT_INPUT,
  FORMAT_LABEL,
  OUTPUT_FORMATS,
  detectInputFormat,
  extensionFor,
  mimeFor,
  needsCustomDecode,
  needsCustomEncode,
} from "./formats";

const fileWith = (name: string, type = "") =>
  new File([new Uint8Array(0)], name, { type });

describe("detectInputFormat", () => {
  it("uses the file MIME when available", () => {
    expect(detectInputFormat(fileWith("anything", "image/png"))).toBe("png");
    expect(detectInputFormat(fileWith("anything", "image/heic"))).toBe("heic");
    expect(detectInputFormat(fileWith("anything", "image/heif"))).toBe("heic");
  });

  it("falls back to the file extension when MIME is missing", () => {
    expect(detectInputFormat(fileWith("photo.JPG"))).toBe("jpeg");
    expect(detectInputFormat(fileWith("a.tif"))).toBe("tiff");
    expect(detectInputFormat(fileWith("a.tiff"))).toBe("tiff");
    expect(detectInputFormat(fileWith("a.heif"))).toBe("heic");
  });

  it("returns null when neither MIME nor extension match", () => {
    expect(detectInputFormat(fileWith("notes.txt"))).toBeNull();
    expect(detectInputFormat(fileWith("no-ext"))).toBeNull();
  });
});

describe("extensionFor / mimeFor", () => {
  it("uses .jpg (not .jpeg) for JPEG outputs", () => {
    expect(extensionFor("jpeg")).toBe("jpg");
    expect(extensionFor("png")).toBe("png");
    expect(extensionFor("webp")).toBe("webp");
    expect(extensionFor("avif")).toBe("avif");
  });

  it("returns image/<format> for the mime", () => {
    expect(mimeFor("jpeg")).toBe("image/jpeg");
    expect(mimeFor("avif")).toBe("image/avif");
  });
});

describe("needsCustomDecode / needsCustomEncode", () => {
  it("flags HEIC and TIFF as needing JS/WASM decoding", () => {
    expect(needsCustomDecode("heic")).toBe(true);
    expect(needsCustomDecode("tiff")).toBe(true);
  });

  it("flags AVIF as needing JS/WASM encoding", () => {
    expect(needsCustomEncode("avif")).toBe(true);
  });

  it("leaves browser-native formats alone", () => {
    expect(needsCustomDecode("png")).toBe(false);
    expect(needsCustomDecode("webp")).toBe(false);
    expect(needsCustomEncode("png")).toBe(false);
    expect(needsCustomEncode("jpeg")).toBe(false);
  });
});

describe("catalog metadata", () => {
  it("OUTPUT_FORMATS is the four formats we can encode", () => {
    expect(OUTPUT_FORMATS).toEqual(["jpeg", "png", "webp", "avif"]);
  });

  it("ACCEPT_INPUT mentions every extension we know", () => {
    for (const ext of ["jpg", "jpeg", "png", "webp", "avif", "gif", "bmp", "tif", "tiff", "heic", "heif"]) {
      expect(ACCEPT_INPUT).toContain(`.${ext}`);
    }
  });

  it("FORMAT_LABEL has a display label for every input and output", () => {
    for (const f of ["jpeg", "png", "webp", "avif", "gif", "bmp", "tiff", "heic"] as const) {
      expect(FORMAT_LABEL[f]).toBeTruthy();
    }
  });
});
