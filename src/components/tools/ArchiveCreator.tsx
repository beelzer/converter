import { useEffect, useState } from "preact/hooks";
import FileDropZone from "../shared/FileDropZone";
import { downloadBlob, formatSize, newId } from "../../lib/util/file";
import { createArchive } from "../../lib/archive/create";
import {
  CREATE_FORMATS,
  CREATE_LABEL,
  type CreateFormat,
} from "../../lib/archive/formats";

interface Item {
  id: string;
  file: File;
}

type Status =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "done"; filename: string; size: number }
  | { kind: "error"; message: string };

export default function ArchiveCreator() {
  const [items, setItems] = useState<Item[]>([]);
  const [format, setFormat] = useState<CreateFormat>("zip");
  const [archiveName, setArchiveName] = useState("archive");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    // If user accidentally picks GZIP with many files, nudge to TAR.GZ.
    if (format === "gzip" && items.length > 1) setFormat("tar.gz");
  }, [items.length, format]);

  const accept = (incoming: FileList | File[]) => {
    const next: Item[] = Array.from(incoming).map((file) => ({
      id: newId(),
      file,
    }));
    if (next.length === 0) return;
    setStatus({ kind: "idle" });
    setItems((current) => [...current, ...next]);
  };

  const remove = (id: string) =>
    setItems((current) => current.filter((i) => i.id !== id));

  const clearAll = () => {
    setItems([]);
    setStatus({ kind: "idle" });
  };

  const onCreate = async () => {
    if (items.length === 0) {
      setStatus({ kind: "error", message: "Add at least one file." });
      return;
    }
    setStatus({ kind: "working" });
    try {
      const inputs = await Promise.all(
        items.map(async (i) => ({
          name: i.file.name,
          bytes: new Uint8Array(await i.file.arrayBuffer()),
        }))
      );
      const out = createArchive(inputs, format, archiveName || "archive");
      downloadBlob(out.bytes, out.filename, out.mime);
      setStatus({ kind: "done", filename: out.filename, size: out.bytes.byteLength });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const busy = status.kind === "working";
  const totalSize = items.reduce((sum, i) => sum + i.file.size, 0);

  return (
    <div class="w-full">
      <FileDropZone
        label="Drop files to archive"
        buttonLabel="Choose files"
        accept="*/*"
        multiple
        inputAriaLabel="Choose files to archive"
        onFiles={accept}
        subtitleHint="Order doesn't matter for ZIP/TAR. GZIP wraps one file only — use TAR.GZ for many."
      />

      {items.length > 0 && (
        <div class="mt-6">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)]">
              Files ({items.length}) · {formatSize(totalSize)}
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
            {items.map((item) => (
              <li
                key={item.id}
                class="flex items-center gap-3 p-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]"
              >
                <span class="flex-1 truncate text-sm text-[var(--color-fg)]">
                  {item.file.name}
                </span>
                <span class="font-mono text-xs text-[var(--color-fg-dim)] hidden sm:inline">
                  {formatSize(item.file.size)}
                </span>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  disabled={busy}
                  aria-label={`Remove ${item.file.name}`}
                  class="font-mono text-xs w-7 h-7 rounded border border-[var(--color-border)] hover:border-[var(--color-danger)] hover:text-[var(--color-danger)] disabled:opacity-30"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          <fieldset class="mt-6">
            <legend class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2">
              Format
            </legend>
            <div class="flex flex-wrap gap-2">
              {CREATE_FORMATS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  aria-pressed={format === f}
                  disabled={busy || (f === "gzip" && items.length > 1)}
                  class={`font-mono text-sm px-4 py-2 rounded-md border transition-colors ${
                    format === f
                      ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                      : "border-[var(--color-border)] text-[var(--color-fg)] hover:border-[var(--color-fg-muted)]"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {CREATE_LABEL[f]}
                </button>
              ))}
            </div>
            {format === "gzip" && (
              <p class="mt-2 font-mono text-xs text-[var(--color-fg-dim)]">
                GZIP wraps a single file. Drop more and we'll switch to TAR.GZ.
              </p>
            )}
          </fieldset>

          {format !== "gzip" && (
            <label class="mt-4 block">
              <span class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2 block">
                Archive name
              </span>
              <input
                type="text"
                value={archiveName}
                onInput={(e) =>
                  setArchiveName(
                    (e.currentTarget as HTMLInputElement).value.replace(/[^A-Za-z0-9._-]/g, "_")
                  )
                }
                disabled={busy}
                class="font-mono text-sm px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] w-64"
              />
            </label>
          )}

          <div class="mt-6">
            <button
              type="button"
              onClick={onCreate}
              disabled={busy}
              class="font-mono text-sm px-5 py-2.5 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-fg-dim)] disabled:cursor-not-allowed transition-colors"
            >
              {busy ? "Creating…" : `Create ${CREATE_LABEL[format]}`}
            </button>
          </div>
        </div>
      )}

      <div role="status" aria-live="polite" class="mt-4 min-h-[1.5rem] font-mono text-sm">
        {status.kind === "done" && (
          <span class="text-[var(--color-accent)]">
            ✓ {status.filename} ({formatSize(status.size)}) downloaded.
          </span>
        )}
        {status.kind === "error" && (
          <span class="text-[var(--color-danger)]">Error: {status.message}</span>
        )}
      </div>
    </div>
  );
}
