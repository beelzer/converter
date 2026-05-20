import { describe, expect, it } from "vitest";
import { parseData } from "./parse";

describe("parseData", () => {
  it("parses JSON", async () => {
    expect(await parseData('{"a":1,"b":[true,null,"x"]}', "json")).toEqual({
      a: 1,
      b: [true, null, "x"],
    });
  });

  it("parses YAML", async () => {
    const out = await parseData("a: 1\nb:\n  - true\n  - x\n", "yaml");
    expect(out).toEqual({ a: 1, b: [true, "x"] });
  });

  it("parses TOML", async () => {
    const out = await parseData('title = "TOML"\n[server]\nport = 8080\n', "toml");
    expect(out).toEqual({ title: "TOML", server: { port: 8080 } });
  });

  it("parses XML with attributes", async () => {
    const out = (await parseData(
      '<root><item id="1">hello</item></root>',
      "xml"
    )) as Record<string, unknown>;
    expect(out).toMatchObject({
      root: { item: { "@_id": 1, "#text": "hello" } },
    });
  });

  it("parses CSV into an array of records with typed values", async () => {
    const csv = "name,age\nAlice,30\nBob,25";
    const out = await parseData(csv, "csv");
    expect(out).toEqual([
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ]);
  });

  it("parses TSV with tab delimiters", async () => {
    const tsv = "name\tage\nAlice\t30";
    expect(await parseData(tsv, "tsv")).toEqual([{ name: "Alice", age: 30 }]);
  });

  it("rejects malformed JSON", async () => {
    await expect(parseData("{not json}", "json")).rejects.toThrow();
  });

  it("rejects malformed YAML", async () => {
    // Tab-indented YAML inside a flow mapping is invalid.
    await expect(parseData("a: 1\n\tb: 2\n  c: 3\n", "yaml")).rejects.toThrow();
  });

  it("rejects malformed TOML", async () => {
    await expect(parseData('name = "unterminated', "toml")).rejects.toThrow();
  });
});
