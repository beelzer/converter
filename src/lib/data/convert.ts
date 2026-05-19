import { parseData } from "./parse";
import { serializeData, type SerializeOptions } from "./serialize";
import type { DataFormat } from "./formats";

export async function convertData(
  text: string,
  from: DataFormat,
  to: DataFormat,
  options: SerializeOptions = {}
): Promise<string> {
  const value = await parseData(text, from);
  return serializeData(value, to, options);
}
