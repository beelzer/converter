import type { DataFormat } from "./formats";

export interface SerializeOptions {
  minify?: boolean;
  indent?: number;
}

export async function serializeData(
  value: unknown,
  format: DataFormat,
  options: SerializeOptions = {}
): Promise<string> {
  const indent = options.indent ?? 2;

  switch (format) {
    case "json":
      return options.minify
        ? JSON.stringify(value)
        : JSON.stringify(value, null, indent);

    case "yaml": {
      const yaml = await import("js-yaml");
      return yaml.dump(value, {
        indent,
        lineWidth: options.minify ? -1 : 80,
        noRefs: true,
        sortKeys: false,
      });
    }

    case "toml": {
      const { stringify } = await import("smol-toml");
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("TOML output requires an object at the top level.");
      }
      return stringify(value as Record<string, unknown>);
    }

    case "xml": {
      const Builder = (await import("fast-xml-builder")).default;
      const wrapped =
        value && typeof value === "object" && !Array.isArray(value)
          ? value
          : { root: value };
      const builder = new Builder({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        textNodeName: "#text",
        format: !options.minify,
        indentBy: " ".repeat(indent),
        suppressEmptyNode: true,
      });
      return builder.build(wrapped);
    }

    case "csv":
    case "tsv": {
      const Papa = (await import("papaparse")).default;
      const delim = format === "tsv" ? "\t" : ",";
      const rows = ensureRows(value);
      return Papa.unparse(rows, { delimiter: delim, header: true });
    }
  }
}

function ensureRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.map((row) => {
      if (row === null || typeof row !== "object" || Array.isArray(row)) {
        return { value: row };
      }
      return row as Record<string, unknown>;
    });
  }
  if (value && typeof value === "object") {
    // Single object → one row
    return [value as Record<string, unknown>];
  }
  return [{ value: String(value ?? "") }];
}
