import { getPdfjs } from "./pdfjs-init";

export interface ThumbnailRenderer {
  // Render the 1-indexed page at the given pixel width. Returns a data URL
  // suitable for direct use in an <img src>. The renderer keeps the pdf.js
  // doc handle open; call destroy() when done.
  renderPage(pageNumber: number, targetWidth: number): Promise<string>;
  destroy(): Promise<void>;
  readonly pageCount: number;
}

export async function openThumbnailRenderer(
  buffer: ArrayBuffer
): Promise<ThumbnailRenderer> {
  const pdfjs = await getPdfjs();
  const data = new Uint8Array(buffer.slice(0));
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;

  return {
    pageCount: doc.numPages,
    async renderPage(pageNumber: number, targetWidth: number): Promise<string> {
      const page = await doc.getPage(pageNumber);
      try {
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = targetWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Couldn't open a 2D drawing context.");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, viewport }).promise;
        return canvas.toDataURL("image/jpeg", 0.75);
      } finally {
        page.cleanup();
      }
    },
    async destroy() {
      await doc.destroy();
    },
  };
}
