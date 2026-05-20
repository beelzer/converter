import type { DwgPointEntity } from "@mlightcad/libredwg-web";
import { resolveStroke } from "../context";
import { Extents } from "../extents";
import { fmt } from "../svg-builder";
import { scaleMagnitude, transformPoint } from "../transform";
import type { Mat3, RenderContext } from "../types";

// AutoCAD POINTs are rendered as a small dot. The actual display style is
// controlled by $PDMODE / $PDSIZE header variables but a 1-pixel-equivalent
// circle reads correctly in every PDF/SVG/PNG output.

export function renderPoint(
  entity: DwgPointEntity,
  ctx: RenderContext,
  mat: Mat3,
  extents: Extents
): string {
  const p = transformPoint(mat, entity.position.x, entity.position.y);
  extents.expand(p.x, p.y);
  const stroke = resolveStroke(ctx, entity, scaleMagnitude(mat));
  // Size scales with stroke so very-zoomed-in views still show the dot.
  const r = Math.max(stroke.width * 1.5, 0.001);
  return `<circle cx="${fmt(p.x)}" cy="${fmt(p.y)}" r="${fmt(r)}" fill="${stroke.color}" stroke="none" />`;
}
