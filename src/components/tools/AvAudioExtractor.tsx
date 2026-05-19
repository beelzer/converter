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
import { extractAudio, type QualityPreset } from "../../lib/av/convert";
import { readMetadata, type MediaMetadata } from "../../lib/av/input";
import {
  ACCEPT_MEDIA,
  AUDIO_CONTAINERS,
  AUDIO_CONTAINER_LABEL,
  basenameWithoutExt,
  mimeForAudio,
  type AudioContainer,
} from "../../lib/av/formats";

const QUALITIES: QualityPreset[] = ["low", "medium", "high"];

export default function AvAudioExtractor() {
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<MediaMetadata | null>(null);
  const [container, setContainer] = useState<AudioContainer>("mp3");
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
      if (!m.hasAudio) {
        setStatus({ kind: "error", message: "This file has no audio track." });
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

  const onExtract = async () => {
    if (!file) return;
    setStatus({ kind: "working", p: 0, label: "Extracting" });
    try {
      const bytes = await extractAudio(file, {
        container,
        quality,
        onProgress: (p) => setStatus({ kind: "working", p, label: "Extracting" }),
      });
      const filename = `${basenameWithoutExt(file.name)}.${container}`;
      downloadBlob(bytes, filename, mimeForAudio(container));
      setStatus({ kind: "done", filename, size: bytes.byteLength });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const busy = status.kind === "loading" || status.kind === "working";
  const lossless = container === "wav" || container === "flac";

  return (
    <div class="w-full">
      <FileDropZone
        label={file ? "Drop a different file to replace" : "Drop a video or audio file"}
        buttonLabel="Choose file"
        accept={ACCEPT_MEDIA}
        inputAriaLabel="Choose a file to extract audio from"
        onFiles={accept}
        subtitleHint="Video → MP3 / WAV / AAC / FLAC / Ogg"
      />

      {file && meta?.hasAudio && (
        <div class="mt-6">
          <MetaSummary file={file} meta={meta} />

          <Fieldset legend="Output format">
            <Pills
              options={AUDIO_CONTAINERS}
              value={container}
              onChange={setContainer}
              label={(c) => AUDIO_CONTAINER_LABEL[c]}
              disabled={busy}
            />
          </Fieldset>

          {!lossless && (
            <Fieldset legend="Quality">
              <Pills<QualityPreset>
                options={QUALITIES}
                value={quality}
                onChange={setQuality}
                label={(q) => q.charAt(0).toUpperCase() + q.slice(1)}
                disabled={busy}
              />
            </Fieldset>
          )}

          <div class="mt-6">
            <button
              type="button"
              onClick={onExtract}
              disabled={busy}
              class="font-mono text-sm px-5 py-2.5 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-fg-dim)] disabled:cursor-not-allowed transition-colors"
            >
              {status.kind === "working"
                ? `Extracting… ${Math.round((status.p ?? 0) * 100)}%`
                : `Extract → ${AUDIO_CONTAINER_LABEL[container]}`}
            </button>
          </div>
        </div>
      )}

      <StatusLine status={status} />
    </div>
  );
}
