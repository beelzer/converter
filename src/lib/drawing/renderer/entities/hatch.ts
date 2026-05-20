import type {
  DwgArcEdge,
  DwgBoundaryPath,
  DwgEllipseEdge,
  DwgHatchEntity,
  DwgLineEdge,
  DwgPolylineBoundaryPath,
  DwgSplineEdge,
} from "@mlightcad/libredwg-web";
import { resolveColor } from "../color";
import { Extents } from "../extents";
import { fmt } from "../svg-builder";
import { scaleMagnitude, transformPoint } from "../transform";
import type { Mat3, RenderContext } from "../types";

// HATCH renders the boundary geometry as a single filled `<path>`. For solid
// fills, full opacity. For pattern fills, we emit an SVG `<pattern>` def
// generated from the hatch's definition lines (angle + offset + dash pattern)
// and reference it as the fill. Gradients are approximated as a solid lighten
// of the entity colour — true gradient hatch fidelity would require a full
// SVG gradient stop computation that's not common in actual usage.

// Per-renderer id pool so each hatch gets a unique pattern id within an SVG.
// The renderer instance increments this so successive hatches don't collide.

export function renderHatch(
  entity: DwgHatchEntity,
  ctx: RenderContext,
  mat: Mat3,
  extents: Extents,
  patternIdCounter: { next: number }
): string {
  const d = boundaryToPath(entity.boundaryPaths, mat, extents);
  if (!d) return "";

  const layer = ctx.layers.get(entity.layer);
  const color = resolveColor(entity, layer, ctx.blockOverride);

  if (entity.solidFill === 1) {
    return `<path d="${d}" fill="${color}" fill-rule="evenodd" stroke="none" />`;
  }

  const isGradient = "gradientName" in entity;
  if (isGradient) {
    // Best-effort: render as a light tinted fill so the region is visible.
    return `<path d="${d}" fill="${lighten(color, 0.4)}" fill-opacity="0.7" fill-rule="evenodd" stroke="none" />`;
  }

  // Pattern fill. Build an SVG pattern from the definition lines.
  const pattern = buildPattern(entity, color, patternIdCounter, scaleMagnitude(mat));
  if (!pattern) {
    // Couldn't build a pattern — fall back to thin tint so the area reads as filled.
    return `<path d="${d}" fill="${color}" fill-opacity="0.25" fill-rule="evenodd" stroke="none" />`;
  }
  return pattern.def + `<path d="${d}" fill="url(#${pattern.id})" fill-rule="evenodd" stroke="none" />`;
}

function boundaryToPath(
  paths: ReadonlyArray<DwgBoundaryPath>,
  mat: Mat3,
  extents: Extents
): string {
  let d = "";
  for (const path of paths) {
    if ("vertices" in path) {
      d += polylineBoundaryToPath(path as DwgPolylineBoundaryPath, mat, extents);
    } else {
      d += edgeBoundaryToPath(path, mat, extents);
    }
  }
  return d;
}

function polylineBoundaryToPath(
  path: DwgPolylineBoundaryPath,
  mat: Mat3,
  extents: Extents
): string {
  if (path.vertices.length === 0) return "";
  let out = "";
  for (let i = 0; i < path.vertices.length; i++) {
    const v = path.vertices[i];
    const w = transformPoint(mat, v.x, v.y);
    extents.expand(w.x, w.y);
    out += `${i === 0 ? "M" : "L"} ${fmt(w.x)} ${fmt(w.y)} `;
  }
  if (path.isClosed) out += "Z ";
  return out;
}

