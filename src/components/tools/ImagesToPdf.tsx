import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import FileDropZone from "../shared/FileDropZone";
import type { Status } from "../shared/Widgets";
import { downloadBlob, formatSize, newId } from "../../lib/util/file";
import { MIME } from "../../lib/util/mime";
import { imageToPngBytes } from "../../lib/image/decode";
import type {
  ImageInput,
  SupportedImageMime,
} from "../../lib/pdf/imagesToPdf";
import type {
  ImagesToPdfRequest,
  ImagesToPdfResponse,
} from "../../lib/pdf/imagesToPdf.worker";

interface QueuedFile {
  id: string;
  name: string;
  size: number;
  file: File;
}

const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"];

function isImage(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  const lower = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

async function fileToImageInput(file: File): Promise<ImageInput> {
  const lower = file.name.toLowerCase();
  const isJpg =
    file.type === "image/jpeg" ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg");
  const isPng = file.type === "image/png" || lower.endsWith(".png");

  if (isJpg) {
    return {
      bytes: await file.arrayBuffer(),
      mime: "image/jpeg",
      name: file.name,
    };
  }
  if (isPng) {
    return {
      bytes: await file.arrayBuffer(),
      mime: "image/png",
      name: file.name,
    };
  }
  // Anything else (WebP, GIF, BMP) gets re-encoded as PNG so pdf-lib can embed it.
  const pngBytes = await imageToPngBytes(file);
  const renamed = file.name.replace(/\.[a-z0-9]+$/i, ".png");
  return {
    bytes: pngBytes,
    mime: "image/png" as SupportedImageMime,
    name: renamed,
  };
}

export default function ImagesToPdf() {
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
    setStatus({ kind: "loading", label: "Preparing builder" });
    const worker = new Worker(
      new URL("../../lib/pdf/imagesToPdf.worker.ts", import.meta.url),
      { type: "module" }
    );
    workerRef.current = worker;
    return worker;
  }, []);

  const acceptFiles = useCallback((incoming: FileList | File[]) => {
    const images: QueuedFile[] = [];
    for (const file of Array.from(incoming)) {
      if (!isImage(file)) continue;
      images.push({ id: newId(), name: file.name, size: file.size, file });
    }
    if (images.length === 0) {
      setStatus({
        kind: "error",
        message:
          "Those don't look like images. Drop JPG, PNG, WebP, GIF, or BMP files.",
      });
      return;
    }
    setStatus({ kind: "idle" });
    setFiles((current) => [...current, ...images]);
  }, []);

  const move = (from: number, to: number) => {
    setFiles((current) => {
      if (to < 0 || to >= current.length) return current;
      const next = current.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const remove = (id: string) => {
    setFiles((current) => current.filter((f) => f.id !== id));
  };

  const clearAll = () => {
    setFiles([]);
    setStatus({ kind: "idle" });
  };

  const onBuild = async () => {
    if (files.length === 0) return;
    try {
      const worker = await ensureWorker();
      setStatus({ kind: "working", label: "Decoding images" });
      const inputs = await Promise.all(files.map((f) => fileToImageInput(f.file)));

      const id = ++requestIdRef.current;
      const responsePromise = new Promise<ImagesToPdfResponse>((resolve) => {
        const handler = (event: MessageEvent<ImagesToPdfResponse>) => {
          if (event.data.id !== id) return;
          worker.removeEventListener("message", handler);
          resolve(event.data);
        };
        worker.addEventListener("message", handler);
      });

      setStatus({ kind: "working", label: "Building PDF in your browser" });
      const req: ImagesToPdfRequest = { id, images: inputs };
      worker.postMessage(
        req,
        inputs.map((i) => i.bytes)
      );

      const result = await responsePromise;
      if (!result.ok) {
        setStatus({ kind: "error", message: result.error });
        return;
      }
      downloadBlob(result.bytes, result.filename, MIME.PDF);
      setStatus({
        kind: "done",
        count: result.pageCount,
        filename: result.filename,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus({ kind: "error", message });
    }
  };

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
        label="Drop images here"
        buttonLabel="Choose images"
        accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,.jpg,.jpeg,.png,.webp,.gif,.bmp"
        multiple
        inputAriaLabel="Choose images to combine into a PDF"
        onFiles={acceptFiles}
        subtitleHint="JPG · PNG · WebP · GIF · BMP"
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
            {files.map((file, index) => (
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
              onClick={onBuild}
              disabled={files.length === 0 || busy}
              class="font-mono text-sm px-5 py-2.5 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-fg-dim)] disabled:cursor-not-allowed transition-colors"
            >
              {busy
                ? buttonLabel(status)
                : `Build PDF (${files.length} page${files.length === 1 ? "" : "s"})`}
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
        {status.kind === "working" && status.label === "Decoding images" && (
          <span class="text-[var(--color-fg-muted)]">{status.label}…</span>
        )}
        {status.kind === "working" && status.label === "Building PDF in your browser" && (
          <span class="text-[var(--color-accent)]">{status.label}…</span>
        )}
        {status.kind === "done" && (
          <span class="text-[var(--color-accent)]">
            ✓ Built {status.count} page{status.count === 1 ? "" : "s"} → {status.filename} downloaded.
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
  if (status.kind === "loading") return "Loading…";
  if (status.kind === "working" && status.label === "Decoding images") return "Decoding…";
  if (status.kind === "working") return "Building…";
  return "Working…";
}
