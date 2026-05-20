// Apply layer + paper-space-layout selection to a DwgDatabase before handing
// it to libredwg's built-in `dwg_to_svg`. The renderer hard-codes "render only
// the block named *Model_Space at the top level"; to render a paper-space
// layout we rename the block records so that the user's choice masquerades as
// the model space while libredwg walks the tree.

import type { DwgDatabase, DwgEntity } from "@mlightcad/libredwg-web";

const MODEL_SPACE_NAME = "*Model_Space";
const HIDDEN_MS_NAME = "*Drawing_Tool_Hidden_Model_Space";

interface FilterOptions {
  frozenLayers: ReadonlySet<string>;
  // The block-record name of the layout to render. When null we render the
  // model space (libredwg's default).
  layoutBlockName: string | null;
}

// Shallow-clone the database with only the BLOCK_RECORD.entries array (and the
// entities arrays inside it) touched. Everything else passes through by
// reference — libredwg won't mutate it during rendering.
export function applyFilter(db: DwgDatabase, opts: FilterOptions): DwgDatabase {
  const targetBlockName = opts.layoutBlockName;
  const entries = db.tables.BLOCK_RECORD.entries.map((block) => {
    let name = block.name;
    let entities = block.entities;

    // Layer freeze: drop entities whose layer was toggled off in the UI.
    if (opts.frozenLayers.size > 0 && entities.length > 0) {
      entities = entities.filter((e) => !opts.frozenLayers.has(e.layer));
    }

    // Layout swap: rename the selected paper-space block to *Model_Space and
    // rename the real model space to a sentinel so libredwg ignores it.
    if (targetBlockName && !isCurrentlyModelSpace(name)) {
      if (name === targetBlockName) name = MODEL_SPACE_NAME;
    } else if (targetBlockName && isCurrentlyModelSpace(name)) {
      name = HIDDEN_MS_NAME;
    }

    return entities === block.entities && name === block.name
      ? block
      : { ...block, name, entities };
  });

  return {
    ...db,
    tables: {
      ...db.tables,
      BLOCK_RECORD: { ...db.tables.BLOCK_RECORD, entries },
    },
  };
}

function isCurrentlyModelSpace(name: string): boolean {
  return name === MODEL_SPACE_NAME || name.toLowerCase() === "*model_space";
}

// Resolves what to fall back to when the user hasn't picked a layout. For
// drawings with no model-space geometry but a single non-empty paper-space
// layout, treat that layout as the default render target — otherwise output
// would be silently blank.
export function pickDefaultLayoutBlock(
  db: DwgDatabase,
  layouts: { blockName: string; isModelSpace: boolean }[]
): string | null {
  const modelSpace = db.tables.BLOCK_RECORD.entries.find((b) =>
    isCurrentlyModelSpace(b.name)
  );
  if (modelSpace && hasGeometry(modelSpace.entities)) return null;
  const firstPaper = layouts.find((l) => !l.isModelSpace);
  return firstPaper ? firstPaper.blockName : null;
}

function hasGeometry(entities: DwgEntity[]): boolean {
  return entities.some((e) => !INVISIBLE_TYPES.has(e.type));
}

// Entities that don't produce visible geometry; ignoring them when deciding
// "does model space have anything to render" avoids treating a DWG with only
// VIEWPORT records in model space as non-empty.
const INVISIBLE_TYPES = new Set([
  "ATTDEF",
  "VIEWPORT",
  "BLOCK",
  "ENDBLK",
  "SEQEND",
]);
