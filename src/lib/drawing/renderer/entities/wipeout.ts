import type { DwgWipeoutEntity } from "@mlightcad/libredwg-web";
import { Extents } from "../extents";
import { fmt } from "../svg-builder";
import { transformPoint } from "../transform";
import type { Mat3 } from "../types";

// Wipeouts mask underlying drawing geometry with a "background colour" polygon.
// In PDF/SVG/PNG output we always render on white, so the wipeout colour is
// always white. The coordinates are in image-pixel space relative to a
// position + uPixel/vPixel basis.

export function renderWipeout(entity: DwgWipeoutEntity, mat: Mat3, extents: Extents): string {
  const path = entity.clippingBoundaryPath;
  if (!path || path.length < 3) return "";

  const points: string[] = [];
  for (const p of path) {
    const localX = entity.position.x + p.x * entity.uPixel.x + p.y * entity.vPixel.x;
    const localY = entity.position.y + p.x * entity.uPixel.y + p.y * entity.vPixel.y;
    const w = transformPoint(mat, localX, localY);
    extents.expand(w.x, w.y);
    points.push(`${fmt(w.x)},${fmt(w.y)}`);
  }
  return `<polygon points="${points.join(" ")}" fill="#ffffff" stroke="none" />`;
}
