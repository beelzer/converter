// UTF-8 safe Base64 helpers built on TextEncoder/TextDecoder + native btoa/atob.

import { BINARY_STRING_CHUNK } from "../util/defaults";

export type Base64Variant = "standard" | "url-safe";

export function encodeBase64Text(input: string, variant: Base64Variant = "standard"): string {
  const bytes = new TextEncoder().encode(input);
  return bytesToBase64(bytes, variant);
}

export function decodeBase64Text(input: string): string {
  const bytes = base64ToBytes(input);
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export function bytesToBase64(bytes: Uint8Array, variant: Base64Variant = "standard"): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += BINARY_STRING_CHUNK) {
    s += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + BINARY_STRING_CHUNK))
    );
  }
  let b64 = btoa(s);
  if (variant === "url-safe") {
    b64 = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }
  return b64;
}

export function base64ToBytes(input: string): Uint8Array {
  // Tolerate either standard or URL-safe base64; strip whitespace.
  let normalized = input.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4 !== 0) normalized += "=";
  const binary = atob(normalized);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
