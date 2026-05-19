import { useState } from "preact/hooks";
import FileDropZone from "../shared/FileDropZone";
import { downloadBlob, formatSize } from "../../lib/util/file";
import { extractPdfText } from "../../lib/document/pdfText";

type Status =
  | { kind: "idle" }
  | { kind: "working"; p: number }
  | { kind: "done"; pageCount: number }
  | { kind: "error"; message: string };

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
      setStatus({ kind: "done", pageCount: r.pages.length });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const onDownload = () => {
    if (!text || !file) return;
    const base = file.name.replace(/\.pdf$/i, "");
    downloadBlob(
      new Blob([text], { type: "text/plain" }),
      `${base}.txt`,
      "text/plain"
    );
  };

  const onCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

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
            {busy ? `Extracting… ${Math.round(status.p * 100)}%` : "Extract text"}
          </button>
        </div>
      )}

      {text && (
        <div class="mt-6">
          <label class="block font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2">
            Extracted text
          </label>
          <div class="rounded-md border-2 border-[var(--color-border)] bg-[var(--color-surface)]">
            <textarea
              value={text}
              readOnly
              rows={14}
              aria-label="Extracted text"
              class="block w-full bg-transparent p-3 font-mono text-sm text-[var(--color-fg)] focus:outline-none resize-y"
              spellcheck={false}
            />
            <div class="flex items-center justify-between px-3 py-2 border-t border-[var(--color-border)] text-xs font-mono text-[var(--color-fg-dim)]">
              <div class="flex gap-3">
                <button type="button" onClick={onCopy} class="hover:text-[var(--color-accent)]">
                  copy
                </button>
                <button type="button" onClick={onDownload} class="hover:text-[var(--color-accent)]">
                  download .txt
                </button>
              </div>
              <span>{text.length.toLocaleString()} chars</span>
            </div>
          </div>
        </div>
      )}

      <div role="status" aria-live="polite" class="mt-4 min-h-[1.5rem] font-mono text-sm">
        {status.kind === "done" && (
          <span class="text-[var(--color-accent)]">
            ✓ Extracted text from {status.pageCount} page{status.pageCount === 1 ? "" : "s"}.
          </span>
        )}
        {status.kind === "error" && (
          <span class="text-[var(--color-danger)]">Error: {status.message}</span>
        )}
      </div>
    </div>
  );
}
