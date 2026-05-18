export type SupportedInputFormat =
  | "jpeg"
  | "png"
  | "webp"
  | "avif"
  | "gif"
  | "bmp"
  | "tiff"
  | "heic";

export type SupportedOutputFormat = "jpeg" | "png" | "webp" | "avif";

export const FORMAT_LABEL: Record<SupportedInputFormat | SupportedOutputFormat, string> = {
  jpeg: "JPG",
  png: "PNG",
  webp: "WebP",
  avif: "AVIF",
  gif: "GIF",
  bmp: "BMP",
  tiff: "TIFF",
  heic: "HEIC",
};

export const OUTPUT_FORMATS: SupportedOutputFormat[] = ["jpeg", "png", "webp", "avif"];

export const ACCEPT_INPUT =
  "image/jpeg,image/png,image/webp,image/avif,image/gif,image/bmp,image/tiff,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.avif,.gif,.bmp,.tif,.tiff,.heic,.heif";

const MIME_TO_FORMAT: Record<string, SupportedInputFormat> = {
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/x-bmp": "bmp",
  "image/tiff": "tiff",
  "image/x-tiff": "tiff",
  "image/heic": "heic",
  "image/heif": "heic",
};

const EXT_TO_FORMAT: Record<string, SupportedInputFormat> = {
  jpg: "jpeg",
  jpeg: "jpeg",
  png: "png",
  webp: "webp",
  avif: "avif",
  gif: "gif",
  bmp: "bmp",
  tif: "tiff",
  tiff: "tiff",
  heic: "heic",
  heif: "heic",
};

export function detectInputFormat(file: File): SupportedInputFormat | null {
  const byMime = MIME_TO_FORMAT[file.type.toLowerCase()];
  if (byMime) return byMime;
  const match = file.name.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (match) {
    const ext = match[1];
    if (EXT_TO_FORMAT[ext]) return EXT_TO_FORMAT[ext];
  }
  return null;
}

export function extensionFor(format: SupportedOutputFormat): string {
  return format === "jpeg" ? "jpg" : format;
}

export function mimeFor(format: SupportedOutputFormat): string {
  return `image/${format}`;
}

export function basenameWithoutExt(name: string): string {
  return name.replace(/\.[a-z0-9]+$/i, "");
}

// Formats that need a JS/WASM decoder (browser cannot natively render them via
// createImageBitmap on all platforms in 2026).
export function needsCustomDecode(format: SupportedInputFormat): boolean {
  return format === "heic" || format === "tiff";
}

// Formats that need a JS/WASM encoder.
export function needsCustomEncode(format: SupportedOutputFormat): boolean {
  return format === "avif";
}
