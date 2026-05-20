import { describe, expect, it } from "vitest";
import { videoToGif } from "./videoToGif";
import clipMp4Url from "../../../e2e/fixtures/av/clip.mp4?url";
import audioMp3Url from "../../../e2e/fixtures/av/audio.mp3?url";

async function fetchAsFile(url: string, name: string, type: string): Promise<File> {
  const res = await fetch(url);
  return new File([await res.arrayBuffer()], name, { type });
}

describe("videoToGif", () => {
  it("produces GIF bytes with the magic 'GIF89a' header", async () => {
    const file = await fetchAsFile(clipMp4Url, "clip.mp4", "video/mp4");
    const bytes = await videoToGif(file, { fps: 8, width: 160 });
    expect(bytes.byteLength).toBeGreaterThan(0);
    const head = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5]);
    expect(head).toMatch(/^GIF8/);
  }, 60_000);

  it("honours a start + end range and fps", async () => {
    const file = await fetchAsFile(clipMp4Url, "clip.mp4", "video/mp4");
    const short = await videoToGif(file, { fps: 4, start: 0, end: 0.5, width: 80 });
    const long = await videoToGif(file, { fps: 4, start: 0, end: 1.0, width: 80 });
    expect(long.byteLength).toBeGreaterThanOrEqual(short.byteLength);
  }, 60_000);

  it("rejects files with no video track", async () => {
    const file = await fetchAsFile(audioMp3Url, "audio.mp3", "audio/mpeg");
    await expect(videoToGif(file)).rejects.toThrow(/no video/);
  }, 30_000);

  it("rejects end-before-start ranges", async () => {
    const file = await fetchAsFile(clipMp4Url, "clip.mp4", "video/mp4");
    await expect(videoToGif(file, { start: 1, end: 0.5 })).rejects.toThrow(/End time/);
  }, 30_000);

  it("reports progress per frame", async () => {
    const file = await fetchAsFile(clipMp4Url, "clip.mp4", "video/mp4");
    const updates: number[] = [];
    await videoToGif(file, {
      fps: 4,
      start: 0,
      end: 0.5,
      width: 80,
      onProgress: (p) => updates.push(p),
    });
    expect(updates.length).toBeGreaterThan(0);
    expect(updates[updates.length - 1]).toBeCloseTo(1, 2);
  }, 60_000);
});
