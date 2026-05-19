import { useEffect, useState } from "preact/hooks";
import { formatHex, parseAny, type Rgb } from "../../lib/color/convert";
import { wcag } from "../../lib/color/contrast";

const DEFAULT_FG: Rgb = { r: 14, g: 14, b: 14, a: 1 };
const DEFAULT_BG: Rgb = { r: 240, g: 240, b: 240, a: 1 };

export default function ColorContrast() {
  const [fgInput, setFgInput] = useState("#0E0E0E");
  const [bgInput, setBgInput] = useState("#F0F0F0");
  const [fg, setFg] = useState<Rgb>(DEFAULT_FG);
  const [bg, setBg] = useState<Rgb>(DEFAULT_BG);

  useEffect(() => {
    const p = parseAny(fgInput);
    if (p) setFg(p);
  }, [fgInput]);

  useEffect(() => {
    const p = parseAny(bgInput);
    if (p) setBg(p);
  }, [bgInput]);

  const verdict = wcag(fg, bg);
  const ratio = verdict.ratio;
  const fgHex = formatHex({ ...fg, a: 1 });
  const bgHex = formatHex({ ...bg, a: 1 });

  return (
    <div class="w-full grid gap-6 lg:grid-cols-2">
      <div>
        <div class="grid gap-4">
          <ColorField
            label="Foreground"
            input={fgInput}
            hex={fgHex}
            onChange={setFgInput}
          />
          <ColorField
            label="Background"
            input={bgInput}
            hex={bgHex}
            onChange={setBgInput}
          />
        </div>

        <div
          class="mt-6 p-8 rounded-md border border-[var(--color-border)] text-center"
          style={`background:${bgHex};color:${fgHex};`}
          aria-label="Live contrast preview"
        >
          <p class="text-3xl font-semibold">Sample heading</p>
          <p class="text-base mt-2">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit.
          </p>
          <p class="text-xs mt-2 opacity-80">
            Smaller body text — readable?
          </p>
        </div>
      </div>

      <div>
        <h3 class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2">
          WCAG verdict
        </h3>
        <div class="p-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
          <p class="font-mono text-3xl text-[var(--color-fg)]">
            {ratio.toFixed(2)}:1
          </p>
          <p class="font-mono text-xs text-[var(--color-fg-dim)] mt-1">
            contrast ratio
          </p>
        </div>

        <ul class="mt-4 space-y-2">
          <VerdictRow label="WCAG AA (normal text, 4.5:1)" pass={verdict.aaNormal} />
          <VerdictRow label="WCAG AA (large text, 3:1)" pass={verdict.aaLarge} />
          <VerdictRow label="WCAG AAA (normal text, 7:1)" pass={verdict.aaaNormal} />
          <VerdictRow label="WCAG AAA (large text, 4.5:1)" pass={verdict.aaaLarge} />
        </ul>

        <p class="mt-4 font-mono text-xs text-[var(--color-fg-dim)]">
          Large text = 18pt+ regular weight or 14pt+ bold.
        </p>
      </div>
    </div>
  );
}

function ColorField({
  label,
  input,
  hex,
  onChange,
}: {
  label: string;
  input: string;
  hex: string;
  onChange: (v: string) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div>
      <label
        htmlFor={id}
        class="block font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2"
      >
        {label}
      </label>
      <div class="flex items-stretch gap-2">
        <input
          type="color"
          value={hex}
          onInput={(e) => onChange((e.currentTarget as HTMLInputElement).value)}
          aria-label={`${label} picker`}
          class="h-10 w-10 rounded-md border border-[var(--color-border)] cursor-pointer"
        />
        <input
          id={id}
          type="text"
          value={input}
          onInput={(e) => onChange((e.currentTarget as HTMLInputElement).value)}
          spellcheck={false}
          class="flex-1 font-mono text-sm px-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] focus-visible:border-[var(--color-accent)] focus:outline-none"
        />
      </div>
    </div>
  );
}

function VerdictRow({ label, pass }: { label: string; pass: boolean }) {
  return (
    <li class="flex items-center gap-3 p-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)]">
      <span
        aria-hidden="true"
        class={`font-mono text-xs w-6 h-6 inline-flex items-center justify-center rounded-full ${
          pass
            ? "bg-[var(--color-accent)] text-[var(--color-bg)]"
            : "border border-[var(--color-danger)] text-[var(--color-danger)]"
        }`}
      >
        {pass ? "✓" : "✗"}
      </span>
      <span class="font-mono text-sm text-[var(--color-fg)]">{label}</span>
      <span
        class={`ml-auto font-mono text-xs ${
          pass ? "text-[var(--color-accent)]" : "text-[var(--color-danger)]"
        }`}
      >
        {pass ? "PASS" : "FAIL"}
      </span>
    </li>
  );
}
