import { CanvasSink } from "mediabunny";
import { openInput } from "./input";

export interface VideoToGifOptions {
  fps?: number;
  width?: number;
  height?: number;
  start?: number;
  end?: number;
  maxColors?: number;
  onProgress?: (p: number) => void;
}

export async function videoToGif(
  file: File,
  options: VideoToGifOptions = {}
): Promise<Uint8Array> {
  const input = openInput(file);
  try {
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) throw new Error("This file has no video track.");
    const duration = await input.computeDuration();
    const start = Math.max(0, options.start ?? 0);
    const end = Math.min(duration, options.end ?? duration);
    if (end <= start) throw new Error("End time must be greater than start time.");

    const fps = Math.max(1, Math.min(30, options.fps ?? 12));
    const dt = 1 / fps;
    const timestamps: number[] = [];
    for (let t = start; t < end; t += dt) timestamps.push(t);
    if (timestamps.length === 0) throw new Error("No frames in selected range.");

    const sink = new CanvasSink(videoTrack, {
      width: options.width,
      height: options.height,
      fit: "contain",
    });

    const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
    const gif = GIFEncoder();
    const delayMs = Math.round(1000 / fps);
    const maxColors = options.maxColors ?? 256;
    let w = 0;
    let h = 0;
    let processed = 0;

    for await (const wrapped of sink.canvasesAtTimestamps(timestamps)) {
      processed++;
      if (!wrapped) continue;
      const c = wrapped.canvas;
      w = c.width;
      h = c.height;
      const ctx =
        c instanceof OffscreenCanvas
          ? c.getContext("2d")
          : (c as HTMLCanvasElement).getContext("2d");
      if (!ctx) throw new Error("Could not get 2D context for frame decode.");
      const { data } = ctx.getImageData(0, 0, w, h);
      const palette = quantize(data, maxColors);
      const index = applyPalette(data, palette);
      gif.writeFrame(index, w, h, { palette, delay: delayMs });
      options.onProgress?.(processed / timestamps.length);
    }
    gif.finish();
    return gif.bytes();
  } finally {
    input.dispose?.();
  }
}
