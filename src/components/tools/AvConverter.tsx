import { useState } from "preact/hooks";
import FileDropZone from "../shared/FileDropZone";
import {
  Fieldset,
  MetaSummary,
  Pills,
  StatusLine,
  type AvStatus,
} from "../shared/AvWidgets";
import { downloadBlob } from "../../lib/util/file";
import { convertVideo, type QualityPreset } from "../../lib/av/convert";
import { readMetadata, type MediaMetadata } from "../../lib/av/input";
import {
  ACCEPT_VIDEO,
  VIDEO_CONTAINERS,
  VIDEO_CONTAINER_LABEL,
  basenameWithoutExt,
  mimeForVideo,
  type VideoContainer,
} from "../../lib/av/formats";

const QUALITIES: QualityPreset[] = ["low", "medium", "high"];

export default function AvConverter() {
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<MediaMetadata | null>(null);
  const [container, setContainer] = useState<VideoContainer>("mp4");
  const [quality, setQuality] = useState<QualityPreset>("high");
  const [status, setStatus] = useState<AvStatus>({ kind: "idle" });

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

  const onConvert = async () => {
    if (!file) return;
    setStatus({ kind: "working", p: 0, label: "Converting" });
    try {
      const bytes = await convertVideo(file, {
        container,
        quality,
        onProgress: (p) =>
          setStatus({ kind: "working", p, label: "Converting" }),
      });
      const filename = `${basenameWithoutExt(file.name)}.${container}`;
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
        inputAriaLabel="Choose a video to convert"
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

          <Fieldset legend="Quality">
            <Pills<QualityPreset>
              options={QUALITIES}
              value={quality}
              onChange={setQuality}
              label={(q) => q.charAt(0).toUpperCase() + q.slice(1)}
              disabled={busy}
            />
          </Fieldset>

          <div class="mt-6">
            <button
              type="button"
              onClick={onConvert}
              disabled={busy}
              class="font-mono text-sm px-5 py-2.5 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-fg-dim)] disabled:cursor-not-allowed transition-colors"
            >
              {status.kind === "working"
                ? `Converting… ${Math.round((status.p ?? 0) * 100)}%`
                : `Convert → ${VIDEO_CONTAINER_LABEL[container]}`}
            </button>
          </div>
        </div>
      )}

      <StatusLine status={status} />
    </div>
  );
}
