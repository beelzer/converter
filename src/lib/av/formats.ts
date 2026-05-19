import {
  Mp4OutputFormat,
  WebMOutputFormat,
  MkvOutputFormat,
  MovOutputFormat,
  Mp3OutputFormat,
  WavOutputFormat,
  AdtsOutputFormat,
  FlacOutputFormat,
  OggOutputFormat,
  type OutputFormat,
} from "mediabunny";

export type VideoContainer = "mp4" | "webm" | "mkv" | "mov";
export type AudioContainer = "mp3" | "wav" | "aac" | "flac" | "ogg";

export const VIDEO_CONTAINERS: VideoContainer[] = ["mp4", "webm", "mkv", "mov"];
export const AUDIO_CONTAINERS: AudioContainer[] = ["mp3", "wav", "aac", "flac", "ogg"];

export const VIDEO_CONTAINER_LABEL: Record<VideoContainer, string> = {
  mp4: "MP4",
  webm: "WebM",
  mkv: "MKV",
  mov: "MOV",
};

export const AUDIO_CONTAINER_LABEL: Record<AudioContainer, string> = {
  mp3: "MP3",
  wav: "WAV",
  aac: "AAC",
  flac: "FLAC",
  ogg: "Ogg",
};

export const VIDEO_CODEC_FOR_CONTAINER: Record<VideoContainer, "avc" | "vp9" | "av1"> = {
  mp4: "avc",
  webm: "vp9",
  mkv: "vp9",
  mov: "avc",
};

export const AUDIO_CODEC_FOR_CONTAINER: Record<VideoContainer, "aac" | "opus"> = {
  mp4: "aac",
  webm: "opus",
  mkv: "opus",
  mov: "aac",
};

export const AUDIO_CODEC_FOR_AUDIO_CONTAINER: Record<
  AudioContainer,
  "mp3" | "aac" | "flac" | "vorbis" | "pcm-s16"
> = {
  mp3: "mp3",
  wav: "pcm-s16",
  aac: "aac",
  flac: "flac",
  ogg: "vorbis",
};

export function videoContainerOutput(c: VideoContainer): OutputFormat {
  if (c === "mp4") return new Mp4OutputFormat();
  if (c === "webm") return new WebMOutputFormat();
  if (c === "mkv") return new MkvOutputFormat();
  return new MovOutputFormat();
}

export function audioContainerOutput(c: AudioContainer): OutputFormat {
  if (c === "mp3") return new Mp3OutputFormat();
  if (c === "wav") return new WavOutputFormat();
  if (c === "aac") return new AdtsOutputFormat();
  if (c === "flac") return new FlacOutputFormat();
  return new OggOutputFormat();
}

export function extensionFor(c: VideoContainer | AudioContainer): string {
  return c;
}

export function mimeForVideo(c: VideoContainer): string {
  if (c === "mp4") return "video/mp4";
  if (c === "webm") return "video/webm";
  if (c === "mkv") return "video/x-matroska";
  return "video/quicktime";
}

export function mimeForAudio(c: AudioContainer): string {
  if (c === "mp3") return "audio/mpeg";
  if (c === "wav") return "audio/wav";
  if (c === "aac") return "audio/aac";
  if (c === "flac") return "audio/flac";
  return "audio/ogg";
}

export const ACCEPT_VIDEO =
  "video/mp4,video/webm,video/quicktime,video/x-matroska,.mp4,.webm,.mov,.mkv,.m4v";

export const ACCEPT_AUDIO =
  "audio/mpeg,audio/wav,audio/aac,audio/flac,audio/ogg,audio/mp4,.mp3,.wav,.aac,.flac,.ogg,.oga,.opus,.m4a";

export const ACCEPT_MEDIA = `${ACCEPT_VIDEO},${ACCEPT_AUDIO}`;

export { stripExt as basenameWithoutExt } from "../util/filename";

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
