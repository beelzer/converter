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
import { compressVideo } from "../../lib/av/convert";
import { readMetadata, type MediaMetadata } from "../../lib/av/input";
import {
  ACCEPT_VIDEO,
  VIDEO_CONTAINERS,
  VIDEO_CONTAINER_LABEL,
  basenameWithoutExt,
  mimeForVideo,
  type VideoContainer,
} from "../../lib/av/formats";

type Preset = "light" | "medium" | "heavy";

const PRESETS: Record<Preset, { videoBitrate: number; audioBitrate: number; maxWidth: number; label: string; hint: string }> = {
  light: { videoBitrate: 4_000_000, audioBitrate: 192_000, maxWidth: 1920, label: "Light", hint: "~4 Mbps, keep 1080p" },
  medium: { videoBitrate: 1_500_000, audioBitrate: 128_000, maxWidth: 1280, label: "Medium", hint: "~1.5 Mbps, cap 720p" },
  heavy: { videoBitrate: 600_000, audioBitrate: 96_000, maxWidth: 854, label: "Heavy", hint: "~600 kbps, cap 480p" },
};

const PRESET_KEYS: Preset[] = ["light", "medium", "heavy"];

export default function AvCompressor() {
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<MediaMetadata | null>(null);
  const [container, setContainer] = useState<VideoContainer>("mp4");
  const [preset, setPreset] = useState<Preset>("medium");
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

  const onCompress = async () => {
    if (!file) return;
    const p = PRESETS[preset];
    setStatus({ kind: "working", p: 0, label: "Compressing" });
    try {
      const bytes = await compressVideo(file, {
        container,
        videoBitrate: p.videoBitrate,
        audioBitrate: p.audioBitrate,
        maxWidth: p.maxWidth,
        onProgress: (progress) =>
          setStatus({ kind: "working", p: progress, label: "Compressing" }),
      });
      const filename = `${basenameWithoutExt(file.name)}-compressed.${container}`;
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
  const p = PRESETS[preset];

  return (
    <div class="w-full">
      <FileDropZone
        label={file ? "Drop a different video to replace" : "Drop a video here"}
        buttonLabel="Choose video"
        accept={ACCEPT_VIDEO}
        inputAriaLabel="Choose a video to compress"
        onFiles={accept}
        subtitleHint="MP4 · WebM · MOV · MKV"
      />

      {file && meta && (
        <div class="mt-6">
          <MetaSummary file={file} meta={meta} />

          <Fieldset legend="Compression preset">
            <Pills<Preset>
              options={PRESET_KEYS}
              value={preset}
              onChange={setPreset}
              label={(k) => PRESETS[k].label}
              disabled={busy}
            />
            <p class="mt-2 font-mono text-xs text-[var(--color-fg-dim)]">{p.hint}</p>
          </Fieldset>

          <Fieldset legend="Output container">
            <Pills
              options={VIDEO_CONTAINERS}
              value={container}
              onChange={setContainer}
              label={(c) => VIDEO_CONTAINER_LABEL[c]}
              disabled={busy}
            />
          </Fieldset>

          <div class="mt-6">
            <button
              type="button"
              onClick={onCompress}
              disabled={busy}
              class="font-mono text-sm px-5 py-2.5 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-fg-dim)] disabled:cursor-not-allowed transition-colors"
            >
              {status.kind === "working"
                ? `Compressing… ${Math.round(status.p * 100)}%`
                : `Compress → ${VIDEO_CONTAINER_LABEL[container]}`}
            </button>
          </div>
        </div>
      )}

      <StatusLine status={status} />
    </div>
  );
}
