export type CreateFormat = "zip" | "tar" | "tar.gz" | "gzip";

export type ExtractFormat = "zip" | "tar" | "tar.gz" | "gzip" | "rar";

export const CREATE_FORMATS: CreateFormat[] = ["zip", "tar", "tar.gz", "gzip"];

export const CREATE_LABEL: Record<CreateFormat, string> = {
  zip: "ZIP",
  tar: "TAR",
  "tar.gz": "TAR.GZ",
  gzip: "GZIP",
};

export const EXTRACT_LABEL: Record<ExtractFormat, string> = {
  zip: "ZIP",
  tar: "TAR",
  "tar.gz": "TAR.GZ",
  gzip: "GZIP",
  rar: "RAR",
};

export const CREATE_MIME: Record<CreateFormat, string> = {
  zip: "application/zip",
  tar: "application/x-tar",
  "tar.gz": "application/gzip",
  gzip: "application/gzip",
};

export const CREATE_EXT: Record<CreateFormat, string> = {
  zip: "zip",
  tar: "tar",
  "tar.gz": "tar.gz",
  gzip: "gz",
};

export const ACCEPT_ANY_ARCHIVE =
  ".zip,.tar,.tgz,.tar.gz,.gz,.gzip,.rar,application/zip,application/x-tar,application/gzip,application/x-rar-compressed,application/vnd.rar";

// Magic-byte detection. Order matters: gzip can wrap tar, so we check ZIP/RAR
// first, then gzip-containing-tar, then plain gzip.
export function detectFormat(bytes: Uint8Array, filename?: string): ExtractFormat | null {
  if (bytes.length < 4) return null;
  // ZIP: PK\x03\x04 (regular) or PK\x05\x06 (empty) or PK\x07\x08 (spanned)
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return "zip";
  // RAR4: Rar!\x1A\x07\x00 — RAR5: Rar!\x1A\x07\x01\x00
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x61 &&
    bytes[2] === 0x72 &&
    bytes[3] === 0x21
  ) {
    return "rar";
  }
  // gzip: 1F 8B
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    // If the filename hints tar.gz, surface that — saves the user from a
    // second extract step.
    if (filename && /\.tar\.gz$|\.tgz$/i.test(filename)) return "tar.gz";
    return "gzip";
  }
  // TAR: ustar magic at offset 257 — but only present in some variants.
  if (bytes.length >= 263) {
    const magic = String.fromCharCode(bytes[257], bytes[258], bytes[259], bytes[260], bytes[261]);
    if (magic === "ustar") return "tar";
  }
  if (filename) {
    if (/\.zip$/i.test(filename)) return "zip";
    if (/\.tar\.gz$|\.tgz$/i.test(filename)) return "tar.gz";
    if (/\.tar$/i.test(filename)) return "tar";
    if (/\.gz$|\.gzip$/i.test(filename)) return "gzip";
    if (/\.rar$/i.test(filename)) return "rar";
  }
  return null;
}
