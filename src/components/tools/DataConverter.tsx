import { useState } from "preact/hooks";
import DataInput from "../shared/DataInput";
import { downloadBlob } from "../../lib/util/file";
import { convertData } from "../../lib/data/convert";
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
      new Blob([output], { type: FORMAT_MIME[to] }),
      `data.${FORMAT_EXT[to]}`,
      FORMAT_MIME[to]
    );
  };

  const onCopy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
    } catch {
      // ignore — clipboard may be unavailable
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
        <div class="rounded-lg border-2 border-[var(--color-border)] bg-[var(--color-surface)]">
          <textarea
            value={output}
            readOnly
            rows={12}
            aria-label="Output data"
            placeholder="Converted output appears here."
            class="block w-full bg-transparent p-3 font-mono text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-dim)] focus:outline-none resize-y"
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
              ✓ {status.bytes.toLocaleString()} bytes
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
