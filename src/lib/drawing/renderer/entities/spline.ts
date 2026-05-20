import type { DwgSplineEntity } from "@mlightcad/libredwg-web";
import { resolveStroke } from "../context";
import { Extents } from "../extents";
import { strokeAttrs, fmt } from "../svg-builder";
import { scaleMagnitude, transformPoint } from "../transform";
import type { Mat3, RenderContext } from "../types";

// Evaluates a NURBS curve at evenly-spaced parameters and emits the result as
// a polyline. This is the standard approach for rendering splines in SVG —
// SVG has no native B-spline command. We use the de Boor algorithm so we
// support arbitrary degree and weights (rational B-splines / NURBS).

const SAMPLES_PER_KNOT_SPAN = 16;
const CLOSED_FLAG = 1;

export function renderSpline(
  entity: DwgSplineEntity,
  ctx: RenderContext,
  mat: Mat3,
  extents: Extents
): string {
  const closed = ((entity.flag ?? 0) & CLOSED_FLAG) !== 0;

  // Prefer NURBS evaluation when we have both knots and control points; fall
  // back to a polyline through fit points (some splines store only those) or
  // the control polygon as a last resort. The fallbacks aren't curve-smooth
  // but they're vastly better than emitting nothing.
  const ctrl = entity.controlPoints;
  const knots = entity.knots;
  const fitPoints = entity.fitPoints;

  let points: Array<{ x: number; y: number }> = [];

  if (ctrl && ctrl.length > 0 && knots && knots.length > 0 && entity.degree > 0) {
    const start = knots[entity.degree];
    const end = knots[knots.length - 1 - entity.degree];
    if (end > start) {
      const knotSpans = knots.length - 2 * entity.degree - 1;
      const samples = Math.max(32, knotSpans * SAMPLES_PER_KNOT_SPAN);
      for (let i = 0; i <= samples; i++) {
        const t = start + (i / samples) * (end - start);
        const p = deBoor(t, entity.degree, knots, ctrl, entity.weights);
        if (p) points.push(p);
      }
    }
  }
  if (points.length < 2 && fitPoints && fitPoints.length > 0) {
    points = fitPoints.map((p) => ({ x: p.x, y: p.y }));
  }
  if (points.length < 2 && ctrl && ctrl.length > 0) {
    points = ctrl.map((p) => ({ x: p.x, y: p.y }));
  }
  if (points.length < 2) return "";

  let d = "";
  for (let i = 0; i < points.length; i++) {
    const p = transformPoint(mat, points[i].x, points[i].y);
    extents.expand(p.x, p.y);
    d += `${i === 0 ? "M" : "L"} ${fmt(p.x)} ${fmt(p.y)} `;
  }
  if (closed) d += "Z";

  const stroke = resolveStroke(ctx, entity, scaleMagnitude(mat));
  return `<path d="${d}"${strokeAttrs(stroke)} />`;
}

// De Boor evaluation for (rational) B-splines.
function deBoor(
  t: number,
  degree: number,
  knots: ReadonlyArray<number>,
  controlPoints: ReadonlyArray<{ x: number; y: number }>,
  weights?: ReadonlyArray<number>
): { x: number; y: number } | null {
  // Find knot span k where knots[k] ≤ t < knots[k+1].
  let k = -1;
  for (let i = degree; i < knots.length - degree - 1; i++) {
    if (t >= knots[i] && t < knots[i + 1]) {
      k = i;
      break;
    }
  }
  if (k === -1) k = knots.length - degree - 2;

  // Use homogenous coordinates so we get rational evaluation for free.
  const dx: number[] = new Array(degree + 1);
  const dy: number[] = new Array(degree + 1);
  const dw: number[] = new Array(degree + 1);
  for (let j = 0; j <= degree; j++) {
    const cp = controlPoints[k - degree + j];
    if (!cp) return null;
    const w = weights ? weights[k - degree + j] ?? 1 : 1;
    dx[j] = cp.x * w;
    dy[j] = cp.y * w;
    dw[j] = w;
  }

  for (let r = 1; r <= degree; r++) {
    for (let j = degree; j >= r; j--) {
      const left = knots[j + k - degree];
      const right = knots[j + 1 + k - r];
      const span = right - left;
      const alpha = span === 0 ? 0 : (t - left) / span;
      dx[j] = (1 - alpha) * dx[j - 1] + alpha * dx[j];
      dy[j] = (1 - alpha) * dy[j - 1] + alpha * dy[j];
      dw[j] = (1 - alpha) * dw[j - 1] + alpha * dw[j];
    }
  }

  const w = dw[degree] || 1;
  return { x: dx[degree] / w, y: dy[degree] / w };
}
