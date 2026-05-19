import { getPdfjs } from "../pdf/pdfjs-init";

export interface ExtractedText {
  pages: string[];
  joined: string;
}

export async function extractPdfText(
  file: File | Blob,
  onProgress?: (p: number) => void
): Promise<ExtractedText> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: unknown) =>
        item && typeof item === "object" && "str" in item
          ? (item as { str: string }).str
          : ""
      )
      .join("\n")
      .trim();
    pages.push(text);
    onProgress?.(i / doc.numPages);
  }
  return {
    pages,
    joined: pages.join("\n\n--- page break ---\n\n"),
  };
}
