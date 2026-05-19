// Filename helpers. A single regex + functions, replacing 9 local copies of
// `basenameWithoutExt` and various ad-hoc extension parsers.

export const EXT_CAPTURE = /\.([a-z0-9]+)$/i;

export function stripExt(name: string): string {
  return name.replace(/\.[a-z0-9]+$/i, "");
}

export function getExt(name: string): string | null {
  const match = EXT_CAPTURE.exec(name);
  return match ? match[1].toLowerCase() : null;
}

export function replaceExt(name: string, newExt: string): string {
  return stripExt(name) + (newExt.startsWith(".") ? newExt : `.${newExt}`);
}
