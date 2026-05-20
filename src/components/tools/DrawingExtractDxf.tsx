// DWG → DXF extraction. No rendering involved — this calls libredwg's
// dwg_write_dxf directly on the source bytes, giving a clean DXF text file
// suitable for opening in any CAD app. ZIP bundles are unpacked so users can
// drop project archives directly.

import { useState } from "preact/hooks";
import FileDropZone from "../shared/FileDropZone";
import { StatusLine, btnPrimary, type Status } from "../shared/Widgets";
import { downloadBlob } from "../../lib/util/file";
import { useDrawingSession } from "../../lib/drawing/useDrawingSession";
import { ingest } from "../../lib/drawing/bundle";
import { basenameWithoutExt } from "../../lib/drawing/formats";

export default function DrawingExtractDxf() {
  const session = useDrawingSession();
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const accept = async (incoming: FileList | File[]) => {
    const picked = Array.from(incoming)[0];
    if (!picked) return;
    setStatus({ kind: "loading", label: "Opening" });
    try {
      const bundle = await ingest(picked);
      if (bundle.drawingFormat !== "dwg") {
        setStatus({
          kind: "error",
          message:
            "Extract DXF only accepts .dwg files. To convert SVG or DXF, use the other tabs.",
        });
        return;
      }
      setFileName(bundle.drawingName);
      await session.load(bundle.drawingBytes, "dwg");
      setStatus({ kind: "idle" });
    } catch (err) {
      setFileName(null);
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const onExtract = async () => {
    if (!fileName) return;
    setStatus({ kind: "working", label: "Writing DXF" });
    try {
      const result = await session.extractDxf();
      const outName = `${basenameWithoutExt(fileName)}.dxf`;
      downloadBlob(result.bytes, outName, result.mime);
      setStatus({ kind: "done", filename: outName, size: result.bytes.byteLength });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const busy = status.kind === "loading" || status.kind === "working";
  const ready = fileName !== null && session.analysis !== null;

  return (
    <div class="w-full">
      <FileDropZone
        label={fileName ? "Drop a different DWG or ZIP to replace" : "Drop a DWG or ZIP bundle here"}
        buttonLabel="Choose DWG"
        accept=".dwg,.zip,application/zip"
        inputAriaLabel="Choose a DWG file to extract DXF from"
        onFiles={accept}
        subtitleHint="DWG (or ZIP containing one) — outputs a DXF text file"
      />

      {ready && (
        <div class="mt-6">
          <p class="font-mono text-xs text-[var(--color-fg-muted)] mb-4">
            <span class="text-[var(--color-fg)]">{fileName}</span>
            <span class="mx-2 text-[var(--color-fg-dim)]">·</span>
            <span class="uppercase tracking-widest">dwg</span>
          </p>

          <button
            type="button"
            onClick={onExtract}
            disabled={busy}
            class={btnPrimary}
          >
            {busy
              ? `${status.kind === "loading" ? status.label : status.label ?? "Working"}…`
              : "Extract → DXF"}
          </button>
        </div>
      )}

      <StatusLine status={status} />

      <p class="mt-6 font-mono text-xs text-[var(--color-fg-dim)] leading-relaxed">
        DXF is the open ASCII interchange format that AutoCAD and every other
        CAD tool can read and write losslessly. Use this to escape the
        proprietary DWG container without any rendering pass — the geometry
        round-trips exactly. Parsing runs in your browser via libredwg
        WebAssembly (GPL-3.0); your DWG never leaves your machine.
      </p>
    </div>
  );
}
