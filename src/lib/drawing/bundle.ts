// Some firms distribute drawings as a ZIP that bundles the .dwg/.dxf and a
// matching .ctb/.stb (plus optional supporting files). We detect ZIP inputs
// by extension/magic, walk the central directory to find the primary drawing
// + the plot-style table, and feed each into the worker separately.
//
// Uses `fflate` (already a dep via /archive) for synchronous unzip — fast
// enough for project-sized bundles (<50 MB).

import { unzipSync } from "fflate";
import type { DrawingFormat } from "./formats";
import { detectFormat } from "./formats";

export interface BundledDrawing {
  drawingBytes: ArrayBuffer;
  drawingName: string;
  drawingFormat: DrawingFormat;
  plotStyleBytes: ArrayBuffer | null;
  plotStyleName: string | null;
}

export function isZip(file: File): boolean {
  if (file.name.toLowerCase().endsWith(".zip")) return true;
  if (file.type === "application/zip" || file.type === "application/x-zip-compressed") return true;
  return false;
}

export async function unpackBundle(file: File): Promise<BundledDrawing> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const entries = unzipSync(buf);

  let drawing: { name: string; bytes: ArrayBuffer; format: DrawingFormat } | null = null;
  let plotStyle: { name: string; bytes: ArrayBuffer } | null = null;

  for (const [name, data] of Object.entries(entries)) {
    const lower = name.toLowerCase();
    // Skip macOS metadata + directory markers.
    if (lower.startsWith("__macosx") || lower.endsWith("/") || lower.includes("/.")) continue;

    if (lower.endsWith(".dwg") || lower.endsWith(".dxf") || lower.endsWith(".svg")) {
      // Pick the largest drawing — heuristic for "the actual deliverable" when
      // a ZIP contains supporting fragments.
      if (!drawing || data.byteLength > drawing.bytes.byteLength) {
        const format = lower.endsWith(".dwg")
          ? ("dwg" as DrawingFormat)
          : lower.endsWith(".dxf")
            ? ("dxf" as DrawingFormat)
            : ("svg" as DrawingFormat);
        drawing = {
          name: basename(name),
          bytes: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer,
          format,
        };
      }
    } else if (lower.endsWith(".ctb") || lower.endsWith(".stb")) {
      // First plot-style file wins; multiple per bundle is uncommon and
      // disambiguation needs UI we don't surface today.
      if (!plotStyle) {
        plotStyle = {
          name: basename(name),
          bytes: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer,
        };
      }
    }
  }

  if (!drawing) {
    throw new Error(
      "ZIP doesn't contain a .dwg, .dxf, or .svg file. Drop the drawing file directly, or rebuild the bundle."
    );
  }

  return {
    drawingBytes: drawing.bytes,
    drawingName: drawing.name,
    drawingFormat: drawing.format,
    plotStyleBytes: plotStyle?.bytes ?? null,
    plotStyleName: plotStyle?.name ?? null,
  };
}

function basename(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i < 0 ? path : path.slice(i + 1);
}

// Used by the panel to decide whether to accept a non-drawing file as a
// plot-style attachment in the secondary picker.
export function isPlotStyleFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return lower.endsWith(".ctb") || lower.endsWith(".stb");
}

// Convenience for the "I picked a normal drawing file" path so the rest of
// the panel sees a uniform shape.
export function toBundle(
  bytes: ArrayBuffer,
  name: string,
  format: DrawingFormat
): BundledDrawing {
  return {
    drawingBytes: bytes,
    drawingName: name,
    drawingFormat: format,
    plotStyleBytes: null,
    plotStyleName: null,
  };
}

// Centralised dispatcher used when the user drops any file. Returns a
// uniform BundledDrawing for downstream code; throws if the file isn't a
// supported input.
export async function ingest(file: File): Promise<BundledDrawing> {
  if (isZip(file)) {
    return unpackBundle(file);
  }
  const format = detectFormat(file);
  if (!format) {
    throw new Error(
      "That doesn't look like a CAD drawing or a ZIP bundle. Drop a .dwg, .dxf, .svg, or .zip file."
    );
  }
  return toBundle(await file.arrayBuffer(), file.name, format);
}
