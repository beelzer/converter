import { useEffect, useState } from "preact/hooks";
import { urlDecode, urlEncode } from "../../lib/encode/url";

type Direction = "encode" | "decode";

export default function EncodeUrl() {
  const [direction, setDirection] = useState<Direction>("encode");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [full, setFull] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOutput("");
    setError(null);
    if (!input) return;
    try {
      setOutput(direction === "encode" ? urlEncode(input, full) : urlDecode(input));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [input, direction, full]);

  const copy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
    } catch {
      // ignore
    }
  };

  return (
    <div class="w-full">
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <div role="radiogroup" aria-label="Direction" class="flex gap-2">
          {(["encode", "decode"] as const).map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={direction === d}
              onClick={() => setDirection(d)}
              class={`font-mono text-sm px-4 py-2 rounded-md border transition-colors ${
                direction === d
                  ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                  : "border-[var(--color-border)] text-[var(--color-fg)] hover:border-[var(--color-fg-muted)]"
              }`}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
        {direction === "encode" && (
          <label class="font-mono text-sm text-[var(--color-fg-muted)] inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={full}
              onChange={(e) => setFull((e.currentTarget as HTMLInputElement).checked)}
              class="accent-[var(--color-accent)]"
            />
            full encoding (encodeURIComponent)
          </label>
        )}
      </div>

      <label class="block font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2">
        {direction === "encode" ? "Plain" : "Encoded"}
      </label>
      <textarea
        value={input}
        rows={5}
        onInput={(e) => setInput((e.currentTarget as HTMLTextAreaElement).value)}
        spellcheck={false}
        autocomplete="off"
        aria-label={direction === "encode" ? "Plain URL input" : "Encoded URL input"}
        class="block w-full rounded-md border-2 border-[var(--color-border)] bg-[var(--color-surface)] p-3 font-mono text-sm text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-accent)] resize-y"
      />

      {(output || error) && (
        <div class="mt-6">
          <label class="block font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2">
            {direction === "encode" ? "Encoded" : "Decoded"}
          </label>
          <div class="rounded-md border-2 border-[var(--color-border)] bg-[var(--color-surface)]">
            <textarea
              value={output}
              readOnly
              rows={5}
              aria-label="Output"
              class="block w-full bg-transparent p-3 font-mono text-sm text-[var(--color-fg)] focus:outline-none resize-y"
              spellcheck={false}
            />
            <div class="flex items-center justify-between px-3 py-2 border-t border-[var(--color-border)] text-xs font-mono text-[var(--color-fg-dim)]">
              <button
                type="button"
                onClick={copy}
                disabled={!output}
                class="hover:text-[var(--color-accent)] disabled:opacity-50"
              >
                copy
              </button>
              <span>{output.length > 0 ? `${output.length.toLocaleString()} chars` : "empty"}</span>
            </div>
          </div>
        </div>
      )}

      <div role="status" aria-live="polite" class="mt-4 min-h-[1.5rem] font-mono text-sm">
        {error && <span class="text-[var(--color-danger)]">Error: {error}</span>}
      </div>
    </div>
  );
}
