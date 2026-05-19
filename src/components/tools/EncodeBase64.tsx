import { useEffect, useState } from "preact/hooks";
import { bytesToBase64, decodeBase64Text, encodeBase64Text, type Base64Variant } from "../../lib/encode/base64";
import { downloadBlob } from "../../lib/util/file";

type Direction = "encode" | "decode";

export default function EncodeBase64() {
  const [direction, setDirection] = useState<Direction>("encode");
  const [variant, setVariant] = useState<Base64Variant>("standard");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOutput("");
    setError(null);
    if (!input) return;
    try {
      if (direction === "encode") {
        setOutput(encodeBase64Text(input, variant));
      } else {
        setOutput(decodeBase64Text(input));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [input, direction, variant]);

  const onFile = async (e: Event) => {
    const target = e.currentTarget as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    setError(null);
    const buf = new Uint8Array(await file.arrayBuffer());
    setDirection("encode");
    setInput("");
    setOutput(bytesToBase64(buf, variant));
    target.value = "";
  };

  const onDownload = () => {
    if (!output) return;
    downloadBlob(
      new Blob([output], { type: "text/plain" }),
      `base64.txt`,
      "text/plain"
    );
  };

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
              checked={variant === "url-safe"}
              onChange={(e) =>
                setVariant((e.currentTarget as HTMLInputElement).checked ? "url-safe" : "standard")
              }
              class="accent-[var(--color-accent)]"
            />
            URL-safe (no padding)
          </label>
        )}
      </div>

      <label class="block font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2">
        {direction === "encode" ? "Plaintext" : "Base64"}
      </label>
      <textarea
        value={input}
        rows={6}
        onInput={(e) => setInput((e.currentTarget as HTMLTextAreaElement).value)}
        spellcheck={false}
        autocomplete="off"
        aria-label={direction === "encode" ? "Plaintext input" : "Base64 input"}
        placeholder={
          direction === "encode" ? "Type or paste text to encode." : "Paste base64 to decode."
        }
        class="block w-full rounded-md border-2 border-[var(--color-border)] bg-[var(--color-surface)] p-3 font-mono text-sm text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-accent)] resize-y"
      />

      {direction === "encode" && (
        <p class="mt-2 font-mono text-xs text-[var(--color-fg-dim)]">
          Or{" "}
          <label class="text-[var(--color-accent)] hover:underline cursor-pointer">
            pick a file
            <input type="file" onChange={onFile} class="sr-only" aria-label="Pick a file to base64-encode" />
          </label>
          {" "}to encode its bytes.
        </p>
      )}

      {(output || error) && (
        <div class="mt-6">
          <label class="block font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2">
            {direction === "encode" ? "Base64" : "Plaintext"}
          </label>
          <div class="rounded-md border-2 border-[var(--color-border)] bg-[var(--color-surface)]">
            <textarea
              value={output}
              readOnly
              rows={6}
              aria-label="Output"
              class="block w-full bg-transparent p-3 font-mono text-sm text-[var(--color-fg)] focus:outline-none resize-y"
              spellcheck={false}
            />
            <div class="flex items-center justify-between px-3 py-2 border-t border-[var(--color-border)] text-xs font-mono text-[var(--color-fg-dim)]">
              <div class="flex gap-3">
                <button
                  type="button"
                  onClick={copy}
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
        {error && <span class="text-[var(--color-danger)]">Error: {error}</span>}
      </div>
    </div>
  );
}
