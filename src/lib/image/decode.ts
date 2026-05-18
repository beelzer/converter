import { detectInputFormat } from "./formats";

export interface DecodedImage {
  source: ImageBitmap | ImageData;
  width: number;
  height: number;
}

// Decode any supported image into something canvas can draw. Native formats
// flow through createImageBitmap; HEIC and TIFF use lazy-loaded WASM/JS.
export async function decodeImage(file: File): Promise<DecodedImage> {
  const format = detectInputFormat(file);
  if (!format) {
    throw new Error(
      `Unrecognized image type. We support JPG, PNG, WebP, AVIF, GIF, BMP, TIFF, and HEIC.`
    );
  }

  if (format === "heic") {
    return decodeHeic(file);
  }
  if (format === "tiff") {
    return decodeTiff(file);
  }
  // Native: createImageBitmap covers JPG/PNG/WebP/AVIF/GIF/BMP across modern browsers.
  const bitmap = await createImageBitmap(file);
  return { source: bitmap, width: bitmap.width, height: bitmap.height };
}

interface LibheifImage {
  get_width(): number;
  get_height(): number;
  display(
    target: { data: Uint8ClampedArray; width: number; height: number },
    cb: (result: { data: Uint8ClampedArray } | null) => void
  ): void;
}

interface LibheifModule {
  HeifDecoder: new () => { decode(buffer: ArrayBuffer): LibheifImage[] };
}

async function decodeHeic(file: File): Promise<DecodedImage> {
  // libheif-js default export is a function returning the wasm module.
  const mod = (await import("libheif-js")) as unknown as
    | { default: () => Promise<LibheifModule> | LibheifModule }
    | LibheifModule;
  let libheif: LibheifModule;
  if (typeof (mod as { default?: unknown }).default === "function") {
    const factory = (mod as { default: () => Promise<LibheifModule> | LibheifModule }).default;
    libheif = await Promise.resolve(factory());
  } else if ((mod as LibheifModule).HeifDecoder) {
    libheif = mod as LibheifModule;
  } else {
    throw new Error("libheif-js loaded in an unexpected shape.");
  }

  const buffer = await file.arrayBuffer();
  const decoder = new libheif.HeifDecoder();
  const images = decoder.decode(buffer);
  if (!images || images.length === 0) {
    throw new Error("That HEIC file doesn't contain any images we can decode.");
  }
  const img = images[0];
  const width = img.get_width();
  const height = img.get_height();
  const target = {
    data: new Uint8ClampedArray(width * height * 4),
    width,
    height,
  };
  await new Promise<void>((resolve, reject) => {
    img.display(target, (result) => {
      if (!result) reject(new Error("Decode failed inside libheif."));
      else resolve();
    });
  });
  const imageData = new ImageData(target.data, width, height);
  return { source: imageData, width, height };
}

async function decodeTiff(file: File): Promise<DecodedImage> {
  const UTIF = (await import("utif2")) as unknown as {
    decode(buffer: ArrayBuffer): Array<{ width: number; height: number }>;
    decodeImage(
      buffer: ArrayBuffer,
      ifd: { width: number; height: number }
    ): void;
    toRGBA8(ifd: { width: number; height: number }): Uint8Array;
  };
  const buffer = await file.arrayBuffer();
  const ifds = UTIF.decode(buffer);
  if (!ifds || ifds.length === 0) {
    throw new Error("This TIFF file doesn't contain any image frames.");
  }
  UTIF.decodeImage(buffer, ifds[0]);
  const rgba = UTIF.toRGBA8(ifds[0]);
  const width = ifds[0].width;
  const height = ifds[0].height;
  const imageData = new ImageData(new Uint8ClampedArray(rgba), width, height);
  return { source: imageData, width, height };
}

// Draw a DecodedImage onto a canvas, optionally painting a white background
// first (for output formats that don't carry an alpha channel).
export function drawDecoded(
  decoded: DecodedImage,
  canvas: HTMLCanvasElement | OffscreenCanvas,
  fillBackground: boolean
): void {
  const ctx = canvas.getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!ctx) throw new Error("Couldn't open a 2D drawing context.");
  if (fillBackground) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (decoded.source instanceof ImageBitmap) {
    ctx.drawImage(decoded.source, 0, 0);
  } else {
    ctx.putImageData(decoded.source, 0, 0);
  }
}

// Re-export for callers that want the existing PNG-bytes shape (used by
// images-to-pdf to feed pdf-lib).
export async function imageToPngBytes(blob: Blob): Promise<ArrayBuffer> {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(bitmap.width, bitmap.height)
        : (() => {
            const c = document.createElement("canvas");
            c.width = bitmap.width;
            c.height = bitmap.height;
            return c;
          })();
    const ctx = canvas.getContext("2d") as
      | OffscreenCanvasRenderingContext2D
      | CanvasRenderingContext2D
      | null;
    if (!ctx) throw new Error("Couldn't open a 2D drawing context.");
    ctx.drawImage(bitmap, 0, 0);
    let pngBlob: Blob;
    if (canvas instanceof OffscreenCanvas) {
      pngBlob = await canvas.convertToBlob({ type: "image/png" });
    } else {
      pngBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error("Canvas couldn't produce a PNG."));
        }, "image/png");
      });
    }
    return await pngBlob.arrayBuffer();
  } finally {
    bitmap.close?.();
  }
}
