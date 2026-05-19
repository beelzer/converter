// DOCX → HTML / Markdown / plain text. Uses mammoth.js, lazy-loaded.
// Mammoth's main entry depends on a stack of node-style modules (bluebird,
// underscore, jszip). Vite handles them via its CJS interop, but we point at
// the prebuilt browser bundle to keep things predictable.

import { htmlToMarkdown } from "./markdown";

interface MammothResult {
  value: string;
  messages: { type: string; message: string }[];
}

interface MammothModule {
  convertToHtml(input: { arrayBuffer: ArrayBuffer }, options?: unknown): Promise<MammothResult>;
  extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<MammothResult>;
}

async function loadMammoth(): Promise<MammothModule> {
  // The browser bundle is a UMD module exporting `mammoth` as default.
  const mod = await import("mammoth/mammoth.browser.js");
  // The UMD shape varies: try `.default` first, fall back to the module object.
  const m = (mod as unknown as { default?: MammothModule }).default ?? (mod as unknown as MammothModule);
  return m;
}

export async function docxToHtml(file: File | Blob): Promise<{ html: string; warnings: string[] }> {
  const arrayBuffer = await file.arrayBuffer();
  const mammoth = await loadMammoth();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  return {
    html: result.value,
    warnings: result.messages.map((m) => `${m.type}: ${m.message}`),
  };
}

export async function docxToMarkdown(file: File | Blob): Promise<{ markdown: string; warnings: string[] }> {
  const { html, warnings } = await docxToHtml(file);
  const markdown = await htmlToMarkdown(html);
  return { markdown, warnings };
}

export async function docxToText(file: File | Blob): Promise<{ text: string; warnings: string[] }> {
  const arrayBuffer = await file.arrayBuffer();
  const mammoth = await loadMammoth();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return {
    text: result.value,
    warnings: result.messages.map((m) => `${m.type}: ${m.message}`),
  };
}
