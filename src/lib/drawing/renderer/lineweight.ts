// DWG lineweight enum → millimetres.
//
// AutoCAD stores lineweight as an integer code per the DXF specification.
// Values 0..211 represent specific widths in hundredths of a mm; -1 is
// ByLayer, -2 is ByBlock, -3 is "default" (which AutoCAD resolves to the
// $LWDEFAULT header value, typically 0.25 mm).
//
// Not every integer between 0 and 211 is a valid lineweight; only the values
// listed in the spec. Anything outside that set falls back to default.

import type { DwgEntity, DwgLayerTableEntry } from "@mlightcad/libredwg-web";
import type { BlockOverride } from "./types";

const VALID_LINEWEIGHTS = new Set<number>([
  0, 5, 9, 13, 15, 18, 20, 25, 30, 35, 40, 50, 53, 60, 70, 80, 90, 100, 106,
  120, 140, 158, 200, 211,
]);

const BY_LAYER = -1;
const BY_BLOCK = -2;
const DEFAULT_LW = -3;

const DEFAULT_LW_MM = 0.25;
const MINIMUM_VISIBLE_MM = 0.1; // hairline; below this AutoCAD displays as a thin line

// Returns the resolved width in MILLIMETRES. Caller converts to drawing units
// once we know the unit factor of the page being rendered.
export function resolveLineweightMm(
  entity: DwgEntity,
  layer: DwgLayerTableEntry | undefined,
  blockOverride: BlockOverride | null
): number {
  const code = entity.lineweight ?? BY_LAYER;

  if (code === BY_BLOCK) {
    return blockOverride ? blockOverride.width : DEFAULT_LW_MM;
  }
  if (code === BY_LAYER) {
    return resolveLayerLineweight(layer);
  }
  if (code === DEFAULT_LW) {
    return DEFAULT_LW_MM;
  }
  return widthFromCode(code);
}

function resolveLayerLineweight(layer: DwgLayerTableEntry | undefined): number {
  if (!layer) return DEFAULT_LW_MM;
  const code = layer.lineweight;
  if (code == null || code === BY_LAYER || code === DEFAULT_LW) return DEFAULT_LW_MM;
  return widthFromCode(code);
}

function widthFromCode(code: number): number {
  if (!VALID_LINEWEIGHTS.has(code)) return DEFAULT_LW_MM;
  const mm = code / 100;
  return mm < MINIMUM_VISIBLE_MM ? MINIMUM_VISIBLE_MM : mm;
}
