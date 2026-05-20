import { describe, expect, it } from "vitest";
import { docxToHtml, docxToMarkdown, docxToText } from "./docx";
import sampleDocxUrl from "../../../e2e/fixtures/document/sample.docx?url";

async function fetchAsFile(url: string, name: string, type: string): Promise<File> {
  const res = await fetch(url);
  return new File([await res.arrayBuffer()], name, { type });
}

const fixture = () =>
  fetchAsFile(
    sampleDocxUrl,
    "sample.docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );

describe("docxToHtml", () => {
  it("converts DOCX content to HTML", async () => {
    const file = await fixture();
    const result = await docxToHtml(file);
    expect(typeof result.html).toBe("string");
    expect(result.html.length).toBeGreaterThan(0);
    // Mammoth always wraps body content in HTML tags for paragraphs / headings.
    expect(result.html).toMatch(/<(p|h\d|ul|ol)/);
    expect(Array.isArray(result.warnings)).toBe(true);
  }, 30_000);
});

describe("docxToMarkdown", () => {
  it("chains HTML conversion through to markdown", async () => {
    const file = await fixture();
    const result = await docxToMarkdown(file);
    expect(typeof result.markdown).toBe("string");
    expect(result.markdown.length).toBeGreaterThan(0);
  }, 30_000);
});

describe("docxToText", () => {
  it("extracts plain text content", async () => {
    const file = await fixture();
    const result = await docxToText(file);
    expect(typeof result.text).toBe("string");
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.text).not.toContain("<");
  }, 30_000);
});
