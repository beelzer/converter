import { useState } from "preact/hooks";
import ColorConverter from "./ColorConverter";
import ColorPalette from "./ColorPalette";
import ColorContrast from "./ColorContrast";

type Mode = "convert" | "palette" | "contrast";

interface ModeSpec {
  id: Mode;
  label: string;
  blurb: string;
}

const MODES: ModeSpec[] = [
  {
    id: "convert",
    label: "Convert",
    blurb:
      "Type any CSS color (HEX, rgb(), hsl(), oklch(), cmyk()) — see it in every other format.",
  },
  {
    id: "palette",
    label: "Palette",
    blurb:
      "Generate a harmony from a base color: complementary, analogous, triadic, tetradic, split-complementary, or monochromatic.",
  },
  {
    id: "contrast",
    label: "Contrast",
    blurb:
      "WCAG contrast checker. Type a foreground and background, see the ratio and AA/AAA pass status.",
  },
];

export default function ColorHub() {
  const [mode, setMode] = useState<Mode>("convert");
  const active = MODES.find((m) => m.id === mode) ?? MODES[0];

  return (
    <div class="w-full">
      <div
        role="tablist"
        aria-label="Choose a color operation"
        class="flex flex-wrap gap-2 border-b border-[var(--color-border)] pb-3 mb-4"
      >
        {MODES.map((m) => {
          const isActive = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${m.id}`}
              id={`tab-${m.id}`}
              onClick={() => setMode(m.id)}
              class={`font-mono text-sm px-3 py-1.5 rounded-md border transition-colors ${
                isActive
                  ? "border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-surface)]"
                  : "border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border)]"
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      <p class="font-mono text-xs text-[var(--color-fg-dim)] mb-6">{active.blurb}</p>

      <div role="tabpanel" id={`panel-${mode}`} aria-labelledby={`tab-${mode}`} key={mode}>
        {mode === "convert" && <ColorConverter />}
        {mode === "palette" && <ColorPalette />}
        {mode === "contrast" && <ColorContrast />}
      </div>
    </div>
  );
}
