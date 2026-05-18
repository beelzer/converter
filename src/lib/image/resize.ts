import { decodeImage } from "./decode";
import {
  basenameWithoutExt,
  detectInputFormat,
  extensionFor,
  type SupportedOutputFormat,
} from "./formats";

export interface ResizeOptions {
  // Target maximum dimensions. Aspect ratio is always preserved.
  maxWidth: number;
  maxHeight: number;
  // If both target dimensions are >= source, do nothing (don't upscale).
  preventUpscale?: boolean;
  // Output format; default = same as input where possible, falling back to PNG.
  outputFormat?: SupportedOutputFormat;
  quality?: number;
}

export interface ResizeResult {
  blob: Blob;
  name: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
}

function fitInside(
  srcW: number,
  srcH: number,
  maxW: number,
  maxH: number
): { width: number; height: number } {
  const scale = Math.min(maxW / srcW, maxH / srcH);
  return {
    width: Math.max(1, Math.round(srcW * scale)),
    height: Math.max(1, Math.round(srcH * scale)),
  };
}

export async function resizeImage(
  file: File,
  options: ResizeOptions
): Promise<ResizeResult> {
  const decoded = await decodeImage(file);
  const inputFormat = detectInputFormat(file);
  const targetFormat: SupportedOutputFormat =
    options.outputFormat ??
    (inputFormat === "jpeg" || inputFormat === "png" || inputFormat === "webp"
      ? (inputFormat as SupportedOutputFormat)
      : "png");

  let { width: targetW, height: targetH } = fitInside(
    decoded.width,
    decoded.height,
    options.maxWidth,
    options.maxHeight
  );

  if (
    options.preventUpscale &&
    targetW >= decoded.width &&
    targetH >= decoded.height
  ) {
    targetW = decoded.width;
    targetH = decoded.height;
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't open a 2D drawing context.");

    // Fill white only when the target format won't carry alpha.
    if (targetFormat === "jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetW, targetH);
    }

    if (decoded.source instanceof ImageBitmap) {
      ctx.drawImage(decoded.source, 0, 0, targetW, targetH);
    } else {
      // ImageData path — composite via an intermediate canvas to scale.
      const stage = document.createElement("canvas");
      stage.width = decoded.width;
      stage.height = decoded.height;
      const stageCtx = stage.getContext("2d");
      if (!stageCtx) throw new Error("Couldn't open a 2D drawing context.");
      stageCtx.putImageData(decoded.source, 0, 0);
      ctx.drawImage(stage, 0, 0, targetW, targetH);
    }

    // Encode by re-wrapping the resized canvas as a fake DecodedImage.
    // (encodeImage accepts ImageBitmap too — we can convert the canvas into one
    //  via createImageBitmap to keep the API tidy, but the canvas path is
    //  simpler here.)
    const blob = await new Promise<Blob>((resolve, reject) => {
      const mime = `image/${targetFormat}`;
      const q = options.quality ?? 0.92;
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error(`Couldn't encode as ${targetFormat}.`));
        },
        mime,
        targetFormat === "jpeg" || targetFormat === "webp" ? q : undefined
      );
    });

    const base = basenameWithoutExt(file.name) || "image";
    return {
      blob,
      name: `${base}-${targetW}x${targetH}.${extensionFor(targetFormat)}`,
      width: targetW,
      height: targetH,
      originalWidth: decoded.width,
      originalHeight: decoded.height,
    };
  } finally {
    if (decoded.source instanceof ImageBitmap) decoded.source.close?.();
  }
}
