import type { DwgLeaderEntity } from "@mlightcad/libredwg-web";
import { resolveStroke } from "../context";
import { Extents } from "../extents";
import { strokeAttrs, fmt } from "../svg-builder";
import { scaleMagnitude, transformPoint } from "../transform";
import type { Mat3, RenderContext } from "../types";

// LEADER renders a polyline (or spline) from a sequence of vertices, with an
// arrowhead at the first vertex when enabled. The arrowhead is a small filled
// triangle pointing along the first segment.

export function renderLeader(
  entity: DwgLeaderEntity,
  ctx: RenderContext,
  mat: Mat3,
  extents: Extents
): string {
  const verts = entity.vertices;
  if (!verts || verts.length < 2) return "";

  const stroke = resolveStroke(ctx, entity, scaleMagnitude(mat));

  let d = "";
  let firstWorld: { x: number; y: number } | null = null;
  let secondWorld: { x: number; y: number } | null = null;
  for (let i = 0; i < verts.length; i++) {
    const p = transformPoint(mat, verts[i].x, verts[i].y);
    extents.expand(p.x, p.y);
    if (i === 0) firstWorld = p;
    if (i === 1) secondWorld = p;
    d += `${i === 0 ? "M" : "L"} ${fmt(p.x)} ${fmt(p.y)} `;
  }

  let out = `<path d="${d}"${strokeAttrs(stroke)} />`;

  if (entity.isArrowheadEnabled !== false && firstWorld && secondWorld) {
    out += arrowhead(firstWorld, secondWorld, entity.textHeight ?? 1, stroke.color, scaleMagnitude(mat));
  }
  return out;
}

export function arrowhead(
  tip: { x: number; y: number },
  along: { x: number; y: number },
  textHeight: number,
  color: string,
  scale: number
): string {
  const dx = along.x - tip.x;
  const dy = along.y - tip.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const arrowLen = textHeight * 1.5 * scale;
  const arrowWidth = arrowLen * 0.45;
  const baseX = tip.x + ux * arrowLen;
  const baseY = tip.y + uy * arrowLen;
  const px = -uy * arrowWidth;
  const py = ux * arrowWidth;
  return (
    `<polygon points="${fmt(tip.x)},${fmt(tip.y)} ` +
    `${fmt(baseX + px)},${fmt(baseY + py)} ` +
    `${fmt(baseX - px)},${fmt(baseY - py)}" ` +
    `fill="${color}" stroke="none" />`
  );
}
