// Entity types libredwg-web's built-in SvgConverter drops on the floor
// (returns null in its dispatcher). We walk the DwgDatabase ourselves and
// emit SVG for them, then inject the result into libredwg's output so the
// final SVG contains the missing geometry.
//
// Coverage:
//   - HATCH (solid fill + best-effort line patterns)
//   - LEADER (polyline + optional arrowhead)
//   - WIPEOUT (white masking polygon — covers underlying geometry)
//
// libredwg's renderer wraps model space in a `<g ... transform="matrix(1,0,0,
// -1,0,0)">` to flip Y for paper coordinates. We mirror that transform on
// our overlay so coordinates align.

import type {
  DwgArcEdge,
  DwgBoundaryPath,
  DwgDatabase,
  DwgEntity,
  DwgHatchEntity,
  DwgLayerTableEntry,
  DwgLeaderEntity,
  DwgPolylineBoundaryPath,
  DwgWipeoutEntity,
} from "@mlightcad/libredwg-web";
function isModelSpace(name: string): boolean {
  return name.toLowerCase() === "*model_space";
}

const FLIP_Y_TRANSFORM = "matrix(1,0,0,-1,0,0)";

// Build the overlay group containing every HATCH/LEADER/WIPEOUT in the
// chosen render space. Returns an empty string if nothing applies — caller
// can skip the merge step.
export function renderExtras(
  db: DwgDatabase,
  options: {
    renderBlockName: string | null;
    frozenLayers: ReadonlySet<string>;
  }
): string {
  const targetEntities = pickEntities(db, options.renderBlockName);
  if (targetEntities.length === 0) return "";

  const layers = new Map<string, DwgLayerTableEntry>();
  for (const l of db.tables.LAYER.entries) layers.set(l.name, l);

  let body = "";
  for (const entity of targetEntities) {
    if (options.frozenLayers.has(entity.layer)) continue;
    if (entity.isVisible === false) continue;

    if (entity.type === "HATCH") {
      body += renderHatch(entity as DwgHatchEntity, layers);
    } else if (entity.type === "LEADER") {
      body += renderLeader(entity as DwgLeaderEntity, layers);
    } else if (entity.type === "WIPEOUT") {
      body += renderWipeout(entity as DwgWipeoutEntity);
    }
  }

  if (!body) return "";
  return `<g transform="${FLIP_Y_TRANSFORM}" data-source="dcln-extras">${body}</g>`;
}

function pickEntities(db: DwgDatabase, renderBlockName: string | null): DwgEntity[] {
  const block = db.tables.BLOCK_RECORD.entries.find((b) => {
    if (renderBlockName === null) return isModelSpace(b.name);
    return b.name === renderBlockName;
  });
  return block ? block.entities : [];
}

// ----- HATCH -----------------------------------------------------------------

function renderHatch(
  entity: DwgHatchEntity,
  layers: Map<string, DwgLayerTableEntry>
): string {
  const d = boundaryPathsToSvgPath(entity.boundaryPaths);
  if (!d) return "";

  const color = resolveColor(entity, layers);
  const isGradient = "gradientName" in entity;
  const fill = isGradient ? lightenForGradient(color) : color;
  // Solid-fill hatches: full opacity. Pattern fills: a thin alpha so the
  // boundary geometry remains legible underneath (libredwg already drew the
  // outline strokes). Gradients are approximated as a lighter solid colour.
  const opacity = entity.solidFill === 1 || isGradient ? 1 : 0.25;

  return `<path d="${d}" fill="${fill}" fill-opacity="${opacity}" fill-rule="evenodd" stroke="none" />`;
}

function boundaryPathsToSvgPath(paths: DwgBoundaryPath[]): string {
  let d = "";
  for (const path of paths) {
    if ("vertices" in path) {
      d += polylineBoundaryToPath(path);
    } else {
      d += edgeBoundaryToPath(path);
    }
  }
  return d;
}

