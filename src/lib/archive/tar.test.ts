import { describe, expect, it } from "vitest";
import { readTar, writeTar, type TarEntry } from "./tar";

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array) => new TextDecoder().decode(b);

describe("writeTar / readTar round-trip", () => {
  it("preserves names and bytes for a small set of entries", () => {
    const entries: TarEntry[] = [
      { name: "a.txt", bytes: enc("alpha") },
      { name: "b.txt", bytes: enc("beta") },
      { name: "c.bin", bytes: new Uint8Array([1, 2, 3, 4, 5]) },
    ];
    const tar = writeTar(entries);
    const read = readTar(tar);
    expect(read).toHaveLength(3);
    expect(read[0].name).toBe("a.txt");
    expect(dec(read[0].bytes)).toBe("alpha");
    expect(dec(read[1].bytes)).toBe("beta");
    expect(Array.from(read[2].bytes)).toEqual([1, 2, 3, 4, 5]);
  });

  it("handles a payload that lands exactly on a 512-byte boundary", () => {
    const exact = new Uint8Array(512);
    exact.fill(0x41);
    const tar = writeTar([{ name: "exact.bin", bytes: exact }]);
    const read = readTar(tar);
    expect(read[0].bytes.byteLength).toBe(512);
    expect(read[0].bytes[0]).toBe(0x41);
  });

  it("handles a payload that needs padding to the next block", () => {
    const odd = new Uint8Array(513);
    odd.fill(0x42);
    const tar = writeTar([{ name: "odd.bin", bytes: odd }]);
    const read = readTar(tar);
    expect(read[0].bytes.byteLength).toBe(513);
    expect(read[0].bytes[512]).toBe(0x42);
  });

  it("encodes valid ustar headers (magic at offset 257)", () => {
    const tar = writeTar([{ name: "x.txt", bytes: enc("hi") }]);
    const magic = String.fromCharCode(tar[257], tar[258], tar[259], tar[260], tar[261]);
    expect(magic).toBe("ustar");
  });

  it("ends with two empty 512-byte blocks", () => {
    const tar = writeTar([{ name: "x.txt", bytes: enc("hi") }]);
    const tail = tar.slice(tar.byteLength - 1024);
    expect(tail.every((b) => b === 0)).toBe(true);
  });

  it("returns an empty entry list for an empty TAR", () => {
    expect(readTar(writeTar([]))).toEqual([]);
  });

  it("throws when a filename is too long for ustar (>100 chars)", () => {
    const tooLong = "x".repeat(101);
    expect(() => writeTar([{ name: tooLong, bytes: enc("a") }])).toThrow(/long/);
  });

  it("honours a caller-supplied mtime", () => {
    const tar = writeTar([{ name: "x.txt", bytes: enc("hi"), mtime: 1234567890 }]);
    // mtime is at header offset 136, 12 bytes octal NUL-terminated.
    const mtimeStr = String.fromCharCode(...Array.from(tar.subarray(136, 147))).replace(/\0+$/, "");
    expect(parseInt(mtimeStr, 8)).toBe(1234567890);
  });
});
