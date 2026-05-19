// Small file picker rendered as a `<label>` wrapping a hidden `<input>`.
// Replaces ~7 inline reimplementations across components that need a
// secondary "pick a file" affordance (the main flow uses FileDropZone).

import { useRef } from "preact/hooks";

interface FilePickButtonProps {
  onFile: (file: File) => void | Promise<void>;
  accept?: string;
  label: string;
  ariaLabel: string;
  multiple?: boolean;
  disabled?: boolean;
  // Use "link" style by default (compact, inline). "button" gives the
  // secondary-button styling.
  variant?: "link" | "button";
}

export default function FilePickButton({
  onFile,
  accept,
  label,
  ariaLabel,
  multiple,
  disabled,
  variant = "link",
}: FilePickButtonProps) {
  const ref = useRef<HTMLInputElement | null>(null);

  const handleChange = async (e: Event) => {
    const target = e.currentTarget as HTMLInputElement;
    const files = target.files;
    if (files && files.length > 0) {
      if (multiple) {
        for (const f of Array.from(files)) await onFile(f);
      } else {
        await onFile(files[0]);
      }
    }
    target.value = "";
  };

  if (variant === "button") {
    return (
      <>
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={disabled}
          class="font-mono text-sm px-4 py-2 rounded-md border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {label}
        </button>
        <input
          ref={ref}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
          class="sr-only"
          aria-label={ariaLabel}
        />
      </>
    );
  }

  return (
    <label
      class={`font-mono text-xs text-[var(--color-fg-dim)] hover:text-[var(--color-accent)] cursor-pointer ${
        disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : ""
      }`}
    >
      {label}
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={handleChange}
        class="sr-only"
        aria-label={ariaLabel}
      />
    </label>
  );
}
