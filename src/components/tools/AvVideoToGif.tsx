import { useEffect, useState } from "preact/hooks";
import FileDropZone from "../shared/FileDropZone";
import {
  Fieldset,
  MetaSummary,
  StatusLine,
  type AvStatus,
} from "../shared/AvWidgets";
import { downloadBlob } from "../../lib/util/file";
import { videoToGif } from "../../lib/av/videoToGif";
import { readMetadata, type MediaMetadata } from "../../lib/av/input";
import {
  ACCEPT_VIDEO,
  basenameWithoutExt,
  formatDuration,
} from "../../lib/av/formats";

export default function AvVideoToGif() {
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<MediaMetadata | null>(null);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [fps, setFps] = useState(12);
  const [width, setWidth] = useState(480);
  const [status, setStatus] = useState<AvStatus>({ kind: "idle" });

  useEffect(() => {
    if (meta) {
      setStart(0);
      setEnd(Math.min(meta.duration, 6));
      if (meta.width) setWidth(Math.min(meta.width, 480));
    }
  }, [meta]);

  const accept = async (incoming: FileList | File[]) => {
    const next = Array.from(incoming)[0];
    if (!next) return;
    setStatus({ kind: "loading" });
    setFile(next);
    try {
      const m = await readMetadata(next);
      setMeta(m);
      if (!m.hasVideo) {
        setStatus({ kind: "error", message: "This file has no video track." });
        return;
      }
      setStatus({ kind: "idle" });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const onMakeGif = async () => {
    if (!file) return;
    setStatus({ kind: "working", p: 0, label: "Encoding GIF" });
    try {
      const bytes = await videoToGif(file, {
        fps,
        width,
        start,
        end,
        onProgress: (p) => setStatus({ kind: "working", p, label: "Encoding GIF" }),
      });
      const filename = `${basenameWithoutExt(file.name)}.gif`;
      downloadBlob(bytes, filename, "image/gif");
      setStatus({ kind: "done", filename, size: bytes.byteLength });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const busy = status.kind === "loading" || status.kind === "working";

  return (
    <div class="w-full">
      <FileDropZone
        label={file ? "Drop a different video to replace" : "Drop a video here"}
        buttonLabel="Choose video"
        accept={ACCEPT_VIDEO}
        inputAriaLabel="Choose a video to convert to GIF"
        onFiles={accept}
        subtitleHint="Short clips work best — GIFs grow fast"
      />

      {file && meta?.hasVideo && (
        <div class="mt-6">
          <MetaSummary file={file} meta={meta} />

          <Fieldset legend={`Range — ${formatDuration(start)} → ${formatDuration(end)} (${formatDuration(end - start)})`}>
            <div class="space-y-3">
              <label class="block">
                <span class="font-mono text-xs text-[var(--color-fg-dim)]">
                  Start ({formatDuration(start)})
                </span>
                <input
                  type="range"
                  min="0"
                  max={meta.duration}
                  step="0.05"
                  value={start}
                  disabled={busy}
                  onInput={(e) => {
                    const v = parseFloat((e.currentTarget as HTMLInputElement).value);
                    setStart(Math.min(v, end - 0.1));
                  }}
                  class="w-full"
                />
              </label>
              <label class="block">
                <span class="font-mono text-xs text-[var(--color-fg-dim)]">
                  End ({formatDuration(end)})
                </span>
                <input
                  type="range"
                  min="0"
                  max={meta.duration}
                  step="0.05"
                  value={end}
                  disabled={busy}
                  onInput={(e) => {
                    const v = parseFloat((e.currentTarget as HTMLInputElement).value);
                    setEnd(Math.max(v, start + 0.1));
                  }}
                  class="w-full"
                />
              </label>
            </div>
          </Fieldset>

          <Fieldset legend={`Frame rate — ${fps} fps`}>
            <input
              type="range"
              min="2"
              max="30"
              step="1"
              value={fps}
              disabled={busy}
              onInput={(e) =>
                setFps(parseInt((e.currentTarget as HTMLInputElement).value, 10))
              }
              class="w-full"
              aria-label="Frame rate"
            />
          </Fieldset>

          <Fieldset legend={`Width — ${width}px`}>
            <input
              type="range"
              min="120"
              max={meta.width ?? 1280}
              step="20"
              value={width}
              disabled={busy}
              onInput={(e) =>
                setWidth(parseInt((e.currentTarget as HTMLInputElement).value, 10))
              }
              class="w-full"
              aria-label="Output width"
            />
            <p class="mt-2 font-mono text-xs text-[var(--color-fg-dim)]">
              ~{Math.round((end - start) * fps)} frames at {width}px wide
            </p>
          </Fieldset>

          <div class="mt-6">
            <button
              type="button"
              onClick={onMakeGif}
              disabled={busy}
              class="font-mono text-sm px-5 py-2.5 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-fg-dim)] disabled:cursor-not-allowed transition-colors"
            >
              {status.kind === "working"
                ? `Encoding… ${Math.round((status.p ?? 0) * 100)}%`
                : "Make GIF"}
            </button>
          </div>
        </div>
      )}

      <StatusLine status={status} />
    </div>
  );
}
