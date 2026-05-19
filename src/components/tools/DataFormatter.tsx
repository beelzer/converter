import { useState } from "preact/hooks";
import DataInput from "../shared/DataInput";
import { downloadBlob } from "../../lib/util/file";
import { parseData } from "../../lib/data/parse";
import { serializeData } from "../../lib/data/serialize";
import {
  DATA_FORMATS,
  FORMAT_EXT,
  FORMAT_LABEL,
  FORMAT_MIME,
  detectFromText,
  type DataFormat,
} from "../../lib/data/formats";

type Status =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "done"; bytes: number }
  | { kind: "error"; message: string };

export default function DataFormatter() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [format, setFormat] = useState<DataFormat>("json");
  const [mode, setMode] = useState<"pretty" | "minify">("pretty");
  const [indent, setIndent] = useState(2);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const onInputChange = (text: string, detected: DataFormat | null) => {
    setInput(text);
    setOutput("");
    setStatus({ kind: "idle" });
    if (detected) setFormat(detected);
    else {
      const sniff = detectFromText(text);
      if (sniff) setFormat(sniff);
    }
  };

  const onRun = async () => {
    if (!input.trim()) {
      setStatus({ kind: "error", message: "Paste or drop some input first." });
      return;
    }
    setStatus({ kind: "working" });
    try {
      const value = await parseData(input, format);
      const result = await serializeData(value, format, {
        minify: mode === "minify",
        indent,
      });
      setOutput(result);
      setStatus({ kind: "done", bytes: new TextEncoder().encode(result).length });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const onDownload = () => {
    if (!output) return;
    downloadBlob(
      new Blob([output], { type: FORMAT_MIME[format] }),
      `formatted.${FORMAT_EXT[format]}`,
      FORMAT_MIME[format]
    );
  };

  const onCopy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
    } catch {
      // ignore
    }
  };

  const busy = status.kind === "working";

  return (
    <div class="w-full">
      <div class="flex items-center justify-between mb-2">
        <label class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)]">
          Input
        </label>
        <select
          aria-label="Format"
          value={format}
          onChange={(e) => setFormat((e.currentTarget as HTMLSelectElement).value as DataFormat)}
          disabled={busy}
          class="font-mono text-xs px-2 py-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] hover:border-[var(--color-fg-muted)] disabled:opacity-50"
        >
          {DATA_FORMATS.map((f) => (
            <option key={f} value={f}>
              {FORMAT_LABEL[f]}
            </option>
          ))}
        </select>
      </div>
      <DataInput
        value={input}
        onChange={onInputChange}
        disabled={busy}
        ariaLabel="Input data to format"
        placeholder={`Paste ${FORMAT_LABEL[format]} here, or drop a file.`}
      />

      <div class="mt-6 flex flex-wrap items-center gap-4">
        <div role="radiogroup" aria-label="Formatting mode" class="flex gap-2">
          {(["pretty", "minify"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              disabled={busy}
              class={`font-mono text-sm px-4 py-2 rounded-md border transition-colors ${
                mode === m
                  ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                  : "border-[var(--color-border)] text-[var(--color-fg)] hover:border-[var(--color-fg-muted)]"
              } disabled:opacity-50`}
            >
              {m === "pretty" ? "Pretty" : "Minify"}
            </button>
          ))}
        </div>
        {mode === "pretty" && (
          <label class="font-mono text-sm text-[var(--color-fg-muted)] inline-flex items-center gap-2">
            indent
            <select
              value={indent}
              onChange={(e) => setIndent(parseInt((e.currentTarget as HTMLSelectElement).value, 10))}
              disabled={busy}
              class="font-mono text-xs px-2 py-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)]"
            >
              <option value="2">2 spaces</option>
              <option value="4">4 spaces</option>
              <option value="0">tab</option>
            </select>
          </label>
        )}
        <button
          type="button"
          onClick={onRun}
          disabled={busy}
          class="font-mono text-sm px-5 py-2.5 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-fg-dim)] disabled:cursor-not-allowed transition-colors"
        >
          {busy ? "Working…" : mode === "pretty" ? "Format" : "Minify"}
        </button>
      </div>

      {(output || status.kind === "error") && (
        <div class="mt-6">
          <div class="flex items-center justify-between mb-2">
            <label class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)]">
              Output
            </label>
          </div>
          <div class="rounded-lg border-2 border-[var(--color-border)] bg-[var(--color-surface)]">
            <textarea
              value={output}
              readOnly
              rows={12}
              aria-label="Formatted output"
              class="block w-full bg-transparent p-3 font-mono text-sm text-[var(--color-fg)] focus:outline-none resize-y"
              spellcheck={false}
            />
            <div class="flex items-center justify-between px-3 py-2 border-t border-[var(--color-border)] text-xs font-mono text-[var(--color-fg-dim)]">
              <div class="flex gap-3">
                <button
                  type="button"
                  onClick={onCopy}
                  disabled={!output}
                  class="hover:text-[var(--color-accent)] disabled:opacity-50"
                >
                  copy
                </button>
                <button
                  type="button"
                  onClick={onDownload}
                  disabled={!output}
                  class="hover:text-[var(--color-accent)] disabled:opacity-50"
                >
                  download
                </button>
              </div>
              <span>{output.length > 0 ? `${output.length.toLocaleString()} chars` : "empty"}</span>
            </div>
          </div>
        </div>
      )}

      <div role="status" aria-live="polite" class="mt-4 min-h-[1.5rem] font-mono text-sm">
        {status.kind === "done" && (
          <span class="text-[var(--color-accent)]">
            ✓ {status.bytes.toLocaleString()} bytes
          </span>
        )}
        {status.kind === "error" && (
          <span class="text-[var(--color-danger)]">Error: {status.message}</span>
        )}
      </div>
    </div>
  );
}
