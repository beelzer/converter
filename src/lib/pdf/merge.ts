import { PDFDocument } from "pdf-lib";

export interface MergeResult {
  bytes: Uint8Array;
  pageCount: number;
}

export async function mergePdfs(buffers: ArrayBuffer[]): Promise<MergeResult> {
  if (buffers.length === 0) {
    throw new Error("No PDFs to merge.");
  }

  const merged = await PDFDocument.create();

  for (const buffer of buffers) {
    const source = await PDFDocument.load(buffer, { ignoreEncryption: false });
    const indices = source.getPageIndices();
    const copied = await merged.copyPages(source, indices);
    for (const page of copied) {
      merged.addPage(page);
    }
  }

  const bytes = await merged.save();
  return { bytes, pageCount: merged.getPageCount() };
}
