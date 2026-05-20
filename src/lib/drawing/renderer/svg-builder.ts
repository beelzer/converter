// Tiny string-emit helpers. We hand-build SVG rather than using a DOM because
// (a) Workers do have DOMParser but creating elements is slower than string
// concatenation for thousands of entities, (b) the output is consumed by
// svg2pdf which parses it anyway, so a structured DOM here would be wasted.

export function fmt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  // 4 dp keeps CAD-scale geometry crisp without bloating the file.
  return Number(n.toFixed(4)).toString();
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Emits common stroke attributes. The wrapping `<g>` in renderer/index.ts
// sets a percentage-based default stroke-width that's always visible across
// drawing scales, so we DON'T emit per-entity stroke-width here — entities
// inherit. (Per-entity lineweight fidelity is a v2 enhancement that needs a
// two-pass render or non-scaling-stroke support; for now visibility wins.)
//
// `width` is left in the signature so callers don't all need to change at
// once; we just ignore it here.
export function strokeAttrs(stroke: { color: string; width: number; dasharray: string | null }): string {
  void stroke.width;
  let out = ` stroke="${stroke.color}" fill="none"`;
  if (stroke.dasharray) out += ` stroke-dasharray="${stroke.dasharray}"`;
  return out;
}
