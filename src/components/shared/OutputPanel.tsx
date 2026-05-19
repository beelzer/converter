// Read-only output panel with copy + optional download in the footer.
// Replaces ~10 inline reimplementations across data/encode/code/doc hubs.

import { useState } from "preact/hooks";
import { downloadBlob } from "../../lib/util/file";
import { copyText } from "../../lib/util/clipboard";

interface OutputPanelProps {
  value: string;
  ariaLabel: string;
  label?: string;
  rows?: number;
  // Right-aligned footer counter unit. Defaults to "chars" — set "lines"
  // for source-code outputs where line count matters more.
  countUnit?: "chars" | "lines";
  // Optional download wiring. Omitting filename hides the download button.
  filename?: string;
  mime?: string;
}

export default function OutputPanel({
  value,
  ariaLabel,
  label,
  rows = 12,
  countUnit = "chars",
  filename,
  mime = "text/plain",
}: OutputPanelProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    const ok = await copyText(value);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  };

  const onDownload = () => {
    if (!value || !filename) return;
    downloadBlob(new Blob([value], { type: mime }), filename, mime);
  };

  const counter =
    countUnit === "lines"
      ? value.length > 0
        ? `${value.split("\n").length} lines`
        : "empty"
      : value.length > 0
        ? `${value.length.toLocaleString()} chars`
        : "empty";

  return (
    <div>
      {label && (
        <label class="block font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2">
          {label}
        </label>
      )}
      <div class="rounded-md border-2 border-[var(--color-border)] bg-[var(--color-surface)]">
        <textarea
          value={value}
          readOnly
          rows={rows}
          aria-label={ariaLabel}
          class="block w-full bg-transparent p-3 font-mono text-sm text-[var(--color-fg)] focus:outline-none resize-y"
          spellcheck={false}
        />
        <div class="flex items-center justify-between px-3 py-2 border-t border-[var(--color-border)] text-xs font-mono text-[var(--color-fg-dim)]">
          <div class="flex gap-3">
            <button
              type="button"
              onClick={onCopy}
              disabled={!value}
              class="hover:text-[var(--color-accent)] disabled:opacity-50"
            >
              {copied ? "copied" : "copy"}
            </button>
            {filename && (
              <button
                type="button"
                onClick={onDownload}
                disabled={!value}
                class="hover:text-[var(--color-accent)] disabled:opacity-50"
              >
                download
              </button>
            )}
          </div>
          <span>{counter}</span>
        </div>
      </div>
    </div>
  );
}
