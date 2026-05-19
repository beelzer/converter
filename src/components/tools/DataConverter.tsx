import { useState } from "preact/hooks";
import DataInput from "../shared/DataInput";
import OutputPanel from "../shared/OutputPanel";
import type { Status } from "../shared/Widgets";
import { convertData } from "../../lib/data/convert";
import {
  DATA_FORMATS,
  FORMAT_EXT,
  FORMAT_LABEL,
  FORMAT_MIME,
  detectFromText,
  type DataFormat,
} from "../../lib/data/formats";

export default function DataConverter() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [from, setFrom] = useState<DataFormat>("json");
  const [to, setTo] = useState<DataFormat>("yaml");
  const [minify, setMinify] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const onInputChange = (text: string, detected: DataFormat | null) => {
    setInput(text);
    setOutput("");
    setStatus({ kind: "idle" });
    if (detected) setFrom(detected);
    else {
      const sniff = detectFromText(text);
      if (sniff) setFrom(sniff);
    }
  };

  const onConvert = async () => {
    if (!input.trim()) {
      setStatus({ kind: "error", message: "Paste or drop some input first." });
      return;
    }
    setStatus({ kind: "working" });
    setOutput("");
    try {
      const result = await convertData(input, from, to, { minify });
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
    <div class="w-full grid gap-4 lg:grid-cols-2">
      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)]">
            Input
          </label>
          <FormatSelect value={from} onChange={setFrom} disabled={busy} id="from" />
        </div>
        <DataInput
          value={input}
          onChange={onInputChange}
          disabled={busy}
          ariaLabel="Input data"
          placeholder={`Paste ${FORMAT_LABEL[from]} here, or drop a file.`}
        />
      </div>

      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)]">
            Output
          </label>
          <FormatSelect value={to} onChange={setTo} disabled={busy} id="to" />
        </div>
        <OutputPanel
          value={output}
          ariaLabel="Output data"
          filename={`data.${FORMAT_EXT[to]}`}
          mime={FORMAT_MIME[to]}
        />
      </div>

      <div class="lg:col-span-2 flex flex-wrap items-center gap-4 mt-2">
        <button
          type="button"
          onClick={onConvert}
          disabled={busy}
          class="font-mono text-sm px-5 py-2.5 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-fg-dim)] disabled:cursor-not-allowed transition-colors"
        >
          {busy ? "Converting…" : `${FORMAT_LABEL[from]} → ${FORMAT_LABEL[to]}`}
        </button>
        <label class="font-mono text-sm text-[var(--color-fg-muted)] inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={minify}
            onChange={(e) => setMinify((e.currentTarget as HTMLInputElement).checked)}
            disabled={busy}
            class="accent-[var(--color-accent)]"
          />
          minify output
        </label>
        <div
          role="status"
          aria-live="polite"
          class="font-mono text-sm flex-1 min-w-[200px]"
        >
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
    </div>
  );
}

function FormatSelect({
  value,
  onChange,
  disabled,
  id,
}: {
  value: DataFormat;
  onChange: (v: DataFormat) => void;
  disabled?: boolean;
  id: string;
}) {
  return (
    <select
      id={`format-${id}`}
      aria-label={`${id === "from" ? "Input" : "Output"} format`}
      value={value}
      onChange={(e) => onChange((e.currentTarget as HTMLSelectElement).value as DataFormat)}
      disabled={disabled}
      class="font-mono text-xs px-2 py-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] hover:border-[var(--color-fg-muted)] focus-visible:border-[var(--color-accent)] disabled:opacity-50"
    >
      {DATA_FORMATS.map((f) => (
        <option key={f} value={f}>
          {FORMAT_LABEL[f]}
        </option>
      ))}
    </select>
  );
}
