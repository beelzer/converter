import { useEffect, useState } from "preact/hooks";
import {
  formatHex,
  parseAny,
  type Rgb,
} from "../../lib/color/convert";
import {
  HARMONIES,
  HARMONY_LABEL,
  harmony,
  type HarmonyKind,
} from "../../lib/color/palette";

const DEFAULT: Rgb = { r: 32, g: 178, b: 170, a: 1 };

export default function ColorPalette() {
  const [input, setInput] = useState("#20B2AA");
  const [base, setBase] = useState<Rgb>(DEFAULT);
  const [kind, setKind] = useState<HarmonyKind>("complementary");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const parsed = parseAny(input);
    if (parsed) setBase(parsed);
  }, [input]);

  const swatches = harmony(base, kind);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      // ignore
    }
  };

  return (
    <div class="w-full">
      <div class="flex items-center gap-2 mb-4">
        <input
          type="color"
          value={formatHex({ ...base, a: 1 })}
          onInput={(e) => setInput((e.currentTarget as HTMLInputElement).value)}
          aria-label="Native color picker"
          class="h-12 w-12 rounded-md border border-[var(--color-border)] cursor-pointer"
        />
        <input
          type="text"
          value={input}
          onInput={(e) => setInput((e.currentTarget as HTMLInputElement).value)}
          placeholder="Base color (#20B2AA, rgb(...), etc.)"
          spellcheck={false}
          class="flex-1 font-mono text-sm px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] focus-visible:border-[var(--color-accent)] focus:outline-none"
        />
      </div>

      <fieldset>
        <legend class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2">
          Harmony
        </legend>
        <div class="flex flex-wrap gap-2">
          {HARMONIES.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setKind(h)}
              aria-pressed={kind === h}
              class={`font-mono text-sm px-3 py-1.5 rounded-md border transition-colors ${
                kind === h
                  ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                  : "border-[var(--color-border)] text-[var(--color-fg)] hover:border-[var(--color-fg-muted)]"
              }`}
            >
              {HARMONY_LABEL[h]}
            </button>
          ))}
        </div>
      </fieldset>

      <div class="mt-6 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {swatches.map((rgb, idx) => {
          const hex = formatHex(rgb);
          return (
            <button
              key={idx}
              type="button"
              onClick={() => copy(hex)}
              class="text-left rounded-md border border-[var(--color-border)] overflow-hidden hover:border-[var(--color-accent)] transition-colors group"
              aria-label={`Copy ${hex}`}
            >
              <div
                class="h-24 w-full"
                style={`background:${hex}`}
                aria-hidden="true"
              />
              <div class="px-3 py-2 bg-[var(--color-surface)] font-mono text-xs flex items-center justify-between">
                <span class="text-[var(--color-fg)]">{hex}</span>
                <span class="text-[var(--color-fg-dim)] group-hover:text-[var(--color-accent)]">
                  {copied === hex ? "copied" : "copy"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
