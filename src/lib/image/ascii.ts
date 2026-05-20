import { decodeImage } from "./decode";

export type AsciiCharset = "gradient" | "dense" | "blocks" | "braille" | "custom";
export type AsciiOutput = "text" | "html" | "ansi" | "png";
export type AsciiColor = "mono" | "color";

export interface AsciiOptions {
  outputWidth: number;
  charset: AsciiCharset;
  customRamp?: string;
  color: AsciiColor;
  invert: boolean;
  background: string;
  foreground: string;
  // PNG render only.
  fontSize?: number;
}

export interface AsciiResult {
  // Plain-text representation (always populated). Use this for the live preview.
  text: string;
  rows: number;
  cols: number;
  // The colour the renderer would paint each cell with, row-major, length = rows * cols.
  // Only populated when color === "color"; otherwise null.
  colors: string[] | null;
}

// Character cell aspect ratio. Monospace cells are ~2× as tall as they are wide,
// so we sample half the vertical resolution to preserve the image's aspect when
// the result is displayed in a monospace context.
const CHAR_ASPECT = 0.5;

const RAMPS: Record<Exclude<AsciiCharset, "braille" | "custom">, string> = {
  gradient: " .:-=+*#%@",
  dense:
    " .'`^\",:;Il!i><~+_-?][}{1)(|/\\tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
  blocks: " ░▒▓█",
};

// Luminance (Rec. 709). Returns 0-1.
function lumaFromRgb(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

// Map a 0-1 luminance to a charset index.
function indexFromLuma(luma: number, charsetLen: number, invert: boolean): number {
  const t = invert ? luma : 1 - luma;
  return Math.min(charsetLen - 1, Math.max(0, Math.floor(t * charsetLen)));
}

function hex2(n: number): string {
  return n.toString(16).padStart(2, "0");
}

function rgbHex(r: number, g: number, b: number): string {
  return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
}

// Build the source-pixel canvas at the resolution our character grid needs:
//   gradient/dense/blocks/custom → outputWidth × outputHeight pixels
//   braille                      → outputWidth*2 × outputHeight*4 sub-pixels
async function sampleImage(
  source: ImageBitmap | ImageData,
  imgWidth: number,
  imgHeight: number,
  sampleWidth: number,
  sampleHeight: number
): Promise<Uint8ClampedArray> {
  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(sampleWidth, sampleHeight)
      : (() => {
          const c = document.createElement("canvas");
          c.width = sampleWidth;
          c.height = sampleHeight;
          return c;
        })();
  const ctx = canvas.getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!ctx) throw new Error("Couldn't open a 2D drawing context.");
  if (source instanceof ImageBitmap) {
    ctx.drawImage(source, 0, 0, imgWidth, imgHeight, 0, 0, sampleWidth, sampleHeight);
  } else {
    // ImageData can't be scaled directly; paint it to a temp canvas first.
    const tmp =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(imgWidth, imgHeight)
        : document.createElement("canvas");
    if (!(tmp instanceof OffscreenCanvas)) {
      (tmp as HTMLCanvasElement).width = imgWidth;
      (tmp as HTMLCanvasElement).height = imgHeight;
    }
    const tctx = tmp.getContext("2d") as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!tctx) throw new Error("Couldn't open a 2D drawing context.");
    tctx.putImageData(source, 0, 0);
    ctx.drawImage(
      tmp as unknown as CanvasImageSource,
      0,
      0,
      imgWidth,
      imgHeight,
      0,
      0,
      sampleWidth,
      sampleHeight
    );
  }
  return ctx.getImageData(0, 0, sampleWidth, sampleHeight).data;
}

// Convert a decoded image into the ASCII grid plus per-cell colors.
export async function imageToAsciiGrid(
  file: File,
  options: AsciiOptions
): Promise<AsciiResult> {
  const decoded = await decodeImage(file);
  return decodedToAsciiGrid(decoded.source, decoded.width, decoded.height, options);
}

