import { useState } from "preact/hooks";
import FileDropZone from "../shared/FileDropZone";
import { downloadBlob, formatSize } from "../../lib/util/file";
import { docxToHtml, docxToMarkdown, docxToText } from "../../lib/document/docx";

type OutputFormat = "html" | "markdown" | "text";

const OUTPUTS: { id: OutputFormat; label: string; ext: string; mime: string }[] = [
  { id: "html", label: "HTML", ext: "html", mime: "text/html" },
  { id: "markdown", label: "Markdown", ext: "md", mime: "text/markdown" },
  { id: "text", label: "Plain text", ext: "txt", mime: "text/plain" },
];

type Status =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "done"; warnings: string[] }
  | { kind: "error"; message: string };

export default function DocDocx() {
  const [file, setFile] = useState<File | null>(null);
  const [output, setOutput] = useState<OutputFormat>("markdown");
  const [result, setResult] = useState<string>("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const accept = (incoming: FileList | File[]) => {
    const f = Array.from(incoming)[0];
    if (!f) return;
    setFile(f);
    setResult("");
    setStatus({ kind: "idle" });
  };

  const onConvert = async () => {
    if (!file) return;
    setStatus({ kind: "working" });
    setResult("");
    try {
      if (output === "html") {
        const r = await docxToHtml(file);
        setResult(r.html);
        setStatus({ kind: "done", warnings: r.warnings });
      } else if (output === "markdown") {
        const r = await docxToMarkdown(file);
        setResult(r.markdown);
        setStatus({ kind: "done", warnings: r.warnings });
      } else {
        const r = await docxToText(file);
        setResult(r.text);
        setStatus({ kind: "done", warnings: r.warnings });
      }
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const onDownload = () => {
    if (!result || !file) return;
    const spec = OUTPUTS.find((o) => o.id === output)!;
    const base = file.name.replace(/\.docx?$/i, "");
    downloadBlob(new Blob([result], { type: spec.mime }), `${base}.${spec.ext}`, spec.mime);
  };

  const onCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
    } catch {
      // ignore
    }
  };

  const busy = status.kind === "working";

  return (
    <div class="w-full">
      <FileDropZone
        label={file ? "Drop a different .docx to replace" : "Drop a .docx file"}
        buttonLabel="Choose .docx"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        inputAriaLabel="Choose a DOCX file"
        onFiles={accept}
        subtitleHint="Old .doc files are not supported — convert to .docx in Word first."
      />

      {file && (
        <div class="mt-6">
          <div class="mb-4 p-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
            <p class="font-mono text-sm text-[var(--color-fg)] truncate">{file.name}</p>
            <p class="mt-1 font-mono text-xs text-[var(--color-fg-dim)]">
              {formatSize(file.size)}
            </p>
          </div>

          <fieldset>
            <legend class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2">
              Output format
            </legend>
            <div class="flex flex-wrap gap-2">
              {OUTPUTS.map((spec) => (
                <button
                  key={spec.id}
                  type="button"
                  onClick={() => setOutput(spec.id)}
                  aria-pressed={output === spec.id}
                  disabled={busy}
                  class={`font-mono text-sm px-4 py-2 rounded-md border transition-colors ${
                    output === spec.id
                      ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                      : "border-[var(--color-border)] text-[var(--color-fg)] hover:border-[var(--color-fg-muted)]"
                  } disabled:opacity-50`}
                >
                  {spec.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div class="mt-6">
            <button
              type="button"
              onClick={onConvert}
              disabled={busy}
              class="font-mono text-sm px-5 py-2.5 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-fg-dim)] transition-colors"
            >
              {busy ? "Converting…" : `Convert → ${OUTPUTS.find((o) => o.id === output)?.label}`}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div class="mt-6">
          <label class="block font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2">
            Result
          </label>
          <div class="rounded-md border-2 border-[var(--color-border)] bg-[var(--color-surface)]">
            <textarea
              value={result}
              readOnly
              rows={14}
              aria-label="Conversion result"
              class="block w-full bg-transparent p-3 font-mono text-sm text-[var(--color-fg)] focus:outline-none resize-y"
              spellcheck={false}
            />
            <div class="flex items-center justify-between px-3 py-2 border-t border-[var(--color-border)] text-xs font-mono text-[var(--color-fg-dim)]">
              <div class="flex gap-3">
                <button type="button" onClick={onCopy} class="hover:text-[var(--color-accent)]">
                  copy
                </button>
                <button type="button" onClick={onDownload} class="hover:text-[var(--color-accent)]">
                  download
                </button>
              </div>
              <span>{result.length.toLocaleString()} chars</span>
            </div>
          </div>
        </div>
      )}

      <div role="status" aria-live="polite" class="mt-4 min-h-[1.5rem] font-mono text-sm">
        {status.kind === "done" && status.warnings.length > 0 && (
          <details class="font-mono text-xs text-[var(--color-fg-dim)]">
            <summary class="cursor-pointer text-[var(--color-fg-muted)]">
              {status.warnings.length} conversion warning{status.warnings.length === 1 ? "" : "s"}
            </summary>
            <ul class="mt-2 ml-4 list-disc space-y-1">
              {status.warnings.slice(0, 20).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
              {status.warnings.length > 20 && (
                <li>… and {status.warnings.length - 20} more</li>
              )}
            </ul>
          </details>
        )}
        {status.kind === "error" && (
          <span class="text-[var(--color-danger)]">Error: {status.message}</span>
        )}
      </div>
    </div>
  );
}
