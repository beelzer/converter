import { useRef, useState } from "preact/hooks";

interface FileDropZoneProps {
  // Main heading shown inside the drop zone. Callers can change this based on
  // whether a file is already loaded (e.g. "Drop a different PDF to replace").
  label: string;
  buttonLabel: string;
  accept: string;
  multiple?: boolean;
  inputAriaLabel: string;
  onFiles: (files: FileList) => void;
  // Optional one-line hint below the privacy badge, e.g. "JPG · PNG · WebP".
  subtitleHint?: string;
}

export default function FileDropZone({
  label,
  buttonLabel,
  accept,
  multiple = false,
  inputAriaLabel,
  onFiles,
  subtitleHint,
}: FileDropZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const onInputChange = (event: Event) => {
    const target = event.currentTarget as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      onFiles(target.files);
    }
    target.value = "";
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      onFiles(event.dataTransfer.files);
    }
  };

  const onDragOver = (event: DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    setDragOver(true);
  };

  const onDragLeave = () => setDragOver(false);

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      class={`relative border-2 border-dashed rounded-lg p-8 sm:p-10 text-center transition-colors ${
        dragOver
          ? "border-[var(--color-accent)] bg-[var(--color-surface-2)]"
          : "border-[var(--color-border)] bg-[var(--color-surface)]"
      }`}
    >
      <p class="font-mono text-base text-[var(--color-fg)]">{label}</p>
      <p class="mt-1 text-sm text-[var(--color-fg-muted)]">or</p>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        class="mt-3 inline-flex items-center font-mono text-sm px-4 py-2 rounded-md border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] focus-visible:border-[var(--color-accent)] transition-colors"
      >
        {buttonLabel}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={onInputChange}
        class="sr-only"
        aria-label={inputAriaLabel}
      />
      <p class="mt-4 text-xs font-mono text-[var(--color-fg-dim)]">
        <span class="text-[var(--color-accent)]">●</span> Stays on your device. Nothing is uploaded.
      </p>
      {subtitleHint && (
        <p class="mt-1 text-[10px] font-mono text-[var(--color-fg-dim)]">{subtitleHint}</p>
      )}
    </div>
  );
}
