import { describe, expect, it } from "vitest";
import { patternForEntity } from "./linetype";
import { asEntity, asLayer, asLineType } from "./__fixtures";

const lt = (pattern: { elementLength: number }[]) =>
  asLineType({ pattern });

describe("patternForEntity", () => {
  it("returns null for CONTINUOUS / BYBLOCK / unset linetypes", () => {
    const ltMap = new Map([["DASHED", lt([{ elementLength: 5 }])]]);
    expect(patternForEntity(asEntity({ lineType: "CONTINUOUS" }), undefined, ltMap, 1)).toBeNull();
    expect(patternForEntity(asEntity({ lineType: "BYBLOCK" }), undefined, ltMap, 1)).toBeNull();
    expect(patternForEntity(asEntity({}), undefined, ltMap, 1)).toBeNull();
  });

  it("returns null when the named linetype isn't in the map", () => {
    const ltMap = new Map();
    expect(patternForEntity(asEntity({ lineType: "DASHED" }), undefined, ltMap, 1)).toBeNull();
  });

  it("emits dashes and absolute-value gaps from the pattern", () => {
    const ltMap = new Map([
      ["DASHED", lt([{ elementLength: 5 }, { elementLength: -2 }])],
    ]);
    const dash = patternForEntity(asEntity({ lineType: "DASHED" }), undefined, ltMap, 1);
    expect(dash).toBe("5 2");
  });

  it("multiplies pattern lengths by the entity scale and the global LTSCALE", () => {
    const ltMap = new Map([
      ["DASHED", lt([{ elementLength: 10 }, { elementLength: -5 }])],
    ]);
    const e = asEntity({ lineType: "DASHED", lineTypeScale: 2 });
    // LTSCALE = 3 → final 10*2*3 = 60, gap 5*2*3 = 30.
    expect(patternForEntity(e, undefined, ltMap, 3)).toBe("60 30");
  });

  it("uses 0.01 in place of zero-length dots so they render", () => {
    const ltMap = new Map([
      ["DOTS", lt([{ elementLength: 0 }, { elementLength: -1 }])],
    ]);
    expect(patternForEntity(asEntity({ lineType: "DOTS" }), undefined, ltMap, 1)).toBe("0.01 1");
  });

  it("doubles odd-length patterns into an even-length alternating cycle", () => {
    const ltMap = new Map([
      ["ODD", lt([{ elementLength: 5 }, { elementLength: -2 }, { elementLength: 3 }])],
    ]);
    expect(patternForEntity(asEntity({ lineType: "ODD" }), undefined, ltMap, 1)).toBe(
      "5 2 3 5 2 3"
    );
  });

  it("falls back to the layer's linetype when entity uses BYLAYER", () => {
    const ltMap = new Map([["DASHED", lt([{ elementLength: 4 }, { elementLength: -1 }])]]);
    const layer = asLayer({ lineType: "DASHED" });
    const entity = asEntity({ lineType: "BYLAYER" });
    expect(patternForEntity(entity, layer, ltMap, 1)).toBe("4 1");
  });

  it("case-insensitive matches the linetype name when an upper-cased copy exists", () => {
    const ltMap = new Map([["DASHED", lt([{ elementLength: 3 }, { elementLength: -1 }])]]);
    const entity = asEntity({ lineType: "dashed" });
    expect(patternForEntity(entity, undefined, ltMap, 1)).toBe("3 1");
  });
});
