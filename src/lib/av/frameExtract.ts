import { CanvasSink } from "mediabunny";
import { openInput } from "./input";

export type FrameImageFormat = "png" | "jpeg" | "webp";

export interface FrameExtractOptions {
  format: FrameImageFormat;
  width?: number;
  height?: number;
  quality?: number;
}

export interface ExtractedFrame {
  blob: Blob;
  timestamp: number;
  width: number;
  height: number;
}

function canvasToBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  format: FrameImageFormat,
  quality?: number
): Promise<Blob> {
  const mime = `image/${format}`;
  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: mime, quality });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to encode frame."))),
      mime,
      quality
    );
  });
}

export async function extractFrame(
  file: File,
  timestamp: number,
  options: FrameExtractOptions
): Promise<ExtractedFrame> {
  const input = openInput(file);
  try {
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) throw new Error("This file has no video track.");
    const sink = new CanvasSink(videoTrack, {
      width: options.width,
      height: options.height,
      fit: "contain",
    });
    const wrapped = await sink.getCanvas(timestamp);
    if (!wrapped) throw new Error("No frame available at that timestamp.");
    const blob = await canvasToBlob(wrapped.canvas, options.format, options.quality);
    return {
      blob,
      timestamp: wrapped.timestamp,
      width: wrapped.canvas.width,
      height: wrapped.canvas.height,
    };
  } finally {
    input.dispose?.();
  }
}

export interface MultiFrameOptions extends FrameExtractOptions {
  fps?: number;
  count?: number;
  onProgress?: (p: number) => void;
}

export async function extractFrames(
  file: File,
  options: MultiFrameOptions
): Promise<ExtractedFrame[]> {
  const input = openInput(file);
  try {
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) throw new Error("This file has no video track.");
    const duration = await input.computeDuration();
    const timestamps: number[] = [];
    if (options.count && options.count > 0) {
      const step = duration / (options.count + 1);
      for (let i = 1; i <= options.count; i++) timestamps.push(step * i);
    } else {
      const fps = options.fps ?? 1;
      const dt = 1 / fps;
      for (let t = 0; t < duration; t += dt) timestamps.push(t);
    }
    const sink = new CanvasSink(videoTrack, {
      width: options.width,
      height: options.height,
      fit: "contain",
    });
    const frames: ExtractedFrame[] = [];
    let i = 0;
    for await (const wrapped of sink.canvasesAtTimestamps(timestamps)) {
      i++;
      if (!wrapped) continue;
      const blob = await canvasToBlob(wrapped.canvas, options.format, options.quality);
      frames.push({
        blob,
        timestamp: wrapped.timestamp,
        width: wrapped.canvas.width,
        height: wrapped.canvas.height,
      });
      options.onProgress?.(i / timestamps.length);
    }
    return frames;
  } finally {
    input.dispose?.();
  }
}
