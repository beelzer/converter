import { describe, expect, it } from "vitest";
import { createArchive, type InputFile } from "./create";
import { extractArchive } from "./extract";

const file = (name: string, body: string): InputFile => ({
  name,
  bytes: new TextEncoder().encode(body),
});

const asFile = (bytes: Uint8Array, name: string): File =>
  new File([bytes as BlobPart], name);

const decodeEntry = (b: Uint8Array) => new TextDecoder().decode(b);

describe("extractArchive — zip round-trip", () => {
  it("recovers the original file list and bytes", async () => {
    const archive = createArchive(
      [file("a.txt", "alpha"), file("docs/b.txt", "beta")],
      "zip"
    );
    const result = await extractArchive(asFile(archive.bytes, "out.zip"));
    expect(result.format).toBe("zip");
    expect(result.entries).toHaveLength(2);
    const map = Object.fromEntries(result.entries.map((e) => [e.name, decodeEntry(e.bytes)]));
    expect(map["a.txt"]).toBe("alpha");
    expect(map["docs/b.txt"]).toBe("beta");
  });
});

describe("extractArchive — tar round-trip", () => {
  it("recovers entries from a plain TAR", async () => {
    const archive = createArchive([file("a.txt", "alpha")], "tar");
    const result = await extractArchive(asFile(archive.bytes, "out.tar"));
    expect(result.format).toBe("tar");
    expect(result.entries).toHaveLength(1);
    expect(decodeEntry(result.entries[0].bytes)).toBe("alpha");
  });
});

describe("extractArchive — tar.gz round-trip", () => {
  it("decompresses and reads back the original entries", async () => {
    const archive = createArchive([file("a.txt", "alpha")], "tar.gz");
    const result = await extractArchive(asFile(archive.bytes, "out.tar.gz"));
    expect(result.format).toBe("tar.gz");
    expect(decodeEntry(result.entries[0].bytes)).toBe("alpha");
  });
});

describe("extractArchive — gzip round-trip", () => {
  it("strips the .gz suffix from the file's name for the inner entry", async () => {
    const archive = createArchive([file("notes.txt", "hello")], "gzip");
    const result = await extractArchive(asFile(archive.bytes, "notes.txt.gz"));
    expect(result.format).toBe("gzip");
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].name).toBe("notes.txt");
    expect(decodeEntry(result.entries[0].bytes)).toBe("hello");
  });

  it("falls back to 'output' when the filename has no recognised suffix", async () => {
    const archive = createArchive([file("notes.txt", "hello")], "gzip");
    const result = await extractArchive(asFile(archive.bytes, "anonymous"));
    expect(result.entries[0].name).toBe("anonymous");
  });
});

describe("extractArchive — unrecognised input", () => {
  it("throws a clear error when neither magic bytes nor extension match", async () => {
    const garbage = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    await expect(extractArchive(asFile(garbage, "mystery.bin"))).rejects.toThrow(
      /Unrecognised/
    );
  });
});
