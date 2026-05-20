// Drawing parse + render orchestration.
//
// libredwg-web is used only for PARSING (its WASM converts the DWG/DXF binary
// into a DwgDatabase object tree). The actual entity-to-SVG rendering is done
// by our own renderer in ./renderer, which honours per-entity lineweight,
// linetype, colour, hatch patterns, dimensions, splines, and block inserts.

import type { LibreDwg as LibreDwgClass, DwgDatabase } from "@mlightcad/libredwg-web";
import type { ColorMode, DrawingFormat } from "./formats";
import { renderDatabase } from "./renderer";
import { mmPerUnit } from "./units";
import type { PlotStyle } from "./plot-style";

let modulePromise: Promise<typeof import("@mlightcad/libredwg-web")> | null = null;
function loadModule() {
  if (!modulePromise) modulePromise = import("@mlightcad/libredwg-web");
  return modulePromise;
}

let libredwgInstance: LibreDwgClass | null = null;
async function getLibreDwg(): Promise<LibreDwgClass> {
  if (libredwgInstance) return libredwgInstance;
  const { LibreDwg } = await loadModule();
  libredwgInstance = await LibreDwg.create();
  return libredwgInstance;
}

export interface ParsedDrawing {
  database: DwgDatabase | null;
  // For SVG-input drawings — the raw text we just pass through.
  rawSvg: string | null;
  format: DrawingFormat;
  // Original bytes are retained for the DWG → DXF unwrap operation.
  sourceBytes: ArrayBuffer | null;
}

export async function parseDrawing(
  bytes: ArrayBuffer,
  format: DrawingFormat
): Promise<ParsedDrawing> {
  if (format === "svg") {
    return {
      database: null,
      rawSvg: new TextDecoder().decode(bytes),
      format,
      sourceBytes: null,
    };
  }

  const { Dwg_File_Type } = await loadModule();
  const libredwg = await getLibreDwg();
  const fileType = format === "dwg" ? Dwg_File_Type.DWG : Dwg_File_Type.DXF;
  const dwgPtr = libredwg.dwg_read_data(bytes, fileType);
  if (dwgPtr == null) {
    throw new Error(
      `Could not parse this ${format.toUpperCase()} file. The version may be unsupported or the file may be corrupt.`
    );
  }
  try {
    const database = libredwg.convert(dwgPtr);
    return { database, rawSvg: null, format, sourceBytes: bytes };
  } finally {
    libredwg.dwg_free(dwgPtr);
  }
}

export interface RenderOptions {
  frozenLayers: ReadonlySet<string>;
  layoutBlockName: string | null;
  colorMode: ColorMode;
  plotStyle: PlotStyle | null;
}

export function renderToSvg(parsed: ParsedDrawing, options: RenderOptions): string {
  if (parsed.database) {
    let svg = renderDatabase(parsed.database, {
      frozenLayers: options.frozenLayers,
      renderBlockName: options.layoutBlockName,
      // `unitToMm` is "mm per drawing unit" — i.e. a drawing in inches passes
      // 25.4, a drawing in metres passes 1000. Width-in-mm → drawing-units is
      // then `widthMm / unitToMm`. The previous inversion (1/x) here is what
      // broke stroke widths and PDFs came out blank.
      unitToMm: Math.max(mmPerUnit(parsed.database), 0.001),
    });
    svg = applyPlotStyle(svg, options.plotStyle);
    svg = applyColorMode(svg, options.colorMode);
    return svg;
  }
  if (parsed.rawSvg) {
    return applyColorMode(parsed.rawSvg, options.colorMode);
  }
  throw new Error("Drawing has no database and no raw SVG.");
}

export async function writeDxf(parsed: ParsedDrawing): Promise<Uint8Array> {
  if (parsed.format !== "dwg" || !parsed.sourceBytes) {
    throw new Error("DXF extraction is only available for DWG inputs.");
  }
  const libredwg = await getLibreDwg();
  const dxf = libredwg.dwg_write_dxf(parsed.sourceBytes);
  if (!dxf) {
    throw new Error(
      "libredwg returned no DXF output for this DWG. The file may be corrupt or in an unsupported version."
    );
  }
  return dxf;
}

// Force every drawn path to black-on-white. We do this as a string rewrite
// rather than parsing the SVG into a DOM: DOMParser is a Window-only API in
// the spec, and even when browsers expose it to Workers it's not guaranteed.
// Our renderer emits a known well-formed shape so a few regexes suffice.
export function applyColorMode(svg: string, mode: ColorMode): string {
  if (mode === "preserve") return svg;
  // 1. Strokes: any concrete colour (not "none") → black. Keep pattern/url refs
  //    intact because some SVG hatches use them.
  let out = svg.replace(
    /stroke="(?!none)(?!url\()[^"]*"/g,
    'stroke="#000"'
  );
  // 2. Fills: concrete colour → black; "none" stays; url(#hatchN) stays.
  out = out.replace(
    /fill="(?!none)(?!url\()[^"]*"/g,
    'fill="#000"'
  );
  return out;
}

// Maps every coloured element through the supplied plot-style table. We
// rewrite each stroke / fill attribute by looking it up in the plot style.
// Anything that doesn't map cleanly is left untouched.
function applyPlotStyle(svg: string, plotStyle: PlotStyle | null): string {
  if (!plotStyle) return svg;
  let out = svg.replace(/stroke="(#[0-9a-fA-F]{6})"/g, (match, color: string) => {
    const mapped = plotStyle.mapColor(color);
    return mapped.color ? `stroke="${mapped.color}"` : match;
  });
  out = out.replace(/fill="(#[0-9a-fA-F]{6})"/g, (match, color: string) => {
    const mapped = plotStyle.mapColor(color);
    return mapped.color ? `fill="${mapped.color}"` : match;
  });
  return out;
}

export function readSvgExtent(svg: string): { width: number; height: number } {
  const tagMatch = svg.match(/<svg[^>]*>/i);
  if (!tagMatch) return { width: 100, height: 100 };
  const tag = tagMatch[0];
  const viewBoxMatch = tag.match(/viewBox=["']([^"']+)["']/i);
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      return { width: Math.abs(parts[2]) || 100, height: Math.abs(parts[3]) || 100 };
    }
  }
  const widthMatch = tag.match(/width=["']([\d.]+)/i);
  const heightMatch = tag.match(/height=["']([\d.]+)/i);
  return {
    width: widthMatch ? parseFloat(widthMatch[1]) : 100,
    height: heightMatch ? parseFloat(heightMatch[1]) : 100,
  };
}
