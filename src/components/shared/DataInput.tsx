import { useRef, useState } from "preact/hooks";
import { ACCEPT_DATA, detectFromFile, type DataFormat } from "../../lib/data/formats";

interface DataInputProps {
  value: string;
  onChange: (text: string, detectedFormat: DataFormat | null) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  ariaLabel?: string;
}

export default function DataInput({
  value,
  onChange,
  placeholder,
  disabled,
  rows = 12,
  ariaLabel = "Data input",
}: DataInputProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = async (file: File) => {
    const text = await file.text();
    onChange(text, detectFromFile(file));
  };

  const onDrop = async (event: DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) await handleFile(file);
  };

  const onPick = async (event: Event) => {
    const target = event.currentTarget as HTMLInputElement;
    const file = target.files?.[0];
    if (file) await handleFile(file);
    target.value = "";
  };

  return (
    <div
      onDrop={onDrop}
      onDragOver={(e) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      class={`relative rounded-lg border-2 transition-colors ${
        dragOver
          ? "border-[var(--color-accent)] bg-[var(--color-surface-2)]"
          : "border-[var(--color-border)] bg-[var(--color-surface)]"
      }`}
    >
      <textarea
        value={value}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder ?? "Paste data here, or drop a file."}
        aria-label={ariaLabel}
        onInput={(e) => onChange((e.currentTarget as HTMLTextAreaElement).value, null)}
        class="block w-full bg-transparent p-3 font-mono text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-dim)] focus:outline-none resize-y"
        spellcheck={false}
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
      />
      <div class="flex items-center justify-between px-3 py-2 border-t border-[var(--color-border)] text-xs font-mono text-[var(--color-fg-dim)]">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          class="hover:text-[var(--color-accent)] disabled:opacity-50"
        >
          drop or pick a file ↑
        </button>
        <span>
          {value.length > 0 ? `${value.length.toLocaleString()} chars` : "empty"}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_DATA}
          onChange={onPick}
          class="sr-only"
          aria-label="Pick a data file"
        />
      </div>
    </div>
  );
}
