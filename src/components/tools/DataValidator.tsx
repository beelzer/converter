import { useState } from "preact/hooks";
import DataInput from "../shared/DataInput";
import { validateText, type ValidationResult } from "../../lib/data/validate";
import {
  DATA_FORMATS,
  FORMAT_LABEL,
  detectFromText,
  type DataFormat,
} from "../../lib/data/formats";

export default function DataValidator() {
  const [input, setInput] = useState("");
  const [format, setFormat] = useState<DataFormat>("json");
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [busy, setBusy] = useState(false);

  const onInputChange = (text: string, detected: DataFormat | null) => {
    setInput(text);
    setResult(null);
    if (detected) setFormat(detected);
    else {
      const sniff = detectFromText(text);
      if (sniff) setFormat(sniff);
    }
  };

  const onRun = async () => {
    setBusy(true);
    setResult(null);
    try {
      const r = await validateText(input, format);
      setResult(r);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="w-full">
      <div class="flex items-center justify-between mb-2">
        <span class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)]">
          Input
        </span>
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
        ariaLabel="Input data to validate"
        placeholder={`Paste ${FORMAT_LABEL[format]} here, or drop a file.`}
      />

      <div class="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={onRun}
          disabled={busy || !input.trim()}
          class="font-mono text-sm px-5 py-2.5 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-fg-dim)] disabled:cursor-not-allowed transition-colors"
        >
          {busy ? "Validating…" : `Validate ${FORMAT_LABEL[format]}`}
        </button>
      </div>

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        class="mt-4 min-h-[1.5rem] font-mono text-sm"
      >
        {result?.ok && (
          <span class="text-[var(--color-accent)]">
            ✓ Valid {FORMAT_LABEL[format]}.
          </span>
        )}
        {result && !result.ok && (
          <div>
            <span class="text-[var(--color-danger)]">✗ Invalid {FORMAT_LABEL[format]}.</span>
            {result.message && (
              <p class="mt-2 text-[var(--color-fg-muted)] whitespace-pre-wrap">
                {result.message}
              </p>
            )}
            {(result.line || result.column) && (
              <p class="mt-1 text-[var(--color-fg-dim)] text-xs">
                {result.line ? `line ${result.line}` : ""}
                {result.line && result.column ? " · " : ""}
                {result.column ? `column ${result.column}` : ""}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
