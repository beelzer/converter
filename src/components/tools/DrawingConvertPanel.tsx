// Universal "convert drawing to one of {PDF, SVG, PNG}" panel. Wraps a
// DrawingSession with a drop zone, the shared plot controls, an optional
// plot-style file picker, and a Convert button. ZIP bundles are auto-
// unpacked — if they contain a .ctb / .stb alongside the drawing, that's
// loaded as the plot style without a second click.

import { useState } from "preact/hooks";
import FileDropZone from "../shared/FileDropZone";
import FilePickButton from "../shared/FilePickButton";
import { StatusLine, btnPrimary, Fieldset, Pills, type Status } from "../shared/Widgets";
import DrawingControls from "./DrawingControls";
import { downloadBlob } from "../../lib/util/file";
import { useDrawingSession } from "../../lib/drawing/useDrawingSession";
import { ingest, isPlotStyleFile } from "../../lib/drawing/bundle";
import {
  ACCEPT_DRAWING,
  ACCEPT_PLOT_STYLE,
  basenameWithoutExt,
  type ColorMode,
  type DrawingFormat,
  type Orientation,
  type PageSize,
} from "../../lib/drawing/formats";
import type { OutputFormat } from "../../lib/drawing/convert";

interface PanelProps {
  output: OutputFormat;
  buttonLabel: string;
}

const PNG_SCALES = [1, 2, 4] as const;
const PNG_SCALE_LABEL: Record<(typeof PNG_SCALES)[number], string> = {
  1: "1× (screen)",
  2: "2× (web Retina)",
  4: "4× (print)",
};

