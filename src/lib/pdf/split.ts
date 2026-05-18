import { PDFDocument } from "pdf-lib";

export interface SplitResult {
  bytes: Uint8Array;
  filename: string;
  pageCount: number;
  sourcePageCount: number;
}

// Parse a 1-indexed range expression like "1-3, 5, 7-" against a known page
// count. Returns a flat list of 0-indexed page indices in the order the user
// listed them — duplicates are preserved (the user may legitimately want a
// page to appear twice in the output).
//
// Open-ended ranges: "7-" means "page 7 to the end". "-3" means "page 1 to 3".
export function parsePageList(input: string, pageCount: number): number[] {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Enter at least one page or range, e.g. 1-3, 5, 7-");
  }

  const segments = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) {
    throw new Error("No pages or ranges found.");
  }

  const out: number[] = [];

  for (const seg of segments) {
    const rangeMatch = seg.match(/^(\d+)?\s*-\s*(\d+)?$/);
    if (rangeMatch) {
      const startStr = rangeMatch[1];
      const endStr = rangeMatch[2];
      if (!startStr && !endStr) {
        throw new Error(`Bad range: "${seg}" — needs a start or an end.`);
      }
      const start = startStr ? parseInt(startStr, 10) : 1;
      const end = endStr ? parseInt(endStr, 10) : pageCount;
      if (!Number.isInteger(start) || !Number.isInteger(end)) {
        throw new Error(`Bad range: "${seg}"`);
      }
      if (start < 1 || end < 1 || start > pageCount || end > pageCount) {
        throw new Error(
          `Range "${seg}" is out of bounds — this PDF has ${pageCount} pages.`
        );
      }
      if (start > end) {
        throw new Error(`Range "${seg}" starts after it ends.`);
      }
      for (let p = start; p <= end; p++) out.push(p - 1);
      continue;
    }

    if (/^\d+$/.test(seg)) {
      const page = parseInt(seg, 10);
      if (page < 1 || page > pageCount) {
        throw new Error(
          `Page ${page} is out of bounds — this PDF has ${pageCount} pages.`
        );
      }
      out.push(page - 1);
      continue;
    }

    throw new Error(`Couldn't parse "${seg}". Use formats like 1-3, 5, 7-.`);
  }

  return out;
}

function basenameWithoutExt(name: string): string {
  return name.replace(/\.pdf$/i, "");
}

export async function readPageCount(buffer: ArrayBuffer): Promise<number> {
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: false });
  return doc.getPageCount();
}

export async function extractPages(
  buffer: ArrayBuffer,
  sourceName: string,
  pagesInput: string
): Promise<SplitResult> {
  const source = await PDFDocument.load(buffer, { ignoreEncryption: false });
  const sourcePageCount = source.getPageCount();
  if (sourcePageCount === 0) {
    throw new Error("This PDF has no pages.");
  }

  const pageIndices = parsePageList(pagesInput, sourcePageCount);

  const out = await PDFDocument.create();
  const copied = await out.copyPages(source, pageIndices);
  for (const page of copied) out.addPage(page);

  const bytes = await out.save();
  const base = basenameWithoutExt(sourceName) || "document";
  return {
    bytes,
    filename: `${base}-pages.pdf`,
    pageCount: pageIndices.length,
    sourcePageCount,
  };
}
