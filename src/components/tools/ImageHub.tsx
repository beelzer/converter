import { useState } from "preact/hooks";
import ImageConverter from "./ImageConverter";
import ImageResizer from "./ImageResizer";
import ImageCompressor from "./ImageCompressor";
import FaviconGenerator from "./FaviconGenerator";
import ExifStripper from "./ExifStripper";
import SvgRasterizer from "./SvgRasterizer";

type Mode = "convert" | "resize" | "compress" | "favicon" | "exif" | "svg";

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
      "Convert images between JPG, PNG, WebP, AVIF, GIF, BMP, TIFF and HEIC.",
  },
  {
    id: "resize",
    label: "Resize",
    blurb:
      "Shrink an image to fit within a max width and height. Aspect ratio preserved.",
  },
  {
    id: "compress",
    label: "Compress",
    blurb:
      "Re-encode images at a chosen quality to shrink file size. JPG/WebP/AVIF stay in their format; lossless inputs convert to WebP.",
  },
  {
    id: "favicon",
    label: "Favicon",
    blurb:
      "Generate a complete favicon bundle (ICO + multi-size PNGs + manifest) from one source image.",
  },
  {
    id: "exif",
    label: "Strip EXIF",
    blurb:
      "Remove EXIF metadata (camera, GPS, timestamps) from a JPG without re-encoding the pixels.",
  },
  {
    id: "svg",
    label: "SVG → Raster",
    blurb:
      "Rasterize an SVG into PNG, JPG or WebP at any width.",
  },
];

export default function ImageHub() {
  const [mode, setMode] = useState<Mode>("convert");
  const active = MODES.find((m) => m.id === mode) ?? MODES[0];

  return (
    <div class="w-full">
      <div
        role="tablist"
        aria-label="Choose an image operation"
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
        {mode === "convert" && <ImageConverter />}
        {mode === "resize" && <ImageResizer />}
        {mode === "compress" && <ImageCompressor />}
        {mode === "favicon" && <FaviconGenerator />}
        {mode === "exif" && <ExifStripper />}
        {mode === "svg" && <SvgRasterizer />}
      </div>
    </div>
  );
}
