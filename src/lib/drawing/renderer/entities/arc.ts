import type { DwgArcEntity } from "@mlightcad/libredwg-web";
import { resolveStroke } from "../context";
import { Extents } from "../extents";
import { strokeAttrs, fmt } from "../svg-builder";
import { scaleMagnitude, transformPoint } from "../transform";
import type { Mat3, RenderContext } from "../types";

// AutoCAD arc angles are in DEGREES, swept counter-clockwise from start to end.
// SVG's arc command goes either way based on the sweep-flag, so we just need
// to convert to radians, compute the endpoints, and pick large-arc + sweep.

export function renderArc(
  entity: DwgArcEntity,
  ctx: RenderContext,
  mat: Mat3,
  extents: Extents
): string {
  const sa = (entity.startAngle * Math.PI) / 180;
  let ea = (entity.endAngle * Math.PI) / 180;
  // Ensure we sweep CCW (positive); if end < start, add 2π.
  if (ea < sa) ea += Math.PI * 2;

  const startLocal = {
    x: entity.center.x + entity.radius * Math.cos(sa),
    y: entity.center.y + entity.radius * Math.sin(sa),
  };
  const endLocal = {
    x: entity.center.x + entity.radius * Math.cos(ea),
    y: entity.center.y + entity.radius * Math.sin(ea),
  };
  const start = transformPoint(mat, startLocal.x, startLocal.y);
  const end = transformPoint(mat, endLocal.x, endLocal.y);
  const r = entity.radius * scaleMagnitude(mat);

  // bbox: cheap version — pad by radius.
  const cTransformed = transformPoint(mat, entity.center.x, entity.center.y);
  extents.expand(cTransformed.x - r, cTransformed.y - r);
  extents.expand(cTransformed.x + r, cTransformed.y + r);

  const largeArc = ea - sa > Math.PI ? 1 : 0;
  const sweep = 1; // CCW after our normalisation above

  const stroke = resolveStroke(ctx, entity, scaleMagnitude(mat));
  const d = `M ${fmt(start.x)} ${fmt(start.y)} A ${fmt(r)} ${fmt(r)} 0 ${largeArc} ${sweep} ${fmt(end.x)} ${fmt(end.y)}`;
  return `<path d="${d}"${strokeAttrs(stroke)} />`;
}
