import { getPdfjs } from "./pdfjs-init";
import { parsePageList } from "./split";

export type OutputFormat = "jpeg" | "png";

export interface PdfToImagesOptions {
  format: OutputFormat;
  // pdf.js scale factor. 1 ≈ 72 dpi, 2 ≈ 144, 3 ≈ 216, 4 ≈ 288.
  scale: number;
  // JPEG quality, 0..1. Ignored for PNG.
  quality?: number;
  // 1-indexed page list, e.g. "1-3, 5". Empty means every page.
  pages?: string;
  onProgress?: (done: number, total: number) => void;
}

export interface RenderedPage {
  name: string;
  bytes: Uint8Array;
  pageNumber: number;
  width: number;
  height: number;
}

export interface PdfToImagesResult {
  pages: RenderedPage[];
  sourcePageCount: number;
}

function basenameWithoutExt(name: string): string {
  return name.replace(/\.pdf$/i, "");
}

async function canvasToBytes(
  canvas: HTMLCanvasElement,
  format: OutputFormat,
  quality: number | undefined
): Promise<Uint8Array> {
  const mime = format === "jpeg" ? "image/jpeg" : "image/png";
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Couldn't encode page as image."));
      },
      mime,
      format === "jpeg" ? quality ?? 0.92 : undefined
    );
  });
  return new Uint8Array(await blob.arrayBuffer());
}

export async function pdfToImages(
  buffer: ArrayBuffer,
  sourceName: string,
  options: PdfToImagesOptions
): Promise<PdfToImagesResult> {
  const pdfjs = await getPdfjs();
  // Clone the buffer because pdf.js takes ownership of the underlying data.
  const data = new Uint8Array(buffer.slice(0));
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;
  try {
    const sourcePageCount = doc.numPages;
    const wanted = options.pages?.trim()
      ? parsePageList(options.pages, sourcePageCount).map((i) => i + 1)
      : Array.from({ length: sourcePageCount }, (_, i) => i + 1);

    const ext = options.format === "jpeg" ? "jpg" : "png";
    const base = basenameWithoutExt(sourceName) || "document";
    const padWidth = String(sourcePageCount).length;
    const pages: RenderedPage[] = [];

    let done = 0;
    options.onProgress?.(0, wanted.length);

    for (const pageNumber of wanted) {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: options.scale });
      const width = Math.ceil(viewport.width);
      const height = Math.ceil(viewport.height);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Couldn't open a 2D drawing context.");

      // Paint a white background for JPEG (which has no alpha) so transparent
      // PDF content doesn't render as black.
      if (options.format === "jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
      }

      await page.render({ canvas, viewport }).promise;
      page.cleanup();

      const bytes = await canvasToBytes(canvas, options.format, options.quality);
      const padded = String(pageNumber).padStart(padWidth, "0");
      pages.push({
        name: `${base}-page-${padded}.${ext}`,
        bytes,
        pageNumber,
        width,
        height,
      });

      done += 1;
      options.onProgress?.(done, wanted.length);
    }

    return { pages, sourcePageCount };
  } finally {
    await doc.destroy();
  }
}
