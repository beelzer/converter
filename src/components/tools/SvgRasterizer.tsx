import { useCallback, useState } from "preact/hooks";
import FileDropZone from "../shared/FileDropZone";
import type { Status } from "../shared/Widgets";
import { downloadBlob, formatSize } from "../../lib/util/file";
import { stripExt } from "../../lib/util/filename";
import { rasterizeSvg } from "../../lib/image/svg";
import {
  FORMAT_LABEL,
  extensionFor,
  type SupportedOutputFormat,
} from "../../lib/image/formats";

interface LoadedFile {
  file: File;
}

const FORMATS_FOR_SVG: SupportedOutputFormat[] = ["png", "jpeg", "webp"];

export default function SvgRasterizer() {
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [format, setFormat] = useState<SupportedOutputFormat>("png");
  const [width, setWidth] = useState(1024);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const accept = useCallback((incoming: FileList | File[]) => {
    const first = Array.from(incoming)[0];
    if (!first) return;
    if (
      first.type !== "image/svg+xml" &&
      !/\.svg$/i.test(first.name)
    ) {
      setStatus({
        kind: "error",
        message: "That doesn't look like an SVG. Drop or pick a .svg file.",
      });
      return;
    }
    setFile({ file: first });
    setStatus({ kind: "idle" });
  }, []);

  const clear = () => {
    setFile(null);
    setStatus({ kind: "idle" });
  };

  const onRasterize = async () => {
    if (!file) return;
    if (width < 1) {
      setStatus({
        kind: "error",
        message: "Width must be a positive whole number.",
      });
      return;
    }
    setStatus({ kind: "working", label: "Rasterizing in your browser" });
    try {
      const result = await rasterizeSvg(file.file, { format, width });
      const base = stripExt(file.file.name) || "image";
      const filename = `${base}-${result.width}x${result.height}.${extensionFor(format)}`;
      downloadBlob(result.blob, filename, result.blob.type);
      setStatus({
        kind: "done",
        filename,
        meta: { width: result.width, height: result.height },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus({ kind: "error", message });
    }
  };

  const busy = status.kind === "working";

  return (
    <div class="w-full">
      <FileDropZone
        label={file ? "Drop a different SVG to replace" : "Drop an SVG here"}
        buttonLabel="Choose SVG"
        accept="image/svg+xml,.svg"
        inputAriaLabel="Choose an SVG to rasterize"
        onFiles={accept}
      />

      {file && (
        <div class="mt-6">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)]">
              Source
            </h3>
            <button
              type="button"
              onClick={clear}
              disabled={busy}
              class="font-mono text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-danger)] disabled:opacity-50"
            >
              clear
            </button>
          </div>
          <div class="flex items-center gap-3 p-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
            <span class="flex-1 truncate text-sm text-[var(--color-fg)]">
              {file.file.name}
            </span>
            <span class="font-mono text-xs text-[var(--color-fg-dim)] hidden sm:inline">
              {formatSize(file.file.size)}
            </span>
          </div>

          <fieldset class="mt-6">
            <legend class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2">
              Output format
            </legend>
            <div class="flex flex-wrap gap-2">
              {FORMATS_FOR_SVG.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFormat(option)}
                  disabled={busy}
                  aria-pressed={format === option}
                  class={`font-mono text-sm px-4 py-2 rounded-md border transition-colors ${
                    format === option
                      ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                      : "border-[var(--color-border)] text-[var(--color-fg)] hover:border-[var(--color-fg-muted)]"
                  } disabled:opacity-50`}
                >
                  {FORMAT_LABEL[option]}
                </button>
              ))}
            </div>
          </fieldset>

          <div class="mt-6">
            <label
              htmlFor="svg-width"
              class="block font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2"
            >
              Output width (px)
            </label>
            <input
              id="svg-width"
              type="number"
              min={1}
              value={width}
              disabled={busy}
              onInput={(e) =>
                setWidth(parseInt((e.currentTarget as HTMLInputElement).value || "0", 10))
              }
              class="w-full font-mono text-base px-3 py-2.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-50"
            />
            <p class="mt-2 text-xs font-mono text-[var(--color-fg-dim)]">
              Height is derived from the SVG&rsquo;s aspect ratio.
            </p>
          </div>

          <div class="mt-6 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onRasterize}
              disabled={busy}
              class="font-mono text-sm px-5 py-2.5 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-fg-dim)] disabled:cursor-not-allowed transition-colors"
            >
              {busy ? "Rasterizing…" : "Rasterize & download"}
            </button>
          </div>
        </div>
      )}

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        class="mt-4 min-h-[1.5rem] font-mono text-sm"
      >
        {status.kind === "working" && (
          <span class="text-[var(--color-accent)]">{status.label}…</span>
        )}
        {status.kind === "done" && (
          <span class="text-[var(--color-accent)]">
            ✓ Rasterized to {(status.meta?.width as number) ?? 0}×{(status.meta?.height as number) ?? 0} → {status.filename} downloaded.
          </span>
        )}
        {status.kind === "error" && (
          <span class="text-[var(--color-danger)]">Error: {status.message}</span>
        )}
      </div>
    </div>
  );
}
