import {
  Output,
  BufferTarget,
  Conversion,
  QUALITY_HIGH,
  QUALITY_MEDIUM,
  QUALITY_LOW,
  type Quality,
} from "mediabunny";
import { openInput } from "./input";
import {
  videoContainerOutput,
  audioContainerOutput,
  VIDEO_CODEC_FOR_CONTAINER,
  AUDIO_CODEC_FOR_CONTAINER,
  AUDIO_CODEC_FOR_AUDIO_CONTAINER,
  type VideoContainer,
  type AudioContainer,
} from "./formats";

export type QualityPreset = "high" | "medium" | "low";

export function presetToQuality(preset: QualityPreset): Quality {
  if (preset === "high") return QUALITY_HIGH;
  if (preset === "medium") return QUALITY_MEDIUM;
  return QUALITY_LOW;
}

export interface ConvertOptions {
  container: VideoContainer;
  quality?: QualityPreset;
  width?: number;
  height?: number;
  onProgress?: (p: number) => void;
}

export async function convertVideo(file: File, options: ConvertOptions): Promise<Uint8Array> {
  const input = openInput(file);
  try {
    const output = new Output({
      format: videoContainerOutput(options.container),
      target: new BufferTarget(),
    });
    const quality = presetToQuality(options.quality ?? "high");
    const conversion = await Conversion.init({
      input,
      output,
      video: {
        codec: VIDEO_CODEC_FOR_CONTAINER[options.container],
        bitrate: quality,
        width: options.width,
        height: options.height,
        fit: "contain",
      },
      audio: {
        codec: AUDIO_CODEC_FOR_CONTAINER[options.container],
        bitrate: quality,
      },
    });
    if (options.onProgress) conversion.onProgress = options.onProgress;
    if (!conversion.isValid) {
      throw new Error("This file can't be converted to the chosen format in this browser.");
    }
    await conversion.execute();
    const buffer = (output.target as BufferTarget).buffer;
    if (!buffer) throw new Error("Conversion produced no output.");
    return new Uint8Array(buffer);
  } finally {
    input.dispose?.();
  }
}

export interface TrimOptions {
  container: VideoContainer;
  start: number;
  end: number;
  onProgress?: (p: number) => void;
}

export async function trimVideo(file: File, options: TrimOptions): Promise<Uint8Array> {
  const input = openInput(file);
  try {
    const output = new Output({
      format: videoContainerOutput(options.container),
      target: new BufferTarget(),
    });
    const conversion = await Conversion.init({
      input,
      output,
      trim: { start: options.start, end: options.end },
    });
    if (options.onProgress) conversion.onProgress = options.onProgress;
    if (!conversion.isValid) {
      throw new Error("This file can't be trimmed to that range in this browser.");
    }
    await conversion.execute();
    const buffer = (output.target as BufferTarget).buffer;
    if (!buffer) throw new Error("Trim produced no output.");
    return new Uint8Array(buffer);
  } finally {
    input.dispose?.();
  }
}

export interface ExtractAudioOptions {
  container: AudioContainer;
  quality?: QualityPreset;
  onProgress?: (p: number) => void;
}

export async function extractAudio(
  file: File,
  options: ExtractAudioOptions
): Promise<Uint8Array> {
  const input = openInput(file);
  try {
    const output = new Output({
      format: audioContainerOutput(options.container),
      target: new BufferTarget(),
    });
    const quality = presetToQuality(options.quality ?? "high");
    const conversion = await Conversion.init({
      input,
      output,
      video: { discard: true },
      audio: {
        codec: AUDIO_CODEC_FOR_AUDIO_CONTAINER[options.container],
        bitrate: quality,
      },
    });
    if (options.onProgress) conversion.onProgress = options.onProgress;
    if (!conversion.isValid) {
      throw new Error("This file has no audio track that can be extracted.");
    }
    await conversion.execute();
    const buffer = (output.target as BufferTarget).buffer;
    if (!buffer) throw new Error("Audio extraction produced no output.");
    return new Uint8Array(buffer);
  } finally {
    input.dispose?.();
  }
}

export interface CompressOptions {
  container: VideoContainer;
  videoBitrate: number;
  audioBitrate?: number;
  maxWidth?: number;
  onProgress?: (p: number) => void;
}

export async function compressVideo(
  file: File,
  options: CompressOptions
): Promise<Uint8Array> {
  const input = openInput(file);
  try {
    const output = new Output({
      format: videoContainerOutput(options.container),
      target: new BufferTarget(),
    });
    const conversion = await Conversion.init({
      input,
      output,
      video: {
        codec: VIDEO_CODEC_FOR_CONTAINER[options.container],
        bitrate: options.videoBitrate,
        width: options.maxWidth,
        fit: "contain",
        forceTranscode: true,
      },
      audio: {
        codec: AUDIO_CODEC_FOR_CONTAINER[options.container],
        bitrate: options.audioBitrate ?? 128_000,
        forceTranscode: true,
      },
    });
    if (options.onProgress) conversion.onProgress = options.onProgress;
    if (!conversion.isValid) {
      throw new Error("This file can't be compressed in this browser.");
    }
    await conversion.execute();
    const buffer = (output.target as BufferTarget).buffer;
    if (!buffer) throw new Error("Compress produced no output.");
    return new Uint8Array(buffer);
  } finally {
    input.dispose?.();
  }
}
