import { describe, expect, it } from "vitest";
import { decodeJwt, summariseClaims } from "./jwt";

// A well-known unsigned JWT from jwt.io (header HS256, payload {sub:1234567890,
// name:"John Doe", iat:1516239022}).
const SAMPLE_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ." +
  "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

describe("decodeJwt", () => {
  it("decodes header + payload from a real JWT", () => {
    const parts = decodeJwt(SAMPLE_JWT);
    expect(parts.header).toEqual({ alg: "HS256", typ: "JWT" });
    expect(parts.payload).toEqual({
      sub: "1234567890",
      name: "John Doe",
      iat: 1516239022,
    });
    expect(parts.signature).toBe("SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c");
  });

  it("preserves the raw base64url-encoded parts", () => {
    const parts = decodeJwt(SAMPLE_JWT);
    expect(parts.raw.header).toBe("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    expect(parts.raw.payload).toMatch(/^eyJ/);
    expect(parts.raw.signature).toBe(parts.signature);
  });

  it("trims surrounding whitespace", () => {
    const parts = decodeJwt(`  \n${SAMPLE_JWT}\t`);
    expect(parts.header).toEqual({ alg: "HS256", typ: "JWT" });
  });

  it("rejects tokens that don't have three dot-separated parts", () => {
    expect(() => decodeJwt("not.a.real.jwt")).toThrow(/three/);
    expect(() => decodeJwt("only.two")).toThrow(/three/);
    expect(() => decodeJwt("nodots")).toThrow(/three/);
  });

  it("reports which segment couldn't be decoded as JSON", () => {
    // Three "parts" but the middle one base64-decodes to invalid JSON.
    const broken = "eyJhbGciOiJIUzI1NiJ9.bm90LWpzb24.sig";
    expect(() => decodeJwt(broken)).toThrow(/payload/);
  });
});

describe("summariseClaims", () => {
  it("returns the standard-claim subset only when present", () => {
    const out = summariseClaims({ sub: "user-1", name: "John" });
    expect(out.sub).toBe("user-1");
    expect(out.iss).toBeUndefined();
  });

  it("computes ISO timestamps and detects expiry", () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    const future = Math.floor(Date.now() / 1000) + 60;
    const expired = summariseClaims({ exp: past });
    const live = summariseClaims({ exp: future });
    expect(expired.exp?.expired).toBe(true);
    expect(live.exp?.expired).toBe(false);
    expect(expired.exp?.iso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("passes string and array audiences through unchanged", () => {
    expect(summariseClaims({ aud: "api" }).aud).toBe("api");
    expect(summariseClaims({ aud: ["api", "web"] }).aud).toEqual(["api", "web"]);
  });

  it("ignores non-numeric exp/iat/nbf", () => {
    const out = summariseClaims({ exp: "tomorrow", iat: null });
    expect(out.exp).toBeUndefined();
    expect(out.iat).toBeUndefined();
  });

  it("returns an empty object for non-object payloads", () => {
    expect(summariseClaims(null)).toEqual({});
    expect(summariseClaims("string")).toEqual({});
    expect(summariseClaims(42)).toEqual({});
  });
});
