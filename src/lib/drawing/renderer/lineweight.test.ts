import { describe, expect, it } from "vitest";
import type { DwgEntity, DwgLayerTableEntry } from "@mlightcad/libredwg-web";
import { resolveLineweightMm } from "./lineweight";
import type { BlockOverride } from "./types";

const asEntity = (e: Partial<DwgEntity>): DwgEntity => e as unknown as DwgEntity;
const asLayer = (l: Partial<DwgLayerTableEntry>): DwgLayerTableEntry =>
  l as unknown as DwgLayerTableEntry;

describe("resolveLineweightMm", () => {
  it("returns the entity's explicit lineweight in millimetres", () => {
    expect(resolveLineweightMm(asEntity({ lineweight: 50 }), undefined, null)).toBeCloseTo(0.5, 6);
    expect(resolveLineweightMm(asEntity({ lineweight: 100 }), undefined, null)).toBeCloseTo(1.0, 6);
  });

  it("uses the default (0.25 mm) for code -3", () => {
    expect(resolveLineweightMm(asEntity({ lineweight: -3 }), undefined, null)).toBe(0.25);
  });

  it("falls back to the layer when entity is ByLayer (-1)", () => {
    const layer = asLayer({ lineweight: 50 });
    expect(resolveLineweightMm(asEntity({ lineweight: -1 }), layer, null)).toBeCloseTo(0.5, 6);
  });

  it("falls back to default when ByLayer has no layer", () => {
    expect(resolveLineweightMm(asEntity({ lineweight: -1 }), undefined, null)).toBe(0.25);
  });

  it("uses the block override when entity is ByBlock (-2)", () => {
    const override: BlockOverride = { color: "#000", width: 0.75, dasharray: null };
    expect(resolveLineweightMm(asEntity({ lineweight: -2 }), undefined, override)).toBe(0.75);
  });

  it("falls back to default when ByBlock has no override", () => {
    expect(resolveLineweightMm(asEntity({ lineweight: -2 }), undefined, null)).toBe(0.25);
  });

  it("rejects invalid lineweight codes (returns default)", () => {
    // 999 is not in the DXF lineweight enum.
    expect(resolveLineweightMm(asEntity({ lineweight: 999 }), undefined, null)).toBe(0.25);
  });

  it("clamps very thin lines up to the minimum-visible width", () => {
    // Code 5 = 0.05 mm < the 0.1 minimum.
    expect(resolveLineweightMm(asEntity({ lineweight: 5 }), undefined, null)).toBe(0.1);
  });

  it("defaults to ByLayer when entity has no lineweight at all", () => {
    const layer = asLayer({ lineweight: 50 });
    expect(resolveLineweightMm(asEntity({}), layer, null)).toBeCloseTo(0.5, 6);
  });
});
