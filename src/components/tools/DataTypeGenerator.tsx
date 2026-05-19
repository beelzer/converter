import { useState } from "preact/hooks";
import DataInput from "../shared/DataInput";
import { downloadBlob } from "../../lib/util/file";
import { parseData } from "../../lib/data/parse";
import { jsonToTypeScript } from "../../lib/data/typegen";
import { detectFromText, type DataFormat } from "../../lib/data/formats";

type Status =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "done" }
  | { kind: "error"; message: string };

// JSON-shaped inputs only — YAML, CSV etc. produce JS objects too and could
// be supported, but TS interface generation maps most cleanly to JSON.
const INPUT_FORMATS: DataFormat[] = ["json", "yaml"];
const INPUT_LABEL: Record<DataFormat, string> = {
  json: "JSON",
  yaml: "YAML",
  xml: "XML",
  toml: "TOML",
  csv: "CSV",
  tsv: "TSV",
};

export default function DataTypeGenerator() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [rootName, setRootName] = useState("Root");
  const [format, setFormat] = useState<DataFormat>("json");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const onInputChange = (text: string, detected: DataFormat | null) => {
    setInput(text);
    setOutput("");
    setStatus({ kind: "idle" });
    if (detected && INPUT_FORMATS.includes(detected)) {
      setFormat(detected);
    } else if (!detected) {
      const sniff = detectFromText(text);
      if (sniff && INPUT_FORMATS.includes(sniff)) setFormat(sniff);
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
      const ts = jsonToTypeScript(value, rootName || "Root");
      setOutput(ts);
      setStatus({ kind: "done" });
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
      new Blob([output], { type: "text/typescript" }),
      `${rootName || "types"}.ts`,
      "text/typescript"
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
          Sample input
        </label>
        <select
          aria-label="Format"
          value={format}
          onChange={(e) =>
            setFormat((e.currentTarget as HTMLSelectElement).value as DataFormat)
          }
          disabled={busy}
          class="font-mono text-xs px-2 py-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] hover:border-[var(--color-fg-muted)] disabled:opacity-50"
        >
          {INPUT_FORMATS.map((f) => (
            <option key={f} value={f}>
              {INPUT_LABEL[f]}
            </option>
          ))}
        </select>
      </div>
      <DataInput
        value={input}
        onChange={onInputChange}
        disabled={busy}
        ariaLabel="Input data to infer types from"
        placeholder={`Paste sample ${INPUT_LABEL[format]} here.\nThe more representative your sample, the better the inferred types.`}
      />

      <div class="mt-6 flex flex-wrap items-center gap-4">
        <label class="font-mono text-sm text-[var(--color-fg-muted)] inline-flex items-center gap-2">
          Root name
          <input
            type="text"
            value={rootName}
            onInput={(e) =>
              setRootName((e.currentTarget as HTMLInputElement).value.replace(/[^A-Za-z0-9_]/g, ""))
            }
            disabled={busy}
            class="font-mono text-sm px-2 py-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] w-32"
          />
        </label>
        <button
          type="button"
          onClick={onRun}
          disabled={busy}
          class="font-mono text-sm px-5 py-2.5 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-fg-dim)] disabled:cursor-not-allowed transition-colors"
        >
          {busy ? "Generating…" : "Generate TypeScript"}
        </button>
      </div>

      {(output || status.kind === "error") && (
        <div class="mt-6">
          <div class="flex items-center justify-between mb-2">
            <label class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)]">
              TypeScript
            </label>
          </div>
          <div class="rounded-lg border-2 border-[var(--color-border)] bg-[var(--color-surface)]">
            <textarea
              value={output}
              readOnly
              rows={12}
              aria-label="Generated TypeScript"
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
              <span>
                {output.length > 0 ? `${output.split("\n").length} lines` : "empty"}
              </span>
            </div>
          </div>
        </div>
      )}

      <div role="status" aria-live="polite" class="mt-4 min-h-[1.5rem] font-mono text-sm">
        {status.kind === "error" && (
          <span class="text-[var(--color-danger)]">Error: {status.message}</span>
        )}
      </div>
    </div>
  );
}
