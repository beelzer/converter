import { describe, expect, it } from "vitest";
import { convertData } from "./convert";

describe("convertData", () => {
  it("JSON → YAML", async () => {
    const yaml = await convertData('{"name":"app","port":8080}', "json", "yaml");
    expect(yaml).toContain("name: app");
    expect(yaml).toContain("port: 8080");
  });

  it("YAML → JSON", async () => {
    const json = await convertData("a: 1\nb: [2, 3]", "yaml", "json");
    expect(JSON.parse(json)).toEqual({ a: 1, b: [2, 3] });
  });

  it("JSON → TOML", async () => {
    const toml = await convertData('{"title":"demo","srv":{"port":8080}}', "json", "toml");
    expect(toml).toContain('title = "demo"');
    expect(toml).toMatch(/\[srv\]/);
    expect(toml).toContain("port = 8080");
  });

  it("CSV → JSON preserves typed values", async () => {
    const json = await convertData("name,age\nAlice,30\nBob,25", "csv", "json");
    expect(JSON.parse(json)).toEqual([
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ]);
  });

  it("propagates the minify option through to serialize", async () => {
    const min = await convertData('{"a":1,"b":2}', "json", "json", { minify: true });
    expect(min).toBe('{"a":1,"b":2}');
  });

  it("rejects malformed source before reaching the target serializer", async () => {
    await expect(convertData("{bad", "json", "yaml")).rejects.toThrow();
  });
});
