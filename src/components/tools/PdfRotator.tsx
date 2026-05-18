import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import FileDropZone from "../shared/FileDropZone";
import { downloadBlob, formatSize } from "../../lib/util/file";
import { readPageCount } from "../../lib/pdf/split";
import type { RotationAngle } from "../../lib/pdf/rotate";
import type { RotateRequest, RotateResponse } from "../../lib/pdf/rotate.worker";

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
  | { kind: "rotating" }
  | { kind: "done"; rotatedPageCount: number; totalPageCount: number; filename: string }
  | { kind: "error"; message: string };

const ANGLES: RotationAngle[] = [90, 180, 270];

export default function PdfRotator() {
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [angle, setAngle] = useState<RotationAngle>(90);
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
      new URL("../../lib/pdf/rotate.worker.ts", import.meta.url),
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
      setFile({ name: first.name, size: first.size, pageCount, buffer });
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

  const onRotate = async () => {
    if (!file) return;
    try {
      const worker = await ensureWorker();
      const id = ++requestIdRef.current;

      const responsePromise = new Promise<RotateResponse>((resolve) => {
        const handler = (event: MessageEvent<RotateResponse>) => {
          if (event.data.id !== id) return;
          worker.removeEventListener("message", handler);
          resolve(event.data);
        };
        worker.addEventListener("message", handler);
      });

      setStatus({ kind: "rotating" });
      const buffer = file.buffer.slice(0);
      const req: RotateRequest = {
        id,
        buffer,
        sourceName: file.name,
        angle,
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
        rotatedPageCount: result.rotatedPageCount,
        totalPageCount: result.totalPageCount,
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
    status.kind === "rotating";

  return (
    <div class="w-full">
      <FileDropZone
        label={file ? "Drop a different PDF to replace" : "Drop a PDF here"}
        buttonLabel="Choose file"
        accept="application/pdf,.pdf"
        inputAriaLabel="Choose a PDF to rotate"
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
              Rotation
            </legend>
            <div class="flex flex-wrap gap-2">
              {ANGLES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setAngle(option)}
                  disabled={busy}
                  aria-pressed={angle === option}
                  class={`font-mono text-sm px-4 py-2 rounded-md border transition-colors ${
                    angle === option
                      ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                      : "border-[var(--color-border)] text-[var(--color-fg)] hover:border-[var(--color-fg-muted)]"
                  } disabled:opacity-50`}
                >
                  {option}° clockwise
                </button>
              ))}
            </div>
          </fieldset>

          <div class="mt-6">
            <label
              htmlFor="rotate-pages-input"
              class="block font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2"
            >
              Which pages
            </label>
            <input
              id="rotate-pages-input"
              type="text"
              value={pages}
              onInput={(event) =>
                setPages((event.currentTarget as HTMLInputElement).value)
              }
              disabled={busy}
              placeholder="leave blank for all pages, or e.g. 1-3, 5, 7-"
              autocomplete="off"
              spellcheck={false}
              class="w-full font-mono text-base px-3 py-2.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-50"
            />
            <p class="mt-2 text-xs font-mono text-[var(--color-fg-dim)]">
              Empty = rotate every page. Otherwise list pages or ranges, e.g. <span class="text-[var(--color-fg-muted)]">2-4, 7</span>.
            </p>
          </div>

          <div class="mt-6 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onRotate}
              disabled={busy}
              class="font-mono text-sm px-5 py-2.5 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-fg-dim)] disabled:cursor-not-allowed transition-colors"
            >
              {busy ? statusLabel(status) : "Rotate & download"}
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
          <span class="text-[var(--color-fg-muted)]">Preparing rotator…</span>
        )}
        {status.kind === "rotating" && (
          <span class="text-[var(--color-accent)]">Rotating in your browser…</span>
        )}
        {status.kind === "done" && (
          <span class="text-[var(--color-accent)]">
            ✓ Rotated {status.rotatedPageCount} of {status.totalPageCount} page{status.totalPageCount === 1 ? "" : "s"} → {status.filename} downloaded.
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
    case "rotating":
      return "Rotating…";
    default:
      return "Working…";
  }
}
