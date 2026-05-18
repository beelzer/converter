import { useState } from "preact/hooks";
import PdfMerger from "./PdfMerger";
import PdfSplitter from "./PdfSplitter";
import PdfRotator from "./PdfRotator";
import PdfOrganizer from "./PdfOrganizer";
import ImagesToPdf from "./ImagesToPdf";
import PdfToImages from "./PdfToImages";

type Mode =
  | "merge"
  | "split"
  | "rotate"
  | "organize"
  | "images-to-pdf"
  | "to-images";

interface ModeSpec {
  id: Mode;
  label: string;
  blurb: string;
}

const MODES: ModeSpec[] = [
  {
    id: "merge",
    label: "Merge",
    blurb: "Combine multiple PDFs into one. Drag to reorder, then download.",
  },
  {
    id: "split",
    label: "Split",
    blurb:
      "Extract pages or ranges into a new PDF in the order you list them.",
  },
  {
    id: "rotate",
    label: "Rotate",
    blurb:
      "Rotate every page, or just specific pages, by 90°, 180° or 270°.",
  },
  {
    id: "organize",
    label: "Organize",
    blurb:
      "Reorder or delete pages using thumbnail previews. Drag to move, × to delete.",
  },
  {
    id: "images-to-pdf",
    label: "Images → PDF",
    blurb:
      "Drop JPG, PNG, WebP, GIF or BMP images and combine them into a single PDF.",
  },
  {
    id: "to-images",
    label: "PDF → Images",
    blurb:
      "Render each page of a PDF as a JPG or PNG. Multiple pages download as a ZIP.",
  },
];

export default function PdfHub() {
  const [mode, setMode] = useState<Mode>("merge");
  const active = MODES.find((m) => m.id === mode) ?? MODES[0];

  return (
    <div class="w-full">
      <div
        role="tablist"
        aria-label="Choose a PDF operation"
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
        // Recreate the panel each time the mode changes so a previous panel's
        // queued files / loaded buffers don't leak across modes.
        key={mode}
      >
        {mode === "merge" && <PdfMerger />}
        {mode === "split" && <PdfSplitter />}
        {mode === "rotate" && <PdfRotator />}
        {mode === "organize" && <PdfOrganizer />}
        {mode === "images-to-pdf" && <ImagesToPdf />}
        {mode === "to-images" && <PdfToImages />}
      </div>
    </div>
  );
}
