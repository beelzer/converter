import { useCallback, useEffect, useState } from "preact/hooks";
import FileDropZone from "../shared/FileDropZone";
import { downloadBlob, formatSize } from "../../lib/util/file";
import { readExifSummary, stripExifFromJpeg, type ExifSummary } from "../../lib/image/exif";

interface LoadedFile {
  file: File;
}

type Status =
  | { kind: "idle" }
  | { kind: "reading" }
  | { kind: "stripping" }
  | { kind: "done"; filename: string; hadExif: boolean }
  | { kind: "error"; message: string };

function basenameWithoutExt(name: string): string {
  return name.replace(/\.[a-z0-9]+$/i, "");
}

export default function ExifStripper() {
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [exif, setExif] = useState<ExifSummary | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const accept = useCallback((incoming: FileList | File[]) => {
    const first = Array.from(incoming)[0];
    if (!first) return;
    if (
      first.type !== "image/jpeg" &&
      !/\.jpe?g$/i.test(first.name)
    ) {
      setStatus({
        kind: "error",
        message:
          "EXIF stripping needs a JPG. Other formats handle metadata differently — convert to JPG first.",
      });
      return;
    }
    setFile({ file: first });
    setExif(null);
    setStatus({ kind: "reading" });
  }, []);

  // Read EXIF in a side-effect so the UI shows a "Reading…" state while it's
  // happening (parsing is fast but lazy-imports a chunk).
  useEffect(() => {
    if (!file || status.kind !== "reading") return;
    let cancelled = false;
    (async () => {
      try {
        const summary = await readExifSummary(file.file);
        if (cancelled) return;
        setExif(summary);
        setStatus({ kind: "idle" });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setStatus({
          kind: "error",
          message: `Couldn't read this JPG: ${message}`,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file, status.kind]);

  const clear = () => {
    setFile(null);
    setExif(null);
    setStatus({ kind: "idle" });
  };

  const onStrip = async () => {
    if (!file) return;
    setStatus({ kind: "stripping" });
    try {
      const blob = await stripExifFromJpeg(file.file);
      const base = basenameWithoutExt(file.file.name) || "image";
      const filename = `${base}-no-exif.jpg`;
      downloadBlob(blob, filename, "image/jpeg");
      setStatus({
        kind: "done",
        filename,
        hadExif: !!exif && Object.keys(exif).length > 0,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus({ kind: "error", message });
    }
  };

  const busy = status.kind === "reading" || status.kind === "stripping";

  return (
    <div class="w-full">
      <FileDropZone
        label={file ? "Drop a different JPG to replace" : "Drop a JPG here"}
        buttonLabel="Choose JPG"
        accept="image/jpeg,.jpg,.jpeg"
        inputAriaLabel="Choose a JPG to strip EXIF from"
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

          {exif && Object.keys(exif).length > 0 && (
            <div class="mt-6">
              <h3 class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2">
                EXIF data found
              </h3>
              <dl class="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                {Object.entries(exif).map(([key, value]) => (
                  <div class="flex justify-between gap-2 border-b border-[var(--color-border)] py-1">
                    <dt class="font-mono text-xs text-[var(--color-fg-dim)] shrink-0">{key}</dt>
                    <dd class="font-mono text-xs text-[var(--color-fg)] truncate text-right" title={String(value)}>
                      {String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {status.kind !== "reading" && exif && Object.keys(exif).length === 0 && (
            <p class="mt-4 font-mono text-xs text-[var(--color-fg-muted)]">
              No EXIF data detected. Stripping is still safe — it&rsquo;ll just be a no-op.
            </p>
          )}

          <div class="mt-6 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onStrip}
              disabled={busy}
              class="font-mono text-sm px-5 py-2.5 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-fg-dim)] disabled:cursor-not-allowed transition-colors"
            >
              {busy ? "Working…" : "Strip EXIF & download"}
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
        {status.kind === "reading" && (
          <span class="text-[var(--color-fg-muted)]">Reading EXIF…</span>
        )}
        {status.kind === "stripping" && (
          <span class="text-[var(--color-accent)]">Stripping EXIF in your browser…</span>
        )}
        {status.kind === "done" && (
          <span class="text-[var(--color-accent)]">
            ✓ EXIF stripped → {status.filename} downloaded.
          </span>
        )}
        {status.kind === "error" && (
          <span class="text-[var(--color-danger)]">Error: {status.message}</span>
        )}
      </div>
    </div>
  );
}
