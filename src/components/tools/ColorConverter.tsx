import { useEffect, useState } from "preact/hooks";
import {
  formatCmyk,
  formatHex,
  formatHsl,
  formatOklch,
  formatRgb,
  parseAny,
  rgbToCmyk,
  rgbToHsl,
  rgbToOklch,
  type Rgb,
} from "../../lib/color/convert";

const DEFAULT: Rgb = { r: 32, g: 178, b: 170, a: 1 };

interface Row {
  label: string;
  value: string;
}

export default function ColorConverter() {
  const [input, setInput] = useState("#20B2AA");
  const [color, setColor] = useState<Rgb>(DEFAULT);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const parsed = parseAny(input);
    if (parsed) {
      setColor(parsed);
      setError(null);
    } else if (input.trim()) {
      setError("Couldn't parse that color.");
    } else {
      setError(null);
    }
  }, [input]);

  const onPick = (e: Event) => {
    const target = e.currentTarget as HTMLInputElement;
    setInput(target.value);
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      // ignore
    }
  };

  const rows: Row[] = [
    { label: "HEX", value: formatHex(color) },
    { label: "RGB", value: formatRgb(color) },
    { label: "HSL", value: formatHsl(rgbToHsl(color)) },
    { label: "OKLCH", value: formatOklch(rgbToOklch(color)) },
    { label: "CMYK", value: formatCmyk(rgbToCmyk(color)) },
  ];

  const cssColor = formatHex(color);

  return (
    <div class="w-full grid gap-6 lg:grid-cols-[1fr_2fr]">
      <div>
        <label
          htmlFor="color-input"
          class="block font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2"
        >
          Color
        </label>
        <div class="flex items-stretch gap-2">
          <input
            type="color"
            value={formatHex({ ...color, a: 1 })}
            onInput={onPick}
            aria-label="Native color picker"
            class="h-12 w-12 rounded-md border border-[var(--color-border)] bg-transparent cursor-pointer"
          />
          <input
            id="color-input"
            type="text"
            value={input}
            onInput={(e) => setInput((e.currentTarget as HTMLInputElement).value)}
            placeholder="#20B2AA, rgb(32 178 170), hsl(177 53% 41%), oklch(70% 0.1 195)"
            spellcheck={false}
            class="flex-1 font-mono text-sm px-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] focus-visible:border-[var(--color-accent)] focus:outline-none"
          />
        </div>
        {error && (
          <p class="mt-2 font-mono text-xs text-[var(--color-danger)]">{error}</p>
        )}

        <div
          class="mt-6 h-32 rounded-md border border-[var(--color-border)]"
          style={`background:${cssColor}`}
          aria-label="Color swatch preview"
          role="img"
        />
      </div>

      <div>
        <h3 class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2">
          All formats
        </h3>
        <ul class="space-y-2">
          {rows.map((row) => (
            <li
              key={row.label}
              class="flex items-center gap-3 p-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]"
            >
              <span class="font-mono text-[10px] uppercase tracking-widest w-12 shrink-0 text-[var(--color-fg-dim)]">
                {row.label}
              </span>
              <code class="flex-1 font-mono text-sm text-[var(--color-fg)] break-all">
                {row.value}
              </code>
              <button
                type="button"
                onClick={() => copy(row.value)}
                aria-label={`Copy ${row.label}`}
                class="font-mono text-xs px-2 py-1 rounded border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
              >
                {copied === row.value ? "copied" : "copy"}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
