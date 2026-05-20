import { describe, expect, it } from "vitest";
import { jsonToTypeScript } from "./typegen";

describe("jsonToTypeScript primitive root", () => {
  it("renders a type alias for primitive roots", () => {
    expect(jsonToTypeScript("hello", "Greeting")).toContain(
      "export type Greeting = string;"
    );
    expect(jsonToTypeScript(42, "Answer")).toContain("export type Answer = number;");
    expect(jsonToTypeScript(true, "Flag")).toContain("export type Flag = boolean;");
    expect(jsonToTypeScript(null, "Maybe")).toContain("export type Maybe = null;");
  });
});

describe("jsonToTypeScript object root", () => {
  it("renders an interface with each field's inferred type", () => {
    const out = jsonToTypeScript({ name: "Alice", age: 30, active: true }, "User");
    expect(out).toContain("export interface User {");
    expect(out).toContain("name: string;");
    expect(out).toContain("age: number;");
    expect(out).toContain("active: boolean;");
  });

  it("emits a separate interface for each nested object", () => {
    const out = jsonToTypeScript(
      { user: { id: 1, name: "Alice" }, role: "admin" },
      "Root"
    );
    expect(out).toContain("export interface Root {");
    // The nested 'user' key gets PascalCased into 'User'.
    expect(out).toContain("export interface User {");
    expect(out).toContain("user: User;");
    expect(out).toContain("role: string;");
  });

  it("unions array elements that have different shapes", () => {
    const out = jsonToTypeScript(
      {
        items: [
          { kind: "a", value: 1 },
          { kind: "b", value: 2 },
        ],
      },
      "Root"
    );
    // Sibling array elements each produce their own interface (Item, Item2).
    expect(out).toContain("export interface Item {");
    expect(out).toContain("export interface Item2 {");
    expect(out).toMatch(/items: \(Item \| Item2\)\[\];/);
  });

  it("quotes keys that aren't valid TS identifiers", () => {
    const out = jsonToTypeScript({ "weird-key": 1, "with space": 2 }, "Root");
    expect(out).toContain('"weird-key": number;');
    expect(out).toContain('"with space": number;');
  });

  it("singularises array parent names for the element interface", () => {
    const out = jsonToTypeScript({ users: [{ id: 1 }] }, "Root");
    // users → User (singularised + pascalCased) for the element interface.
    expect(out).toContain("export interface User {");
    expect(out).toContain("users: User[];");
  });
});

describe("jsonToTypeScript array root", () => {
  it("renders a type alias for top-level arrays of primitives", () => {
    expect(jsonToTypeScript([1, 2, 3], "Counts")).toContain(
      "export type Counts = number[];"
    );
  });

  it("renders alias + element interfaces for arrays of objects", () => {
    const out = jsonToTypeScript([{ id: 1 }, { id: 2 }], "Items");
    expect(out).toContain("export interface Item {");
    expect(out).toMatch(/export type Items = \(Item \| Item2\)\[\];/);
  });

  it("falls back to any[] for empty arrays", () => {
    expect(jsonToTypeScript([], "Empty")).toContain("export type Empty = any[];");
  });

  it("collapses primitive unions inside arrays into a single union", () => {
    const out = jsonToTypeScript([1, "two", null], "Mixed");
    // Should be `(number | string | null)[]` or any permutation.
    expect(out).toMatch(/export type Mixed =/);
    expect(out).toContain("number");
    expect(out).toContain("string");
    expect(out).toContain("null");
    expect(out).toContain("[]");
  });
});
