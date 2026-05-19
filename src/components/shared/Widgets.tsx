// Generic UI widgets shared by every hub. The AV-specific MetaSummary lives
// in AvWidgets.tsx and re-exports these.

import type { ComponentChildren } from "preact";
import { formatSize } from "../../lib/util/file";

// ---------- Unified status type ----------
//
// Replaces the ~20 ad-hoc Status unions that used to live in individual
// components. The `meta` field is the escape hatch for component-specific
// payloads (warnings, page counts, dimensions, etc.).

export type Status =
  | { kind: "idle" }
  | { kind: "loading"; label?: string }
  | { kind: "working"; p?: number; label?: string }
  | { kind: "done"; filename?: string; size?: number; count?: number; meta?: Record<string, unknown> }
  | { kind: "error"; message: string };

export function StatusLine({ status }: { status: Status }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      class="mt-4 min-h-[1.5rem] font-mono text-sm"
    >
      {status.kind === "loading" && (
        <span class="text-[var(--color-fg-muted)]">{status.label ?? "Loading…"}</span>
      )}
      {status.kind === "working" && (
        <span class="text-[var(--color-accent)]">
          {status.label ?? "Working"}
          {typeof status.p === "number" ? `… ${Math.round(status.p * 100)}%` : "…"}
        </span>
      )}
      {status.kind === "done" && (
        <span class="text-[var(--color-accent)]">
          ✓ {status.count && status.count > 1 ? `${status.count} files → ` : ""}
          {status.filename ?? "Done."}
          {typeof status.size === "number" ? ` (${formatSize(status.size)})` : ""}
          {status.filename ? " downloaded." : ""}
        </span>
      )}
      {status.kind === "error" && (
        <span class="text-[var(--color-danger)]">Error: {status.message}</span>
      )}
    </div>
  );
}

// ---------- Layout primitives ----------

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

// ---------- Pills (toggle group / radio look-alike) ----------

interface PillsProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  label: (v: T) => string;
  disabled?: boolean;
  // Per-option disabled predicate, e.g. "GZIP only allows one file"
  isOptionDisabled?: (v: T) => boolean;
}

export function Pills<T extends string>({
  options,
  value,
  onChange,
  label,
  disabled,
  isOptionDisabled,
}: PillsProps<T>) {
  return (
    <div class="flex flex-wrap gap-2">
      {options.map((option) => {
        const optDisabled = disabled || (isOptionDisabled?.(option) ?? false);
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            disabled={optDisabled}
            aria-pressed={value === option}
            class={`font-mono text-sm px-4 py-2 rounded-md border transition-colors ${
              value === option
                ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                : "border-[var(--color-border)] text-[var(--color-fg)] hover:border-[var(--color-fg-muted)]"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {label(option)}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Button class constants ----------
//
// Re-used by inline elements that can't use the components below (e.g.
// `<label>` wrappers acting as file pickers, anchor tags).

export const btnPrimary =
  "font-mono text-sm px-5 py-2.5 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-fg-dim)] disabled:cursor-not-allowed transition-colors";

export const btnSecondary =
  "font-mono text-sm px-4 py-2 rounded-md border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
