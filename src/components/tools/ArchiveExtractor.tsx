import { useState } from "preact/hooks";
import FileDropZone from "../shared/FileDropZone";
import { downloadBlob, formatSize } from "../../lib/util/file";
import { zipEntries } from "../../lib/util/zip";
import { extractArchive, type ExtractResult } from "../../lib/archive/extract";
import { ACCEPT_ANY_ARCHIVE, EXTRACT_LABEL } from "../../lib/archive/formats";

type Status =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "done" }
  | { kind: "error"; message: string };

export default function ArchiveExtractor() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const accept = async (incoming: FileList | File[]) => {
    const f = Array.from(incoming)[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setStatus({ kind: "working" });
    try {
      const r = await extractArchive(f);
      setResult(r);
      setStatus({ kind: "done" });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const downloadOne = (idx: number) => {
    if (!result) return;
    const entry = result.entries[idx];
    downloadBlob(
      new Blob([entry.bytes as BlobPart]),
      entry.name.split("/").pop() ?? entry.name,
      "application/octet-stream"
    );
  };

  const downloadAll = () => {
    if (!result || !file) return;
    if (result.entries.length === 1) {
      downloadOne(0);
      return;
    }
    const zip = zipEntries(result.entries.map((e) => ({ name: e.name, bytes: e.bytes })));
    const base = file.name.replace(/\.(zip|tar\.gz|tgz|tar|gz|gzip|rar)$/i, "") || "archive";
    downloadBlob(zip, `${base}-extracted.zip`, "application/zip");
  };

  const busy = status.kind === "working";

  return (
    <div class="w-full">
      <FileDropZone
        label={file ? "Drop a different archive to replace" : "Drop an archive to extract"}
        buttonLabel="Choose archive"
        accept={ACCEPT_ANY_ARCHIVE}
        inputAriaLabel="Choose an archive to extract"
        onFiles={accept}
        subtitleHint="ZIP · TAR · TAR.GZ · GZIP · RAR — format auto-detected from magic bytes"
      />

      {file && (
        <div class="mt-6">
          <div class="mb-4 p-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
            <p class="font-mono text-sm text-[var(--color-fg)] truncate">{file.name}</p>
            <p class="mt-1 font-mono text-xs text-[var(--color-fg-dim)]">
              {formatSize(file.size)}
              {result && ` · ${EXTRACT_LABEL[result.format]}`}
              {result && ` · ${result.entries.length} file${result.entries.length === 1 ? "" : "s"}`}
            </p>
          </div>

          {busy && (
            <p class="font-mono text-sm text-[var(--color-accent)]">Extracting…</p>
          )}
        </div>
      )}

      {result && result.entries.length > 0 && (
        <div class="mt-2">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)]">
              Contents
            </h3>
            <button
              type="button"
              onClick={downloadAll}
              class="font-mono text-sm px-4 py-2 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold hover:bg-[var(--color-accent-hover)] transition-colors"
            >
              {result.entries.length === 1 ? "Download" : "Download all (ZIP)"}
            </button>
          </div>
          <ul class="space-y-2 max-h-[28rem] overflow-y-auto">
            {result.entries.map((entry, idx) => (
              <li
                key={`${idx}-${entry.name}`}
                class="flex items-center gap-3 p-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]"
              >
                <span class="flex-1 truncate font-mono text-sm text-[var(--color-fg)]">
                  {entry.name}
                </span>
                <span class="font-mono text-xs text-[var(--color-fg-dim)] hidden sm:inline">
                  {formatSize(entry.bytes.byteLength)}
                </span>
                <button
                  type="button"
                  onClick={() => downloadOne(idx)}
                  aria-label={`Download ${entry.name}`}
                  class="font-mono text-xs px-2 py-1 rounded border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
                >
                  download
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div role="status" aria-live="polite" class="mt-4 min-h-[1.5rem] font-mono text-sm">
        {result && result.entries.length === 0 && (
          <span class="text-[var(--color-fg-muted)]">
            Archive is empty (no extractable files found).
          </span>
        )}
        {status.kind === "error" && (
          <span class="text-[var(--color-danger)]">Error: {status.message}</span>
        )}
      </div>
    </div>
  );
}
