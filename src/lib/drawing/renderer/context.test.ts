import { describe, expect, it } from "vitest";
import { resolveStroke } from "./context";
import { asEntity, asLayer, asLineType, makeContext } from "./__fixtures";

describe("resolveStroke", () => {
  it("combines colour + lineweight + linetype into a single Stroke", () => {
    const ctx = makeContext({
      layers: new Map([
        ["walls", asLayer({ colorIndex: 1, lineweight: 50 })],
      ]),
    });
    const entity = asEntity({ layer: "walls", colorIndex: 256, lineweight: -1 });
    const stroke = resolveStroke(ctx, entity, 1);
    expect(stroke.color).toBe("#ff0000");
    // 50 → 0.5 mm; unitToMm = 1 and scale = 1, so width stays at 0.5.
    expect(stroke.width).toBeCloseTo(0.5, 6);
    expect(stroke.dasharray).toBeNull();
  });

  it("scales the lineweight by the parent matrix's scale magnitude", () => {
    const ctx = makeContext();
    const entity = asEntity({ layer: "0", lineweight: 100 });
    // Doubling the scale should double the width in drawing units.
    const a = resolveStroke(ctx, entity, 1);
    const b = resolveStroke(ctx, entity, 2);
    expect(b.width).toBeCloseTo(a.width * 2, 6);
  });

  it("divides by unitToMm so widths look right in non-mm drawings", () => {
    // Drawing authored in inches: 25.4 mm per inch. A 1 mm lineweight should
    // emit ~0.039 drawing units (= 1 / 25.4) so it still plots as 1 mm.
    const ctx = makeContext({ unitToMm: 25.4 });
    const entity = asEntity({ layer: "0", lineweight: 100 }); // 1 mm
    const stroke = resolveStroke(ctx, entity, 1);
    expect(stroke.width).toBeCloseTo(1 / 25.4, 4);
  });

  it("emits a stroke-dasharray when the layer carries a linetype", () => {
    const linetypes = new Map([
      [
        "DASHED",
        asLineType({
          pattern: [
            { elementLength: 5 },
            { elementLength: -2 },
          ],
        }),
      ],
    ]);
    const layers = new Map([
      ["dashedLayer", asLayer({ lineType: "DASHED", lineweight: 50 })],
    ]);
    const ctx = makeContext({ layers, linetypes });
    const entity = asEntity({ layer: "dashedLayer", lineType: "BYLAYER" });
    const stroke = resolveStroke(ctx, entity, 1);
    expect(stroke.dasharray).toBe("5 2");
  });
});
