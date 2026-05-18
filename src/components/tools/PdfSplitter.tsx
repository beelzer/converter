import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import FileDropZone from "../shared/FileDropZone";
import { downloadBlob, formatSize } from "../../lib/util/file";
import { readPageCount } from "../../lib/pdf/split";
import type { SplitRequest, SplitResponse } from "../../lib/pdf/split.worker";

interface LoadedFile {
  name: string;
  size: number;
  pageCount: number;
  buffer: ArrayBuffer;
}

type Status =
  | { kind: "idle" }
  | { kind: "reading" }
  | { kind: "loading-worker" }
  | { kind: "splitting" }
  | { kind: "done"; pageCount: number; filename: string }
  | { kind: "error"; message: string };

export default function PdfSplitter() {
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [pages, setPages] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
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
      setPages(pageCount > 1 ? `1-${pageCount}` : "1");
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

  const onSplit = async () => {
    if (!file) return;
    if (!pages.trim()) {
      setStatus({
        kind: "error",
        message: "Enter at least one page or range, e.g. 1-3, 5, 7-",
      });
      return;
    }
    try {
      const worker = await ensureWorker();
      const id = ++requestIdRef.current;

      const responsePromise = new Promise<SplitResponse>((resolve) => {
        const handler = (event: MessageEvent<SplitResponse>) => {
          if (event.data.id !== id) return;
          worker.removeEventListener("message", handler);
          resolve(event.data);
        };
        worker.addEventListener("message", handler);
      });

      setStatus({ kind: "splitting" });
      const buffer = file.buffer.slice(0);
      const req: SplitRequest = {
        id,
        buffer,
        sourceName: file.name,
        pages,
      };
      worker.postMessage(req, [buffer]);

      const result = await responsePromise;
      if (!result.ok) {
        setStatus({ kind: "error", message: result.error });
        return;
      }
      downloadBlob(result.bytes, result.filename, "application/pdf");
      setStatus({
        kind: "done",
        pageCount: result.pageCount,
        filename: result.filename,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus({ kind: "error", message });
    }
  };

  const busy =
    status.kind === "reading" ||
    status.kind === "loading-worker" ||
    status.kind === "splitting";

  return (
    <div class="w-full">
      <FileDropZone
        label={file ? "Drop a different PDF to replace" : "Drop a PDF here"}
        buttonLabel="Choose file"
        accept="application/pdf,.pdf"
        inputAriaLabel="Choose a PDF to split"
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

          <div class="mt-6">
            <label
              htmlFor="pages-input"
              class="block font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2"
            >
              Pages to extract
            </label>
            <input
              id="pages-input"
              type="text"
              value={pages}
              onInput={(event) =>
                setPages((event.currentTarget as HTMLInputElement).value)
              }
              disabled={busy}
              placeholder="e.g. 1-3, 5, 7-"
              autocomplete="off"
              spellcheck={false}
              class="w-full font-mono text-base px-3 py-2.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-50"
            />
            <p class="mt-2 text-xs font-mono text-[var(--color-fg-dim)]">
              Use commas to list ranges. <span class="text-[var(--color-fg-muted)]">1-3, 5, 7-</span> means pages 1–3, plus 5, plus 7 to the end.
            </p>
          </div>

          <div class="mt-6 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onSplit}
              disabled={busy || !pages.trim()}
              class="font-mono text-sm px-5 py-2.5 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-fg-dim)] disabled:cursor-not-allowed transition-colors"
            >
              {busy ? statusLabel(status) : "Extract & download"}
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
          <span class="text-[var(--color-fg-muted)]">Reading PDF…</span>
        )}
        {status.kind === "loading-worker" && (
          <span class="text-[var(--color-fg-muted)]">Preparing splitter…</span>
        )}
        {status.kind === "splitting" && (
          <span class="text-[var(--color-accent)]">Extracting in your browser…</span>
        )}
        {status.kind === "done" && (
          <span class="text-[var(--color-accent)]">
            ✓ Extracted {status.pageCount} page{status.pageCount === 1 ? "" : "s"} → {status.filename} downloaded.
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
    case "splitting":
      return "Extracting…";
    default:
      return "Working…";
  }
}
