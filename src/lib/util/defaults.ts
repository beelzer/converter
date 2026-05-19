// Cross-cutting default values. Per-hub specifics still live in each hub's
// formats / presets module; this catches the things shared by many hubs.

// Default JPEG/WebP/AVIF encode quality (0..1). 0.92 is the sweet spot for
// "visually lossless" — anything higher rarely produces visible differences
// in side-by-side viewing.
export const DEFAULT_LOSSY_QUALITY = 0.92;

// Lower-quality default for thumbnails and previews where bandwidth matters
// more than fidelity.
export const THUMBNAIL_QUALITY = 0.75;

// How long the browser holds a `URL.createObjectURL()` blob URL alive after
// we've handed it to a download or print window. The download click happens
// synchronously, but some browsers need the URL to remain valid briefly
// after — 1 second is enough.
export const BLOB_URL_REVOKE_MS = 1_000;

// For the print-to-PDF flow we open the URL in a new tab and let the user
// drive — the URL needs to outlive the print dialog. One minute is generous
// without leaking forever.
export const PRINT_BLOB_URL_REVOKE_MS = 60_000;

// Chunk size for incremental `String.fromCharCode.apply(null, ...)` over a
// large `Uint8Array`. Browsers throw "argument list too large" beyond ~64KB
// of args, so we stride at 32KB.
export const BINARY_STRING_CHUNK = 0x8000;
