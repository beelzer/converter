// Catch-all MIME constants for things that aren't owned by a per-hub formats
// module. Image / audio / video / data MIMEs live in their respective
// `lib/<hub>/formats.ts`; this file is for cross-cutting types only.

export const MIME = {
  OCTET_STREAM: "application/octet-stream",
  PDF: "application/pdf",
  ZIP: "application/zip",
  TAR: "application/x-tar",
  GZIP: "application/gzip",
  TEXT_PLAIN: "text/plain",
  TEXT_HTML: "text/html",
  TEXT_MARKDOWN: "text/markdown",
  TEXT_TYPESCRIPT: "text/typescript",
  JSON: "application/json",
} as const;
