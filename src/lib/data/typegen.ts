// JSON → TypeScript interfaces. Walks a sample value and generates named
// interfaces for objects, arrays-of-T, and primitive unions including null.
//
// Intentionally small: no dependencies, ~150 lines, handles 95% of real-world
// JSON. For more complex cases (allOf-style schemas, recursive types) we'd
// reach for quicktype-core — but it's 500KB lazy and overkill for v1.

type TypeNode =
  | { kind: "primitive"; name: "string" | "number" | "boolean" | "null" | "any" }
  | { kind: "array"; element: TypeNode }
  | { kind: "object"; ref: string }
  | { kind: "union"; members: TypeNode[] };

interface ObjectShape {
  // Property name → list of seen types
  fields: Map<string, TypeNode[]>;
  // Count of objects that contributed — used to decide which fields are optional
  count: number;
  // Per-field count of how many sample objects included this key
  fieldCounts: Map<string, number>;
}

class Inferer {
  private shapes = new Map<string, ObjectShape>();

  constructor(private readonly rootName: string) {}

  infer(value: unknown, parentName: string): TypeNode {
    if (value === null) return { kind: "primitive", name: "null" };
    if (typeof value === "string") return { kind: "primitive", name: "string" };
    if (typeof value === "number") return { kind: "primitive", name: "number" };
    if (typeof value === "boolean") return { kind: "primitive", name: "boolean" };
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return { kind: "array", element: { kind: "primitive", name: "any" } };
      }
      const elementType = unify(
        value.map((v) => this.infer(v, singularize(parentName)))
      );
      return { kind: "array", element: elementType };
    }
    if (typeof value === "object") {
      const ref = ensureUniqueName(this.shapes, pascalCase(parentName));
      let shape = this.shapes.get(ref);
      if (!shape) {
        shape = { fields: new Map(), count: 0, fieldCounts: new Map() };
        this.shapes.set(ref, shape);
      }
      shape.count++;
      const obj = value as Record<string, unknown>;
      for (const key of Object.keys(obj)) {
        const existing = shape.fields.get(key) ?? [];
        existing.push(this.infer(obj[key], key));
        shape.fields.set(key, existing);
        shape.fieldCounts.set(key, (shape.fieldCounts.get(key) ?? 0) + 1);
      }
      return { kind: "object", ref };
    }
    return { kind: "primitive", name: "any" };
  }

  emit(): string {
    const lines: string[] = [];
    for (const [name, shape] of this.shapes) {
      lines.push(`export interface ${name} {`);
      for (const [key, types] of shape.fields) {
        const seen = shape.fieldCounts.get(key) ?? 0;
        const optional = seen < shape.count;
        const unified = unify(types);
        const safeKey = isSafeIdentifier(key) ? key : JSON.stringify(key);
        lines.push(`  ${safeKey}${optional ? "?" : ""}: ${render(unified)};`);
      }
      lines.push("}");
      lines.push("");
    }
    return lines.join("\n").trimEnd() + "\n";
  }

  inferRoot(value: unknown): string {
    const rootType = this.infer(value, this.rootName);
    if (rootType.kind === "object") {
      return this.emit();
    }
    if (rootType.kind === "array") {
      const interfaces = this.emit();
      const alias = `export type ${pascalCase(this.rootName)} = ${render(rootType)};`;
      return interfaces ? `${interfaces}\n${alias}\n` : `${alias}\n`;
    }
    return `export type ${pascalCase(this.rootName)} = ${render(rootType)};\n`;
  }
}

function unify(types: TypeNode[]): TypeNode {
  // Dedup by structural key. Collapse string|null → string | null; merge object
  // refs of same name.
  const seen = new Map<string, TypeNode>();
  for (const t of types) {
    const k = key(t);
    if (!seen.has(k)) seen.set(k, t);
  }
  const members = [...seen.values()];
  if (members.length === 1) return members[0];
  return { kind: "union", members };
}

function key(node: TypeNode): string {
  switch (node.kind) {
    case "primitive":
      return `P:${node.name}`;
    case "array":
      return `A:${key(node.element)}`;
    case "object":
      return `O:${node.ref}`;
    case "union":
      return `U:${node.members.map(key).sort().join("|")}`;
  }
}

function render(node: TypeNode): string {
  switch (node.kind) {
    case "primitive":
      return node.name;
    case "array":
      return `${wrap(node.element)}[]`;
    case "object":
      return node.ref;
    case "union":
      return node.members.map(wrap).join(" | ");
  }
}

function wrap(node: TypeNode): string {
  if (node.kind === "union") return `(${render(node)})`;
  return render(node);
}

function pascalCase(input: string): string {
  const cleaned = input.replace(/[^A-Za-z0-9]+/g, " ").trim();
  if (!cleaned) return "Root";
  return cleaned
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

function singularize(name: string): string {
  if (name.endsWith("ies")) return name.slice(0, -3) + "y";
  if (name.endsWith("s") && !name.endsWith("ss")) return name.slice(0, -1);
  return name;
}

function ensureUniqueName(
  shapes: Map<string, ObjectShape>,
  base: string
): string {
  if (!shapes.has(base)) return base;
  let i = 2;
  while (shapes.has(`${base}${i}`)) i++;
  return `${base}${i}`;
}

function isSafeIdentifier(name: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name);
}

export function jsonToTypeScript(value: unknown, rootName = "Root"): string {
  const inferer = new Inferer(rootName);
  return inferer.inferRoot(value);
}
