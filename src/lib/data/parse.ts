import type { DataFormat } from "./formats";

export async function parseData(text: string, format: DataFormat): Promise<unknown> {
  switch (format) {
    case "json":
      return JSON.parse(text);

    case "yaml": {
      const yaml = await import("js-yaml");
      return yaml.load(text);
    }

    case "toml": {
      const { parse } = await import("smol-toml");
      return parse(text);
    }

    case "xml": {
      const { XMLParser } = await import("fast-xml-parser");
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        textNodeName: "#text",
        parseAttributeValue: true,
        parseTagValue: true,
        trimValues: true,
      });
      return parser.parse(text);
    }

    case "csv":
    case "tsv": {
      const Papa = (await import("papaparse")).default;
      const delim = format === "tsv" ? "\t" : ",";
      const result = Papa.parse<Record<string, unknown>>(text.trim(), {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        delimiter: delim,
      });
      if (result.errors.length > 0) {
        const first = result.errors[0];
        throw new Error(`${first.type}: ${first.message} (row ${first.row ?? "?"})`);
      }
      return result.data;
    }
  }
}
