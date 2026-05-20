// SVG → PNG raster export. Uses OffscreenCanvas + drawImage with a Blob URL of
// the SVG; this works inside a Worker without touching the main thread DOM.
// DPI knob is honored by scaling the canvas (96 dpi = 1 SVG user unit per
// pixel; 300 dpi → 3.125x oversample).
//
// Note: rasterizing CAD output is a fallback for users who need a quick image
// — vector PDF or SVG is always preferable for CAD content.

export interface PngOptions {
  drawingWidth: number;
  drawingHeight: number;
  // Render scale relative to SVG user units (1 = 96 dpi-ish baseline).
  scale: number;
}

export async function svgToPng(svg: string, options: PngOptions): Promise<Uint8Array> {
  const w = Math.max(1, Math.round(options.drawingWidth * options.scale));
  const h = Math.max(1, Math.round(options.drawingHeight * options.scale));

  // Inject explicit width / height so the rasterizer respects our scale even
  // when the SVG was emitted with width="100%".
  const sized = injectDimensions(svg, w, h);

  const blob = new Blob([sized], { type: "image/svg+xml" });
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not get a 2D canvas context for PNG export.");
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    const pngBlob = await canvas.convertToBlob({ type: "image/png" });
    return new Uint8Array(await pngBlob.arrayBuffer());
  } finally {
    bitmap.close?.();
  }
}

function injectDimensions(svg: string, width: number, height: number): string {
  return svg.replace(
    /<svg([^>]*)>/i,
    (_match, attrs: string) => {
      const stripped = attrs
        .replace(/\swidth=["'][^"']*["']/i, "")
        .replace(/\sheight=["'][^"']*["']/i, "");
      return `<svg${stripped} width="${width}" height="${height}">`;
    }
  );
}
