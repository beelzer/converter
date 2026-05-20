import { describe, expect, it } from "vitest";
import { unzipSync, gunzipSync } from "fflate";
import { createArchive, type InputFile } from "./create";
import { readTar } from "./tar";

const file = (name: string, body: string): InputFile => ({
  name,
  bytes: new TextEncoder().encode(body),
});

describe("createArchive — zip", () => {
  it("packs entries and writes a valid ZIP", () => {
    const result = createArchive([file("a.txt", "alpha"), file("b.txt", "beta")], "zip", "out");
    expect(result.filename).toBe("out.zip");
    expect(result.mime).toBe("application/zip");
    const unpacked = unzipSync(result.bytes);
    expect(new TextDecoder().decode(unpacked["a.txt"])).toBe("alpha");
    expect(new TextDecoder().decode(unpacked["b.txt"])).toBe("beta");
  });

  it("disambiguates duplicate filenames as 'name (2).ext'", () => {
    const result = createArchive(
      [file("doc.txt", "first"), file("doc.txt", "second")],
      "zip"
    );
    const unpacked = unzipSync(result.bytes);
    const names = Object.keys(unpacked);
    expect(names).toContain("doc.txt");
    expect(names).toContain("doc (2).txt");
  });
});

describe("createArchive — tar", () => {
  it("packs entries into a valid TAR", () => {
    const result = createArchive([file("a.txt", "alpha")], "tar", "data");
    expect(result.filename).toBe("data.tar");
    expect(result.mime).toBe("application/x-tar");
    const entries = readTar(result.bytes);
    expect(entries).toHaveLength(1);
    expect(new TextDecoder().decode(entries[0].bytes)).toBe("alpha");
  });
});

describe("createArchive — tar.gz", () => {
  it("gzip-wraps the TAR output and round-trips", () => {
    const result = createArchive([file("a.txt", "alpha")], "tar.gz", "data");
    expect(result.filename).toBe("data.tar.gz");
    expect(result.mime).toBe("application/gzip");
    // gzip magic.
    expect(result.bytes[0]).toBe(0x1f);
    expect(result.bytes[1]).toBe(0x8b);
    const tar = gunzipSync(result.bytes);
    const entries = readTar(tar);
    expect(new TextDecoder().decode(entries[0].bytes)).toBe("alpha");
  });
});

describe("createArchive — gzip", () => {
  it("wraps a single file directly with no TAR layer", () => {
    const result = createArchive([file("notes.txt", "hello world")], "gzip");
    expect(result.filename).toBe("notes.txt.gz");
    expect(result.mime).toBe("application/gzip");
    expect(new TextDecoder().decode(gunzipSync(result.bytes))).toBe("hello world");
  });

  it("refuses to gzip multiple files (suggests TAR.GZ)", () => {
    expect(() =>
      createArchive([file("a.txt", "a"), file("b.txt", "b")], "gzip")
    ).toThrow(/TAR\.GZ/);
  });
});

describe("createArchive — empty input", () => {
  it("rejects an empty file list", () => {
    expect(() => createArchive([], "zip")).toThrow(/No files/);
  });
});