export default function DrawingConvertPanel({ output, buttonLabel }: PanelProps) {
  const session = useDrawingSession();

  const [fileName, setFileName] = useState<string | null>(null);
  const [format, setFormat] = useState<DrawingFormat | null>(null);
  const [plotStyleName, setPlotStyleName] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<PageSize>("fit");
  const [orientation, setOrientation] = useState<Orientation>("auto");
  const [colorMode, setColorMode] = useState<ColorMode>("mono");
  const [frozenLayers, setFrozenLayers] = useState<Set<string>>(new Set());
  const [selectedLayout, setSelectedLayout] = useState<string | null>(null);
  const [pngScale, setPngScale] = useState<(typeof PNG_SCALES)[number]>(2);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const acceptDrawing = async (incoming: FileList | File[]) => {
    const picked = Array.from(incoming)[0];
    if (!picked) return;

    setStatus({ kind: "loading", label: "Opening" });
    try {
      const bundle = await ingest(picked);
      setFileName(bundle.drawingName);
      setFormat(bundle.drawingFormat);
      setPlotStyleName(null);

      const analysis = await session.load(bundle.drawingBytes, bundle.drawingFormat);
      setFrozenLayers(new Set());
      setSelectedLayout(
        analysis.layouts.length > 0 && !analysis.layouts[0].isModelSpace
          ? analysis.layouts[0].blockName
          : null
      );

      if (bundle.plotStyleBytes) {
        const matched = await session.attachPlotStyle(bundle.plotStyleBytes);
        if (matched) setPlotStyleName(bundle.plotStyleName);
      }

      setStatus({ kind: "idle" });
    } catch (err) {
      setFileName(null);
      setFormat(null);
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const acceptPlotStyle = async (file: File) => {
    if (!isPlotStyleFile(file)) {
      setStatus({
        kind: "error",
        message: "Plot-style picker accepts .ctb (color-dependent) or .stb (style-name) files.",
      });
      return;
    }
    setStatus({ kind: "loading", label: "Reading plot style" });
    try {
      const matched = await session.attachPlotStyle(await file.arrayBuffer());
      if (matched) {
        setPlotStyleName(file.name);
        setStatus({ kind: "idle" });
      } else {
        setPlotStyleName(null);
        setStatus({
          kind: "error",
          message:
            "That file didn't parse as a CTB or STB. The format is reverse-engineered — older or non-standard files can fail.",
        });
      }
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const clearPlotStyle = async () => {
    await session.clearPlotStyle();
    setPlotStyleName(null);
  };

  const onLayerToggle = (name: string, frozen: boolean) => {
    setFrozenLayers((current) => {
      const next = new Set(current);
      if (frozen) next.add(name);
      else next.delete(name);
      return next;
    });
  };

  const onConvert = async () => {
    if (!fileName || !format) return;
    setStatus({ kind: "working", label: `Rendering ${output.toUpperCase()}` });
    try {
      const result = await session.convert({
        output,
        pageSize,
        orientation,
        colorMode,
        frozenLayers: Array.from(frozenLayers),
        layoutBlockName: selectedLayout,
        pngScale,
      });
      const outName = `${basenameWithoutExt(fileName)}.${result.ext}`;
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
  const ready = fileName !== null && format !== null && session.analysis !== null;

  return (
    <div class="w-full">
      <FileDropZone
        label={fileName ? "Drop a different drawing or ZIP bundle to replace" : "Drop a drawing or ZIP bundle here"}
        buttonLabel="Choose drawing"
        accept={ACCEPT_DRAWING}
        inputAriaLabel="Choose a CAD drawing or ZIP bundle"
        onFiles={acceptDrawing}
        subtitleHint="DWG · DXF · SVG · ZIP (with optional CTB/STB inside)"
      />

      {ready && (
        <div class="mt-6">
          <p class="font-mono text-xs text-[var(--color-fg-muted)] mb-4 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span class="text-[var(--color-fg)]">{fileName}</span>
            <span class="text-[var(--color-fg-dim)]">·</span>
            <span class="uppercase tracking-widest">{format}</span>
            {session.analysis!.layouts.length > 0 && (
              <>
                <span class="text-[var(--color-fg-dim)]">·</span>
                <span>{session.analysis!.layouts.length} layout{session.analysis!.layouts.length === 1 ? "" : "s"}</span>
              </>
            )}
            {session.analysis!.layers.filter((l) => l.used).length > 0 && (
              <>
                <span class="text-[var(--color-fg-dim)]">·</span>
                <span>
                  {session.analysis!.layers.filter((l) => l.used).length} layer
                  {session.analysis!.layers.filter((l) => l.used).length === 1 ? "" : "s"}
                </span>
              </>
            )}
            {plotStyleName && (
              <>
                <span class="text-[var(--color-fg-dim)]">·</span>
                <span class="text-[var(--color-accent)]">plot style: {plotStyleName}</span>
              </>
            )}
          </p>

          <DrawingControls
            showPageOptions={output === "pdf"}
            pageSize={pageSize}
            onPageSize={setPageSize}
            orientation={orientation}
            onOrientation={setOrientation}
            colorMode={colorMode}
            onColorMode={setColorMode}
            layers={session.analysis!.layers}
            frozenLayers={frozenLayers}
            onLayerToggle={onLayerToggle}
            layouts={session.analysis!.layouts}
            selectedLayout={selectedLayout}
            onSelectLayout={setSelectedLayout}
            disabled={busy}
          />

          {format !== "svg" && (
            <Fieldset legend="Plot style (CTB / STB) — optional">
              <div class="flex flex-wrap items-center gap-3">
                <FilePickButton
                  onFile={acceptPlotStyle}
                  label={plotStyleName ? "Replace" : "Attach"}
                  ariaLabel="Pick a CTB or STB plot-style file"
                  accept={ACCEPT_PLOT_STYLE}
                  variant="button"
                  disabled={busy}
                />
                {plotStyleName ? (
                  <span class="font-mono text-xs text-[var(--color-fg-muted)]">
                    {plotStyleName}{" "}
                    <button
                      type="button"
                      onClick={clearPlotStyle}
                      class="ml-2 text-[var(--color-fg-dim)] hover:text-[var(--color-danger)]"
                      disabled={busy}
                    >
                      remove
                    </button>
                  </span>
                ) : (
                  <span class="font-mono text-xs text-[var(--color-fg-dim)]">
                    AutoCAD plot-style table — remaps colors + lineweights to match a printed style.
                  </span>
                )}
              </div>
            </Fieldset>
          )}

          {output === "png" && (
            <Fieldset legend="PNG resolution">
              <Pills
                options={PNG_SCALES.map(String) as readonly string[]}
                value={String(pngScale)}
                onChange={(v) => setPngScale(Number(v) as (typeof PNG_SCALES)[number])}
                label={(v) => PNG_SCALE_LABEL[Number(v) as (typeof PNG_SCALES)[number]]}
                disabled={busy}
              />
            </Fieldset>
          )}

          <div class="mt-6">
            <button
              type="button"
              onClick={onConvert}
              disabled={busy}
              class={btnPrimary}
            >
              {busy
                ? `${status.kind === "loading" ? status.label : status.label ?? "Working"}…`
                : buttonLabel}
            </button>
          </div>
        </div>
      )}

      <StatusLine status={status} />

      {(format === "dwg" || format === "dxf") && (
        <p class="mt-6 font-mono text-xs text-[var(--color-fg-dim)] leading-relaxed">
          DWG and DXF parsing happens in your browser using a WebAssembly build
          of libredwg (GPL-3.0). Rendering — including hatches, lineweights,
          linetypes, splines, dimensions, and block inserts — runs in our own
          renderer (MIT). The parser loads once after you pick a file;
          subsequent renders reuse the parsed drawing in-memory.
        </p>
      )}
    </div>
  );
}
