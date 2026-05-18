// Re-encode any browser-decodable image as PNG via an offscreen canvas.
// Use this only for formats pdf-lib can't embed directly (WebP, GIF, BMP, …).
// JPG and PNG should be passed through as-is to preserve quality + speed.
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
