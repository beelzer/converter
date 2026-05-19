import { useState } from "preact/hooks";
import FileDropZone from "../shared/FileDropZone";
import OutputPanel from "../shared/OutputPanel";
import type { Status } from "../shared/Widgets";
import { formatSize } from "../../lib/util/file";
import { MIME } from "../../lib/util/mime";
import { extractPdfText } from "../../lib/document/pdfText";

export default function DocPdfText() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const accept = (incoming: FileList | File[]) => {
    const f = Array.from(incoming)[0];
    if (!f) return;
    setFile(f);
    setText("");
    setStatus({ kind: "idle" });
  };

  const onExtract = async () => {
    if (!file) return;
    setStatus({ kind: "working", p: 0 });
    setText("");
    try {
      const r = await extractPdfText(file, (p) => setStatus({ kind: "working", p }));
      setText(r.joined);
      setStatus({ kind: "done", count: r.pages.length });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const base = file ? file.name.replace(/\.pdf$/i, "") : "";
  const downloadName = file ? `${base}.txt` : undefined;

  const busy = status.kind === "working";

  return (
    <div class="w-full">
      <FileDropZone
        label={file ? "Drop a different PDF to replace" : "Drop a PDF file"}
        buttonLabel="Choose PDF"
        accept="application/pdf,.pdf"
        inputAriaLabel="Choose a PDF file"
        onFiles={accept}
        subtitleHint="Text extraction. For image-only PDFs (scans), no text will come out — that's an OCR job."
      />

      {file && (
        <div class="mt-6">
          <div class="mb-4 p-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
            <p class="font-mono text-sm text-[var(--color-fg)] truncate">{file.name}</p>
            <p class="mt-1 font-mono text-xs text-[var(--color-fg-dim)]">
              {formatSize(file.size)}
            </p>
          </div>

          <button
            type="button"
            onClick={onExtract}
            disabled={busy}
            class="font-mono text-sm px-5 py-2.5 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-fg-dim)] transition-colors"
          >
            {busy ? `Extracting… ${Math.round((status.p ?? 0) * 100)}%` : "Extract text"}
          </button>
        </div>
      )}

      {text && (
        <div class="mt-6">
          <OutputPanel
            value={text}
            ariaLabel="Extracted text"
            label="Extracted text"
            rows={14}
            filename={downloadName}
            mime={MIME.TEXT_PLAIN}
          />
        </div>
      )}

      <div role="status" aria-live="polite" class="mt-4 min-h-[1.5rem] font-mono text-sm">
        {status.kind === "done" && (
          <span class="text-[var(--color-accent)]">
            ✓ Extracted text from {status.count} page{status.count === 1 ? "" : "s"}.
          </span>
        )}
        {status.kind === "error" && (
          <span class="text-[var(--color-danger)]">Error: {status.message}</span>
        )}
      </div>
    </div>
  );
}
