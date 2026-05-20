import { describe, expect, it } from "vitest";
import type { DwgDatabase } from "@mlightcad/libredwg-web";
import { mmPerUnit } from "./units";

const dbWith = (code: number | null | undefined): DwgDatabase =>
  ({ header: { INSUNITS: code } } as unknown as DwgDatabase);

describe("mmPerUnit", () => {
  it("returns 1 when the database is null", () => {
    expect(mmPerUnit(null)).toBe(1);
  });

  it("returns 1 when INSUNITS is missing", () => {
    expect(mmPerUnit(dbWith(null))).toBe(1);
    expect(mmPerUnit(dbWith(undefined))).toBe(1);
  });

  it("maps the common INSUNITS codes", () => {
    expect(mmPerUnit(dbWith(0))).toBe(1); // unspecified → mm
    expect(mmPerUnit(dbWith(1))).toBe(25.4); // inch
    expect(mmPerUnit(dbWith(2))).toBe(304.8); // foot
    expect(mmPerUnit(dbWith(3))).toBe(1609344); // mile
    expect(mmPerUnit(dbWith(4))).toBe(1); // mm
    expect(mmPerUnit(dbWith(5))).toBe(10); // cm
    expect(mmPerUnit(dbWith(6))).toBe(1000); // m
    expect(mmPerUnit(dbWith(7))).toBe(1_000_000); // km
    expect(mmPerUnit(dbWith(9))).toBeCloseTo(0.0254); // mil
    expect(mmPerUnit(dbWith(10))).toBe(914.4); // yard
    expect(mmPerUnit(dbWith(14))).toBe(100); // dm
  });

  it("falls back to 1 for obscure unit codes we don't model", () => {
    expect(mmPerUnit(dbWith(20))).toBe(1); // parsec, μin, etc.
    expect(mmPerUnit(dbWith(255))).toBe(1);
  });
});
