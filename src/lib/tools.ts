// Single source of truth for the product hub catalog. Consumed by the
// homepage, the 404 page, and any future "see also" list.

export interface ToolEntry {
  slug: string;
  name: string;
  // One-line blurb suitable for compact contexts (404 / footer / sidebar).
  shortBlurb: string;
  // Multi-sentence card description for the homepage grid.
  longBlurb: string;
  // Optional lifecycle status. Defaults to "live" when omitted. "beta" means
  // the tool ships but is known to have visual or fidelity gaps; the site
  // surfaces this on cards + a banner on the tool page so users aren't
  // surprised when output disagrees with reference renders.
  status?: "live" | "beta";
}

export const TOOLS: readonly ToolEntry[] = [
  {
    slug: "pdf",
    name: "PDF",
    shortBlurb: "Merge, split, rotate, organize, convert",
    longBlurb:
      "Merge, split, rotate, reorganize, convert to images, or build a PDF from images — all in one tool.",
  },
  {
    slug: "image",
    name: "Image",
    shortBlurb: "Convert, resize, compress, favicon, EXIF",
    longBlurb:
      "Convert between JPG, PNG, WebP, AVIF, HEIC and more. Resize, compress, strip EXIF, build favicons, rasterize SVG.",
  },
  {
    slug: "data",
    name: "Data",
    shortBlurb: "JSON / YAML / XML / TOML / CSV — convert, format, validate, TS types",
    longBlurb:
      "Convert between JSON, YAML, XML, TOML, CSV and TSV. Format, minify, validate, generate TypeScript types.",
  },
  {
    slug: "audio-video",
    name: "Audio / Video",
    shortBlurb: "Convert, trim, GIF, extract audio, frames, merge",
    longBlurb:
      "Convert between MP4, WebM, MOV, MKV. Trim, compress, extract audio, video to GIF, frames, merge clips — via WebCodecs.",
  },
  {
    slug: "color",
    name: "Color",
    shortBlurb: "Convert, palette, WCAG contrast",
    longBlurb:
      "Convert HEX / RGB / HSL / OKLCH / CMYK. Generate harmonies. WCAG contrast checker.",
  },
  {
    slug: "encode",
    name: "Encode",
    shortBlurb: "Base64, URL, JWT, SHA hashes",
    longBlurb:
      "Base64, URL encoding, JWT decoder, SHA-1 / 256 / 384 / 512 hashes via WebCrypto.",
  },
  {
    slug: "document",
    name: "Document",
    shortBlurb: "Markdown, HTML, DOCX, PDF text",
    longBlurb:
      "Markdown ↔ HTML, DOCX → HTML/Markdown/text, PDF → text. Browser-native print to PDF.",
  },
  {
    slug: "archive",
    name: "Archive",
    shortBlurb: "ZIP, TAR, GZIP, RAR — create and extract",
    longBlurb:
      "Create ZIP / TAR / TAR.GZ / GZIP, or extract any of those plus RAR. Auto-detect format on read.",
  },
  {
    slug: "code",
    name: "Code",
    shortBlurb: "Beautify or minify JS, TS, CSS, HTML, JSON, SQL and more",
    longBlurb:
      "Beautify and minify JavaScript, TypeScript, CSS, HTML, JSON, SCSS, Markdown, YAML, GraphQL, Vue, SQL.",
  },
  {
    slug: "drawing",
    name: "Drawing",
    shortBlurb: "DWG, DXF, SVG → PDF (beta)",
    longBlurb:
      "Convert AutoCAD DWG, DXF and SVG drawings to vector PDF in your browser. Beta: from-scratch renderer covers most geometry, text and dimensions, but hatch patterns, lineweight fidelity and a few entity types are still rough.",
    status: "beta",
  },
];

export function findTool(slug: string): ToolEntry | undefined {
  return TOOLS.find((t) => t.slug === slug);
}
