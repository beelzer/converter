// Read a DwgDatabase and surface only what the UI needs to drive controls:
// layer toggles and paper-space layout picker. Keeps the worker → UI boundary
// thin (no DwgEntity objects cross the postMessage gap).

import type { DwgDatabase } from "@mlightcad/libredwg-web";

export interface LayerInfo {
  name: string;
  colorIndex: number;
  off: boolean;
  frozen: boolean;
  // True iff at least one entity actually references this layer. Pure
  // metadata layers with no geometry get hidden from the UI.
  used: boolean;
}

export interface LayoutInfo {
  // Display name, e.g. "Model" or "Layout1".
  name: string;
  // Block-record name as stored in BLOCK_RECORD.entries — we round-trip this
  // back into filter.ts when the user selects a layout to render.
  blockName: string;
  isModelSpace: boolean;
}

const MODEL_SPACE_PATTERN = /^\*model_space$/i;
const PAPER_SPACE_PATTERN = /^\*paper_space(?:\d*|_\d+)?$/i;

export function analyzeDatabase(db: DwgDatabase): {
  layers: LayerInfo[];
  layouts: LayoutInfo[];
} {
  const usedLayers = new Set<string>();
  for (const block of db.tables.BLOCK_RECORD.entries) {
    for (const entity of block.entities) {
      if (entity.layer) usedLayers.add(entity.layer);
    }
  }

  const layers: LayerInfo[] = db.tables.LAYER.entries
    .map((l) => ({
      name: l.name,
      colorIndex: l.colorIndex,
      off: !!l.off,
      frozen: !!l.frozen,
      used: usedLayers.has(l.name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Paper-space layouts come from BLOCK_RECORD entries other than the model
  // space. Empty layouts (no entities) are dropped — they'd render blank.
  const layouts: LayoutInfo[] = [];
  for (const block of db.tables.BLOCK_RECORD.entries) {
    const name = block.name;
    if (MODEL_SPACE_PATTERN.test(name)) {
      layouts.unshift({ name: "Model", blockName: name, isModelSpace: true });
      continue;
    }
    if (PAPER_SPACE_PATTERN.test(name) && block.entities.length > 0) {
      // BlockRecord.layout is the handle of the owning LAYOUT object; match
      // by handle to get a human-friendly name. Fall back to the block name
      // if the link is broken.
      const layout = db.objects.LAYOUT.find((l) => l.handle === block.layout);
      layouts.push({
        name: layout?.layoutName ?? name,
        blockName: name,
        isModelSpace: false,
      });
    }
  }

  return { layers, layouts };
}
