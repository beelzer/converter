// DWG linetype → SVG stroke-dasharray.
//
// Each LTYPE entry stores a sequence of pattern elements whose lengths are in
// drawing units. Positive lengths are dashes, negative lengths are gaps, zero
// is a dot. We translate that directly to SVG dasharray syntax, applying the
// entity's linetype scale (or the global LTSCALE if the entity has none).

import type {
  DwgEntity,
  DwgLayerTableEntry,
  DwgLTypeTableEntry,
} from "@mlightcad/libredwg-web";

// LTSCALE — global linetype scale; lives on the header, defaults to 1.
export function patternForEntity(
  entity: DwgEntity,
  layer: DwgLayerTableEntry | undefined,
  linetypes: Map<string, DwgLTypeTableEntry>,
  globalLtScale: number
): string | null {
  const name = resolveLinetypeName(entity, layer);
  if (!name) return null;
  if (name === "CONTINUOUS" || name === "BYBLOCK") return null;

  const lt = linetypes.get(name) ?? linetypes.get(name.toUpperCase());
  if (!lt || !lt.pattern || lt.pattern.length === 0) return null;

  const ltScale = entity.lineTypeScale ?? 1;
  const scale = ltScale * globalLtScale;

  // SVG dasharray must alternate dash/gap. Convert each element:
  //   positive (dash)  → its length
  //   negative (gap)   → its absolute length
  //   zero (dot)       → a tiny non-zero value, otherwise SVG renders nothing
  const out: number[] = [];
  for (const el of lt.pattern) {
    const len = Math.abs(el.elementLength) * scale;
    out.push(Math.max(len, 0.01));
  }

  // SVG requires an even number of values for a proper dash/gap cycle; if odd,
  // duplicate the sequence so it remains alternating.
  if (out.length % 2 !== 0) {
    out.push(...out);
  }
  return out.map((n) => round(n)).join(" ");
}

function resolveLinetypeName(
  entity: DwgEntity,
  layer: DwgLayerTableEntry | undefined
): string | null {
  const direct = entity.lineType;
  if (direct && direct !== "BYLAYER" && direct !== "ByLayer") return direct;
  if (layer && layer.lineType) return layer.lineType;
  return null;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
