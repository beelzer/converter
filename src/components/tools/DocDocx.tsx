import { useState } from "preact/hooks";
import FileDropZone from "../shared/FileDropZone";
import OutputPanel from "../shared/OutputPanel";
import type { Status } from "../shared/Widgets";
import { formatSize } from "../../lib/util/file";
import { MIME } from "../../lib/util/mime";
import { docxToHtml, docxToMarkdown, docxToText } from "../../lib/document/docx";

type OutputFormat = "html" | "markdown" | "text";

const OUTPUTS: { id: OutputFormat; label: string; ext: string; mime: string }[] = [
  { id: "html", label: "HTML", ext: "html", mime: MIME.TEXT_HTML },
  { id: "markdown", label: "Markdown", ext: "md", mime: MIME.TEXT_MARKDOWN },
  { id: "text", label: "Plain text", ext: "txt", mime: MIME.TEXT_PLAIN },
];

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
        setStatus({ kind: "done", meta: { warnings: r.warnings } });
      } else if (output === "markdown") {
        const r = await docxToMarkdown(file);
        setResult(r.markdown);
        setStatus({ kind: "done", meta: { warnings: r.warnings } });
      } else {
        const r = await docxToText(file);
        setResult(r.text);
        setStatus({ kind: "done", meta: { warnings: r.warnings } });
      }
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const spec = OUTPUTS.find((o) => o.id === output)!;
  const base = file ? file.name.replace(/\.docx?$/i, "") : "";
  const downloadName = file ? `${base}.${spec.ext}` : undefined;

  const busy = status.kind === "working";
  const warnings = (status.kind === "done" ? (status.meta?.warnings as string[] | undefined) : undefined) ?? [];

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
          <OutputPanel
            value={result}
            ariaLabel="Conversion result"
            label="Result"
            rows={14}
            filename={downloadName}
            mime={spec.mime}
          />
        </div>
      )}

      <div role="status" aria-live="polite" class="mt-4 min-h-[1.5rem] font-mono text-sm">
        {status.kind === "done" && warnings.length > 0 && (
          <details class="font-mono text-xs text-[var(--color-fg-dim)]">
            <summary class="cursor-pointer text-[var(--color-fg-muted)]">
              {warnings.length} conversion warning{warnings.length === 1 ? "" : "s"}
            </summary>
            <ul class="mt-2 ml-4 list-disc space-y-1">
              {warnings.slice(0, 20).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
              {warnings.length > 20 && (
                <li>… and {warnings.length - 20} more</li>
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
