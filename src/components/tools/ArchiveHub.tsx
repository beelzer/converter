import { useState } from "preact/hooks";
import ArchiveCreator from "./ArchiveCreator";
import ArchiveExtractor from "./ArchiveExtractor";

type Mode = "create" | "extract";

interface ModeSpec {
  id: Mode;
  label: string;
  blurb: string;
}

const MODES: ModeSpec[] = [
  {
    id: "create",
    label: "Create",
    blurb:
      "Bundle multiple files into a ZIP, TAR or TAR.GZ — or wrap a single file as GZIP. Done locally, no upload.",
  },
  {
    id: "extract",
    label: "Extract",
    blurb:
      "Drop ZIP, TAR, TAR.GZ, GZIP or RAR. Format is auto-detected from the file's magic bytes. Pick individual files or grab everything as a fresh ZIP.",
  },
];

export default function ArchiveHub() {
  const [mode, setMode] = useState<Mode>("create");
  const active = MODES.find((m) => m.id === mode) ?? MODES[0];

  return (
    <div class="w-full">
      <div
        role="tablist"
        aria-label="Choose an archive operation"
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
        {mode === "create" && <ArchiveCreator />}
        {mode === "extract" && <ArchiveExtractor />}
      </div>
    </div>
  );
}
