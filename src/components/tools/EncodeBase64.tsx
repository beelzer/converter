import { useEffect, useState } from "preact/hooks";
import OutputPanel from "../shared/OutputPanel";
import FilePickButton from "../shared/FilePickButton";
import { MIME } from "../../lib/util/mime";
import { bytesToBase64, decodeBase64Text, encodeBase64Text, type Base64Variant } from "../../lib/encode/base64";

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

  const onPickFile = async (file: File) => {
    setError(null);
    const buf = new Uint8Array(await file.arrayBuffer());
    setDirection("encode");
    setInput("");
    setOutput(bytesToBase64(buf, variant));
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
          <FilePickButton
            onFile={onPickFile}
            label="pick a file"
            ariaLabel="Pick a file to base64-encode"
          />
          {" "}to encode its bytes.
        </p>
      )}

      {(output || error) && (
        <div class="mt-6">
          <OutputPanel
            value={output}
            ariaLabel="Output"
            label={direction === "encode" ? "Base64" : "Plaintext"}
            rows={6}
            filename="base64.txt"
            mime={MIME.TEXT_PLAIN}
          />
        </div>
      )}

      <div role="status" aria-live="polite" class="mt-4 min-h-[1.5rem] font-mono text-sm">
        {error && <span class="text-[var(--color-danger)]">Error: {error}</span>}
      </div>
    </div>
  );
}
