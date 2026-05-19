import { useCallback, useEffect, useState } from "preact/hooks";
import FileDropZone from "../shared/FileDropZone";
import type { Status } from "../shared/Widgets";
import { downloadBlob, formatSize } from "../../lib/util/file";
import { stripExt } from "../../lib/util/filename";
import { MIME } from "../../lib/util/mime";
import { readPageCount } from "../../lib/pdf/split";
import { pdfToImages, type OutputFormat } from "../../lib/pdf/pdfToImages";
import { zipEntries } from "../../lib/util/zip";

interface LoadedFile {
  name: string;
  size: number;
  pageCount: number;
  buffer: ArrayBuffer;
}

const QUALITY_PRESETS: { label: string; dpi: number; scale: number }[] = [
  { label: "Screen (96 dpi)", dpi: 96, scale: 96 / 72 },
  { label: "Print (200 dpi)", dpi: 200, scale: 200 / 72 },
  { label: "High (300 dpi)", dpi: 300, scale: 300 / 72 },
];

export default function PdfToImages() {
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [format, setFormat] = useState<OutputFormat>("jpeg");
  const [dpi, setDpi] = useState<number>(200);
  const [pages, setPages] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const scale =
    QUALITY_PRESETS.find((p) => p.dpi === dpi)?.scale ?? 200 / 72;

  useEffect(() => () => undefined, []);

  const acceptFiles = useCallback(async (incoming: FileList | File[]) => {
    const first = Array.from(incoming)[0];
    if (!first) return;
    const isPdf =
      first.type === "application/pdf" ||
      first.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setStatus({
        kind: "error",
        message: "That doesn't look like a PDF. Drop or pick a .pdf file.",
      });
      return;
    }
    setStatus({ kind: "loading", label: "Reading PDF" });
    try {
      const buffer = await first.arrayBuffer();
      const pageCount = await readPageCount(buffer);
      setFile({
        name: first.name,
        size: first.size,
        pageCount,
        buffer,
      });
      setPages("");
      setStatus({ kind: "idle" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus({
        kind: "error",
        message: `Couldn't read this PDF: ${message}`,
      });
    }
  }, []);

  const clear = () => {
    setFile(null);
    setPages("");
    setStatus({ kind: "idle" });
  };

  const onConvert = async () => {
    if (!file) return;
    setStatus({ kind: "working", label: `Rendering 0 of ${file.pageCount}`, p: 0 });
    try {
      const result = await pdfToImages(file.buffer, file.name, {
        format,
        scale,
        quality: 0.92,
        pages,
        onProgress: (done, total) => {
          setStatus({ kind: "working", label: `Rendering ${done} of ${total}`, p: done / total });
        },
      });

      if (result.pages.length === 0) {
        setStatus({ kind: "error", message: "No pages rendered." });
        return;
      }

      if (result.pages.length === 1) {
        const only = result.pages[0];
        downloadBlob(
          only.bytes,
          only.name,
          format === "jpeg" ? "image/jpeg" : "image/png"
        );
        setStatus({
          kind: "done",
          count: 1,
          filename: only.name,
        });
        return;
      }

      setStatus({ kind: "working", label: "Packing ZIP" });
      const zip = zipEntries(
        result.pages.map((p) => ({ name: p.name, bytes: p.bytes }))
      );
      const base = stripExt(file.name) || "document";
      const zipName = `${base}-${format === "jpeg" ? "jpg" : "png"}.zip`;
      downloadBlob(zip, zipName, MIME.ZIP);
      setStatus({
        kind: "done",
        count: result.pages.length,
        filename: zipName,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus({ kind: "error", message });
    }
  };

  const busy =
    status.kind === "loading" ||
    status.kind === "working";

  return (
    <div class="w-full">
      <FileDropZone
        label={file ? "Drop a different PDF to replace" : "Drop a PDF here"}
        buttonLabel="Choose file"
        accept="application/pdf,.pdf"
        inputAriaLabel="Choose a PDF to convert to images"
        onFiles={acceptFiles}
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
              {file.name}
            </span>
            <span class="font-mono text-xs text-[var(--color-fg-dim)]">
              {file.pageCount} pages
            </span>
            <span class="font-mono text-xs text-[var(--color-fg-dim)] hidden sm:inline">
              {formatSize(file.size)}
            </span>
          </div>

          <fieldset class="mt-6">
            <legend class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2">
              Format
            </legend>
            <div class="flex flex-wrap gap-2">
              {(["jpeg", "png"] as const).map((option) => (
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
                  {option === "jpeg" ? "JPG" : "PNG"}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset class="mt-6">
            <legend class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2">
              Resolution
            </legend>
            <div class="flex flex-wrap gap-2">
              {QUALITY_PRESETS.map((preset) => (
                <button
                  key={preset.dpi}
                  type="button"
                  onClick={() => setDpi(preset.dpi)}
                  disabled={busy}
                  aria-pressed={dpi === preset.dpi}
                  class={`font-mono text-sm px-4 py-2 rounded-md border transition-colors ${
                    dpi === preset.dpi
                      ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                      : "border-[var(--color-border)] text-[var(--color-fg)] hover:border-[var(--color-fg-muted)]"
                  } disabled:opacity-50`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div class="mt-6">
            <label
              htmlFor="pdf-to-img-pages"
              class="block font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2"
            >
              Which pages
            </label>
            <input
              id="pdf-to-img-pages"
              type="text"
              value={pages}
              onInput={(event) =>
                setPages((event.currentTarget as HTMLInputElement).value)
              }
              disabled={busy}
              placeholder="leave blank for all pages, or e.g. 1-3, 5"
              autocomplete="off"
              spellcheck={false}
              class="w-full font-mono text-base px-3 py-2.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-50"
            />
          </div>

          <div class="mt-6 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onConvert}
              disabled={busy}
              class="font-mono text-sm px-5 py-2.5 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-fg-dim)] disabled:cursor-not-allowed transition-colors"
            >
              {busy ? buttonLabel(status) : "Convert & download"}
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
        {status.kind === "loading" && (
          <span class="text-[var(--color-fg-muted)]">{status.label}…</span>
        )}
        {status.kind === "working" && status.label === "Packing ZIP" && (
          <span class="text-[var(--color-fg-muted)]">Packing ZIP…</span>
        )}
        {status.kind === "working" && status.label !== "Packing ZIP" && (
          <span class="text-[var(--color-accent)]">{status.label}…</span>
        )}
        {status.kind === "done" && (
          <span class="text-[var(--color-accent)]">
            ✓ Converted {status.count} page{status.count === 1 ? "" : "s"} → {status.filename} downloaded.
          </span>
        )}
        {status.kind === "error" && (
          <span class="text-[var(--color-danger)]">Error: {status.message}</span>
        )}
      </div>
    </div>
  );
}

function buttonLabel(status: Status): string {
  if (status.kind === "loading") return "Reading…";
  if (status.kind === "working" && status.label === "Packing ZIP") return "Packing…";
  if (status.kind === "working") return status.label ? `${status.label}…` : "Working…";
  return "Working…";
}
