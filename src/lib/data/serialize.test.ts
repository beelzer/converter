import { describe, expect, it } from "vitest";
import { serializeData } from "./serialize";
import { parseData } from "./parse";

describe("serializeData → parseData round trips", () => {
  const sample = {
    title: "demo",
    nested: { count: 3, active: true },
    items: [1, 2, 3],
  };

  it("JSON", async () => {
    const out = await serializeData(sample, "json");
    expect(out).toContain("\"title\"");
    expect(await parseData(out, "json")).toEqual(sample);
  });

  it("YAML", async () => {
    const out = await serializeData(sample, "yaml");
    expect(await parseData(out, "yaml")).toEqual(sample);
  });

  it("TOML", async () => {
    const out = await serializeData(sample, "toml");
    expect(await parseData(out, "toml")).toEqual(sample);
  });

  it("CSV (array of records)", async () => {
    const rows = [
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ];
    const csv = await serializeData(rows, "csv");
    expect(csv.split(/\r?\n/)[0]).toBe("name,age");
    expect(await parseData(csv, "csv")).toEqual(rows);
  });

  it("TSV", async () => {
    const rows = [{ name: "Alice", age: 30 }];
    const tsv = await serializeData(rows, "tsv");
    expect(tsv).toContain("\t");
    expect(await parseData(tsv, "tsv")).toEqual(rows);
  });
});

describe("serializeData options", () => {
  it("minifies JSON when requested", async () => {
    const min = await serializeData({ a: 1, b: 2 }, "json", { minify: true });
    expect(min).toBe('{"a":1,"b":2}');
  });

  it("respects custom indent for JSON", async () => {
    const out = await serializeData({ a: 1 }, "json", { indent: 4 });
    expect(out).toContain("    \"a\": 1");
  });
});

describe("serializeData TOML restrictions", () => {
  it("refuses non-object roots", async () => {
    await expect(serializeData([1, 2, 3], "toml")).rejects.toThrow();
    await expect(serializeData("hello", "toml")).rejects.toThrow();
    await expect(serializeData(null, "toml")).rejects.toThrow();
  });
});

describe("serializeData CSV from non-array roots", () => {
  it("wraps a single object as one row", async () => {
    const out = await serializeData({ name: "Alice", age: 30 }, "csv");
    expect(out).toContain("Alice");
    expect(out.split(/\r?\n/)).toHaveLength(2); // header + 1 row
  });
});
