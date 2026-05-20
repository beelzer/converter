import { describe, expect, it } from "vitest";
import {
  ACCEPT_ANY_ARCHIVE,
  CREATE_EXT,
  CREATE_FORMATS,
  CREATE_LABEL,
  CREATE_MIME,
  EXTRACT_LABEL,
  detectFormat,
} from "./formats";

describe("archive format catalog", () => {
  it("CREATE_FORMATS lists the four formats we can build", () => {
    expect(CREATE_FORMATS).toEqual(["zip", "tar", "tar.gz", "gzip"]);
  });

  it("every create format has a label, ext, and mime", () => {
    for (const f of CREATE_FORMATS) {
      expect(CREATE_LABEL[f]).toBeTruthy();
      expect(CREATE_EXT[f]).toBeTruthy();
      expect(CREATE_MIME[f]).toMatch(/\//);
    }
  });

  it("EXTRACT_LABEL covers everything CREATE_LABEL covers + RAR", () => {
    for (const f of CREATE_FORMATS) {
      expect(EXTRACT_LABEL[f]).toBe(CREATE_LABEL[f]);
    }
    expect(EXTRACT_LABEL.rar).toBeTruthy();
  });

  it("ACCEPT_ANY_ARCHIVE mentions every extension we extract", () => {
    for (const ext of [".zip", ".tar", ".gz", ".rar"]) {
      expect(ACCEPT_ANY_ARCHIVE).toContain(ext);
    }
  });
});

describe("detectFormat by magic bytes", () => {
  it("detects ZIP from PK\\x03\\x04 header", () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
    expect(detectFormat(bytes)).toBe("zip");
  });

  it("detects RAR from Rar! header", () => {
    const bytes = new Uint8Array([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00]);
    expect(detectFormat(bytes)).toBe("rar");
  });

  it("detects gzip from 1F 8B and treats .tar.gz / .tgz filenames as tar.gz", () => {
    const bytes = new Uint8Array([0x1f, 0x8b, 0x08, 0x00]);
    expect(detectFormat(bytes)).toBe("gzip");
    expect(detectFormat(bytes, "thing.tar.gz")).toBe("tar.gz");
    expect(detectFormat(bytes, "thing.tgz")).toBe("tar.gz");
    // Plain .gz remains gzip, not tar.gz.
    expect(detectFormat(bytes, "thing.gz")).toBe("gzip");
  });

  it("detects ustar TAR from the magic at offset 257", () => {
    const bytes = new Uint8Array(512);
    bytes[257] = 0x75; // 'u'
    bytes[258] = 0x73; // 's'
    bytes[259] = 0x74; // 't'
    bytes[260] = 0x61; // 'a'
    bytes[261] = 0x72; // 'r'
    expect(detectFormat(bytes)).toBe("tar");
  });

  it("falls back to the filename when magic bytes don't match", () => {
    const garbage = new Uint8Array([0, 1, 2, 3, 4, 5]);
    expect(detectFormat(garbage, "a.zip")).toBe("zip");
    expect(detectFormat(garbage, "a.tar")).toBe("tar");
    expect(detectFormat(garbage, "a.tar.gz")).toBe("tar.gz");
    expect(detectFormat(garbage, "a.rar")).toBe("rar");
  });

  it("returns null when neither magic bytes nor filename match", () => {
    expect(detectFormat(new Uint8Array([1, 2, 3, 4]), "mystery.bin")).toBeNull();
    expect(detectFormat(new Uint8Array([1, 2]))).toBeNull(); // too short for header
  });
});
