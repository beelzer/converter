import { useCallback, useState } from "preact/hooks";
import FileDropZone from "../shared/FileDropZone";
import type { Status } from "../shared/Widgets";
import { downloadBlob, formatSize, newId } from "../../lib/util/file";
import { MIME } from "../../lib/util/mime";
import { zipEntries } from "../../lib/util/zip";
import { convertImage } from "../../lib/image/convert";
import {
  ACCEPT_INPUT,
  detectInputFormat,
  type SupportedOutputFormat,
} from "../../lib/image/formats";

interface QueuedFile {
  id: string;
  file: File;
}

// For compression, we re-encode in the same family the user expects. PNG can't
// be tuned by a quality slider, so PNG inputs default to WebP output to actually
// shrink. JPG/WebP/AVIF stay in their lane.
function targetFormatFor(file: File): SupportedOutputFormat {
  const fmt = detectInputFormat(file);
  if (fmt === "jpeg") return "jpeg";
  if (fmt === "webp") return "webp";
  if (fmt === "avif") return "avif";
  // PNG, GIF, BMP, TIFF, HEIC → WebP for meaningful compression.
  return "webp";
}

export default function ImageCompressor() {
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [quality, setQuality] = useState(0.75);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const accept = useCallback((incoming: FileList | File[]) => {
    const next: QueuedFile[] = [];
    for (const f of Array.from(incoming)) {
      if (!detectInputFormat(f)) continue;
      next.push({ id: newId(), file: f });
    }
    if (next.length === 0) return;
    setFiles((current) => [...current, ...next]);
    setStatus({ kind: "idle" });
  }, []);

  const remove = (id: string) =>
    setFiles((current) => current.filter((f) => f.id !== id));
  const clearAll = () => {
    setFiles([]);
    setStatus({ kind: "idle" });
  };

  const onCompress = async () => {
    if (files.length === 0) return;
    const total = files.length;
    setStatus({ kind: "working", label: `Compressing 0 of ${total}`, p: 0 });
    const results: { name: string; bytes: Uint8Array; blob: Blob; original: number }[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        try {
          const target = targetFormatFor(files[i].file);
          const r = await convertImage(files[i].file, target, quality);
          const bytes = new Uint8Array(await r.blob.arrayBuffer());
          results.push({
            name: r.name,
            bytes,
            blob: r.blob,
            original: files[i].file.size,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          setStatus({
            kind: "error",
            message: `${files[i].file.name}: ${message}`,
          });
          return;
        }
        setStatus({
          kind: "working",
          label: `Compressing ${i + 1} of ${total}`,
          p: (i + 1) / total,
        });
      }

      const originalTotal = results.reduce((a, r) => a + r.original, 0);
      const compressedTotal = results.reduce((a, r) => a + r.bytes.length, 0);

      if (results.length === 1) {
        const only = results[0];
        downloadBlob(only.blob, only.name, only.blob.type);
        setStatus({
          kind: "done",
          count: 1,
          filename: only.name,
          meta: { originalSize: originalTotal, compressedSize: compressedTotal },
        });
        return;
      }
      setStatus({ kind: "working", label: "Packing ZIP" });
      const zip = zipEntries(
        results.map((r) => ({ name: r.name, bytes: r.bytes }))
      );
      const zipName = `compressed.zip`;
      downloadBlob(zip, zipName, MIME.ZIP);
      setStatus({
        kind: "done",
        count: results.length,
        filename: zipName,
        meta: { originalSize: originalTotal, compressedSize: compressedTotal },
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
        label="Drop images here"
        buttonLabel="Choose images"
        accept={ACCEPT_INPUT}
        multiple
        inputAriaLabel="Choose images to compress"
        onFiles={accept}
      />

      {files.length > 0 && (
        <div class="mt-6">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)]">
              Queue ({files.length})
            </h3>
            <button
              type="button"
              onClick={clearAll}
              disabled={busy}
              class="font-mono text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-danger)] disabled:opacity-50"
            >
              clear all
            </button>
          </div>
          <ul class="space-y-2">
            {files.map((f) => (
              <li
                key={f.id}
                class="flex items-center gap-3 p-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]"
              >
                <span class="flex-1 truncate text-sm text-[var(--color-fg)]">
                  {f.file.name}
                </span>
                <span class="font-mono text-xs text-[var(--color-fg-dim)] hidden sm:inline">
                  {formatSize(f.file.size)}
                </span>
                <button
                  type="button"
                  onClick={() => remove(f.id)}
                  disabled={busy}
                  aria-label={`Remove ${f.file.name}`}
                  class="font-mono text-xs w-7 h-7 rounded border border-[var(--color-border)] hover:border-[var(--color-danger)] hover:text-[var(--color-danger)] disabled:opacity-30"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          <div class="mt-6">
            <label
              htmlFor="compress-quality"
              class="block font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2"
            >
              Quality — {Math.round(quality * 100)}%
            </label>
            <input
              id="compress-quality"
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={quality}
              disabled={busy}
              onInput={(e) =>
                setQuality(parseFloat((e.currentTarget as HTMLInputElement).value))
              }
              class="w-full"
            />
            <p class="mt-2 text-xs font-mono text-[var(--color-fg-dim)]">
              JPG, WebP, and AVIF inputs stay in their format. PNG / GIF / BMP / TIFF / HEIC are converted to WebP for meaningful compression.
            </p>
          </div>

          <div class="mt-6 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onCompress}
              disabled={busy}
              class="font-mono text-sm px-5 py-2.5 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-fg-dim)] disabled:cursor-not-allowed transition-colors"
            >
              {busy ? `${status.label ?? "Working"}…` : `Compress ${files.length}`}
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
        {status.kind === "working" && status.label === "Packing ZIP" && (
          <span class="text-[var(--color-fg-muted)]">Packing ZIP…</span>
        )}
        {status.kind === "working" && status.label !== "Packing ZIP" && (
          <span class="text-[var(--color-accent)]">
            {status.label}…
          </span>
        )}
        {status.kind === "done" && (
          <span class="text-[var(--color-accent)]">
            ✓ {formatSize((status.meta?.originalSize as number) ?? 0)} → {formatSize((status.meta?.compressedSize as number) ?? 0)} ({Math.round(
              (1 - ((status.meta?.compressedSize as number) ?? 0) / ((status.meta?.originalSize as number) || 1)) * 100
            )}% smaller). Saved as {status.filename}.
          </span>
        )}
        {status.kind === "error" && (
          <span class="text-[var(--color-danger)]">Error: {status.message}</span>
        )}
      </div>
    </div>
  );
}
