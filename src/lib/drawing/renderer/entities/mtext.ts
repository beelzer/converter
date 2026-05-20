import type { DwgMTextEntity } from "@mlightcad/libredwg-web";
import { resolveColor } from "../color";
import { Extents } from "../extents";
import { fmt, escapeXml } from "../svg-builder";
import { multiply, rotation, transformPoint, translation } from "../transform";
import type { Mat3, RenderContext } from "../types";

// MTEXT is AutoCAD's multi-line / formatted text entity. The content string
// has inline formatting codes (\P for newline, \f / \H / \C for font/height/
// colour overrides). We strip the codes to recover plain text and lay out
// multiple `<tspan>` lines.

const NEWLINE_TOKEN = /\\P/g;
const FORMATTING_CODE = /\\[fFhHCcQqLlOoNnAaTtpqxXSsKk][^;\\]*;/g;
// Stacking codes like \S1/2; produce numerator/denominator. We render the
// whole stacked expression on one line — full layout is out of scope for v1.
const STACK_CODE = /\\S([^\\;]+);/g;
const ESCAPED_BACKSLASH = /\\\\/g;
const ESCAPED_BRACES = /\\([{}])/g;
const GROUP_DELIMS = /[{}]/g;

const ATTACHMENT_ANCHOR: Record<number, { x: string; y: string }> = {
  1: { x: "start", y: "hanging" }, // Top left
  2: { x: "middle", y: "hanging" }, // Top center
  3: { x: "end", y: "hanging" }, // Top right
  4: { x: "start", y: "middle" }, // Middle left
  5: { x: "middle", y: "middle" }, // Middle center
  6: { x: "end", y: "middle" }, // Middle right
  7: { x: "start", y: "alphabetic" }, // Bottom left
  8: { x: "middle", y: "alphabetic" }, // Bottom center
  9: { x: "end", y: "alphabetic" }, // Bottom right
};

export function renderMText(
  entity: DwgMTextEntity,
  ctx: RenderContext,
  mat: Mat3,
  extents: Extents
): string {
  if (!entity.text) return "";
  const layer = ctx.layers.get(entity.layer);
  const color = resolveColor(entity, layer, ctx.blockOverride);
  const lines = parseMtextLines(entity.text);
  if (lines.length === 0) return "";

  // Resolve rotation: prefer the explicit rotation; fall back to atan2 of the
  // direction vector if present.
  let rot = entity.rotation || 0;
  if (entity.direction && (entity.direction.x !== 0 || entity.direction.y !== 0)) {
    rot = Math.atan2(entity.direction.y, entity.direction.x);
  }

  const local = multiply(translation(entity.insertionPoint.x, entity.insertionPoint.y), rotation(rot));
  const yFlip: Mat3 = [1, 0, 0, 0, -1, 0, 0, 0, 1];
  const final = multiply(mat, multiply(local, yFlip));

  const fontSize = entity.textHeight || 1;
  const lineHeight = (entity.lineSpacing || 1) * fontSize * 1.2;

  const anchor = ATTACHMENT_ANCHOR[entity.attachmentPoint] ?? { x: "start", y: "alphabetic" };

  // bbox padding
  const widthEstimate = entity.rectWidth || fontSize * 10;
  const heightEstimate = lines.length * lineHeight;
  const corners = [
    transformPoint(final, 0, 0),
    transformPoint(final, widthEstimate, 0),
    transformPoint(final, widthEstimate, heightEstimate),
    transformPoint(final, 0, heightEstimate),
  ];
  for (const c of corners) extents.expand(c.x, c.y);

  const tspans = lines
    .map(
      (line, i) =>
        `<tspan x="0" dy="${i === 0 ? 0 : fmt(lineHeight)}">${escapeXml(line)}</tspan>`
    )
    .join("");

  return (
    `<g transform="matrix(${matEntries(final)})">` +
    `<text x="0" y="0" text-anchor="${anchor.x}" dominant-baseline="${anchor.y}" ` +
    `font-family="Helvetica, Arial, sans-serif" font-size="${fmt(fontSize)}" fill="${color}" stroke="none">` +
    tspans +
    `</text></g>`
  );
}

function parseMtextLines(text: string): string[] {
  // Strip formatting codes, then split on \P. We deliberately keep the actual
  // text content; the visual fidelity of MTEXT formatting (per-run font/colour
  // changes) is not v1 scope.
  const stripped = text
    .replace(ESCAPED_BACKSLASH, "") // protect literal backslashes
    .replace(ESCAPED_BRACES, "$1") // protect literal { and }
    .replace(NEWLINE_TOKEN, "\n")
    .replace(STACK_CODE, "$1")
    .replace(FORMATTING_CODE, "")
    .replace(GROUP_DELIMS, "");
    
  return stripped.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
}

function matEntries(m: Mat3): string {
  return `${num(m[0])},${num(m[3])},${num(m[1])},${num(m[4])},${num(m[2])},${num(m[5])}`;
}

function num(n: number): string {
  return Number(n.toFixed(6)).toString();
}
