// AV-specific UI widget. Generic primitives (Pills, Fieldset, StatusLine,
// Status, btnPrimary) have moved to ./Widgets — this file is just the
// MetaSummary that's specific to A/V's MediaMetadata shape, plus
// backwards-compatible re-exports so existing imports keep working.

import { formatSize } from "../../lib/util/file";
import { formatDuration } from "../../lib/av/formats";
import type { MediaMetadata } from "../../lib/av/input";

export function MetaSummary({ file, meta }: { file: File; meta: MediaMetadata }) {
  return (
    <div class="mb-6 p-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
      <p class="font-mono text-sm text-[var(--color-fg)] truncate">{file.name}</p>
      <p class="mt-1 font-mono text-xs text-[var(--color-fg-dim)]">
        {formatSize(file.size)} · {formatDuration(meta.duration)}
        {meta.width && meta.height ? ` · ${meta.width}×${meta.height}` : ""}
        {meta.videoCodec ? ` · ${meta.videoCodec}` : ""}
        {meta.audioCodec ? ` · ${meta.audioCodec}` : meta.hasAudio ? "" : " · no audio"}
      </p>
    </div>
  );
}

// Backwards-compat re-exports so AV components keep working unchanged.
export { Fieldset, Pills, StatusLine } from "./Widgets";
export type { Status as AvStatus } from "./Widgets";
