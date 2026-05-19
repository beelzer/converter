import { useState } from "preact/hooks";
import CodeBeautifier from "./CodeBeautifier";
import CodeMinifier from "./CodeMinifier";

type Mode = "beautify" | "minify";

interface ModeSpec {
  id: Mode;
  label: string;
  blurb: string;
}

const MODES: ModeSpec[] = [
  {
    id: "beautify",
    label: "Beautify",
    blurb:
      "Format code with consistent whitespace and quotes. Powered by prettier (JS/TS/CSS/HTML/Markdown/YAML/GraphQL/Vue) and sql-formatter (SQL).",
  },
  {
    id: "minify",
    label: "Minify",
    blurb:
      "Shrink output for production. JavaScript/TypeScript via terser, CSS via csso, JSON via native stringify, HTML via whitespace collapse.",
  },
];

export default function CodeHub() {
  const [mode, setMode] = useState<Mode>("beautify");
  const active = MODES.find((m) => m.id === mode) ?? MODES[0];

  return (
    <div class="w-full">
      <div
        role="tablist"
        aria-label="Choose a code operation"
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
        {mode === "beautify" && <CodeBeautifier />}
        {mode === "minify" && <CodeMinifier />}
      </div>
    </div>
  );
}
