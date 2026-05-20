import { describe, expect, it } from "vitest";
import { HASH_ALGORITHMS, hashBytes, hashText } from "./hash";

// Known SHA digests for the empty string and "abc", straight from RFC 6234.
const KNOWN: Record<string, { empty: string; abc: string }> = {
  "SHA-1": {
    empty: "da39a3ee5e6b4b0d3255bfef95601890afd80709",
    abc: "a9993e364706816aba3e25717850c26c9cd0d89d",
  },
  "SHA-256": {
    empty: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    abc: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  },
  "SHA-384": {
    empty:
      "38b060a751ac96384cd9327eb1b1e36a21fdb71114be07434c0cc7bf63f6e1da274edebfe76f65fbd51ad2f14898b95b",
    abc: "cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7",
  },
  "SHA-512": {
    empty:
      "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e",
    abc: "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
  },
};

describe("hashText", () => {
  for (const algorithm of HASH_ALGORITHMS) {
    describe(algorithm, () => {
      it("matches the RFC-known digest for the empty string", async () => {
        expect(await hashText("", algorithm)).toBe(KNOWN[algorithm].empty);
      });

      it("matches the RFC-known digest for 'abc'", async () => {
        expect(await hashText("abc", algorithm)).toBe(KNOWN[algorithm].abc);
      });

      it("is deterministic across calls", async () => {
        const a = await hashText("repeatable input 🌱", algorithm);
        const b = await hashText("repeatable input 🌱", algorithm);
        expect(a).toBe(b);
      });
    });
  }
});

describe("hashBytes", () => {
  it("accepts Uint8Array input", async () => {
    const bytes = new TextEncoder().encode("abc");
    expect(await hashBytes(bytes, "SHA-256")).toBe(KNOWN["SHA-256"].abc);
  });

  it("accepts ArrayBuffer input", async () => {
    const bytes = new TextEncoder().encode("abc");
    const slice = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    expect(await hashBytes(slice, "SHA-256")).toBe(KNOWN["SHA-256"].abc);
  });

  it("returns lowercase hex with no separators", async () => {
    const hex = await hashText("x", "SHA-256");
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("HASH_ALGORITHMS", () => {
  it("exposes all four SHA variants in spec order", () => {
    expect(HASH_ALGORITHMS).toEqual(["SHA-1", "SHA-256", "SHA-384", "SHA-512"]);
  });
});
