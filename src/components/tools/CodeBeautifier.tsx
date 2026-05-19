import { useState } from "preact/hooks";
import OutputPanel from "../shared/OutputPanel";
import FilePickButton from "../shared/FilePickButton";
import type { Status } from "../shared/Widgets";
import { beautify } from "../../lib/code/beautify";
import {
  BEAUTIFY_LANGUAGES,
  LANGUAGE_EXT,
  LANGUAGE_LABEL,
  LANGUAGE_MIME,
  detectFromFile,
  type Language,
} from "../../lib/code/languages";

export default function CodeBeautifier() {
  const [language, setLanguage] = useState<Language>("javascript");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [indent, setIndent] = useState(2);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const onPickFile = async (file: File) => {
    setInput(await file.text());
    setOutput("");
    setStatus({ kind: "idle" });
    const detected = detectFromFile(file);
    if (detected) setLanguage(detected);
  };

  const onRun = async () => {
    if (!input.trim()) {
      setStatus({ kind: "error", message: "Paste or load some code first." });
      return;
    }
    setStatus({ kind: "working" });
    try {
      const result = await beautify(input, language, { indent });
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
      <div class="flex flex-wrap items-end gap-3 mb-4">
        <label class="font-mono text-sm text-[var(--color-fg-muted)] inline-flex flex-col gap-1">
          <span class="text-xs uppercase tracking-widest text-[var(--color-fg-dim)]">Language</span>
          <select
            value={language}
            onChange={(e) =>
              setLanguage((e.currentTarget as HTMLSelectElement).value as Language)
            }
            disabled={busy}
            class="font-mono text-sm px-2 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] hover:border-[var(--color-fg-muted)] disabled:opacity-50"
          >
            {BEAUTIFY_LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {LANGUAGE_LABEL[l]}
              </option>
            ))}
          </select>
        </label>
        <label class="font-mono text-sm text-[var(--color-fg-muted)] inline-flex flex-col gap-1">
          <span class="text-xs uppercase tracking-widest text-[var(--color-fg-dim)]">Indent</span>
          <select
            value={indent}
            onChange={(e) =>
              setIndent(parseInt((e.currentTarget as HTMLSelectElement).value, 10))
            }
            disabled={busy}
            class="font-mono text-sm px-2 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)]"
          >
            <option value="2">2 spaces</option>
            <option value="4">4 spaces</option>
          </select>
        </label>
        <div class="ml-auto">
          <FilePickButton
            onFile={onPickFile}
            label="pick a file"
            ariaLabel="Pick a source file"
          />
        </div>
      </div>

      <label
        htmlFor="beautify-input"
        class="block font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2"
      >
        Input
      </label>
      <textarea
        id="beautify-input"
        value={input}
        rows={12}
        onInput={(e) => setInput((e.currentTarget as HTMLTextAreaElement).value)}
        spellcheck={false}
        autocomplete="off"
        aria-label="Code to beautify"
        placeholder={`Paste ${LANGUAGE_LABEL[language]} here, or drop a file.`}
        class="block w-full rounded-md border-2 border-[var(--color-border)] bg-[var(--color-surface)] p-3 font-mono text-sm text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-accent)] resize-y"
      />

      <div class="mt-4">
        <button
          type="button"
          onClick={onRun}
          disabled={busy}
          class="font-mono text-sm px-5 py-2.5 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-fg-dim)] disabled:cursor-not-allowed transition-colors"
        >
          {busy ? "Formatting…" : `Format ${LANGUAGE_LABEL[language]}`}
        </button>
      </div>

      {(output || status.kind === "error") && (
        <div class="mt-6">
          <OutputPanel
            value={output}
            ariaLabel="Formatted output"
            label="Formatted"
            filename={`formatted.${LANGUAGE_EXT[language]}`}
            mime={LANGUAGE_MIME[language]}
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
