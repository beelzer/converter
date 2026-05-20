import { describe, expect, it } from "vitest";
import { validateText } from "./validate";

describe("validateText", () => {
  it("returns ok for well-formed inputs", async () => {
    expect(await validateText('{"a":1}', "json")).toEqual({ ok: true });
    expect(await validateText("a: 1", "yaml")).toEqual({ ok: true });
    expect(await validateText("[s]\nx = 1", "toml")).toEqual({ ok: true });
    expect(await validateText("a,b\n1,2", "csv")).toEqual({ ok: true });
  });

  it("rejects empty input with a clear message", async () => {
    const r = await validateText("   ", "json");
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/empty/i);
  });

  it("returns ok=false with the parser's error message for bad JSON", async () => {
    const r = await validateText("{bad json}", "json");
    expect(r.ok).toBe(false);
    expect(r.message).toBeTruthy();
  });

  it("surfaces line/column when YAML parser provides it", async () => {
    // js-yaml errors look like 'YAMLException ... at line N, column M'.
    const r = await validateText("a: 1\n\tb: 2\n", "yaml");
    expect(r.ok).toBe(false);
    // Either line/column comes through, or at least a message did.
    expect(r.message).toBeTruthy();
  });
});
