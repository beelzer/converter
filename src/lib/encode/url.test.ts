import { describe, expect, it } from "vitest";
import { urlDecode, urlEncode } from "./url";

describe("urlEncode", () => {
  it("encodes a full component by default (encodeURIComponent semantics)", () => {
    expect(urlEncode("hello world")).toBe("hello%20world");
    expect(urlEncode("a/b?c=d")).toBe("a%2Fb%3Fc%3Dd");
  });

  it("leaves URL-significant characters alone when full = false (encodeURI)", () => {
    expect(urlEncode("https://example.com/p?x=1", false)).toBe(
      "https://example.com/p?x=1"
    );
    expect(urlEncode("a b", false)).toBe("a%20b");
  });
});

describe("urlDecode", () => {
  it("inverts urlEncode for component-style inputs", () => {
    expect(urlDecode("hello%20world")).toBe("hello world");
    expect(urlDecode("a%2Fb%3Fc%3Dd")).toBe("a/b?c=d");
  });

  it("throws on malformed percent sequences", () => {
    expect(() => urlDecode("%E0%A4%A")).toThrow();
  });
});
