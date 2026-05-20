import type {
  DwgLWPolylineEntity,
  DwgLWPolylineVertex,
} from "@mlightcad/libredwg-web";
import { resolveStroke } from "../context";
import { Extents } from "../extents";
import { strokeAttrs, fmt } from "../svg-builder";
import { scaleMagnitude, transformPoint } from "../transform";
import type { Mat3, RenderContext } from "../types";

// LWPolylines store an optional `bulge` per vertex. Bulge = tan(θ/4) where θ
// is the included angle of the arc that connects this vertex to the next. A
// bulge of 0 means a straight segment; positive is CCW arc, negative is CW.

const CLOSED_FLAG = 1;

export function renderLwPolyline(
  entity: DwgLWPolylineEntity,
  ctx: RenderContext,
  mat: Mat3,
  extents: Extents
): string {
  const verts = entity.vertices;
  if (verts.length === 0) return "";
  const closed = (entity.flag & CLOSED_FLAG) !== 0;

  const stroke = resolveStroke(ctx, entity, scaleMagnitude(mat));
  const path = polylinePath(verts, closed, mat, extents);
  if (!path) return "";

  // Const-width polylines with a meaningful width could be drawn as a fill
  // strip, but in practice CAD viewers always show stroke-only — match that.
  return `<path d="${path}"${strokeAttrs(stroke)} />`;
}

export function polylinePath(
  verts: ReadonlyArray<DwgLWPolylineVertex>,
  closed: boolean,
  mat: Mat3,
  extents: Extents
): string {
  if (verts.length === 0) return "";
  const t = (v: { x: number; y: number }) => transformPoint(mat, v.x, v.y);
  const first = t(verts[0]);
  extents.expand(first.x, first.y);
  let d = `M ${fmt(first.x)} ${fmt(first.y)} `;

  const segments = closed ? verts.length : verts.length - 1;
  for (let i = 0; i < segments; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    const bWorld = t(b);
    extents.expand(bWorld.x, bWorld.y);

    if (!a.bulge || Math.abs(a.bulge) < 1e-9) {
      d += `L ${fmt(bWorld.x)} ${fmt(bWorld.y)} `;
      continue;
    }
    // Convert bulge → arc parameters in *world* (post-transform) space.
    const aWorld = t(a);
    const arc = arcFromBulge(aWorld, bWorld, a.bulge);
    d += `A ${fmt(arc.r)} ${fmt(arc.r)} 0 ${arc.largeArc} ${arc.sweep} ${fmt(bWorld.x)} ${fmt(bWorld.y)} `;
  }
  if (closed) d += "Z";
  return d;
}

function arcFromBulge(
  a: { x: number; y: number },
  b: { x: number; y: number },
  bulge: number
): { r: number; largeArc: 0 | 1; sweep: 0 | 1 } {
  // Bulge geometry: theta (included angle) = 4 * atan(|bulge|)
  // Chord length L = |b - a|
  // Radius r = L / (2 * sin(theta/2))
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const chord = Math.hypot(dx, dy);
  const theta = 4 * Math.atan(Math.abs(bulge));
  const radius = chord / (2 * Math.sin(theta / 2));
  const largeArc = Math.abs(bulge) > 1 ? 1 : 0;
  const sweep = bulge > 0 ? 1 : 0;
  return { r: radius, largeArc, sweep };
}
