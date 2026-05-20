// Shared test fixtures + constructor helpers for the drawing renderer suites.
// Excluded from coverage in vitest.config.ts; not picked up as a test file
// because the include glob only matches *.test.ts / *.spec.ts.

import type {
  DwgDatabase,
  DwgEntity,
  DwgLayerTableEntry,
  DwgLTypeTableEntry,
} from "@mlightcad/libredwg-web";
import type { BlockDef, RenderContext } from "./types";

// Loose `Record<string, unknown>` shape so test call-sites don't have to spell
// out every required property of DwgEntity / DwgLayerTableEntry / etc. The
// renderer code only ever reads the properties we set, so missing ones are
// harmless at runtime.
export function asEntity<T = DwgEntity>(e: Record<string, unknown>): T {
  return e as unknown as T;
}

export function asLayer(l: Record<string, unknown>): DwgLayerTableEntry {
  return l as unknown as DwgLayerTableEntry;
}

export function asLineType(l: Record<string, unknown>): DwgLTypeTableEntry {
  return l as unknown as DwgLTypeTableEntry;
}

// Minimal RenderContext for unit tests. Override anything you care about via
// the `overrides` arg.
export function makeContext(overrides: Partial<RenderContext> = {}): RenderContext {
  const fakeDb = { header: { LTSCALE: 1, INSUNITS: 4 } } as unknown as DwgDatabase;
  return {
    db: fakeDb,
    layers: new Map(),
    linetypes: new Map(),
    blocks: new Map<string, BlockDef>(),
    unitToMm: 1,
    blockOverride: null,
    insertDepth: 0,
    frozenLayers: new Set(),
    ...overrides,
  };
}
