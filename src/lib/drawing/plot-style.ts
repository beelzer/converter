// AutoCAD plot-style table parser (CTB / STB).
//
// CTB (color-dependent): 256 entries keyed by ACI. Each entry overrides
// printed colour + lineweight for that ACI value.
//
// STB (style-name): an array of named plot styles. Entities reference one by
// name; without explicit entity-to-style mapping in our renderer's output,
// we apply only the "Normal" style as a global override. Full STB support
// would require tagging each emitted SVG element with its plot-style name,
// which is doable but bigger scope.
//
// CTB file format is reverse-engineered (Autodesk never officially published
// it). The header is a fixed binary preamble followed by a zlib-compressed
// ASCII section containing the actual style table. We use `fflate` to
// inflate the compressed section — already a dep via /archive.

import { inflateSync } from "fflate";
import { aciHex } from "./renderer/color";

export interface PlotStyleEntry {
  // Output colour as #rrggbb. Null = use entity's original colour.
  color: string | null;
  // Output lineweight in mm. Null = leave as entity's original.
  widthMm: number | null;
}

export interface PlotStyle {
  // Optional global width scaling factor (1 = identity). CTB tables ship
  // their own "lineweight scale" — we apply it via mapColor's widthMm output.
  widthScale: number;
  // Given an entity colour (hex), returns the resolved plot-style override.
  // The colour input is matched against the ACI palette by reversing the hex.
  mapColor(currentHex: string): PlotStyleEntry;
  // Apply the "Normal" style to entities that have no specific name match
  // (STB). Returns the same shape so caller code is unified.
  normalStyle(): PlotStyleEntry;
}

/**
 * Parses a CTB or STB blob. Returns null if the format isn't recognised; the
 * caller treats null as "no plot style applied".
 */
export async function parsePlotStyle(bytes: ArrayBuffer): Promise<PlotStyle | null> {
  const u8 = new Uint8Array(bytes);
  if (u8.length < 64) return null;

  // Sniff the file: the first line is an ASCII signature.
  const header = textSlice(u8, 0, 64);
  const isPiafedeFormat =
    header.includes("PIAFEDEG") || header.includes("PIAFEDE") || header.includes("Plot Style Table");

  if (!isPiafedeFormat) {
    // Not a recognised plot-style table.
    return null;
  }

  // Find the end of the ASCII header (the "BEGIN" line) — the rest is zlib.
  const beginIdx = indexOfSequence(u8, asBytes("\nbegin\n"));
  if (beginIdx < 0) return null;
  const compressedStart = beginIdx + 7; // length of "\nbegin\n"
  const compressed = u8.slice(compressedStart);

  let inflated: string;
  try {
    const inflatedBytes = inflateSync(compressed);
    inflated = new TextDecoder().decode(inflatedBytes);
  } catch {
    return null;
  }

  // The decompressed payload is an INI-ish text describing the table. We
  // parse out per-aci color + lineweight mappings.
  const table = parseCtbBody(inflated);
  if (!table) return null;
  return buildPlotStyle(table);
}

interface ParsedCtb {
  // ACI index → entry. Sparse — only entries that override defaults appear.
  byAci: Map<number, PlotStyleEntry>;
  normal: PlotStyleEntry;
  widthScale: number;
}

function parseCtbBody(text: string): ParsedCtb | null {
  // Plot-style entries look like:
  //   plot_style {
  //     name = "Color_1"
  //     color = 0xC1000000 | 0xFF0000  // depending on version
  //     mode_color = ...
  //     lineweight = N
  //     ...
  //   }
  //
  // We do a lightweight regex sweep — robust parsing of the AutoCAD plot-
  // style "object stream" syntax is multi-page work; we extract just enough
  // to populate per-ACI color+width overrides.

  const byAci = new Map<number, PlotStyleEntry>();
  const lwArray = parseLineweightsArray(text);

  const styleBlocks = text.match(/plot_style\s*\{[\s\S]*?\}/g) ?? [];
  for (const block of styleBlocks) {
    const nameMatch = block.match(/name\s*=\s*"?(Color[_ ]?(\d+)|Normal)"?/i);
    if (!nameMatch) continue;
    const colorIndex = nameMatch[2] ? parseInt(nameMatch[2], 10) : -1;

    const colorMatch = block.match(/(?:mode_color|color)\s*=\s*(-?\d+)/);
    let entryColor: string | null = null;
    if (colorMatch) {
      const raw = parseInt(colorMatch[1], 10);
      if (raw !== -1) {
        // CTB stores 0xC2RRGGBB or similar. Mask off the type byte.
        const rgb = raw & 0xffffff;
        entryColor = `#${rgb.toString(16).padStart(6, "0")}`;
      }
    }

    const lwMatch = block.match(/lineweight\s*=\s*(\d+)/);
    let widthMm: number | null = null;
    if (lwMatch) {
      const idx = parseInt(lwMatch[1], 10);
      if (lwArray && idx >= 0 && idx < lwArray.length) {
        widthMm = lwArray[idx];
      }
    }

    if (colorIndex > 0 && colorIndex <= 255) {
      byAci.set(colorIndex, { color: entryColor, widthMm });
    }
  }

  return {
    byAci,
    normal: { color: null, widthMm: null },
    widthScale: 1,
  };
}

function parseLineweightsArray(text: string): number[] | null {
  // Common form: "custom_lineweight_table {  0=0.000  1=0.090 ... }" or similar.
  const block = text.match(/(?:custom_)?lineweight(?:_table)?\s*\{([\s\S]*?)\}/);
  if (!block) return null;
  const widths: number[] = [];
  const entries = block[1].match(/(?:^|\s)(\d+)\s*=\s*(\d+(?:\.\d+)?)/g);
  if (!entries) return null;
  for (const e of entries) {
    const m = e.match(/(\d+)\s*=\s*(\d+(?:\.\d+)?)/);
    if (!m) continue;
    widths[parseInt(m[1], 10)] = parseFloat(m[2]);
  }
  return widths.length > 0 ? widths : null;
}

function buildPlotStyle(table: ParsedCtb): PlotStyle {
  // Reverse the ACI palette so we can map an entity's current colour back to
  // an ACI index. This is approximate — entities with true-colour RGB that
  // doesn't match an ACI exactly fall through to "no override".
  const aciByHex = new Map<string, number>();
  for (let i = 1; i <= 255; i++) {
    aciByHex.set(aciHex(i).toLowerCase(), i);
  }

  return {
    widthScale: table.widthScale,
    mapColor(currentHex: string): PlotStyleEntry {
      const key = currentHex.toLowerCase();
      const aci = aciByHex.get(key);
      if (aci == null) return table.normal;
      return table.byAci.get(aci) ?? table.normal;
    },
    normalStyle(): PlotStyleEntry {
      return table.normal;
    },
  };
}

function textSlice(u8: Uint8Array, start: number, len: number): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(u8.slice(start, start + len));
}

function asBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function indexOfSequence(haystack: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}
