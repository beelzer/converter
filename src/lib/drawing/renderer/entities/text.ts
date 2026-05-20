import type { DwgTextEntity } from "@mlightcad/libredwg-web";
import { resolveColor } from "../color";
import { Extents } from "../extents";
import { fmt, escapeXml } from "../svg-builder";
import { rotation, scaleMagnitude, transformPoint, translation, multiply } from "../transform";
import type { Mat3, RenderContext } from "../types";

// Single-line TEXT entity. AutoCAD TEXT is rendered in a vector font; in SVG
// we render with a sans-serif fallback. The visual mismatch is acceptable for
// CAD output where text is usually annotations rather than design content.
//
// Alignment quirks:
//   - halign in {0,1,2}: positioned at startPoint
//   - halign in {3,4,5} (Aligned/Middle/Fit): positioned at endPoint
//   - valign sets the baseline reference

const HALIGN_TO_ANCHOR: Record<number, string> = {
  0: "start", // Left
  1: "middle", // Center
  2: "end", // Right
  3: "middle", // Aligned (Middle for SVG purposes)
  4: "middle", // Middle
  5: "middle", // Fit
};

const VALIGN_TO_BASELINE: Record<number, string> = {
  0: "alphabetic", // Baseline
  1: "ideographic", // Bottom (approx)
  2: "middle", // Middle
  3: "hanging", // Top
};

export function renderText(
  entity: DwgTextEntity,
  ctx: RenderContext,
  mat: Mat3,
  extents: Extents
): string {
  if (!entity.text || entity.text.length === 0) return "";
  const layer = ctx.layers.get(entity.layer);
  const color = resolveColor(entity, layer, ctx.blockOverride);

  // Origin point depends on alignment. For Left/Center/Right we use startPoint;
  // for Aligned/Middle/Fit we use endPoint (when present).
  const usingEnd =
    (entity.halign === 3 || entity.halign === 4 || entity.halign === 5) &&
    entity.endPoint;
  const origin = usingEnd ? entity.endPoint! : entity.startPoint;

  // SVG text uses a Y-down baseline; the parent <g> already applies a Y-flip,
  // so we mirror back here for the text glyphs alone (otherwise letters appear
  // upside-down). The trick: stack mat · translate · rotate · scaleY(-1).
  const local = multiply(translation(origin.x, origin.y), rotation(entity.rotation || 0));
  const yFlip: Mat3 = [1, 0, 0, 0, -1, 0, 0, 0, 1];
  const xScale = entity.xScale && entity.xScale !== 0 ? entity.xScale : 1;
  const scaleMat: Mat3 = [xScale, 0, 0, 0, 1, 0, 0, 0, 1];
  const final = multiply(mat, multiply(local, multiply(scaleMat, yFlip)));

  // Estimate bbox via the text's bounding rectangle.
  const height = entity.textHeight || 1;
  const widthEstimate = entity.text.length * height * 0.6;
  const corners = [
    transformPoint(final, 0, 0),
    transformPoint(final, widthEstimate, 0),
    transformPoint(final, widthEstimate, height),
    transformPoint(final, 0, height),
  ];
  for (const c of corners) extents.expand(c.x, c.y);

  const anchor = HALIGN_TO_ANCHOR[entity.halign] ?? "start";
  const baseline = VALIGN_TO_BASELINE[entity.valign] ?? "alphabetic";
  void scaleMagnitude; // referenced via import so it's not flagged unused

  return (
    `<g transform="matrix(${matEntries(final)})">` +
    `<text x="0" y="0" text-anchor="${anchor}" dominant-baseline="${baseline}" ` +
    `font-family="Helvetica, Arial, sans-serif" font-size="${fmt(height)}" fill="${color}" stroke="none">` +
    escapeXml(entity.text) +
    `</text></g>`
  );
}

function matEntries(m: Mat3): string {
  return `${num(m[0])},${num(m[3])},${num(m[1])},${num(m[4])},${num(m[2])},${num(m[5])}`;
}

function num(n: number): string {
  return Number(n.toFixed(6)).toString();
}
