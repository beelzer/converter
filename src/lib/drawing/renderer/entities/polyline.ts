import type {
  DwgPolyline2dEntity,
  DwgPolyline3dEntity,
} from "@mlightcad/libredwg-web";
import { resolveStroke } from "../context";
import { Extents } from "../extents";
import { strokeAttrs, fmt } from "../svg-builder";
import { scaleMagnitude, transformPoint } from "../transform";
import type { Mat3, RenderContext } from "../types";
import { polylinePath } from "./lwpolyline";

const CLOSED_FLAG = 1;

export function renderPolyline2d(
  entity: DwgPolyline2dEntity,
  ctx: RenderContext,
  mat: Mat3,
  extents: Extents
): string {
  if (!entity.vertices || entity.vertices.length === 0) return "";
  const closed = (entity.flag & CLOSED_FLAG) !== 0;
  // 2D polylines store bulge on vertices same as LWPolyline; reuse the path
  // builder for arc-handling consistency.
  const adapted = entity.vertices.map((v, i) => ({
    id: i,
    x: v.x,
    y: v.y,
    bulge: v.bulge ?? 0,
  }));
  const path = polylinePath(adapted, closed, mat, extents);
  if (!path) return "";

  const stroke = resolveStroke(ctx, entity, scaleMagnitude(mat));
  return `<path d="${path}"${strokeAttrs(stroke)} />`;
}

export function renderPolyline3d(
  entity: DwgPolyline3dEntity,
  ctx: RenderContext,
  mat: Mat3,
  extents: Extents
): string {
  if (!entity.vertices || entity.vertices.length === 0) return "";
  const closed = (entity.flag & CLOSED_FLAG) !== 0;
  // 3D polylines have no bulges and we project to XY for 2D rendering.
  const stroke = resolveStroke(ctx, entity, scaleMagnitude(mat));
  let d = "";
  for (let i = 0; i < entity.vertices.length; i++) {
    const v = entity.vertices[i];
    const p = transformPoint(mat, v.x, v.y);
    extents.expand(p.x, p.y);
    d += `${i === 0 ? "M" : "L"} ${fmt(p.x)} ${fmt(p.y)} `;
  }
  if (closed) d += "Z";
  return `<path d="${d}"${strokeAttrs(stroke)} />`;
}
