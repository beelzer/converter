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
import { trimVideo } from "../../lib/av/convert";
import { readMetadata, type MediaMetadata } from "../../lib/av/input";
import {
  ACCEPT_VIDEO,
  VIDEO_CONTAINERS,
  VIDEO_CONTAINER_LABEL,
  basenameWithoutExt,
  formatDuration,
  mimeForVideo,
  type VideoContainer,
} from "../../lib/av/formats";

export default function AvTrimmer() {
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<MediaMetadata | null>(null);
  const [container, setContainer] = useState<VideoContainer>("mp4");
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [status, setStatus] = useState<AvStatus>({ kind: "idle" });

  useEffect(() => {
    if (meta) {
      setStart(0);
      setEnd(meta.duration);
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
      setStatus({ kind: "idle" });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const onTrim = async () => {
    if (!file) return;
    if (end <= start) {
      setStatus({ kind: "error", message: "End time must be greater than start time." });
      return;
    }
    setStatus({ kind: "working", p: 0, label: "Trimming" });
    try {
      const bytes = await trimVideo(file, {
        container,
        start,
        end,
        onProgress: (p) => setStatus({ kind: "working", p, label: "Trimming" }),
      });
      const filename = `${basenameWithoutExt(file.name)}-trim.${container}`;
      downloadBlob(bytes, filename, mimeForVideo(container));
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
        inputAriaLabel="Choose a video to trim"
        onFiles={accept}
        subtitleHint="MP4 · WebM · MOV · MKV"
      />

      {file && meta && (
        <div class="mt-6">
          <MetaSummary file={file} meta={meta} />

          <Fieldset legend="Output container">
            <Pills
              options={VIDEO_CONTAINERS}
              value={container}
              onChange={setContainer}
              label={(c) => VIDEO_CONTAINER_LABEL[c]}
              disabled={busy}
            />
          </Fieldset>

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
                  step="0.01"
                  value={start}
                  disabled={busy}
                  onInput={(e) => {
                    const v = parseFloat((e.currentTarget as HTMLInputElement).value);
                    setStart(Math.min(v, end - 0.01));
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
                  step="0.01"
                  value={end}
                  disabled={busy}
                  onInput={(e) => {
                    const v = parseFloat((e.currentTarget as HTMLInputElement).value);
                    setEnd(Math.max(v, start + 0.01));
                  }}
                  class="w-full"
                />
              </label>
            </div>
          </Fieldset>

          <div class="mt-6">
            <button
              type="button"
              onClick={onTrim}
              disabled={busy}
              class="font-mono text-sm px-5 py-2.5 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-fg-dim)] disabled:cursor-not-allowed transition-colors"
            >
              {status.kind === "working"
                ? `Trimming… ${Math.round((status.p ?? 0) * 100)}%`
                : `Trim → ${VIDEO_CONTAINER_LABEL[container]}`}
            </button>
          </div>
        </div>
      )}

      <StatusLine status={status} />
    </div>
  );
}
