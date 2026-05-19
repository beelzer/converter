import { useState } from "preact/hooks";
import DataInput from "../shared/DataInput";
import OutputPanel from "../shared/OutputPanel";
import type { Status } from "../shared/Widgets";
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
      setStatus({ kind: "done", size: new TextEncoder().encode(result).length });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
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
          <OutputPanel
            value={output}
            ariaLabel="Formatted output"
            label="Output"
            filename={`formatted.${FORMAT_EXT[format]}`}
            mime={FORMAT_MIME[format]}
          />
        </div>
      )}

      <div role="status" aria-live="polite" class="mt-4 min-h-[1.5rem] font-mono text-sm">
        {status.kind === "done" && (
          <span class="text-[var(--color-accent)]">
            ✓ {(status.size ?? 0).toLocaleString()} bytes
          </span>
        )}
        {status.kind === "error" && (
          <span class="text-[var(--color-danger)]">Error: {status.message}</span>
        )}
      </div>
    </div>
  );
}
