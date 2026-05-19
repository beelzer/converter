// SubtleCrypto-backed hashes. Output is always lowercase hex.
// MD5 intentionally omitted — SubtleCrypto doesn't ship it and a custom
// implementation isn't worth the bytes for a hash everyone knows is broken.

export type HashAlgorithm = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";

export const HASH_ALGORITHMS: HashAlgorithm[] = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];

export async function hashText(input: string, algorithm: HashAlgorithm): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  return hashBytes(bytes, algorithm);
}

export async function hashBytes(
  bytes: Uint8Array | ArrayBuffer,
  algorithm: HashAlgorithm
): Promise<string> {
  let view: Uint8Array;
  if (bytes instanceof Uint8Array) view = bytes;
  else view = new Uint8Array(bytes);
  // Copy into a fresh ArrayBuffer to avoid SAB-vs-AB type union issues.
  const copy = new Uint8Array(view.byteLength);
  copy.set(view);
  const digest = await crypto.subtle.digest(algorithm, copy.buffer);
  return toHex(new Uint8Array(digest));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
