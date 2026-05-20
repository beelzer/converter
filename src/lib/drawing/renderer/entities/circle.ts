import type { DwgCircleEntity } from "@mlightcad/libredwg-web";
import { resolveStroke } from "../context";
import { Extents } from "../extents";
import { strokeAttrs, fmt } from "../svg-builder";
import { scaleMagnitude, transformPoint } from "../transform";
import type { Mat3, RenderContext } from "../types";

export function renderCircle(
  entity: DwgCircleEntity,
  ctx: RenderContext,
  mat: Mat3,
  extents: Extents
): string {
  const c = transformPoint(mat, entity.center.x, entity.center.y);
  const r = entity.radius * scaleMagnitude(mat);
  extents.expand(c.x - r, c.y - r);
  extents.expand(c.x + r, c.y + r);

  const stroke = resolveStroke(ctx, entity, scaleMagnitude(mat));
  return `<circle cx="${fmt(c.x)}" cy="${fmt(c.y)}" r="${fmt(r)}"${strokeAttrs(stroke)} />`;
}
