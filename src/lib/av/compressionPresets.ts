// Video compression presets surfaced by the AvCompressor UI. Bitrates are in
// bits per second; resolutions cap the larger axis (height usually follows).

export type CompressionPreset = "light" | "medium" | "heavy";

export interface PresetSpec {
  label: string;
  hint: string;
  videoBitrate: number;
  audioBitrate: number;
  maxWidth: number;
}

export const COMPRESSION_PRESETS: Record<CompressionPreset, PresetSpec> = {
  light: {
    label: "Light",
    hint: "~4 Mbps, keep 1080p",
    videoBitrate: 4_000_000,
    audioBitrate: 192_000,
    maxWidth: 1920,
  },
  medium: {
    label: "Medium",
    hint: "~1.5 Mbps, cap 720p",
    videoBitrate: 1_500_000,
    audioBitrate: 128_000,
    maxWidth: 1280,
  },
  heavy: {
    label: "Heavy",
    hint: "~600 kbps, cap 480p",
    videoBitrate: 600_000,
    audioBitrate: 96_000,
    maxWidth: 854,
  },
};

export const COMPRESSION_PRESET_KEYS: CompressionPreset[] = ["light", "medium", "heavy"];