function edgeBoundaryToPath(
  path: Extract<DwgBoundaryPath, { edges: unknown }>,
  mat: Mat3,
  extents: Extents
): string {
  if (path.edges.length === 0) return "";
  let out = "";
  let started = false;
  for (const edge of path.edges) {
    switch (edge.type) {
      case 1: {
        const e = edge as DwgLineEdge;
        const s = transformPoint(mat, e.start.x, e.start.y);
        const en = transformPoint(mat, e.end.x, e.end.y);
        extents.expand(s.x, s.y);
        extents.expand(en.x, en.y);
        if (!started) {
          out += `M ${fmt(s.x)} ${fmt(s.y)} `;
          started = true;
        }
        out += `L ${fmt(en.x)} ${fmt(en.y)} `;
        break;
      }
      case 2: {
        const e = edge as DwgArcEdge;
        const sa = e.isCCW === false ? e.endAngle : e.startAngle;
        const ea = e.isCCW === false ? e.startAngle : e.endAngle;
        const sLocal = {
          x: e.center.x + e.radius * Math.cos(sa),
          y: e.center.y + e.radius * Math.sin(sa),
        };
        const enLocal = {
          x: e.center.x + e.radius * Math.cos(ea),
          y: e.center.y + e.radius * Math.sin(ea),
        };
        const s = transformPoint(mat, sLocal.x, sLocal.y);
        const en = transformPoint(mat, enLocal.x, enLocal.y);
        extents.expand(s.x, s.y);
        extents.expand(en.x, en.y);
        const r = e.radius * scaleMagnitude(mat);
        const delta = normaliseAngle(ea - sa);
        const largeArc = delta > Math.PI ? 1 : 0;
        const sweep = e.isCCW === false ? 0 : 1;
        if (!started) {
          out += `M ${fmt(s.x)} ${fmt(s.y)} `;
          started = true;
        }
        out += `A ${fmt(r)} ${fmt(r)} 0 ${largeArc} ${sweep} ${fmt(en.x)} ${fmt(en.y)} `;
        break;
      }
      case 3: {
        const e = edge as DwgEllipseEdge;
        // Approximate: use start/end via the major-axis-relative end vector.
        // For v1 the polygon outline preserves the area; refinements can
        // come once we see real test fixtures.
        const s = transformPoint(mat, e.center.x + e.end.x, e.center.y + e.end.y);
        extents.expand(s.x, s.y);
        if (!started) {
          out += `M ${fmt(s.x)} ${fmt(s.y)} `;
          started = true;
        } else {
          out += `L ${fmt(s.x)} ${fmt(s.y)} `;
        }
        break;
      }
      case 4: {
        const e = edge as DwgSplineEdge;
        const pts = e.fitDatum && e.fitDatum.length > 0 ? e.fitDatum : e.controlPoints;
        for (const p of pts) {
          const w = transformPoint(mat, p.x, p.y);
          extents.expand(w.x, w.y);
          out += `${started ? "L" : "M"} ${fmt(w.x)} ${fmt(w.y)} `;
          started = true;
        }
        break;
      }
    }
  }
  return out + "Z ";
}

function normaliseAngle(theta: number): number {
  let t = theta;
  while (t < 0) t += Math.PI * 2;
  while (t > Math.PI * 2) t -= Math.PI * 2;
  return t;
}

function buildPattern(
  entity: DwgHatchEntity,
  color: string,
  pool: { next: number },
  scale: number
): { id: string; def: string } | null {
  if (!entity.definitionLines || entity.definitionLines.length === 0) return null;
  const id = `hp${pool.next++}`;
  const patternScale = (entity.patternScale ?? 1) * scale;
  // Use the FIRST definition line to pick the pattern's tile size; subsequent
  // lines become additional `<line>` strokes inside the tile.
  const firstLine = entity.definitionLines[0];
  const offsetX = (firstLine.offset?.x ?? 1) * patternScale;
  const offsetY = (firstLine.offset?.y ?? 1) * patternScale;
  // The tile must be at least ~1 unit so the pattern doesn't degenerate.
  const tileW = Math.max(Math.abs(offsetX), 0.5) * 4;
  const tileH = Math.max(Math.abs(offsetY), 0.5) * 4;

  let lines = "";
  for (const def of entity.definitionLines) {
    const angle = def.angle ?? 0;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    // Each tile gets one stroke through its centre along the definition angle.
    const cx = tileW / 2;
    const cy = tileH / 2;
    const L = Math.max(tileW, tileH);
    const x1 = cx - c * L;
    const y1 = cy - s * L;
    const x2 = cx + c * L;
    const y2 = cy + s * L;
    let dashAttr = "";
    if (def.dashLengths && def.dashLengths.length > 0) {
      const dashes = def.dashLengths
        .map((dl) => Math.max(Math.abs(dl) * patternScale, 0.05))
        .join(" ");
      dashAttr = ` stroke-dasharray="${dashes}"`;
    }
    lines += `<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}" stroke="${color}" stroke-width="${fmt(Math.max(scale * 0.05, 0.05))}"${dashAttr} />`;
  }

  const def =
    `<defs><pattern id="${id}" patternUnits="userSpaceOnUse" ` +
    `width="${fmt(tileW)}" height="${fmt(tileH)}" patternTransform="rotate(${fmt(((entity.patternAngle ?? 0) * 180) / Math.PI)})">` +
    `${lines}</pattern></defs>`;

  return { id, def };
}

function lighten(color: string, amount: number): string {
  if (!color.startsWith("#") || color.length !== 7) return color;
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const m = (c: number) => Math.round(c + (255 - c) * amount);
  return `#${m(r).toString(16).padStart(2, "0")}${m(g).toString(16).padStart(2, "0")}${m(b).toString(16).padStart(2, "0")}`;
}
