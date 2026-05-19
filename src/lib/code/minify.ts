// Minify dispatch. JS/TS via terser, CSS via csso, JSON via JSON.stringify,
// HTML via lightweight regex-based whitespace collapse.

import type { Language } from "./languages";

export async function minify(source: string, language: Language): Promise<string> {
  switch (language) {
    case "javascript":
    case "typescript": {
      // terser doesn't strip TS types — for typescript input we'd need a
      // separate transpile step (swc/typescript). We document this in the
      // FAQ; for now we treat .ts input as plain JS, which works for files
      // that already have types stripped or are TS-flavoured JS.
      const { minify: terserMinify } = await import("terser");
      const result = await terserMinify(source, {
        compress: true,
        mangle: true,
      });
      if (!result.code) throw new Error("Minifier produced no output.");
      return result.code;
    }

    case "json": {
      const parsed = JSON.parse(source);
      return JSON.stringify(parsed);
    }

    case "css": {
      const csso = await import("csso");
      return csso.minify(source).css;
    }

    case "html": {
      return minifyHtml(source);
    }

    default:
      throw new Error(`Minify not supported for ${language}`);
  }
}

// Conservative HTML minify: strip comments, collapse runs of whitespace
// between tags. Doesn't touch contents of <pre>, <textarea>, or <script>.
function minifyHtml(source: string): string {
  const protectedRanges: { start: number; end: number; tag: string }[] = [];
  for (const tag of ["pre", "textarea", "script", "style"]) {
    const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
    let match: RegExpExecArray | null;
    while ((match = re.exec(source))) {
      protectedRanges.push({ start: match.index, end: match.index + match[0].length, tag });
    }
  }
  protectedRanges.sort((a, b) => a.start - b.start);

  const parts: string[] = [];
  let cursor = 0;
  for (const range of protectedRanges) {
    parts.push(squash(source.slice(cursor, range.start)));
    parts.push(source.slice(range.start, range.end));
    cursor = range.end;
  }
  parts.push(squash(source.slice(cursor)));
  return parts.join("").trim();
}

function squash(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/>\s+</g, "><")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "");
}
