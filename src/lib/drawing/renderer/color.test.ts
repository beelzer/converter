import { describe, expect, it } from "vitest";
import type { DwgEntity, DwgLayerTableEntry } from "@mlightcad/libredwg-web";
import { aciHex, applyMonoMode, resolveColor } from "./color";
import type { BlockOverride } from "./types";

const asEntity = (e: Partial<DwgEntity>): DwgEntity => e as unknown as DwgEntity;
const asLayer = (l: Partial<DwgLayerTableEntry>): DwgLayerTableEntry =>
  l as unknown as DwgLayerTableEntry;

describe("aciHex", () => {
  it("maps the legacy ACI 1-6 to their canonical hex", () => {
    expect(aciHex(1)).toBe("#ff0000");
    expect(aciHex(2)).toBe("#ffff00");
    expect(aciHex(3)).toBe("#00ff00");
    expect(aciHex(4)).toBe("#00ffff");
    expect(aciHex(5)).toBe("#0000ff");
    expect(aciHex(6)).toBe("#ff00ff");
  });

  it("flips ACI 7 (white-on-dark canvas) to black for paper output", () => {
    expect(aciHex(7)).toBe("#000000");
  });

  it("returns black for negative or out-of-range indices", () => {
    expect(aciHex(-1)).toBe("#000000");
    expect(aciHex(999)).toBe("#000000");
  });
});

describe("applyMonoMode", () => {
  it("flattens any colour to black when mode is 'mono'", () => {
    expect(applyMonoMode("#ff00ff", "mono")).toBe("#000000");
  });

  it("returns the input colour unchanged when mode is 'preserve'", () => {
    expect(applyMonoMode("#ff00ff", "preserve")).toBe("#ff00ff");
  });
});

describe("resolveColor", () => {
  const noOverride: BlockOverride | null = null;

  it("uses true-colour when the entity stores a 24-bit RGB value", () => {
    const entity = asEntity({ color: 0xff0080 });
    expect(resolveColor(entity, undefined, noOverride)).toBe("#ff0080");
  });

  it("inverts a pure-white true-colour to black (paper-plot convention)", () => {
    const entity = asEntity({ color: 0xffffff });
    expect(resolveColor(entity, undefined, noOverride)).toBe("#000000");
  });

  it("falls back to ACI when there's no true-colour", () => {
    const entity = asEntity({ colorIndex: 1 });
    expect(resolveColor(entity, undefined, noOverride)).toBe("#ff0000");
  });

  it("looks up the layer when colour is ByLayer (256) or absent", () => {
    const entity = asEntity({ colorIndex: 256 });
    const layer = asLayer({ colorIndex: 3 });
    expect(resolveColor(entity, layer, noOverride)).toBe("#00ff00");
  });

  it("uses the block override when the entity is ByBlock (0)", () => {
    const entity = asEntity({ colorIndex: 0 });
    const override: BlockOverride = {
      color: "#abcdef",
      width: 0.25,
      dasharray: null,
    };
    expect(resolveColor(entity, undefined, override)).toBe("#abcdef");
  });

  it("falls back to black when ByBlock has no override", () => {
    const entity = asEntity({ colorIndex: 0 });
    expect(resolveColor(entity, undefined, noOverride)).toBe("#000000");
  });

  it("prefers entity true-colour over both layer and override", () => {
    const entity = asEntity({ color: 0x123456, colorIndex: 256 });
    const layer = asLayer({ colorIndex: 1 });
    const override: BlockOverride = {
      color: "#000000",
      width: 0.25,
      dasharray: null,
    };
    expect(resolveColor(entity, layer, override)).toBe("#123456");
  });
});
