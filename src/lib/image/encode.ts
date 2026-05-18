import {
  mimeFor,
  needsCustomEncode,
  type SupportedOutputFormat,
} from "./formats";
import { drawDecoded, type DecodedImage } from "./decode";

export interface EncodeOptions {
  format: SupportedOutputFormat;
  // 0..1 for lossy formats. Ignored by PNG.
  quality?: number;
}

// Take a decoded image and produce an encoded Blob in the chosen format.
export async function encodeImage(
  decoded: DecodedImage,
  options: EncodeOptions
): Promise<Blob> {
  const { format, quality = 0.92 } = options;

  // AVIF: native encode isn't reliable across browsers in 2026; use @jsquash.
  if (needsCustomEncode(format)) {
    return encodeAvif(decoded, quality);
  }

  // Everything else flows through canvas.toBlob.
  const canvas = document.createElement("canvas");
  canvas.width = decoded.width;
  canvas.height = decoded.height;
  drawDecoded(decoded, canvas, format === "jpeg");

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else
          reject(new Error(`Couldn't encode as ${format.toUpperCase()}.`));
      },
      mimeFor(format),
      format === "jpeg" || format === "webp" ? quality : undefined
    );
  });
}

async function encodeAvif(
  decoded: DecodedImage,
  quality: number
): Promise<Blob> {
  // Get ImageData via canvas if we started from ImageBitmap.
  let imageData: ImageData;
  if (decoded.source instanceof ImageData) {
    imageData = decoded.source;
  } else {
    const c = document.createElement("canvas");
    c.width = decoded.width;
    c.height = decoded.height;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Couldn't open a 2D drawing context.");
    ctx.drawImage(decoded.source, 0, 0);
    imageData = ctx.getImageData(0, 0, c.width, c.height);
  }
  const mod = await import("@jsquash/avif");
  const encode = mod.encode ?? (mod as unknown as { default: typeof mod.encode }).default;
  // @jsquash/avif quality goes 0..100. Map our 0..1 to 1..100 (1 is the
  // lowest legal value; 0 means lossless).
  const avifQuality = Math.max(1, Math.min(100, Math.round(quality * 100)));
  const bytes = await encode(imageData, {
    quality: avifQuality,
    speed: 6,
  });
  return new Blob([bytes as BlobPart], { type: "image/avif" });
}
