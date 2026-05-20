import { describe, expect, it } from "vitest";
import {
  compressVideo,
  convertVideo,
  extractAudio,
  presetToQuality,
  trimVideo,
} from "./convert";
import { readMetadata } from "./input";
import clipMp4Url from "../../../e2e/fixtures/av/clip.mp4?url";

async function fetchAsFile(url: string, name: string, type: string): Promise<File> {
  const res = await fetch(url);
  return new File([await res.arrayBuffer()], name, { type });
}

const fixture = () => fetchAsFile(clipMp4Url, "clip.mp4", "video/mp4");

describe("presetToQuality", () => {
  it("maps each preset to a mediabunny Quality token", () => {
    const high = presetToQuality("high");
    const medium = presetToQuality("medium");
    const low = presetToQuality("low");
    expect(high).toBeTruthy();
    expect(medium).toBeTruthy();
    expect(low).toBeTruthy();
    // Different presets must resolve to different tokens.
    expect(high).not.toBe(low);
  });
});

describe("convertVideo", () => {
  it("converts an MP4 to WebM and produces parseable bytes", async () => {
    const file = await fixture();
    const bytes = await convertVideo(file, { container: "webm", quality: "low" });
    expect(bytes.byteLength).toBeGreaterThan(0);
    // Round-trip through readMetadata so we know the output is a valid container.
    const meta = await readMetadata(new Blob([bytes as BlobPart], { type: "video/webm" }));
    expect(meta.hasVideo).toBe(true);
    expect(meta.duration).toBeGreaterThan(0);
  }, 60_000);
});

describe("trimVideo", () => {
  it("produces a shorter output when given a sub-range", async () => {
    const file = await fixture();
    const original = await readMetadata(file);
    const trimmedBytes = await trimVideo(file, {
      container: "mp4",
      start: 0,
      end: Math.min(0.5, original.duration / 2),
    });
    const trimmed = await readMetadata(new Blob([trimmedBytes as BlobPart], { type: "video/mp4" }));
    expect(trimmed.duration).toBeLessThan(original.duration);
  }, 60_000);
});

describe("extractAudio", () => {
  it("produces an audio-only file (no video track) from a video", async () => {
    const file = await fixture();
    // WAV (PCM) doesn't need an encoder, so it works in every browser. MP3
    // encode would need libmp3lame which mediabunny doesn't bundle.
    const bytes = await extractAudio(file, { container: "wav" });
    expect(bytes.byteLength).toBeGreaterThan(0);
    const meta = await readMetadata(new Blob([bytes as BlobPart], { type: "audio/wav" }));
    expect(meta.hasAudio).toBe(true);
    expect(meta.hasVideo).toBe(false);
  }, 60_000);
});

describe("compressVideo", () => {
  it("re-encodes with the supplied bitrate", async () => {
    const file = await fixture();
    const bytes = await compressVideo(file, {
      container: "mp4",
      videoBitrate: 300_000,
      audioBitrate: 64_000,
    });
    expect(bytes.byteLength).toBeGreaterThan(0);
  }, 60_000);
});
