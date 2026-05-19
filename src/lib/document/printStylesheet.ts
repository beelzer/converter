// Centralised print + preview stylesheets used by the /document hub. Both
// DocMarkdown and DocHtml previously inlined three near-identical copies
// each — they now route through this module.

import { PRINT_BLOB_URL_REVOKE_MS } from "../util/defaults";

const BASE_BODY =
  "font-family:system-ui,-apple-system,sans-serif;color:#222;line-height:1.6";
const CODE_BLOCK =
  "pre{background:#f4f4f4;padding:1rem;overflow:auto;border-radius:6px}code{font-family:ui-monospace,monospace}img{max-width:100%}";

// Stylesheet used when we open the document in a new tab for the user to
// "Save as PDF" from the browser's print dialog. Compact margins and the
// `@media print` override match what the browser's print preview expects.
export const PRINT_CSS = `body{${BASE_BODY};max-width:48rem;margin:1rem auto;padding:0 1rem;line-height:1.5}${CODE_BLOCK}@media print{body{margin:0}}`;

// Stylesheet used inside the sandboxed iframe preview on the Markdown tab.
// Lighter padding and no print overrides since this never goes to a printer.
export const PREVIEW_CSS = `body{${BASE_BODY};padding:0.75rem;margin:0}${CODE_BLOCK}`;

// Stylesheet used when the user clicks "Download .html" on the Markdown tab.
// Slightly wider margins to look reasonable when opened directly in a
// browser as a standalone document.
export const DOWNLOAD_HTML_CSS = `body{${BASE_BODY};max-width:48rem;margin:2rem auto;padding:0 1rem}${CODE_BLOCK}`;

// Build a self-contained HTML document suitable for `window.open()` into a
// blob URL. Auto-fires `window.print()` after a short delay so the user
// lands on the Save-as-PDF dialog.
export function buildPrintDocument(htmlBody: string, title = "document"): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>${PRINT_CSS}</style>
</head><body>${htmlBody}<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),200))</script></body></html>`;
}

// Build a downloadable standalone HTML document (no print auto-fire).
export function buildDownloadHtml(htmlBody: string, title = "document"): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>${DOWNLOAD_HTML_CSS}</style>
</head>
<body>
${htmlBody}
</body>
</html>`;
}

// Build the srcdoc for the sandboxed iframe preview.
export function buildPreviewSrcDoc(htmlBody: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${PREVIEW_CSS}</style></head><body>${htmlBody}</body></html>`;
}

// Open a print-ready document in a new tab. Caller passes the rendered body
// HTML; this wraps it, creates a blob URL, opens it, and schedules cleanup.
export function openPrintWindow(htmlBody: string, title?: string): void {
  const doc = buildPrintDocument(htmlBody, title);
  const url = URL.createObjectURL(new Blob([doc], { type: "text/html" }));
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), PRINT_BLOB_URL_REVOKE_MS);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
