import { PDFDocument } from "pdf-lib";

export type SupportedImageMime = "image/jpeg" | "image/png";

export interface ImageInput {
  bytes: ArrayBuffer;
  mime: SupportedImageMime;
  name: string;
}

export interface ImagesToPdfResult {
  bytes: Uint8Array;
  filename: string;
  pageCount: number;
}

// Build a PDF where each input image becomes a single page sized to that
// image's pixel dimensions. No scaling, no margins — what you drop is what
// you get. Caller is responsible for re-encoding exotic formats (WebP, etc.)
// to PNG before calling.
export async function imagesToPdf(
  images: ImageInput[]
): Promise<ImagesToPdfResult> {
  if (images.length === 0) {
    throw new Error("No images to combine.");
  }

  const doc = await PDFDocument.create();

  for (const image of images) {
    const embedded =
      image.mime === "image/jpeg"
        ? await doc.embedJpg(image.bytes)
        : await doc.embedPng(image.bytes);

    const page = doc.addPage([embedded.width, embedded.height]);
    page.drawImage(embedded, {
      x: 0,
      y: 0,
      width: embedded.width,
      height: embedded.height,
    });
  }

  const bytes = await doc.save();
  const base =
    images[0].name.replace(/\.[a-z0-9]+$/i, "") || "images";
  return {
    bytes,
    filename: `${base}.pdf`,
    pageCount: images.length,
  };
}
