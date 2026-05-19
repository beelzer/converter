export type DataFormat = "json" | "yaml" | "xml" | "toml" | "csv" | "tsv";

export const DATA_FORMATS: DataFormat[] = ["json", "yaml", "xml", "toml", "csv", "tsv"];

export const FORMAT_LABEL: Record<DataFormat, string> = {
  json: "JSON",
  yaml: "YAML",
  xml: "XML",
  toml: "TOML",
  csv: "CSV",
  tsv: "TSV",
};

export const FORMAT_EXT: Record<DataFormat, string> = {
  json: "json",
  yaml: "yaml",
  xml: "xml",
  toml: "toml",
  csv: "csv",
  tsv: "tsv",
};

export const FORMAT_MIME: Record<DataFormat, string> = {
  json: "application/json",
  yaml: "application/yaml",
  xml: "application/xml",
  toml: "application/toml",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
};

export const ACCEPT_DATA =
  ".json,.yaml,.yml,.xml,.toml,.csv,.tsv,application/json,application/x-yaml,application/yaml,application/xml,text/xml,application/toml,text/csv,text/tab-separated-values,text/plain";

const EXT_TO_FORMAT: Record<string, DataFormat> = {
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  xml: "xml",
  toml: "toml",
  csv: "csv",
  tsv: "tsv",
};

export function detectFromFile(file: File): DataFormat | null {
  const match = file.name.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (match && EXT_TO_FORMAT[match[1]]) return EXT_TO_FORMAT[match[1]];
  return detectFromText(""); // No text yet — return null; callers should pass content if available.
}

export function detectFromText(text: string): DataFormat | null {
  const trimmed = text.trimStart();
  if (!trimmed) return null;
  // JSON: starts with { or [
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // fall through
    }
  }
  // XML: starts with <
  if (trimmed.startsWith("<")) return "xml";
  // TOML: has [section] or key = value patterns at line start
  const lines = trimmed.split(/\r?\n/);
  const firstNonEmpty = lines.find((l) => l.trim() && !l.trim().startsWith("#"));
  if (firstNonEmpty) {
    if (/^\[[\w.\-"]+\]\s*$/.test(firstNonEmpty.trim())) return "toml";
    if (/^[\w.\-"]+\s*=\s*\S/.test(firstNonEmpty.trim())) {
      // could be TOML or YAML — TOML uses =, YAML uses : with optional value
      return "toml";
    }
  }
  // CSV/TSV: comma or tab separators in first line
  const first = lines[0] ?? "";
  if (first.includes("\t") && !first.includes(",")) return "tsv";
  // YAML default for anything else with a colon
  if (first.includes(":")) return "yaml";
  // CSV last resort if commas
  if (first.includes(",")) return "csv";
  return null;
}

export { stripExt as basenameWithoutExt } from "../util/filename";
