import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import FileDropZone from "../shared/FileDropZone";
import { downloadBlob, formatSize, newId } from "../../lib/util/file";
import { readPageCount } from "../../lib/pdf/split";
import { openThumbnailRenderer, type ThumbnailRenderer } from "../../lib/pdf/renderThumbnail";
import type { SplitRequest, SplitResponse } from "../../lib/pdf/split.worker";

interface LoadedFile {
  name: string;
  size: number;
  pageCount: number;
  buffer: ArrayBuffer;
}

interface PageItem {
  id: string;
  originalIndex: number; // 0-based
  thumb: string | null;
}

type Status =
  | { kind: "idle" }
  | { kind: "reading" }
  | { kind: "loading-worker" }
  | { kind: "saving" }
  | { kind: "done"; pageCount: number; filename: string }
  | { kind: "error"; message: string };

function basenameWithoutExt(name: string): string {
  return name.replace(/\.pdf$/i, "");
}

export default function PdfOrganizer() {
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [dragId, setDragId] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const rendererRef = useRef<ThumbnailRenderer | null>(null);
  const renderTokenRef = useRef(0);
  const requestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      rendererRef.current?.destroy().catch(() => undefined);
    };
  }, []);

  const ensureWorker = useCallback(async (): Promise<Worker> => {
    if (workerRef.current) return workerRef.current;
    setStatus({ kind: "loading-worker" });
    const worker = new Worker(
      new URL("../../lib/pdf/split.worker.ts", import.meta.url),
      { type: "module" }
    );
    workerRef.current = worker;
    return worker;
  }, []);

  const startThumbnailLoad = useCallback(
    async (buffer: ArrayBuffer, pageCount: number) => {
      const token = ++renderTokenRef.current;
      // Tear down a previous renderer if the user dropped a different file.
      if (rendererRef.current) {
        await rendererRef.current.destroy().catch(() => undefined);
        rendererRef.current = null;
      }
      try {
        const renderer = await openThumbnailRenderer(buffer);
        if (token !== renderTokenRef.current) {
          await renderer.destroy();
          return;
        }
        rendererRef.current = renderer;
        for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
          if (token !== renderTokenRef.current) return;
          try {
            const dataUrl = await renderer.renderPage(pageNumber, 160);
            if (token !== renderTokenRef.current) return;
            setPages((current) =>
              current.map((p) =>
                p.originalIndex === pageNumber - 1
                  ? { ...p, thumb: dataUrl }
                  : p
              )
            );
          } catch {
            // A failed thumbnail isn't fatal — the page card still works.
          }
        }
      } catch {
        // pdf.js init failure shouldn't break the tool; cards just stay blank.
      }
    },
    []
  );

  const acceptFiles = useCallback(
    async (incoming: FileList | File[]) => {
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
      setStatus({ kind: "reading" });
      try {
        const buffer = await first.arrayBuffer();
        const pageCount = await readPageCount(buffer);
        setFile({
          name: first.name,
          size: first.size,
          pageCount,
          buffer,
        });
        setPages(
          Array.from({ length: pageCount }, (_, i) => ({
            id: newId(),
            originalIndex: i,
            thumb: null,
          }))
        );
        setStatus({ kind: "idle" });
        startThumbnailLoad(buffer, pageCount);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setStatus({
          kind: "error",
          message: `Couldn't read this PDF: ${message}`,
        });
      }
    },
    [startThumbnailLoad]
  );

  const moveById = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setPages((current) => {
      const sourceIndex = current.findIndex((p) => p.id === sourceId);
      const targetIndex = current.findIndex((p) => p.id === targetId);
      if (sourceIndex === -1 || targetIndex === -1) return current;
      const next = current.slice();
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const moveByOffset = (id: string, offset: number) => {
    setPages((current) => {
      const idx = current.findIndex((p) => p.id === id);
      if (idx === -1) return current;
      const newIdx = idx + offset;
      if (newIdx < 0 || newIdx >= current.length) return current;
      const next = current.slice();
      const [moved] = next.splice(idx, 1);
      next.splice(newIdx, 0, moved);
      return next;
    });
  };

  const deletePage = (id: string) => {
    setPages((current) => current.filter((p) => p.id !== id));
  };

  const reset = () => {
    if (!file) return;
    setPages(
      Array.from({ length: file.pageCount }, (_, i) => ({
        id: newId(),
        originalIndex: i,
        thumb: null,
      }))
    );
    startThumbnailLoad(file.buffer, file.pageCount);
    setStatus({ kind: "idle" });
  };

  const clear = async () => {
    renderTokenRef.current++;
    await rendererRef.current?.destroy().catch(() => undefined);
    rendererRef.current = null;
    setFile(null);
    setPages([]);
    setStatus({ kind: "idle" });
  };

  const onSave = async () => {
    if (!file) return;
    if (pages.length === 0) {
      setStatus({
        kind: "error",
        message: "All pages have been deleted — there's nothing to save.",
      });
      return;
    }
    try {
      const worker = await ensureWorker();
      const id = ++requestIdRef.current;
      const pagesString = pages
        .map((p) => (p.originalIndex + 1).toString())
        .join(", ");

      const responsePromise = new Promise<SplitResponse>((resolve) => {
        const handler = (event: MessageEvent<SplitResponse>) => {
          if (event.data.id !== id) return;
          worker.removeEventListener("message", handler);
          resolve(event.data);
        };
        worker.addEventListener("message", handler);
      });

      setStatus({ kind: "saving" });
      const buffer = file.buffer.slice(0);
      const req: SplitRequest = {
        id,
        buffer,
        sourceName: file.name,
        pages: pagesString,
      };
      worker.postMessage(req, [buffer]);

      const result = await responsePromise;
      if (!result.ok) {
        setStatus({ kind: "error", message: result.error });
        return;
      }
      const base = basenameWithoutExt(file.name) || "document";
      const filename = `${base}-organized.pdf`;
      downloadBlob(result.bytes, filename, "application/pdf");
      setStatus({
        kind: "done",
        pageCount: result.pageCount,
        filename,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus({ kind: "error", message });
    }
  };

  const onCardDragStart = (id: string) => (event: DragEvent) => {
    setDragId(id);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", id);
    }
  };
  const onCardDragOver = (event: DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  };
  const onCardDrop = (id: string) => (event: DragEvent) => {
    event.preventDefault();
    if (!dragId || dragId === id) return;
    moveById(dragId, id);
    setDragId(null);
  };
  const onCardDragEnd = () => setDragId(null);

  const busy =
    status.kind === "reading" ||
    status.kind === "loading-worker" ||
    status.kind === "saving";

  const hasChanges =
    file !== null &&
    (pages.length !== file.pageCount ||
      pages.some((p, i) => p.originalIndex !== i));

  return (
    <div class="w-full">
      <FileDropZone
        label={file ? "Drop a different PDF to replace" : "Drop a PDF here"}
        buttonLabel="Choose file"
        accept="application/pdf,.pdf"
        inputAriaLabel="Choose a PDF to organize"
        onFiles={acceptFiles}
      />

      {file && (
        <div class="mt-6">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h3 class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)]">
              Pages ({pages.length}{hasChanges ? ` of ${file.pageCount}` : ""})
            </h3>
            <div class="flex items-center gap-3">
              {hasChanges && (
                <button
                  type="button"
                  onClick={reset}
                  disabled={busy}
                  class="font-mono text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] disabled:opacity-50"
                >
                  reset
                </button>
              )}
              <button
                type="button"
                onClick={clear}
                disabled={busy}
                class="font-mono text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-danger)] disabled:opacity-50"
              >
                clear
              </button>
            </div>
          </div>
          <div class="flex items-center gap-3 p-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] mb-4">
            <span class="flex-1 truncate text-sm text-[var(--color-fg)]">
              {file.name}
            </span>
            <span class="font-mono text-xs text-[var(--color-fg-dim)] hidden sm:inline">
              {formatSize(file.size)}
            </span>
          </div>

          <ul class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {pages.map((page, index) => (
              <li
                key={page.id}
                draggable={!busy}
                onDragStart={onCardDragStart(page.id)}
                onDragOver={onCardDragOver}
                onDrop={onCardDrop(page.id)}
                onDragEnd={onCardDragEnd}
                class={`relative rounded-md border bg-[var(--color-surface)] p-2 transition-colors ${
                  dragId === page.id
                    ? "border-[var(--color-accent)] opacity-50"
                    : "border-[var(--color-border)] hover:border-[var(--color-border-hover)]"
                }`}
              >
                <div class="aspect-[2/3] bg-[var(--color-surface-2)] rounded overflow-hidden flex items-center justify-center text-[var(--color-fg-dim)] font-mono text-xs">
                  {page.thumb ? (
                    <img
                      src={page.thumb}
                      alt={`Page ${page.originalIndex + 1}`}
                      class="max-w-full max-h-full"
                      draggable={false}
                    />
                  ) : (
                    <span aria-hidden="true">loading…</span>
                  )}
                </div>
                <div class="mt-2 flex items-center justify-between">
                  <span class="font-mono text-xs text-[var(--color-fg-dim)]">
                    <span class="text-[var(--color-fg-muted)]">{String(index + 1).padStart(2, "0")}</span>
                    <span class="mx-1">·</span>
                    src p{page.originalIndex + 1}
                  </span>
                  <div class="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveByOffset(page.id, -1)}
                      disabled={index === 0 || busy}
                      aria-label={`Move page ${page.originalIndex + 1} earlier`}
                      class="font-mono text-xs w-6 h-6 rounded border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-30"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => moveByOffset(page.id, 1)}
                      disabled={index === pages.length - 1 || busy}
                      aria-label={`Move page ${page.originalIndex + 1} later`}
                      class="font-mono text-xs w-6 h-6 rounded border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-30"
                    >
                      →
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePage(page.id)}
                      disabled={busy}
                      aria-label={`Delete page ${page.originalIndex + 1}`}
                      class="font-mono text-xs w-6 h-6 rounded border border-[var(--color-border)] hover:border-[var(--color-danger)] hover:text-[var(--color-danger)] disabled:opacity-30"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div class="mt-6 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onSave}
              disabled={busy || pages.length === 0}
              class="font-mono text-sm px-5 py-2.5 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-fg-dim)] disabled:cursor-not-allowed transition-colors"
            >
              {busy ? statusLabel(status) : "Save & download"}
            </button>
            {!hasChanges && status.kind === "idle" && (
              <span class="font-mono text-xs text-[var(--color-fg-muted)]">
                drag pages to reorder, × to delete, then save
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
        {status.kind === "reading" && (
          <span class="text-[var(--color-fg-muted)]">Reading PDF…</span>
        )}
        {status.kind === "loading-worker" && (
          <span class="text-[var(--color-fg-muted)]">Preparing…</span>
        )}
        {status.kind === "saving" && (
          <span class="text-[var(--color-accent)]">Saving in your browser…</span>
        )}
        {status.kind === "done" && (
          <span class="text-[var(--color-accent)]">
            ✓ Saved {status.pageCount} page{status.pageCount === 1 ? "" : "s"} → {status.filename} downloaded.
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
    case "reading":
      return "Reading…";
    case "loading-worker":
      return "Loading…";
    case "saving":
      return "Saving…";
    default:
      return "Working…";
  }
}
