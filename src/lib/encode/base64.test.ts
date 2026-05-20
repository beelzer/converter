import { describe, expect, it } from "vitest";
import {
  base64ToBytes,
  bytesToBase64,
  decodeBase64Text,
  encodeBase64Text,
} from "./base64";

describe("base64 text round-trip", () => {
  it("encodes and decodes ASCII", () => {
    const input = "Hello, world!";
    const encoded = encodeBase64Text(input);
    expect(encoded).toBe("SGVsbG8sIHdvcmxkIQ==");
    expect(decodeBase64Text(encoded)).toBe(input);
  });

  it("preserves multi-byte UTF-8", () => {
    const input = "こんにちは / 안녕 / 👋🌍";
    const encoded = encodeBase64Text(input);
    expect(decodeBase64Text(encoded)).toBe(input);
  });

  it("produces a URL-safe alphabet when requested", () => {
    // Bytes [0xFB, 0xFF, 0xBF] => standard "+/+/" with padding; URL-safe swaps.
    const bytes = new Uint8Array([0xfb, 0xff, 0xbf, 0xff, 0xff]);
    const std = bytesToBase64(bytes, "standard");
    const safe = bytesToBase64(bytes, "url-safe");
    expect(std).toContain("/");
    expect(safe).not.toContain("/");
    expect(safe).not.toContain("+");
    expect(safe).not.toContain("=");
  });
});

describe("bytesToBase64 / base64ToBytes", () => {
  it("handles empty input", () => {
    expect(bytesToBase64(new Uint8Array())).toBe("");
    expect(base64ToBytes("")).toEqual(new Uint8Array());
  });

  it("round-trips arbitrary binary content", () => {
    const bytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) bytes[i] = i;
    const round = base64ToBytes(bytesToBase64(bytes));
    expect(round).toEqual(bytes);
  });

  it("tolerates whitespace, missing padding, and URL-safe variants on decode", () => {
    const original = new Uint8Array([0xfb, 0xff, 0xbf]);
    const safe = bytesToBase64(original, "url-safe");
    const padded = bytesToBase64(original, "standard");

    expect(base64ToBytes(safe)).toEqual(original);
    expect(base64ToBytes(padded.replace(/=+$/, ""))).toEqual(original);
    expect(base64ToBytes(`  ${padded}\n`)).toEqual(original);
  });
});

describe("decodeBase64Text", () => {
  it("rejects malformed UTF-8 sequences", () => {
    // 0xFF is not a valid UTF-8 start byte.
    const bad = bytesToBase64(new Uint8Array([0xff, 0xff, 0xff]));
    expect(() => decodeBase64Text(bad)).toThrow();
  });
});
