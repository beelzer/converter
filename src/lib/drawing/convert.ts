// Stateful drawing session shared by the worker. Holds one parsed drawing
// (and any attached plot-style table) in memory; subsequent renders or
// extractions reuse them.
//
// Note on what runs WHERE:
//   - Worker (this file): parses DWG/DXF, runs our entity → SVG renderer,
//     applies colour / plot-style transforms, rasterises to PNG via
//     OffscreenCanvas, returns DXF text bytes from libredwg's writer.
//   - Main thread: PDF emission only. svg2pdf needs `DOMParser` to walk the
//     SVG, and that API isn't reliably available in Worker scope. The worker
//     returns the rendered SVG string when output==="pdf"; the main thread
//     turns it into a vector PDF there.

import { analyzeDatabase, type LayerInfo, type LayoutInfo } from "./analyze";
import type { ColorMode, DrawingFormat, Orientation, PageSize } from "./formats";
import {
  parseDrawing,
  readSvgExtent,
  renderToSvg,
  writeDxf,
  type ParsedDrawing,
  type RenderOptions,
} from "./render";
import { parsePlotStyle, type PlotStyle } from "./plot-style";
import { svgToPng } from "./to-png";

export type OutputFormat = "pdf" | "svg" | "png";

export interface ConvertOptions {
  output: OutputFormat;
  pageSize: PageSize;
  orientation: Orientation;
  colorMode: ColorMode;
  frozenLayers: string[];
  layoutBlockName: string | null;
  pngScale: number;
}

// Worker-side conversion can return either the final binary bytes (for SVG /
// PNG / DXF) or a rendered SVG string + the page params the main thread
// needs to drive svg2pdf (for PDF).
export type ConvertResult =
  | { kind: "bytes"; bytes: Uint8Array; mime: string; ext: string }
  | {
      kind: "svgForPdf";
      svg: string;
      pageSize: PageSize;
      orientation: Orientation;
      drawingWidth: number;
      drawingHeight: number;
    };

export interface LoadResult {
  layers: LayerInfo[];
  layouts: LayoutInfo[];
  extent: { width: number; height: number };
  // True when the file we loaded came with a plot-style table (either a ZIP
  // bundle or a separate .ctb / .stb pick).
  hasPlotStyle: boolean;
}

export class DrawingSession {
  private parsed: ParsedDrawing | null = null;
  private plotStyle: PlotStyle | null = null;

  async load(bytes: ArrayBuffer, format: DrawingFormat): Promise<LoadResult> {
    this.parsed = await parseDrawing(bytes, format);
    return this.analyzeLoaded();
  }

  async attachPlotStyle(bytes: ArrayBuffer): Promise<boolean> {
    this.plotStyle = await parsePlotStyle(bytes);
    return this.plotStyle !== null;
  }

  clearPlotStyle(): void {
    this.plotStyle = null;
  }

  async convert(options: ConvertOptions): Promise<ConvertResult> {
    const parsed = this.assertLoaded();
    const renderOptions: RenderOptions = {
      frozenLayers: new Set(options.frozenLayers),
      layoutBlockName: options.layoutBlockName,
      colorMode: options.colorMode,
      plotStyle: this.plotStyle,
    };
    const svg = renderToSvg(parsed, renderOptions);
    const extent = readSvgExtent(svg);

    switch (options.output) {
      case "pdf": {
        // PDF emission happens on the main thread (svg2pdf needs DOMParser).
        return {
          kind: "svgForPdf",
          svg,
          pageSize: options.pageSize,
          orientation: options.orientation,
          drawingWidth: extent.width,
          drawingHeight: extent.height,
        };
      }
      case "svg": {
        const bytes = new TextEncoder().encode(svg);
        return { kind: "bytes", bytes, mime: "image/svg+xml", ext: "svg" };
      }
      case "png": {
        const bytes = await svgToPng(svg, {
          drawingWidth: extent.width,
          drawingHeight: extent.height,
          scale: options.pngScale,
        });
        return { kind: "bytes", bytes, mime: "image/png", ext: "png" };
      }
    }
  }

  async extractDxf(): Promise<ConvertResult> {
    this.assertLoaded();
    const dxf = await writeDxf(this.parsed!);
    return { kind: "bytes", bytes: dxf, mime: "image/vnd.dxf", ext: "dxf" };
  }

  unload(): void {
    this.parsed = null;
    this.plotStyle = null;
  }

  private analyzeLoaded(): LoadResult {
    const parsed = this.assertLoaded();
    const analysis = parsed.database
      ? analyzeDatabase(parsed.database)
      : { layers: [], layouts: [] };
    const probeSvg = parsed.database
      ? renderToSvg(parsed, {
          frozenLayers: new Set(),
          layoutBlockName: null,
          colorMode: "preserve",
          plotStyle: null,
        })
      : (parsed.rawSvg ?? "");
    const extent = readSvgExtent(probeSvg);
    return {
      ...analysis,
      extent,
      hasPlotStyle: this.plotStyle !== null,
    };
  }

  private assertLoaded(): ParsedDrawing {
    if (!this.parsed) {
      throw new Error("No drawing is loaded. Pick a file first.");
    }
    return this.parsed;
  }
}
