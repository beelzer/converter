import type { DwgLineEntity } from "@mlightcad/libredwg-web";
import { resolveStroke } from "../context";
import { Extents } from "../extents";
import { strokeAttrs, fmt } from "../svg-builder";
import { scaleMagnitude, transformPoint } from "../transform";
import type { Mat3, RenderContext } from "../types";

export function renderLine(
  entity: DwgLineEntity,
  ctx: RenderContext,
  mat: Mat3,
  extents: Extents
): string {
  const a = transformPoint(mat, entity.startPoint.x, entity.startPoint.y);
  const b = transformPoint(mat, entity.endPoint.x, entity.endPoint.y);
  extents.expand(a.x, a.y);
  extents.expand(b.x, b.y);

  const stroke = resolveStroke(ctx, entity, scaleMagnitude(mat));
  return `<line x1="${fmt(a.x)}" y1="${fmt(a.y)}" x2="${fmt(b.x)}" y2="${fmt(b.y)}"${strokeAttrs(stroke)} />`;
}
