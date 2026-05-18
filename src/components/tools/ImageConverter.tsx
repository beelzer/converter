import { useCallback, useState } from "preact/hooks";
import FileDropZone from "../shared/FileDropZone";
import { downloadBlob, formatSize, newId } from "../../lib/util/file";
import { zipEntries } from "../../lib/util/zip";
import { convertImage } from "../../lib/image/convert";
import {
  ACCEPT_INPUT,
  FORMAT_LABEL,
  OUTPUT_FORMATS,
  detectInputFormat,
  type SupportedInputFormat,
  type SupportedOutputFormat,
} from "../../lib/image/formats";

interface QueuedFile {
  id: string;
  file: File;
  inputFormat: SupportedInputFormat | null;
}

type Status =
  | { kind: "idle" }
  | { kind: "converting"; done: number; total: number }
  | { kind: "packing" }
  | { kind: "done"; count: number; filename: string }
  | { kind: "error"; message: string };

export default function ImageConverter() {
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [outputFormat, setOutputFormat] = useState<SupportedOutputFormat>("jpeg");
  const [quality, setQuality] = useState(0.9);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const accept = useCallback((incoming: FileList | File[]) => {
    const next: QueuedFile[] = [];
    for (const file of Array.from(incoming)) {
      const fmt = detectInputFormat(file);
      next.push({ id: newId(), file, inputFormat: fmt });
    }
    if (next.length === 0) return;
    setStatus({ kind: "idle" });
    setFiles((current) => [...current, ...next]);
  }, []);

  const remove = (id: string) =>
    setFiles((current) => current.filter((f) => f.id !== id));
  const clearAll = () => {
    setFiles([]);
    setStatus({ kind: "idle" });
  };

  const onConvert = async () => {
    if (files.length === 0) return;
    const total = files.length;
    setStatus({ kind: "converting", done: 0, total });
    const results: { name: string; bytes: Uint8Array; blob: Blob }[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        try {
          const r = await convertImage(files[i].file, outputFormat, quality);
          const bytes = new Uint8Array(await r.blob.arrayBuffer());
          results.push({ name: r.name, bytes, blob: r.blob });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          setStatus({
            kind: "error",
            message: `${files[i].file.name}: ${message}`,
          });
          return;
        }
        setStatus({ kind: "converting", done: i + 1, total });
      }
      if (results.length === 1) {
        const only = results[0];
        downloadBlob(only.blob, only.name, only.blob.type);
        setStatus({ kind: "done", count: 1, filename: only.name });
        return;
      }
      setStatus({ kind: "packing" });
      const zip = zipEntries(
        results.map((r) => ({ name: r.name, bytes: r.bytes }))
      );
      const zipName = `images-${outputFormat === "jpeg" ? "jpg" : outputFormat}.zip`;
      downloadBlob(zip, zipName, "application/zip");
      setStatus({ kind: "done", count: results.length, filename: zipName });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus({ kind: "error", message });
    }
  };

  const busy = status.kind === "converting" || status.kind === "packing";

  return (
    <div class="w-full">
      <FileDropZone
        label="Drop images here"
        buttonLabel="Choose images"
        accept={ACCEPT_INPUT}
        multiple
        inputAriaLabel="Choose images to convert"
        onFiles={accept}
        subtitleHint="JPG · PNG · WebP · AVIF · GIF · BMP · TIFF · HEIC"
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
                <span
                  class="font-mono text-[10px] px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-fg-muted)] shrink-0"
                  title="Detected input format"
                >
                  {f.inputFormat ? FORMAT_LABEL[f.inputFormat] : "?"}
                </span>
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

          <fieldset class="mt-6">
            <legend class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2">
              Output format
            </legend>
            <div class="flex flex-wrap gap-2">
              {OUTPUT_FORMATS.map((format) => (
                <button
                  key={format}
                  type="button"
                  onClick={() => setOutputFormat(format)}
                  disabled={busy}
                  aria-pressed={outputFormat === format}
                  class={`font-mono text-sm px-4 py-2 rounded-md border transition-colors ${
                    outputFormat === format
                      ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                      : "border-[var(--color-border)] text-[var(--color-fg)] hover:border-[var(--color-fg-muted)]"
                  } disabled:opacity-50`}
                >
                  {FORMAT_LABEL[format]}
                </button>
              ))}
            </div>
          </fieldset>

          {(outputFormat === "jpeg" ||
            outputFormat === "webp" ||
            outputFormat === "avif") && (
            <div class="mt-6">
              <label
                htmlFor="image-quality"
                class="block font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2"
              >
                Quality — {Math.round(quality * 100)}%
              </label>
              <input
                id="image-quality"
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
            </div>
          )}

          <div class="mt-6 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onConvert}
              disabled={busy}
              class="font-mono text-sm px-5 py-2.5 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-fg-dim)] disabled:cursor-not-allowed transition-colors"
            >
              {busy
                ? statusLabel(status)
                : `Convert ${files.length} → ${FORMAT_LABEL[outputFormat]}`}
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
        {status.kind === "converting" && (
          <span class="text-[var(--color-accent)]">
            Converting {status.done} of {status.total}…
          </span>
        )}
        {status.kind === "packing" && (
          <span class="text-[var(--color-fg-muted)]">Packing ZIP…</span>
        )}
        {status.kind === "done" && (
          <span class="text-[var(--color-accent)]">
            ✓ Converted {status.count} image{status.count === 1 ? "" : "s"} → {status.filename} downloaded.
          </span>
        )}
        {status.kind === "error" && (
          <span class="text-[var(--color-danger)]">Error: {status.message}</span>
        )}
      </div>
    </div>
  );
}

function statusLabel(status: Status): string {
  switch (status.kind) {
    case "converting":
      return `Converting ${status.done}/${status.total}…`;
    case "packing":
      return "Packing…";
    default:
      return "Working…";
  }
}
