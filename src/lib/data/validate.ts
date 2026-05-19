import { parseData } from "./parse";
import type { DataFormat } from "./formats";

export interface ValidationResult {
  ok: boolean;
  message?: string;
  line?: number;
  column?: number;
}

export async function validateText(
  text: string,
  format: DataFormat
): Promise<ValidationResult> {
  if (!text.trim()) return { ok: false, message: "Empty input." };
  try {
    await parseData(text, format);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const pos = extractPosition(message);
    return { ok: false, message, ...pos };
  }
}

function extractPosition(message: string): { line?: number; column?: number } {
  // JSON.parse: "Unexpected token } in JSON at position 42"
  const posMatch = /position (\d+)/i.exec(message);
  if (posMatch) {
    return { column: parseInt(posMatch[1], 10) };
  }
  // js-yaml: "at line N, column M"
  const yamlMatch = /at line (\d+), column (\d+)/i.exec(message);
  if (yamlMatch) {
    return { line: parseInt(yamlMatch[1], 10), column: parseInt(yamlMatch[2], 10) };
  }
  // smol-toml: "(line N, column M)" or similar
  const tomlMatch = /line (\d+)[,:\s]+column (\d+)/i.exec(message);
  if (tomlMatch) {
    return { line: parseInt(tomlMatch[1], 10), column: parseInt(tomlMatch[2], 10) };
  }
  return {};
}
