import type { DwgEllipseEntity } from "@mlightcad/libredwg-web";
import { resolveStroke } from "../context";
import { Extents } from "../extents";
import { strokeAttrs, fmt } from "../svg-builder";
import { scaleMagnitude, transformPoint } from "../transform";
import type { Mat3, RenderContext } from "../types";

// DwgEllipseEntity stores: center, majorAxisEndPoint (relative to center),
// axisRatio (minor/major), and start/end angles in radians (0..2π for full
// ellipse). Angles are measured from the major axis CCW.
//
// SVG's ellipse element doesn't support rotation in a single tag; an arbitrary
// ellipse arc is best expressed as a <path> with `A` commands. For full
// ellipses, we use <ellipse> wrapped in a <g transform="rotate(...)"> to keep
// the SVG smaller.

const TWO_PI = Math.PI * 2;
const EPS = 1e-6;

export function renderEllipse(
  entity: DwgEllipseEntity,
  ctx: RenderContext,
  mat: Mat3,
  extents: Extents
): string {
  const cx = entity.center.x;
  const cy = entity.center.y;
  const ax = entity.majorAxisEndPoint.x;
  const ay = entity.majorAxisEndPoint.y;
  const majorRadius = Math.hypot(ax, ay);
  const minorRadius = majorRadius * entity.axisRatio;
  if (majorRadius < EPS) return "";

  const rotation = Math.atan2(ay, ax);
  const stroke = resolveStroke(ctx, entity, scaleMagnitude(mat));

  // bbox padding — major in either axis direction is the worst case.
  const cTr = transformPoint(mat, cx, cy);
  const rScale = majorRadius * scaleMagnitude(mat);
  extents.expand(cTr.x - rScale, cTr.y - rScale);
  extents.expand(cTr.x + rScale, cTr.y + rScale);

  const isFull =
    Math.abs(entity.startAngle - 0) < EPS &&
    Math.abs(entity.endAngle - TWO_PI) < EPS;

  // Map the ellipse's local coordinate frame through the parent matrix by
  // emitting an SVG <g> whose transform stacks the entity transform AFTER
  // the parent matrix.
  const trMat = matrixForEllipse(mat, cx, cy, rotation);
  const wrapStart = `<g transform="${trMat}">`;
  const wrapEnd = `</g>`;

  if (isFull) {
    return `${wrapStart}<ellipse cx="0" cy="0" rx="${fmt(majorRadius)}" ry="${fmt(minorRadius)}"${strokeAttrs(stroke)} />${wrapEnd}`;
  }

  // Partial ellipse — emit a <path>. Compute start/end in local axes.
  const sa = entity.startAngle;
  let ea = entity.endAngle;
  if (ea < sa) ea += TWO_PI;
  const sx = majorRadius * Math.cos(sa);
  const sy = minorRadius * Math.sin(sa);
  const ex = majorRadius * Math.cos(ea);
  const ey = minorRadius * Math.sin(ea);
  const largeArc = ea - sa > Math.PI ? 1 : 0;
  const sweep = 1;
  const d = `M ${fmt(sx)} ${fmt(sy)} A ${fmt(majorRadius)} ${fmt(minorRadius)} 0 ${largeArc} ${sweep} ${fmt(ex)} ${fmt(ey)}`;
  return `${wrapStart}<path d="${d}"${strokeAttrs(stroke)} />${wrapEnd}`;
}

function matrixForEllipse(parent: Mat3, cx: number, cy: number, rot: number): string {
  // World coords for (0,0) of local axis is (cx,cy); rotation rot lines up
  // SVG x with major axis. We compose parent · translate · rotate.
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const tx = parent[0] * cx + parent[1] * cy + parent[2];
  const ty = parent[3] * cx + parent[4] * cy + parent[5];
  const a = parent[0] * c + parent[1] * s;
  const b = -parent[0] * s + parent[1] * c;
  const dM = parent[3] * c + parent[4] * s;
  const e = -parent[3] * s + parent[4] * c;
  return `matrix(${num(a)},${num(dM)},${num(b)},${num(e)},${num(tx)},${num(ty)})`;
}

function num(n: number): string {
  return Number(n.toFixed(6)).toString();
}
