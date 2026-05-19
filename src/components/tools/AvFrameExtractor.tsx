import { useEffect, useState } from "preact/hooks";
import FileDropZone from "../shared/FileDropZone";
import {
  Fieldset,
  MetaSummary,
  Pills,
  StatusLine,
  type AvStatus,
} from "../shared/AvWidgets";
import { downloadBlob } from "../../lib/util/file";
import { zipEntries } from "../../lib/util/zip";
import {
  extractFrame,
  extractFrames,
  type FrameImageFormat,
} from "../../lib/av/frameExtract";
import { readMetadata, type MediaMetadata } from "../../lib/av/input";
import {
  ACCEPT_VIDEO,
  basenameWithoutExt,
  formatDuration,
} from "../../lib/av/formats";

type Mode = "single" | "interval" | "count";
const MODES: Mode[] = ["single", "interval", "count"];
const FORMATS: FrameImageFormat[] = ["png", "jpeg", "webp"];

const MODE_LABEL: Record<Mode, string> = {
  single: "Single frame",
  interval: "Every N seconds",
  count: "N evenly spaced",
};

export default function AvFrameExtractor() {
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<MediaMetadata | null>(null);
  const [mode, setMode] = useState<Mode>("single");
  const [format, setFormat] = useState<FrameImageFormat>("png");
  const [timestamp, setTimestamp] = useState(0);
  const [fps, setFps] = useState(1);
  const [count, setCount] = useState(6);
  const [quality, setQuality] = useState(0.92);
  const [status, setStatus] = useState<AvStatus>({ kind: "idle" });

  useEffect(() => {
    if (meta) setTimestamp(Math.min(timestamp, meta.duration / 2 || 0));
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

  const onRun = async () => {
    if (!file) return;
    const base = basenameWithoutExt(file.name);
    const ext = format === "jpeg" ? "jpg" : format;
    const q = format === "png" ? undefined : quality;
    setStatus({ kind: "working", p: 0, label: "Extracting" });
    try {
      if (mode === "single") {
        const r = await extractFrame(file, timestamp, { format, quality: q });
        const filename = `${base}-${Math.round(r.timestamp * 1000)}ms.${ext}`;
        downloadBlob(r.blob, filename, r.blob.type);
        setStatus({ kind: "done", filename, size: r.blob.size });
        return;
      }
      const frames = await extractFrames(file, {
        format,
        quality: q,
        fps: mode === "interval" ? fps : undefined,
        count: mode === "count" ? count : undefined,
        onProgress: (p) => setStatus({ kind: "working", p, label: "Extracting" }),
      });
      const entries: { name: string; bytes: Uint8Array }[] = [];
      for (let i = 0; i < frames.length; i++) {
        const f = frames[i];
        const buf = new Uint8Array(await f.blob.arrayBuffer());
        const t = Math.round(f.timestamp * 1000);
        entries.push({
          name: `${base}-${String(i + 1).padStart(4, "0")}-${t}ms.${ext}`,
          bytes: buf,
        });
      }
      const zip = zipEntries(entries);
      const filename = `${base}-frames.zip`;
      downloadBlob(zip, filename, "application/zip");
      setStatus({
        kind: "done",
        filename,
        size: zip.byteLength,
        count: frames.length,
      });
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
        inputAriaLabel="Choose a video to extract frames from"
        onFiles={accept}
        subtitleHint="MP4 · WebM · MOV · MKV"
      />

      {file && meta?.hasVideo && (
        <div class="mt-6">
          <MetaSummary file={file} meta={meta} />

          <Fieldset legend="Mode">
            <Pills<Mode>
              options={MODES}
              value={mode}
              onChange={setMode}
              label={(m) => MODE_LABEL[m]}
              disabled={busy}
            />
          </Fieldset>

          <Fieldset legend="Image format">
            <Pills<FrameImageFormat>
              options={FORMATS}
              value={format}
              onChange={setFormat}
              label={(f) => (f === "jpeg" ? "JPG" : f.toUpperCase())}
              disabled={busy}
            />
          </Fieldset>

          {mode === "single" && (
            <Fieldset legend={`Timestamp — ${formatDuration(timestamp)}`}>
              <input
                type="range"
                min="0"
                max={meta.duration}
                step="0.01"
                value={timestamp}
                disabled={busy}
                onInput={(e) =>
                  setTimestamp(parseFloat((e.currentTarget as HTMLInputElement).value))
                }
                class="w-full"
                aria-label="Timestamp in seconds"
              />
            </Fieldset>
          )}

          {mode === "interval" && (
            <Fieldset legend={`Frames per second — ${fps}`}>
              <input
                type="range"
                min="0.25"
                max="10"
                step="0.25"
                value={fps}
                disabled={busy}
                onInput={(e) =>
                  setFps(parseFloat((e.currentTarget as HTMLInputElement).value))
                }
                class="w-full"
                aria-label="Frames per second"
              />
              <p class="mt-2 font-mono text-xs text-[var(--color-fg-dim)]">
                Approximately {Math.round(fps * meta.duration)} frames total
              </p>
            </Fieldset>
          )}

          {mode === "count" && (
            <Fieldset legend={`Number of frames — ${count}`}>
              <input
                type="range"
                min="1"
                max="50"
                step="1"
                value={count}
                disabled={busy}
                onInput={(e) =>
                  setCount(parseInt((e.currentTarget as HTMLInputElement).value, 10))
                }
                class="w-full"
                aria-label="Number of frames"
              />
            </Fieldset>
          )}

          {format !== "png" && (
            <Fieldset legend={`Quality — ${Math.round(quality * 100)}%`}>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={quality}
                disabled={busy}
                onInput={(e) =>
                  setQuality(parseFloat((e.currentTarget as HTMLInputElement).value))
                }
                class="w-full"
                aria-label="Image quality"
              />
            </Fieldset>
          )}

          <div class="mt-6">
            <button
              type="button"
              onClick={onRun}
              disabled={busy}
              class="font-mono text-sm px-5 py-2.5 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-fg-dim)] disabled:cursor-not-allowed transition-colors"
            >
              {status.kind === "working"
                ? `Extracting… ${Math.round((status.p ?? 0) * 100)}%`
                : mode === "single"
                  ? "Extract frame"
                  : "Extract frames"}
            </button>
          </div>
        </div>
      )}

      <StatusLine status={status} />
    </div>
  );
}
