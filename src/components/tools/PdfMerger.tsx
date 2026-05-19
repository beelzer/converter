import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import FileDropZone from "../shared/FileDropZone";
import type { Status } from "../shared/Widgets";
import { downloadBlob, formatSize, newId } from "../../lib/util/file";
import { MIME } from "../../lib/util/mime";
import type { MergeRequest, MergeResponse } from "../../lib/pdf/merge.worker";

interface QueuedFile {
  id: string;
  name: string;
  size: number;
  file: File;
}

export default function PdfMerger() {
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const ensureWorker = useCallback(async (): Promise<Worker> => {
    if (workerRef.current) return workerRef.current;
    setStatus({ kind: "loading", label: "Preparing merger" });
    const worker = new Worker(
      new URL("../../lib/pdf/merge.worker.ts", import.meta.url),
      { type: "module" }
    );
    workerRef.current = worker;
    return worker;
  }, []);

  const acceptFiles = useCallback((incoming: FileList | File[]) => {
    const pdfs: QueuedFile[] = [];
    for (const file of Array.from(incoming)) {
      const isPdf =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) continue;
      pdfs.push({ id: newId(), name: file.name, size: file.size, file });
    }
    if (pdfs.length === 0) {
      setStatus({
        kind: "error",
        message: "Those don't look like PDF files. Drop or pick .pdf files.",
      });
      return;
    }
    setStatus({ kind: "idle" });
    setFiles((current: QueuedFile[]) => [...current, ...pdfs]);
  }, []);

  const move = (from: number, to: number) => {
    setFiles((current: QueuedFile[]) => {
      if (to < 0 || to >= current.length) return current;
      const next = current.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const remove = (id: string) => {
    setFiles((current: QueuedFile[]) => current.filter((f: QueuedFile) => f.id !== id));
  };

  const clearAll = () => {
    setFiles([]);
    setStatus({ kind: "idle" });
  };

  const onMerge = async () => {
    if (files.length < 2) {
      setStatus({
        kind: "error",
        message: "Add at least two PDFs to merge.",
      });
      return;
    }
    try {
      const worker = await ensureWorker();
      setStatus({ kind: "loading", label: "Reading files" });
      const buffers = await Promise.all(files.map((f) => f.file.arrayBuffer()));

      const id = ++requestIdRef.current;
      const filename = deriveFilename(files);

      const responsePromise = new Promise<MergeResponse>((resolve) => {
        const handler = (event: MessageEvent<MergeResponse>) => {
          if (event.data.id !== id) return;
          worker.removeEventListener("message", handler);
          resolve(event.data);
        };
        worker.addEventListener("message", handler);
      });

      setStatus({ kind: "working", label: "Merging in your browser" });
      const req: MergeRequest = { id, buffers };
      worker.postMessage(req, buffers);

      const result = await responsePromise;
      if (!result.ok) {
        setStatus({ kind: "error", message: result.error });
        return;
      }

      downloadBlob(result.bytes, filename, MIME.PDF);
      setStatus({ kind: "done", count: result.pageCount, filename, meta: { unit: "pages" } });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus({ kind: "error", message });
    }
  };

  // List-item drag for reorder (HTML5 native — keyboard fallback via buttons).
  const onItemDragStart = (index: number) => (event: DragEvent) => {
    setDragIndex(index);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(index));
    }
  };
  const onItemDragOver = (event: DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  };
  const onItemDrop = (index: number) => (event: DragEvent) => {
    event.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    move(dragIndex, index);
    setDragIndex(null);
  };
  const onItemDragEnd = () => setDragIndex(null);

  const busy =
    status.kind === "loading" ||
    status.kind === "working";

  return (
    <div class="w-full">
      <FileDropZone
        label="Drop PDFs here"
        buttonLabel="Choose files"
        accept="application/pdf,.pdf"
        multiple
        inputAriaLabel="Choose PDF files to merge"
        onFiles={acceptFiles}
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
            {files.map((file: QueuedFile, index: number) => (
              <li
                key={file.id}
                draggable
                onDragStart={onItemDragStart(index)}
                onDragOver={onItemDragOver}
                onDrop={onItemDrop(index)}
                onDragEnd={onItemDragEnd}
                class={`flex items-center gap-3 p-3 rounded-md border bg-[var(--color-surface)] ${
                  dragIndex === index
                    ? "border-[var(--color-accent)] opacity-50"
                    : "border-[var(--color-border)] hover:border-[var(--color-border-hover)]"
                }`}
              >
                <span
                  class="font-mono text-xs text-[var(--color-fg-dim)] select-none cursor-grab"
                  aria-hidden="true"
                  title="Drag to reorder"
                >
                  ⋮⋮
                </span>
                <span class="font-mono text-xs text-[var(--color-fg-dim)] w-6 text-right select-none">
                  {(index + 1).toString().padStart(2, "0")}
                </span>
                <span class="flex-1 truncate text-sm text-[var(--color-fg)]">
                  {file.name}
                </span>
                <span class="font-mono text-xs text-[var(--color-fg-dim)] hidden sm:inline">
                  {formatSize(file.size)}
                </span>
                <div class="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(index, index - 1)}
                    disabled={index === 0 || busy}
                    aria-label={`Move ${file.name} up`}
                    class="font-mono text-xs w-7 h-7 rounded border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-30 disabled:hover:border-[var(--color-border)] disabled:hover:text-[var(--color-fg)]"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, index + 1)}
                    disabled={index === files.length - 1 || busy}
                    aria-label={`Move ${file.name} down`}
                    class="font-mono text-xs w-7 h-7 rounded border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-30 disabled:hover:border-[var(--color-border)] disabled:hover:text-[var(--color-fg)]"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(file.id)}
                    disabled={busy}
                    aria-label={`Remove ${file.name}`}
                    class="font-mono text-xs w-7 h-7 rounded border border-[var(--color-border)] hover:border-[var(--color-danger)] hover:text-[var(--color-danger)] disabled:opacity-30"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div class="mt-6 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onMerge}
              disabled={files.length < 2 || busy}
              class="font-mono text-sm px-5 py-2.5 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-fg-dim)] disabled:cursor-not-allowed transition-colors"
            >
              {busy ? buttonLabel(status) : `Merge & download ${files.length} PDF${files.length === 1 ? "" : "s"}`}
            </button>
            {files.length === 1 && status.kind === "idle" && (
              <span class="font-mono text-xs text-[var(--color-fg-muted)]">
                add one more to merge
              </span>
            )}
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
        {status.kind === "working" && (
          <span class="text-[var(--color-accent)]">{status.label}…</span>
        )}
        {status.kind === "done" && (
          <span class="text-[var(--color-accent)]">
            ✓ Merged {status.count} pages → {status.filename} downloaded.
          </span>
        )}
        {status.kind === "error" && (
          <span class="text-[var(--color-danger)]">
            Error: {status.message}
          </span>
        )}
      </div>
    </div>
  );
}

function buttonLabel(status: Status): string {
  if (status.kind === "loading" && status.label === "Preparing merger") return "Loading…";
  if (status.kind === "loading" && status.label === "Reading files") return "Reading files…";
  if (status.kind === "working") return "Merging…";
  return "Working…";
}

function deriveFilename(files: QueuedFile[]): string {
  if (files.length === 0) return "merged.pdf";
  const first = files[0].name.replace(/\.pdf$/i, "");
  return `${first}-merged.pdf`;
}
