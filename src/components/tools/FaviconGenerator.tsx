import { useCallback, useState } from "preact/hooks";
import FileDropZone from "../shared/FileDropZone";
import { downloadBlob, formatSize } from "../../lib/util/file";
import { zipEntries } from "../../lib/util/zip";
import { generateFaviconBundle } from "../../lib/image/favicon";
import { ACCEPT_INPUT, detectInputFormat } from "../../lib/image/formats";

interface LoadedFile {
  file: File;
}

type Status =
  | { kind: "idle" }
  | { kind: "generating" }
  | { kind: "done"; filename: string; count: number }
  | { kind: "error"; message: string };

export default function FaviconGenerator() {
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [siteName, setSiteName] = useState("My Site");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const accept = useCallback((incoming: FileList | File[]) => {
    const first = Array.from(incoming)[0];
    if (!first) return;
    if (!detectInputFormat(first)) {
      setStatus({
        kind: "error",
        message: "Unrecognized image type. Use a square image — PNG works best.",
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

  const onGenerate = async () => {
    if (!file) return;
    setStatus({ kind: "generating" });
    try {
      const result = await generateFaviconBundle(file.file, siteName);
      const zip = zipEntries(result.entries);
      const filename = "favicon-bundle.zip";
      downloadBlob(zip, filename, "application/zip");
      setStatus({
        kind: "done",
        filename,
        count: result.entries.length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus({ kind: "error", message });
    }
  };

  const busy = status.kind === "generating";

  return (
    <div class="w-full">
      <FileDropZone
        label={file ? "Drop a different image to replace" : "Drop your logo here"}
        buttonLabel="Choose image"
        accept={ACCEPT_INPUT}
        inputAriaLabel="Choose a logo image for the favicon bundle"
        onFiles={accept}
        subtitleHint="A square PNG with transparent background works best"
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

          <div class="mt-6">
            <label
              htmlFor="favicon-site-name"
              class="block font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2"
            >
              Site name (for manifest)
            </label>
            <input
              id="favicon-site-name"
              type="text"
              value={siteName}
              disabled={busy}
              onInput={(e) =>
                setSiteName((e.currentTarget as HTMLInputElement).value)
              }
              class="w-full font-mono text-base px-3 py-2.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-50"
            />
          </div>

          <p class="mt-4 text-xs font-mono text-[var(--color-fg-dim)]">
            You&rsquo;ll get a ZIP with <span class="text-[var(--color-fg-muted)]">favicon.ico</span> (16/32/48), Apple touch icon (180), Android chrome icons (192/512), assorted PNGs, and a starter <span class="text-[var(--color-fg-muted)]">site.webmanifest</span>.
          </p>

          <div class="mt-6 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onGenerate}
              disabled={busy}
              class="font-mono text-sm px-5 py-2.5 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-fg-dim)] disabled:cursor-not-allowed transition-colors"
            >
              {busy ? "Generating…" : "Generate & download"}
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
        {status.kind === "generating" && (
          <span class="text-[var(--color-accent)]">Generating bundle in your browser…</span>
        )}
        {status.kind === "done" && (
          <span class="text-[var(--color-accent)]">
            ✓ Bundle with {status.count} files → {status.filename} downloaded.
          </span>
        )}
        {status.kind === "error" && (
          <span class="text-[var(--color-danger)]">Error: {status.message}</span>
        )}
      </div>
    </div>
  );
}