export async function decodedToAsciiGrid(
  source: ImageBitmap | ImageData,
  imgWidth: number,
  imgHeight: number,
  options: AsciiOptions
): Promise<AsciiResult> {
  const cols = Math.max(8, Math.floor(options.outputWidth));
  const rows = Math.max(
    1,
    Math.round((cols * imgHeight) / imgWidth * CHAR_ASPECT)
  );

  const braille = options.charset === "braille";
  const sampleW = braille ? cols * 2 : cols;
  const sampleH = braille ? rows * 4 : rows;
  const pixels = await sampleImage(source, imgWidth, imgHeight, sampleW, sampleH);

  const ramp =
    options.charset === "custom"
      ? options.customRamp && options.customRamp.length > 0
        ? options.customRamp
        : RAMPS.gradient
      : options.charset === "braille"
        ? "" // braille builds its char directly
        : RAMPS[options.charset];

  const wantColor = options.color === "color";
  const out: string[] = [];
  const colors: string[] | null = wantColor ? [] : null;

  if (braille) {
    // 4 vertical sub-pixels × 2 horizontal sub-pixels per char.
    // Standard Unicode braille bit order: col-major within each column,
    // bits 0,1,2 = col 0 rows 0-2; bit 6 = col 0 row 3;
    // bits 3,4,5 = col 1 rows 0-2; bit 7 = col 1 row 3.
    const BIT_FOR = [
      [0, 1, 2, 6], // column 0
      [3, 4, 5, 7], // column 1
    ];
    const threshold = 0.5;
    for (let r = 0; r < rows; r++) {
      let line = "";
      for (let c = 0; c < cols; c++) {
        let mask = 0;
        let rSum = 0,
          gSum = 0,
          bSum = 0,
          lit = 0;
        for (let dx = 0; dx < 2; dx++) {
          for (let dy = 0; dy < 4; dy++) {
            const px = c * 2 + dx;
            const py = r * 4 + dy;
            const idx = (py * sampleW + px) * 4;
            const R = pixels[idx];
            const G = pixels[idx + 1];
            const B = pixels[idx + 2];
            const luma = lumaFromRgb(R, G, B);
            // In braille, "on" means dark pixel for dark-on-light, or light pixel for light-on-dark.
            const on = options.invert ? luma > threshold : luma < threshold;
            if (on) {
              mask |= 1 << BIT_FOR[dx][dy];
              rSum += R;
              gSum += G;
              bSum += B;
              lit++;
            }
          }
        }
        line += String.fromCharCode(0x2800 + mask);
        if (colors) {
          if (lit === 0) {
            colors.push(options.foreground);
          } else {
            colors.push(rgbHex(Math.round(rSum / lit), Math.round(gSum / lit), Math.round(bSum / lit)));
          }
        }
      }
      out.push(line);
    }
  } else {
    for (let r = 0; r < rows; r++) {
      let line = "";
      for (let c = 0; c < cols; c++) {
        const idx = (r * sampleW + c) * 4;
        const R = pixels[idx];
        const G = pixels[idx + 1];
        const B = pixels[idx + 2];
        const luma = lumaFromRgb(R, G, B);
        const ch = ramp[indexFromLuma(luma, ramp.length, options.invert)] ?? " ";
        line += ch;
        if (colors) colors.push(rgbHex(R, G, B));
      }
      out.push(line);
    }
  }

  return { text: out.join("\n"), rows, cols, colors };
}

// ----------------------------------------------------------------------------
// Output formatters

