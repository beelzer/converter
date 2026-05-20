import type { DwgDimensionEntity } from "@mlightcad/libredwg-web";
import { Extents } from "../extents";
import type { Mat3, RenderContext } from "../types";
import type { renderEntity } from "./dispatcher";

// AutoCAD stores every dimension entity TWICE: as the parametric data (point
// locations, style overrides, etc.) AND as a pre-rendered anonymous block
// containing the actual lines, arrows, extension lines, and text already
// laid out at the right positions. The block name is stored on the entity.
//
// Rendering from the pre-baked block is dramatically simpler — and exactly
// matches what AutoCAD displays — versus re-implementing the dimension
// layout algorithm. We do the latter only when the block reference is
// missing or empty.

export function renderDimension(
  entity: DwgDimensionEntity,
  ctx: RenderContext,
  mat: Mat3,
  extents: Extents,
  dispatch: typeof renderEntity,
  patternIdCounter: { next: number }
): string {
  if (!entity.name) return "";
  const block = ctx.blocks.get(entity.name);
  if (!block || block.entities.length === 0) return "";

  // The block's entities are already in world coordinates; pass the parent
  // matrix unchanged. We use the dimension's own colour/lineweight as the
  // byBlock override so the geometry inside the block respects styling.
  let out = "";
  for (const child of block.entities) {
    if (ctx.frozenLayers.has(child.layer)) continue;
    if (child.isVisible === false) continue;
    out += dispatch(child, ctx, mat, extents, patternIdCounter);
  }
  return out;
}
