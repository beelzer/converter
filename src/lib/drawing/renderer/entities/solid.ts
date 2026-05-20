import type { DwgSolidEntity } from "@mlightcad/libredwg-web";
import { resolveStroke } from "../context";
import { Extents } from "../extents";
import { fmt } from "../svg-builder";
import { scaleMagnitude, transformPoint } from "../transform";
import type { Mat3, RenderContext } from "../types";

// DXF SOLID stores corners in a deliberately weird order: corner1, corner2,
// corner4, corner3 makes a non-self-intersecting quad. We re-sequence to
// SVG winding order (corner1 → corner2 → corner4 → corner3) before emitting.

export function renderSolid(
  entity: DwgSolidEntity,
  ctx: RenderContext,
  mat: Mat3,
  extents: Extents
): string {
  const c1 = transformPoint(mat, entity.corner1.x, entity.corner1.y);
  const c2 = transformPoint(mat, entity.corner2.x, entity.corner2.y);
  const c3 = transformPoint(mat, entity.corner3.x, entity.corner3.y);
  const c4 = entity.corner4
    ? transformPoint(mat, entity.corner4.x, entity.corner4.y)
    : c3;

  for (const p of [c1, c2, c3, c4]) extents.expand(p.x, p.y);

  const stroke = resolveStroke(ctx, entity, scaleMagnitude(mat));
  const pts = `${fmt(c1.x)},${fmt(c1.y)} ${fmt(c2.x)},${fmt(c2.y)} ${fmt(c4.x)},${fmt(c4.y)} ${fmt(c3.x)},${fmt(c3.y)}`;
  return `<polygon points="${pts}" fill="${stroke.color}" stroke="${stroke.color}" stroke-width="${fmt(stroke.width)}" />`;
}
