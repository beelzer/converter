import { describe, expect, it } from "vitest";
import { unzipSync } from "fflate";
import { zipEntries } from "./zip";

describe("zipEntries", () => {
  it("returns a real ZIP archive that decompresses back to the input bytes", () => {
    const entries = [
      { name: "a.txt", bytes: new TextEncoder().encode("alpha") },
      { name: "b.bin", bytes: new Uint8Array([1, 2, 3, 4, 5]) },
    ];
    const archive = zipEntries(entries);
    expect(archive).toBeInstanceOf(Uint8Array);
    // PKZIP magic bytes.
    expect(archive[0]).toBe(0x50);
    expect(archive[1]).toBe(0x4b);

    const unpacked = unzipSync(archive);
    expect(new TextDecoder().decode(unpacked["a.txt"])).toBe("alpha");
    expect(Array.from(unpacked["b.bin"])).toEqual([1, 2, 3, 4, 5]);
  });

  it("returns a small archive for an empty entry list (just a central directory)", () => {
    const archive = zipEntries([]);
    expect(archive.byteLength).toBeGreaterThan(0);
    expect(archive.byteLength).toBeLessThan(50);
  });

  it("supports duplicate filenames by the last write winning (the producer's responsibility)", () => {
    const first = new Uint8Array([1]);
    const second = new Uint8Array([2]);
    const archive = zipEntries([
      { name: "same.bin", bytes: first },
      { name: "same.bin", bytes: second },
    ]);
    const unpacked = unzipSync(archive);
    expect(Array.from(unpacked["same.bin"])).toEqual([2]);
  });
});
