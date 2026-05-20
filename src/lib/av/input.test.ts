import { describe, expect, it } from "vitest";
import { openInput, readMetadata } from "./input";
import clipMp4Url from "../../../e2e/fixtures/av/clip.mp4?url";
import audioMp3Url from "../../../e2e/fixtures/av/audio.mp3?url";

async function fetchAsFile(url: string, name: string, type: string): Promise<File> {
  const res = await fetch(url);
  return new File([await res.arrayBuffer()], name, { type });
}

describe("openInput", () => {
  it("returns a mediabunny Input wrapping a BlobSource", async () => {
    const file = await fetchAsFile(clipMp4Url, "clip.mp4", "video/mp4");
    const input = openInput(file);
    expect(input).toBeTruthy();
    expect(typeof (input as { computeDuration: unknown }).computeDuration).toBe("function");
    input.dispose?.();
  });
});

describe("readMetadata — video", () => {
  it("reports duration, dimensions, and codecs for an MP4", async () => {
    const file = await fetchAsFile(clipMp4Url, "clip.mp4", "video/mp4");
    const meta = await readMetadata(file);
    expect(meta.duration).toBeGreaterThan(0);
    expect(meta.hasVideo).toBe(true);
    expect(meta.width).toBeGreaterThan(0);
    expect(meta.height).toBeGreaterThan(0);
    expect(meta.videoCodec).toBeTruthy();
  }, 30_000);
});

describe("readMetadata — audio-only", () => {
  it("reports duration + audio codec for an MP3 (no video track)", async () => {
    const file = await fetchAsFile(audioMp3Url, "audio.mp3", "audio/mpeg");
    const meta = await readMetadata(file);
    expect(meta.duration).toBeGreaterThan(0);
    expect(meta.hasAudio).toBe(true);
    expect(meta.hasVideo).toBe(false);
    expect(meta.width).toBeNull();
    expect(meta.height).toBeNull();
    expect(meta.audioCodec).toBeTruthy();
    expect(meta.audioSampleRate).toBeGreaterThan(0);
  }, 30_000);
});
