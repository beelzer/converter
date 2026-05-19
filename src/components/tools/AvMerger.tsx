import { useState } from "preact/hooks";
import FileDropZone from "../shared/FileDropZone";
import {
  Fieldset,
  Pills,
  StatusLine,
  type AvStatus,
} from "../shared/AvWidgets";
import { downloadBlob, formatSize, newId } from "../../lib/util/file";
import { mergeClips } from "../../lib/av/merge";
import {
  ACCEPT_VIDEO,
  VIDEO_CONTAINERS,
  VIDEO_CONTAINER_LABEL,
  mimeForVideo,
  type VideoContainer,
} from "../../lib/av/formats";

interface Item {
  id: string;
  file: File;
}

export default function AvMerger() {
  const [items, setItems] = useState<Item[]>([]);
  const [container, setContainer] = useState<VideoContainer>("mp4");
  const [status, setStatus] = useState<AvStatus>({ kind: "idle" });

  const accept = (incoming: FileList | File[]) => {
    const next: Item[] = Array.from(incoming).map((file) => ({
      id: newId(),
      file,
    }));
    if (next.length === 0) return;
    setStatus({ kind: "idle" });
    setItems((current) => [...current, ...next]);
  };

  const remove = (id: string) =>
    setItems((current) => current.filter((i) => i.id !== id));

  const move = (id: string, delta: -1 | 1) => {
    setItems((current) => {
      const idx = current.findIndex((i) => i.id === id);
      if (idx < 0) return current;
      const next = idx + delta;
      if (next < 0 || next >= current.length) return current;
      const copy = current.slice();
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
  };

  const clearAll = () => {
    setItems([]);
    setStatus({ kind: "idle" });
  };

  const onMerge = async () => {
    if (items.length < 2) {
      setStatus({ kind: "error", message: "Add at least 2 clips to merge." });
      return;
    }
    setStatus({ kind: "working", p: 0, label: "Merging" });
    try {
      const bytes = await mergeClips(
        items.map((i) => i.file),
        {
          container,
          onProgress: (p) => setStatus({ kind: "working", p, label: "Merging" }),
        }
      );
      const filename = `merged.${container}`;
      downloadBlob(bytes, filename, mimeForVideo(container));
      setStatus({
        kind: "done",
        filename,
        size: bytes.byteLength,
        count: items.length,
      });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const busy = status.kind === "working";

  return (
    <div class="w-full">
      <FileDropZone
        label="Drop video clips to merge"
        buttonLabel="Choose clips"
        accept={ACCEPT_VIDEO}
        multiple
        inputAriaLabel="Choose video clips to merge"
        onFiles={accept}
        subtitleHint="Same-ish resolution works best. Order matters."
      />

      {items.length > 0 && (
        <div class="mt-6">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)]">
              Queue ({items.length})
            </h3>
            <button
              type="button"
              onClick={clearAll}
              disabled={busy}
              class="font-mono text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-danger)] disabled:opacity-50"
            >
              clear all
            </button>
          </div>
          <ul class="space-y-2">
            {items.map((item, idx) => (
              <li
                key={item.id}
                class="flex items-center gap-3 p-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]"
              >
                <span class="font-mono text-[10px] px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-fg-muted)] shrink-0">
                  {idx + 1}
                </span>
                <span class="flex-1 truncate text-sm text-[var(--color-fg)]">
                  {item.file.name}
                </span>
                <span class="font-mono text-xs text-[var(--color-fg-dim)] hidden sm:inline">
                  {formatSize(item.file.size)}
                </span>
                <button
                  type="button"
                  onClick={() => move(item.id, -1)}
                  disabled={busy || idx === 0}
                  aria-label={`Move ${item.file.name} up`}
                  class="font-mono text-xs w-7 h-7 rounded border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(item.id, 1)}
                  disabled={busy || idx === items.length - 1}
                  aria-label={`Move ${item.file.name} down`}
                  class="font-mono text-xs w-7 h-7 rounded border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  disabled={busy}
                  aria-label={`Remove ${item.file.name}`}
                  class="font-mono text-xs w-7 h-7 rounded border border-[var(--color-border)] hover:border-[var(--color-danger)] hover:text-[var(--color-danger)] disabled:opacity-30"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

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
              onClick={onMerge}
              disabled={busy || items.length < 2}
              class="font-mono text-sm px-5 py-2.5 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-fg-dim)] disabled:cursor-not-allowed transition-colors"
            >
              {status.kind === "working"
                ? `Merging… ${Math.round((status.p ?? 0) * 100)}%`
                : `Merge ${items.length} clips → ${VIDEO_CONTAINER_LABEL[container]}`}
            </button>
          </div>
        </div>
      )}

      <StatusLine status={status} />
    </div>
  );
}
