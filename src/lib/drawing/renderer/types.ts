// Shared types for the from-scratch renderer.

import type {
  DwgDatabase,
  DwgEntity,
  DwgLayerTableEntry,
  DwgLTypeTableEntry,
} from "@mlightcad/libredwg-web";

export interface Stroke {
  color: string;
  // Width in drawing units. Resolved from entity lineweight → millimetres, then
  // converted to drawing units via the unit factor of the parent space.
  width: number;
  // SVG stroke-dasharray expressed in drawing units, or null for solid lines.
  dasharray: string | null;
}

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type Mat3 = readonly [
  number, number, number,
  number, number, number,
  number, number, number,
];

export const IDENTITY_MAT: Mat3 = [
  1, 0, 0,
  0, 1, 0,
  0, 0, 1,
];

// The state passed down every entity renderer. Layers / linetypes are cached
// as maps for O(1) lookup; the override stack lets INSERT entities push
// "byBlock" colour overrides as they recurse into their block definition.
export interface RenderContext {
  db: DwgDatabase;
  layers: Map<string, DwgLayerTableEntry>;
  linetypes: Map<string, DwgLTypeTableEntry>;
  blocks: Map<string, BlockDef>;
  // Drawing-unit-per-millimetre factor: used to convert lineweight (mm) into
  // the drawing's coordinate space so widths look right when fitted to a page.
  unitToMm: number;
  // Active "byBlock" override resolved by the enclosing INSERT (color + weight
  // + linetype). Null at the model-space level.
  blockOverride: BlockOverride | null;
  // Recursion guard for INSERT → BLOCK → INSERT cycles in malformed drawings.
  insertDepth: number;
  // Layer names the user toggled off (case-sensitive — DWG layers are
  // case-sensitive even though string comparisons in AutoCAD UI are not).
  frozenLayers: ReadonlySet<string>;
}

export interface BlockOverride {
  color: string;
  width: number;
  dasharray: string | null;
}

export interface BlockDef {
  name: string;
  entities: DwgEntity[];
  basePoint: { x: number; y: number; z: number };
}

export const MAX_INSERT_DEPTH = 16;

export const FLIP_Y_TRANSFORM = "matrix(1,0,0,-1,0,0)";