function polylineBoundaryToPath(path: DwgPolylineBoundaryPath): string {
  if (path.vertices.length === 0) return "";
  const verts = path.vertices;
  let out = `M ${fmt(verts[0].x)} ${fmt(verts[0].y)} `;
  for (let i = 1; i < verts.length; i++) {
    out += `L ${fmt(verts[i].x)} ${fmt(verts[i].y)} `;
  }
  if (path.isClosed) out += "Z ";
  return out;
}

function edgeBoundaryToPath(
  path: Extract<DwgBoundaryPath, { edges: unknown }>
): string {
  if (path.edges.length === 0) return "";

  let out = "";
  let cursorSet = false;
  for (const edge of path.edges) {
    switch (edge.type) {
      case 1: {
        // Line — DwgLineEdge has start/end
        const e = edge as { start: { x: number; y: number }; end: { x: number; y: number } };
        if (!cursorSet) {
          out += `M ${fmt(e.start.x)} ${fmt(e.start.y)} `;
          cursorSet = true;
        }
        out += `L ${fmt(e.end.x)} ${fmt(e.end.y)} `;
        break;
      }
      case 2: {
        // Circular arc — approximate with SVG A command
        const e = edge as DwgArcEdge;
        const startAngle = e.isCCW === false ? e.endAngle : e.startAngle;
        const endAngle = e.isCCW === false ? e.startAngle : e.endAngle;
        const sx = e.center.x + e.radius * Math.cos(startAngle);
        const sy = e.center.y + e.radius * Math.sin(startAngle);
        const ex = e.center.x + e.radius * Math.cos(endAngle);
        const ey = e.center.y + e.radius * Math.sin(endAngle);
        const delta = normaliseAngle(endAngle - startAngle);
        const largeArc = delta > Math.PI ? 1 : 0;
        const sweep = e.isCCW === false ? 0 : 1;
        if (!cursorSet) {
          out += `M ${fmt(sx)} ${fmt(sy)} `;
          cursorSet = true;
        }
        out += `A ${fmt(e.radius)} ${fmt(e.radius)} 0 ${largeArc} ${sweep} ${fmt(ex)} ${fmt(ey)} `;
        break;
      }
      case 3: {
        // Elliptic arc — approximate as same-arc; full ellipse maths would need
        // axis rotation. Best-effort fallback so the hatch still has a closed
        // boundary.
        const e = edge as {
          center: { x: number; y: number };
          end: { x: number; y: number };
          lengthOfMinorAxis: number;
        };
        if (!cursorSet) {
          out += `M ${fmt(e.center.x + e.end.x)} ${fmt(e.center.y + e.end.y)} `;
          cursorSet = true;
        } else {
          out += `L ${fmt(e.center.x + e.end.x)} ${fmt(e.center.y + e.end.y)} `;
        }
        break;
      }
      case 4: {
        // Spline — connect fit points or control points as a polyline. SVG
        // doesn't have a B-spline command; quadratic/cubic fitting would be
        // overkill for hatch boundaries that are usually short.
        const e = edge as { fitDatum?: Array<{ x: number; y: number }>; controlPoints: Array<{ x: number; y: number }> };
        const pts = e.fitDatum && e.fitDatum.length > 0 ? e.fitDatum : e.controlPoints;
        if (pts.length === 0) break;
        if (!cursorSet) {
          out += `M ${fmt(pts[0].x)} ${fmt(pts[0].y)} `;
          cursorSet = true;
        }
        for (let i = 1; i < pts.length; i++) {
          out += `L ${fmt(pts[i].x)} ${fmt(pts[i].y)} `;
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

// ----- LEADER ----------------------------------------------------------------

function renderLeader(
  entity: DwgLeaderEntity,
  layers: Map<string, DwgLayerTableEntry>
): string {
  if (!entity.vertices || entity.vertices.length < 2) return "";
  const color = resolveColor(entity, layers);

  const points = entity.vertices
    .map((v) => `${fmt(v.x)},${fmt(v.y)}`)
    .join(" ");

  let out = `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="0.5" />`;

  if (entity.isArrowheadEnabled !== false && entity.vertices.length >= 2) {
    // Arrowhead at the FIRST vertex (the leader's point end). Size is heuristic
    // because the actual arrow style is governed by the dim style which we
    // don't fully resolve. A small filled triangle reads as "this is a leader"
    // in any output, which is the win we're after.
    const head = entity.vertices[0];
    const tail = entity.vertices[1];
    const dx = tail.x - head.x;
    const dy = tail.y - head.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const arrowLen = entity.textHeight ? entity.textHeight * 1.5 : Math.min(len * 0.1, 5);
    const arrowWidth = arrowLen * 0.45;
    const baseX = head.x + ux * arrowLen;
    const baseY = head.y + uy * arrowLen;
    const px = -uy * arrowWidth;
    const py = ux * arrowWidth;
    const a = `${fmt(head.x)},${fmt(head.y)}`;
    const b = `${fmt(baseX + px)},${fmt(baseY + py)}`;
    const c = `${fmt(baseX - px)},${fmt(baseY - py)}`;
    out += `<polygon points="${a} ${b} ${c}" fill="${color}" stroke="none" />`;
  }

  return out;
}

// ----- WIPEOUT ---------------------------------------------------------------

function renderWipeout(entity: DwgWipeoutEntity): string {
  if (!entity.clippingBoundaryPath || entity.clippingBoundaryPath.length < 3) return "";
  // Wipeout coordinates are stored in image pixel space relative to position
  // + uPixel / vPixel basis vectors. Convert to model coordinates.
  const points = entity.clippingBoundaryPath.map((p) => {
    const x =
      entity.position.x + p.x * entity.uPixel.x + p.y * entity.vPixel.x;
    const y =
      entity.position.y + p.x * entity.uPixel.y + p.y * entity.vPixel.y;
    return `${fmt(x)},${fmt(y)}`;
  });
  return `<polygon points="${points.join(" ")}" fill="#ffffff" stroke="none" />`;
}

// ----- Shared helpers --------------------------------------------------------

const ACI_PALETTE: Record<number, string> = {
  1: "#ff0000",
  2: "#ffff00",
  3: "#00ff00",
  4: "#00ffff",
  5: "#0000ff",
  6: "#ff00ff",
  7: "#ffffff",
  8: "#808080",
  9: "#c0c0c0",
};

function resolveColor(
  entity: DwgEntity,
  layers: Map<string, DwgLayerTableEntry>
): string {
  if (typeof entity.color === "number" && entity.color > 0) {
    return `#${(entity.color & 0xffffff).toString(16).padStart(6, "0")}`;
  }
  if (typeof entity.colorIndex === "number" && entity.colorIndex > 0 && entity.colorIndex < 256) {
    return aciToHex(entity.colorIndex);
  }
  // BYLAYER (default): look up the layer's color
  const layer = layers.get(entity.layer);
  if (layer) {
    if (typeof layer.color === "number" && layer.color > 0) {
      return `#${(layer.color & 0xffffff).toString(16).padStart(6, "0")}`;
    }
    if (typeof layer.colorIndex === "number") {
      return aciToHex(layer.colorIndex);
    }
  }
  return "#000000";
}

function aciToHex(aci: number): string {
  return ACI_PALETTE[aci] ?? "#000000";
}

function lightenForGradient(color: string): string {
  // Pull RGB out of #rrggbb and blend toward white by 30%.
  if (!color.startsWith("#") || color.length !== 7) return color;
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const blend = (c: number) => Math.round(c + (255 - c) * 0.3);
  return `#${blend(r).toString(16).padStart(2, "0")}${blend(g)
    .toString(16)
    .padStart(2, "0")}${blend(b).toString(16).padStart(2, "0")}`;
}

function fmt(n: number): string {
  // Trim trailing zeros and limit precision — keeps SVG output small without
  // visible quality loss for CAD-scale geometry.
  return Number.isFinite(n) ? n.toFixed(3).replace(/\.?0+$/, "") : "0";
}
