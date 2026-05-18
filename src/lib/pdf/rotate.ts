import { PDFDocument, degrees } from "pdf-lib";
import { parsePageList } from "./split";

export type RotationAngle = 90 | 180 | 270;

export interface RotateResult {
  bytes: Uint8Array;
  filename: string;
  rotatedPageCount: number;
  totalPageCount: number;
}

function basenameWithoutExt(name: string): string {
  return name.replace(/\.pdf$/i, "");
}

// Rotate pages by `angle` degrees clockwise. If `pagesInput` is empty, rotate
// every page. Otherwise apply only to the listed pages (same range syntax as
// the splitter: "1-3, 5, 7-").
export async function rotatePdf(
  buffer: ArrayBuffer,
  sourceName: string,
  angle: RotationAngle,
  pagesInput: string
): Promise<RotateResult> {
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: false });
  const totalPageCount = doc.getPageCount();
  if (totalPageCount === 0) {
    throw new Error("This PDF has no pages.");
  }

  const trimmed = pagesInput.trim();
  let targets: number[];
  if (!trimmed) {
    targets = Array.from({ length: totalPageCount }, (_, i) => i);
  } else {
    targets = parsePageList(trimmed, totalPageCount);
  }

  // Use a Set to dedupe — rotating a page twice in a single pass would be a
  // surprising no-op (pdf-lib's setRotation is absolute, not additive… but in
  // case behavior changes, dedupe is the safer contract for callers).
  const seen = new Set<number>();
  const pages = doc.getPages();
  for (const index of targets) {
    if (seen.has(index)) continue;
    seen.add(index);
    const page = pages[index];
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + angle) % 360));
  }

  const bytes = await doc.save();
  const base = basenameWithoutExt(sourceName) || "document";
  return {
    bytes,
    filename: `${base}-rotated.pdf`,
    rotatedPageCount: seen.size,
    totalPageCount,
  };
}
