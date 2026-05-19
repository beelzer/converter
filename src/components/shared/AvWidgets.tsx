import type { ComponentChildren } from "preact";
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

export function Fieldset({
  legend,
  children,
}: {
  legend: string;
  children: ComponentChildren;
}) {
  return (
    <fieldset class="mt-6">
      <legend class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2">
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

interface PillsProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  label: (v: T) => string;
  disabled?: boolean;
}

export function Pills<T extends string>({
  options,
  value,
  onChange,
  label,
  disabled,
}: PillsProps<T>) {
  return (
    <div class="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          disabled={disabled}
          aria-pressed={value === option}
          class={`font-mono text-sm px-4 py-2 rounded-md border transition-colors ${
            value === option
              ? "border-[var(--color-accent)] text-[var(--color-accent)]"
              : "border-[var(--color-border)] text-[var(--color-fg)] hover:border-[var(--color-fg-muted)]"
          } disabled:opacity-50`}
        >
          {label(option)}
        </button>
      ))}
    </div>
  );
}

export type AvStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "working"; p: number; label?: string }
  | { kind: "done"; filename: string; size: number; count?: number }
  | { kind: "error"; message: string };

export function StatusLine({ status }: { status: AvStatus }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      class="mt-4 min-h-[1.5rem] font-mono text-sm"
    >
      {status.kind === "loading" && (
        <span class="text-[var(--color-fg-muted)]">Reading metadata…</span>
      )}
      {status.kind === "working" && (
        <span class="text-[var(--color-accent)]">
          {status.label ?? "Working"}… {Math.round(status.p * 100)}%
        </span>
      )}
      {status.kind === "done" && (
        <span class="text-[var(--color-accent)]">
          ✓ {status.count && status.count > 1 ? `${status.count} files → ` : ""}
          {status.filename} ({formatSize(status.size)}) downloaded.
        </span>
      )}
      {status.kind === "error" && (
        <span class="text-[var(--color-danger)]">Error: {status.message}</span>
      )}
    </div>
  );
}
