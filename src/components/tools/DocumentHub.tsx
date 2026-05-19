import { useState } from "preact/hooks";
import DocMarkdown from "./DocMarkdown";
import DocHtml from "./DocHtml";
import DocDocx from "./DocDocx";
import DocPdfText from "./DocPdfText";

type Mode = "markdown" | "html" | "docx" | "pdf";

interface ModeSpec {
  id: Mode;
  label: string;
  blurb: string;
}

const MODES: ModeSpec[] = [
  {
    id: "markdown",
    label: "Markdown",
    blurb:
      "Edit Markdown with a live HTML preview. Download as .md, .html, or hand off to the browser print dialog to save as PDF.",
  },
  {
    id: "html",
    label: "HTML",
    blurb:
      "Paste HTML to convert it to clean Markdown via turndown, or print it to PDF using the browser's native engine.",
  },
  {
    id: "docx",
    label: "DOCX",
    blurb:
      "Drop a .docx file to convert it to HTML, Markdown, or plain text via mammoth. Powerpoint and old .doc files not supported.",
  },
  {
    id: "pdf",
    label: "PDF → text",
    blurb:
      "Extract the text layer from a PDF. Works on text-based PDFs; scanned image-only PDFs need OCR (not in this tool).",
  },
];

export default function DocumentHub() {
  const [mode, setMode] = useState<Mode>("markdown");
  const active = MODES.find((m) => m.id === mode) ?? MODES[0];

  return (
    <div class="w-full">
      <div
        role="tablist"
        aria-label="Choose a document operation"
        class="flex flex-wrap gap-2 border-b border-[var(--color-border)] pb-3 mb-4"
      >
        {MODES.map((m) => {
          const isActive = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${m.id}`}
              id={`tab-${m.id}`}
              onClick={() => setMode(m.id)}
              class={`font-mono text-sm px-3 py-1.5 rounded-md border transition-colors ${
                isActive
                  ? "border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-surface)]"
                  : "border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border)]"
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      <p class="font-mono text-xs text-[var(--color-fg-dim)] mb-6">{active.blurb}</p>

      <div role="tabpanel" id={`panel-${mode}`} aria-labelledby={`tab-${mode}`} key={mode}>
        {mode === "markdown" && <DocMarkdown />}
        {mode === "html" && <DocHtml />}
        {mode === "docx" && <DocDocx />}
        {mode === "pdf" && <DocPdfText />}
      </div>
    </div>
  );
}
