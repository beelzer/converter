// Resolves the effective Stroke for an entity by combining colour, layer,
// lineweight, linetype, and any active byBlock overrides from an enclosing
// INSERT.

import type { DwgEntity } from "@mlightcad/libredwg-web";
import { resolveColor } from "./color";
import { resolveLineweightMm } from "./lineweight";
import { patternForEntity } from "./linetype";
import type { RenderContext, Stroke } from "./types";

export function resolveStroke(
  ctx: RenderContext,
  entity: DwgEntity,
  scaleMagnitude: number
): Stroke {
  const layer = ctx.layers.get(entity.layer);
  const widthMm = resolveLineweightMm(entity, layer, ctx.blockOverride);
  // Convert width from mm into drawing units, then scale by the enclosing
  // matrix so widths look right whether the entity is inside a 1:1 block or a
  // 100×-scaled INSERT.
  const widthInDrawingUnits = (widthMm / ctx.unitToMm) * scaleMagnitude;

  return {
    color: resolveColor(entity, layer, ctx.blockOverride),
    width: widthInDrawingUnits,
    dasharray: patternForEntity(
      entity,
      layer,
      ctx.linetypes,
      ctx.db.header?.LTSCALE ?? 1
    ),
  };
}
