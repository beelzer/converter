// Entry point for the from-scratch renderer. Replaces libredwg-web's built-in
// `dwg_to_svg(db)` with our walker, which honours per-entity lineweight,
// linetype, colour (incl. byLayer/byBlock resolution through INSERT recursion),
// hatch fills + patterns, dimension blocks, splines, and more.

import type { DwgDatabase } from "@mlightcad/libredwg-web";
import { Extents } from "./extents";
import { FLIP_Y_TRANSFORM, IDENTITY_MAT, type BlockDef } from "./types";
import type { RenderContext } from "./types";
import { renderEntity } from "./entities/dispatcher";

export interface RenderOptions {
  frozenLayers: ReadonlySet<string>;
  // The block-record name to render as the "top level" — null = model space.
  // Paper-space layout rendering passes the layout's block name here.
  renderBlockName: string | null;
  // Drawing-unit-per-mm factor derived from db.header.$INSUNITS.
  unitToMm: number;
}

const MODEL_SPACE_PATTERN = /^\*?model[_ ]?space$/i;

export function renderDatabase(db: DwgDatabase, opts: RenderOptions): string {
  // Build lookup maps once.
  const layers = new Map(db.tables.LAYER.entries.map((l) => [l.name, l]));
  const linetypes = new Map(db.tables.LTYPE.entries.map((lt) => [lt.name, lt]));
  const blocks = new Map<string, BlockDef>();
  for (const b of db.tables.BLOCK_RECORD.entries) {
    blocks.set(b.name, {
      name: b.name,
      entities: b.entities,
      basePoint: b.basePoint ?? { x: 0, y: 0, z: 0 },
    });
  }

  const ctx: RenderContext = {
    db,
    layers,
    linetypes,
    blocks,
    unitToMm: opts.unitToMm,
    blockOverride: null,
    insertDepth: 0,
    frozenLayers: opts.frozenLayers,
  };

  const targetBlock = pickTargetBlock(db, opts.renderBlockName);
  if (!targetBlock) {
    console.warn("[drawing] No renderable block in BLOCK_RECORD table.");
    return emptySvg();
  }

  const extents = new Extents();
  const patternIdCounter = { next: 0 };
  // Collect per-entity SVG fragments so we can drop outliers after rendering.
  // beginEntity is called for every visible entity (even those that emit "")
  // so fragment[i] aligns with extents.boxes[i].
  const fragments: { svg: string; type: string }[] = [];
  const unknownTypes = new Map<string, number>();
  for (const entity of targetBlock.entities) {
    if (opts.frozenLayers.has(entity.layer)) continue;
    if (entity.isVisible === false) continue;
    extents.beginEntity();
    const out = renderEntity(entity, ctx, IDENTITY_MAT, extents, patternIdCounter);
    fragments.push({ svg: out, type: entity.type });
    if (!out) unknownTypes.set(entity.type, (unknownTypes.get(entity.type) ?? 0) + 1);
  }
  extents.finalizeLastEntity();

  const outliers = extents.outlierIndices();
  let body = "";
  let rendered = 0;
  const outlierTypes = new Map<string, number>();
  for (let i = 0; i < fragments.length; i++) {
    if (outliers.has(i)) {
      const t = fragments[i].type;
      outlierTypes.set(t, (outlierTypes.get(t) ?? 0) + 1);
      continue;
    }
    if (fragments[i].svg) {
      body += fragments[i].svg;
      rendered++;
    }
  }

  // Diagnostic: surface what we rendered / skipped. Cheap and invaluable
  // when a real DWG produces an unexpectedly empty page.
  console.info(
    `[drawing] Rendered ${rendered}/${targetBlock.entities.length} entities from block "${targetBlock.name}".`
  );
  if (unknownTypes.size > 0) {
    const summary = Array.from(unknownTypes.entries())
      .map(([type, count]) => `${type}×${count}`)
      .join(", ");
    console.info(`[drawing] Skipped entity types: ${summary}`);
  }
  if (outlierTypes.size > 0) {
    const summary = Array.from(outlierTypes.entries())
      .map(([type, count]) => `${type}×${count}`)
      .join(", ");
    console.info(`[drawing] Excluded outlier entities (would have overlaid drawing): ${summary}`);
  }

  const bbox = extents.result(outliers);
  const w = bbox.maxX - bbox.minX;
  const h = bbox.maxY - bbox.minY;

  // The viewBox uses the original drawing-unit bounds; svg2pdf and our PNG
  // exporter then scale this into millimetres for the page. The flip-Y
  // transform converts drawing coordinates (Y-up) to SVG (Y-down).
  const viewBoxY = -bbox.maxY;
  // Default stroke-width is computed as ~0.1% of the larger viewBox dimension
  // so strokes are always visible after fit-to-page scaling, regardless of
  // drawing units. We use a CONCRETE number rather than the "0.1%" CSS form
  // because svg2pdf interprets percentage strokes as 0 and would render the
  // PDF blank. Per-entity lineweight fidelity is deferred to v2.
  const defaultStrokeWidth = Math.max(w, h) / 1000;

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `viewBox="${fmt(bbox.minX)} ${fmt(viewBoxY)} ${fmt(w)} ${fmt(h)}" ` +
    `width="100%" height="100%" preserveAspectRatio="xMinYMin meet">` +
    `<g transform="${FLIP_Y_TRANSFORM}" stroke-width="${fmt(defaultStrokeWidth)}" stroke-linecap="round" stroke-linejoin="round" fill="none">` +
    body +
    `</g>` +
    `</svg>`
  );
}

function pickTargetBlock(db: DwgDatabase, renderBlockName: string | null) {
  const entries = db.tables.BLOCK_RECORD.entries;
  if (renderBlockName) {
    return entries.find((b) => b.name === renderBlockName) ?? null;
  }
  // First try the canonical model-space match (handles AutoCAD's "*Model_Space"
  // and variants like "*MODEL_SPACE" or "Model Space").
  const modelSpace = entries.find((b) => MODEL_SPACE_PATTERN.test(b.name));
  if (modelSpace && modelSpace.entities.length > 0) return modelSpace;
  // Fallback: drawings can have unusual model-space block names. Pick the
  // non-block-reference entry with the most entities so we never silently
  // emit an empty SVG.
  let largest: { block: typeof entries[number]; count: number } | null = null;
  for (const block of entries) {
    if (block.name.startsWith("*Paper_Space")) continue;
    if (!largest || block.entities.length > largest.count) {
      largest = { block, count: block.entities.length };
    }
  }
  return largest ? largest.block : (modelSpace ?? null);
}

function emptySvg(): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" width="100%" height="100%"/>`
  );
}

function fmt(n: number): string {
  return Number(n.toFixed(4)).toString();
}