export function gridToHtml(result: AsciiResult, options: AsciiOptions): string {
  const fg = options.foreground;
  const bg = options.background;
  const escape = (s: string) =>
    s.replace(/[&<>]/g, (ch) =>
      ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : "&gt;"
    );
  const lines = result.text.split("\n");
  if (!result.colors) {
    return `<pre style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;line-height:1;color:${fg};background:${bg};margin:0;padding:1em;">${escape(
      result.text
    )}</pre>`;
  }
  const colors = result.colors;
  let body = "";
  for (let r = 0; r < lines.length; r++) {
    const line = lines[r];
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      const color = colors[r * result.cols + c];
      const safe =
        ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : ch;
      body += `<span style="color:${color}">${safe}</span>`;
    }
    if (r < lines.length - 1) body += "\n";
  }
  return `<pre style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;line-height:1;background:${bg};margin:0;padding:1em;">${body}</pre>`;
}

// Wrap a grid into a standalone, copy-pasteable HTML document.
export function gridToHtmlDocument(result: AsciiResult, options: AsciiOptions): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>ASCII art</title>
</head>
<body style="margin:0;background:${options.background};">
${gridToHtml(result, options)}
</body>
</html>`;
}

// ANSI 24-bit colour escape sequences. Suitable for piping into a terminal:
// `cat result.ans` will reproduce the colour rendering in any modern terminal.
export function gridToAnsi(result: AsciiResult): string {
  if (!result.colors) return result.text;
  const lines = result.text.split("\n");
  let out = "";
  for (let r = 0; r < lines.length; r++) {
    const line = lines[r];
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      const color = result.colors[r * result.cols + c];
      const R = parseInt(color.slice(1, 3), 16);
      const G = parseInt(color.slice(3, 5), 16);
      const B = parseInt(color.slice(5, 7), 16);
      out += `\x1b[38;2;${R};${G};${B}m${ch}`;
    }
    out += "\x1b[0m";
    if (r < lines.length - 1) out += "\n";
  }
  return out;
}

// Render the ASCII grid to a PNG blob. Uses canvas to draw each character at
// the configured font size; honours per-cell colour if available.
export async function gridToPng(
  result: AsciiResult,
  options: AsciiOptions
): Promise<Blob> {
  const fontSize = Math.max(6, options.fontSize ?? 14);
  // Probe the actual character cell width with measureText.
  const probe = document.createElement("canvas");
  const pctx = probe.getContext("2d");
  if (!pctx) throw new Error("Couldn't open a 2D drawing context.");
  const fontStack = `${fontSize}px "JetBrains Mono Variable", "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace`;
  pctx.font = fontStack;
  pctx.textBaseline = "top";
  const metrics = pctx.measureText("M");
  const charW = metrics.width;
  const charH = fontSize * 1.0; // line-height 1.0 — tight rows for ASCII art
  const W = Math.ceil(charW * result.cols);
  const H = Math.ceil(charH * result.rows);

  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(W, H)
      : (() => {
          const c = document.createElement("canvas");
          c.width = W;
          c.height = H;
          return c;
        })();
  const ctx = canvas.getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!ctx) throw new Error("Couldn't open a 2D drawing context.");
  ctx.fillStyle = options.background;
  ctx.fillRect(0, 0, W, H);
  ctx.font = fontStack;
  ctx.textBaseline = "top";

  const lines = result.text.split("\n");
  for (let r = 0; r < lines.length; r++) {
    const line = lines[r];
    const y = Math.round(r * charH);
    if (result.colors) {
      for (let c = 0; c < line.length; c++) {
        ctx.fillStyle = result.colors[r * result.cols + c];
        ctx.fillText(line[c], Math.round(c * charW), y);
      }
    } else {
      ctx.fillStyle = options.foreground;
      ctx.fillText(line, 0, y);
    }
  }

  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: "image/png" });
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("Canvas couldn't produce a PNG."));
    }, "image/png");
  });
}

export function defaultOptions(): AsciiOptions {
  return {
    outputWidth: 100,
    charset: "gradient",
    customRamp: "",
    color: "mono",
    invert: false,
    background: "#0a0a0a",
    foreground: "#e8e8e8",
    fontSize: 14,
  };
}
