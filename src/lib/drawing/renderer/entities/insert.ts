import type { DwgInsertEntity } from "@mlightcad/libredwg-web";
import { resolveColor } from "../color";
import { resolveLineweightMm } from "../lineweight";
import { patternForEntity } from "../linetype";
import { Extents } from "../extents";
import { multiply, rotation, scale, scaleMagnitude, translation } from "../transform";
import { MAX_INSERT_DEPTH, type BlockOverride, type Mat3, type RenderContext } from "../types";
import type { renderEntity } from "./dispatcher";

// INSERT expands a block reference at a position with optional scale, rotation,
// and arrayed copies. Block expansion is recursive — a block can reference
// other blocks via further INSERT entities. We guard against pathological
// recursion with a depth counter.

export function renderInsert(
  entity: DwgInsertEntity,
  ctx: RenderContext,
  mat: Mat3,
  extents: Extents,
  dispatch: typeof renderEntity,
  patternIdCounter: { next: number }
): string {
  if (ctx.insertDepth >= MAX_INSERT_DEPTH) return "";
  const block = ctx.blocks.get(entity.name);
  if (!block) return "";

  const layer = ctx.layers.get(entity.layer);
  const widthMm = resolveLineweightMm(entity, layer, ctx.blockOverride);
  const widthDU = (widthMm / ctx.unitToMm) * scaleMagnitude(mat);
  const childOverride: BlockOverride = {
    color: resolveColor(entity, layer, ctx.blockOverride),
    width: widthDU,
    dasharray: patternForEntity(entity, layer, ctx.linetypes, ctx.db.header?.LTSCALE ?? 1),
  };

  const childCtx: RenderContext = {
    ...ctx,
    blockOverride: childOverride,
    insertDepth: ctx.insertDepth + 1,
  };

  const rows = Math.max(1, entity.rowCount || 1);
  const cols = Math.max(1, entity.columnCount || 1);
  const rowSpacing = entity.rowSpacing || 0;
  const colSpacing = entity.columnSpacing || 0;

  let out = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tx = entity.insertionPoint.x + c * colSpacing;
      const ty = entity.insertionPoint.y + r * rowSpacing;
      // INSERT transform = parent · translate · rotate · scale · translate(-base)
      const local = multiply(
        translation(tx, ty),
        multiply(
          rotation(entity.rotation || 0),
          multiply(
            scale(entity.xScale || 1, entity.yScale || 1),
            translation(-block.basePoint.x, -block.basePoint.y)
          )
        )
      );
      const childMat = multiply(mat, local);

      for (const child of block.entities) {
        if (childCtx.frozenLayers.has(child.layer)) continue;
        if (child.isVisible === false) continue;
        out += dispatch(child, childCtx, childMat, extents, patternIdCounter);
      }
    }
  }
  return out;
}
