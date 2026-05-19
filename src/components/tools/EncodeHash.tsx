import { useEffect, useRef, useState } from "preact/hooks";
import { hashBytes, hashText, HASH_ALGORITHMS, type HashAlgorithm } from "../../lib/encode/hash";

type Source = "text" | "file";

export default function EncodeHash() {
  const [source, setSource] = useState<Source>("text");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [results, setResults] = useState<Partial<Record<HashAlgorithm, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setResults({});
    setError(null);
    if (source === "text" && text === "") return;
    if (source === "file" && !fileBytes) return;
    let cancelled = false;
    const run = async () => {
      setBusy(true);
      try {
        const out: Partial<Record<HashAlgorithm, string>> = {};
        for (const algorithm of HASH_ALGORITHMS) {
          const hex =
            source === "text"
              ? await hashText(text, algorithm)
              : await hashBytes(fileBytes!, algorithm);
          if (cancelled) return;
          out[algorithm] = hex;
          setResults({ ...out });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [text, fileBytes, source]);

  const onFile = async (e: Event) => {
    const target = e.currentTarget as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    setSource("file");
    setFileName(file.name);
    setFileBytes(bytes);
    target.value = "";
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore
    }
  };

  return (
    <div class="w-full">
      <div role="radiogroup" aria-label="Source" class="flex gap-2 mb-4">
        {(["text", "file"] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={source === s}
            onClick={() => setSource(s)}
            class={`font-mono text-sm px-4 py-2 rounded-md border transition-colors ${
              source === s
                ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                : "border-[var(--color-border)] text-[var(--color-fg)] hover:border-[var(--color-fg-muted)]"
            }`}
          >
            {s === "text" ? "Text" : "File"}
          </button>
        ))}
      </div>

      {source === "text" && (
        <>
          <label
            htmlFor="hash-text"
            class="block font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2"
          >
            Input
          </label>
          <textarea
            id="hash-text"
            value={text}
            rows={5}
            onInput={(e) => setText((e.currentTarget as HTMLTextAreaElement).value)}
            spellcheck={false}
            autocomplete="off"
            placeholder="Type text to hash. Hashes update as you type."
            class="block w-full rounded-md border-2 border-[var(--color-border)] bg-[var(--color-surface)] p-3 font-mono text-sm text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-accent)] resize-y"
          />
        </>
      )}

      {source === "file" && (
        <div>
          <p class="block font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2">
            File
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            class="font-mono text-sm px-4 py-2 rounded-md border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
          >
            {fileName ? "Pick a different file" : "Pick a file"}
          </button>
          <input
            ref={inputRef}
            type="file"
            onChange={onFile}
            class="sr-only"
            aria-label="Pick a file to hash"
          />
          {fileName && (
            <p class="mt-2 font-mono text-xs text-[var(--color-fg-dim)]">
              {fileName}
              {fileBytes ? ` · ${fileBytes.byteLength.toLocaleString()} bytes` : ""}
            </p>
          )}
        </div>
      )}

      <div class="mt-6">
        <h3 class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2">
          Digests
        </h3>
        <ul class="space-y-2">
          {HASH_ALGORITHMS.map((algorithm) => {
            const digest = results[algorithm];
            return (
              <li
                key={algorithm}
                class="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]"
              >
                <span class="font-mono text-xs uppercase tracking-widest w-20 shrink-0 text-[var(--color-fg-dim)]">
                  {algorithm}
                </span>
                <code class="flex-1 font-mono text-xs text-[var(--color-fg)] break-all">
                  {digest ?? (busy ? "…" : "")}
                </code>
                {digest && (
                  <button
                    type="button"
                    onClick={() => copy(digest)}
                    aria-label={`Copy ${algorithm}`}
                    class="font-mono text-xs px-2 py-1 rounded border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors shrink-0"
                  >
                    copy
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div role="status" aria-live="polite" class="mt-4 min-h-[1.5rem] font-mono text-sm">
        {error && <span class="text-[var(--color-danger)]">Error: {error}</span>}
      </div>
    </div>
  );
}
