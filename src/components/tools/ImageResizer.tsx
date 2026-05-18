import { useCallback, useState } from "preact/hooks";
import FileDropZone from "../shared/FileDropZone";
import { downloadBlob, formatSize } from "../../lib/util/file";
import { resizeImage } from "../../lib/image/resize";
import { ACCEPT_INPUT, detectInputFormat } from "../../lib/image/formats";

interface LoadedFile {
  file: File;
}

type Status =
  | { kind: "idle" }
  | { kind: "resizing" }
  | { kind: "done"; filename: string; width: number; height: number }
  | { kind: "error"; message: string };

export default function ImageResizer() {
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [maxWidth, setMaxWidth] = useState(1920);
  const [maxHeight, setMaxHeight] = useState(1920);
  const [preventUpscale, setPreventUpscale] = useState(true);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const accept = useCallback((incoming: FileList | File[]) => {
    const first = Array.from(incoming)[0];
    if (!first) return;
    if (!detectInputFormat(first)) {
      setStatus({
        kind: "error",
        message: "Unrecognized image type. JPG/PNG/WebP/AVIF/GIF/BMP/TIFF/HEIC supported.",
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

  const onResize = async () => {
    if (!file) return;
    if (maxWidth < 1 || maxHeight < 1) {
      setStatus({
        kind: "error",
        message: "Width and height must be positive whole numbers.",
      });
      return;
    }
    setStatus({ kind: "resizing" });
    try {
      const r = await resizeImage(file.file, {
        maxWidth,
        maxHeight,
        preventUpscale,
      });
      downloadBlob(r.blob, r.name, r.blob.type);
      setStatus({
        kind: "done",
        filename: r.name,
        width: r.width,
        height: r.height,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus({ kind: "error", message });
    }
  };

  const busy = status.kind === "resizing";

  return (
    <div class="w-full">
      <FileDropZone
        label={file ? "Drop a different image to replace" : "Drop an image here"}
        buttonLabel="Choose image"
        accept={ACCEPT_INPUT}
        inputAriaLabel="Choose an image to resize"
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

          <div class="mt-6 grid sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="resize-w"
                class="block font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2"
              >
                Max width (px)
              </label>
              <input
                id="resize-w"
                type="number"
                min={1}
                value={maxWidth}
                disabled={busy}
                onInput={(e) =>
                  setMaxWidth(parseInt((e.currentTarget as HTMLInputElement).value || "0", 10))
                }
                class="w-full font-mono text-base px-3 py-2.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-50"
              />
            </div>
            <div>
              <label
                htmlFor="resize-h"
                class="block font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2"
              >
                Max height (px)
              </label>
              <input
                id="resize-h"
                type="number"
                min={1}
                value={maxHeight}
                disabled={busy}
                onInput={(e) =>
                  setMaxHeight(parseInt((e.currentTarget as HTMLInputElement).value || "0", 10))
                }
                class="w-full font-mono text-base px-3 py-2.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-50"
              />
            </div>
          </div>

          <label class="mt-4 inline-flex items-center gap-2 font-mono text-sm text-[var(--color-fg-muted)]">
            <input
              type="checkbox"
              checked={preventUpscale}
              disabled={busy}
              onChange={(e) =>
                setPreventUpscale((e.currentTarget as HTMLInputElement).checked)
              }
            />
            Don&rsquo;t upscale if the source is smaller
          </label>

          <p class="mt-2 text-xs font-mono text-[var(--color-fg-dim)]">
            Aspect ratio is preserved. The image fits within the box, never stretches.
          </p>

          <div class="mt-6 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onResize}
              disabled={busy}
              class="font-mono text-sm px-5 py-2.5 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-fg-dim)] disabled:cursor-not-allowed transition-colors"
            >
              {busy ? "Resizing…" : "Resize & download"}
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
        {status.kind === "resizing" && (
          <span class="text-[var(--color-accent)]">Resizing in your browser…</span>
        )}
        {status.kind === "done" && (
          <span class="text-[var(--color-accent)]">
            ✓ Resized to {status.width}×{status.height} → {status.filename} downloaded.
          </span>
        )}
        {status.kind === "error" && (
          <span class="text-[var(--color-danger)]">Error: {status.message}</span>
        )}
      </div>
    </div>
  );
}
