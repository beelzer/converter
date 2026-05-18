// One-time pdf.js setup. The worker URL goes through Vite's `?url` import so
// the worker bundle is fingerprinted and emitted alongside the rest of the
// site assets — no CDN, no CORS surprises.
import type * as PdfjsType from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

let initialized = false;

export async function getPdfjs(): Promise<typeof PdfjsType> {
  const pdfjs = await import("pdfjs-dist");
  if (!initialized) {
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
    initialized = true;
  }
  return pdfjs;
}
