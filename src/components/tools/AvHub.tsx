import { useState } from "preact/hooks";
import AvConverter from "./AvConverter";
import AvTrimmer from "./AvTrimmer";
import AvAudioExtractor from "./AvAudioExtractor";
import AvVideoToGif from "./AvVideoToGif";
import AvCompressor from "./AvCompressor";
import AvFrameExtractor from "./AvFrameExtractor";
import AvMerger from "./AvMerger";

type Mode =
  | "convert"
  | "trim"
  | "audio"
  | "gif"
  | "compress"
  | "frames"
  | "merge";

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
      "Convert between MP4, WebM, MOV and MKV. Uses WebCodecs — no upload, no server.",
  },
  {
    id: "trim",
    label: "Trim",
    blurb: "Cut a clip to a specific start and end time.",
  },
  {
    id: "audio",
    label: "Extract audio",
    blurb:
      "Pull the audio track out of a video as MP3, WAV, AAC, FLAC or Ogg.",
  },
  {
    id: "gif",
    label: "Video → GIF",
    blurb:
      "Make an animated GIF from a short video clip. Choose range, fps and width.",
  },
  {
    id: "compress",
    label: "Compress",
    blurb:
      "Shrink file size by re-encoding at a lower bitrate. Pick a light, medium or heavy preset.",
  },
  {
    id: "frames",
    label: "Frames",
    blurb:
      "Grab a single frame at a timestamp, or a series of frames at a fixed rate.",
  },
  {
    id: "merge",
    label: "Merge",
    blurb:
      "Stitch multiple clips end-to-end. Drag to reorder. Output normalises to a single resolution.",
  },
];

export default function AvHub() {
  const [mode, setMode] = useState<Mode>("convert");
  const active = MODES.find((m) => m.id === mode) ?? MODES[0];

  return (
    <div class="w-full">
      <div
        role="tablist"
        aria-label="Choose an audio or video operation"
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
        {mode === "convert" && <AvConverter />}
        {mode === "trim" && <AvTrimmer />}
        {mode === "audio" && <AvAudioExtractor />}
        {mode === "gif" && <AvVideoToGif />}
        {mode === "compress" && <AvCompressor />}
        {mode === "frames" && <AvFrameExtractor />}
        {mode === "merge" && <AvMerger />}
      </div>
    </div>
  );
}
