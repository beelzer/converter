import { describe, expect, it } from "vitest";
import {
  BINARY_STRING_CHUNK,
  BLOB_URL_REVOKE_MS,
  DEFAULT_LOSSY_QUALITY,
  PRINT_BLOB_URL_REVOKE_MS,
  THUMBNAIL_QUALITY,
} from "./defaults";

describe("shared defaults", () => {
  it("exposes a 'visually lossless' default JPEG/WebP/AVIF quality", () => {
    expect(DEFAULT_LOSSY_QUALITY).toBeGreaterThan(0);
    expect(DEFAULT_LOSSY_QUALITY).toBeLessThanOrEqual(1);
    expect(DEFAULT_LOSSY_QUALITY).toBeGreaterThanOrEqual(0.9);
  });

  it("uses a lower quality for thumbnails than for final outputs", () => {
    expect(THUMBNAIL_QUALITY).toBeLessThan(DEFAULT_LOSSY_QUALITY);
  });

  it("revoke timeouts are in milliseconds and the print one outlives the dialog", () => {
    expect(BLOB_URL_REVOKE_MS).toBeGreaterThanOrEqual(1000);
    expect(PRINT_BLOB_URL_REVOKE_MS).toBeGreaterThanOrEqual(30_000);
    expect(PRINT_BLOB_URL_REVOKE_MS).toBeGreaterThan(BLOB_URL_REVOKE_MS);
  });

  it("BINARY_STRING_CHUNK stays under the browser arg-list-too-large threshold", () => {
    expect(BINARY_STRING_CHUNK).toBeGreaterThan(0);
    expect(BINARY_STRING_CHUNK).toBeLessThanOrEqual(0x10000);
  });
});
