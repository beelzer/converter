import type { SupportedOutputFormat } from "./formats";

export interface RasterizeOptions {
  format: SupportedOutputFormat;
  // Final pixel width. Height is derived from the SVG's intrinsic aspect ratio
  // (or its viewBox / declared width/height).
  width: number;
  quality?: number;
  background?: string; // CSS colour for JPEG fills; ignored for transparent outputs.
}

export interface RasterizeResult {
  blob: Blob;
  width: number;
  height: number;
}

function parseSvgDimensions(svgText: string): { width: number; height: number } {
  // Try viewBox first; it's the most reliable source of intrinsic aspect.
  const viewBoxMatch = svgText.match(/viewBox\s*=\s*["']([\d.\s-]+)["']/i);
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].trim().split(/\s+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { width: parts[2], height: parts[3] };
    }
  }
  const widthMatch = svgText.match(/\swidth\s*=\s*["']([\d.]+)/i);
  const heightMatch = svgText.match(/\sheight\s*=\s*["']([\d.]+)/i);
  if (widthMatch && heightMatch) {
    return { width: parseFloat(widthMatch[1]), height: parseFloat(heightMatch[1]) };
  }
  // Fallback: assume square. Better than throwing.
  return { width: 512, height: 512 };
}

export async function rasterizeSvg(
  file: File,
  options: RasterizeOptions
): Promise<RasterizeResult> {
  const svgText = await file.text();
  const dims = parseSvgDimensions(svgText);
  const aspect = dims.height / dims.width;
  const targetW = Math.max(1, Math.round(options.width));
  const targetH = Math.max(1, Math.round(targetW * aspect));

  // Use a blob URL so the SVG can reference base64-embedded fonts, but warn
  // upfront that <image href="https://..."> won't load due to security policy
  // on tainted canvases — that's documented in the page FAQ.
  const blob = new Blob([svgText], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () =>
        reject(
          new Error(
            "Couldn't load that SVG — it may be malformed, or it references external resources we can't fetch."
          )
        );
      i.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't open a 2D drawing context.");
    if (options.format === "jpeg") {
      ctx.fillStyle = options.background ?? "#ffffff";
      ctx.fillRect(0, 0, targetW, targetH);
    }
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const mime = `image/${options.format}`;
    const out = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error(`Couldn't encode as ${options.format}.`));
        },
        mime,
        options.format === "jpeg" || options.format === "webp"
          ? options.quality ?? 0.92
          : undefined
      );
    });
    return { blob: out, width: targetW, height: targetH };
  } finally {
    URL.revokeObjectURL(url);
  }
}
