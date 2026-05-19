import { useState } from "preact/hooks";
import DataConverter from "./DataConverter";
import DataFormatter from "./DataFormatter";
import DataValidator from "./DataValidator";
import DataTypeGenerator from "./DataTypeGenerator";

type Mode = "convert" | "format" | "validate" | "types";

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
      "Convert between JSON, YAML, XML, TOML, CSV and TSV. Input format is auto-detected from drop or paste.",
  },
  {
    id: "format",
    label: "Format / Minify",
    blurb:
      "Pretty-print or minify any of the supported formats. Pick indent size for pretty mode.",
  },
  {
    id: "validate",
    label: "Validate",
    blurb:
      "Check the syntax of your input. Errors include line and column when the parser provides them.",
  },
  {
    id: "types",
    label: "TS Types",
    blurb:
      "Generate TypeScript interfaces from a sample JSON or YAML document. Inference is structural — more representative samples produce better types.",
  },
];

export default function DataHub() {
  const [mode, setMode] = useState<Mode>("convert");
  const active = MODES.find((m) => m.id === mode) ?? MODES[0];

  return (
    <div class="w-full">
      <div
        role="tablist"
        aria-label="Choose a data operation"
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

      <p class="font-mono text-xs text-[var(--color-fg-dim)] mb-6">
        {active.blurb}
      </p>

      <div
        role="tabpanel"
        id={`panel-${mode}`}
        aria-labelledby={`tab-${mode}`}
        key={mode}
      >
        {mode === "convert" && <DataConverter />}
        {mode === "format" && <DataFormatter />}
        {mode === "validate" && <DataValidator />}
        {mode === "types" && <DataTypeGenerator />}
      </div>
    </div>
  );
}
