import { useState } from "preact/hooks";
import { downloadBlob } from "../../lib/util/file";
import { minify } from "../../lib/code/minify";
import {
  MINIFY_LANGUAGES,
  LANGUAGE_EXT,
  LANGUAGE_LABEL,
  LANGUAGE_MIME,
  detectFromFile,
  type Language,
} from "../../lib/code/languages";

type Status =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "done"; bytes: number; ratio: number }
  | { kind: "error"; message: string };

export default function CodeMinifier() {
  const [language, setLanguage] = useState<Language>("javascript");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const onFile = async (e: Event) => {
    const target = e.currentTarget as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    setInput(await file.text());
    setOutput("");
    setStatus({ kind: "idle" });
    const detected = detectFromFile(file);
    if (detected && MINIFY_LANGUAGES.includes(detected)) setLanguage(detected);
    target.value = "";
  };

  const onRun = async () => {
    if (!input.trim()) {
      setStatus({ kind: "error", message: "Paste or load some code first." });
      return;
    }
    setStatus({ kind: "working" });
    try {
      const result = await minify(input, language);
      const inputBytes = new TextEncoder().encode(input).length;
      const outputBytes = new TextEncoder().encode(result).length;
      const ratio = inputBytes > 0 ? outputBytes / inputBytes : 1;
      setOutput(result);
      setStatus({ kind: "done", bytes: outputBytes, ratio });
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
      new Blob([output], { type: LANGUAGE_MIME[language] }),
      `min.${LANGUAGE_EXT[language]}`,
      LANGUAGE_MIME[language]
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
            {MINIFY_LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {LANGUAGE_LABEL[l]}
              </option>
            ))}
          </select>
        </label>
        <label class="font-mono text-xs text-[var(--color-fg-dim)] hover:text-[var(--color-accent)] cursor-pointer ml-auto">
          pick a file
          <input
            type="file"
            onChange={onFile}
            class="sr-only"
            aria-label="Pick a source file"
          />
        </label>
      </div>

      <label
        htmlFor="minify-input"
        class="block font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2"
      >
        Input
      </label>
      <textarea
        id="minify-input"
        value={input}
        rows={12}
        onInput={(e) => setInput((e.currentTarget as HTMLTextAreaElement).value)}
        spellcheck={false}
        autocomplete="off"
        aria-label="Code to minify"
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
          {busy ? "Minifying…" : `Minify ${LANGUAGE_LABEL[language]}`}
        </button>
      </div>

      {(output || status.kind === "error") && (
        <div class="mt-6">
          <label class="block font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2">
            Minified
          </label>
          <div class="rounded-md border-2 border-[var(--color-border)] bg-[var(--color-surface)]">
            <textarea
              value={output}
              readOnly
              rows={12}
              aria-label="Minified output"
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
              <span>{output.length > 0 ? `${output.length.toLocaleString()} chars` : "empty"}</span>
            </div>
          </div>
        </div>
      )}

      <div role="status" aria-live="polite" class="mt-4 min-h-[1.5rem] font-mono text-sm">
        {status.kind === "done" && (
          <span class="text-[var(--color-accent)]">
            ✓ {status.bytes.toLocaleString()} bytes ({Math.round((1 - status.ratio) * 100)}% smaller)
          </span>
        )}
        {status.kind === "error" && (
          <span class="text-[var(--color-danger)]">Error: {status.message}</span>
        )}
      </div>
    </div>
  );
}
