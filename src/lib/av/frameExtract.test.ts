import { describe, expect, it } from "vitest";
import { extractFrame, extractFrames } from "./frameExtract";
import clipMp4Url from "../../../e2e/fixtures/av/clip.mp4?url";
import audioMp3Url from "../../../e2e/fixtures/av/audio.mp3?url";

async function fetchAsFile(url: string, name: string, type: string): Promise<File> {
  const res = await fetch(url);
  return new File([await res.arrayBuffer()], name, { type });
}

describe("extractFrame — single frame", () => {
  it("extracts a frame as PNG at timestamp 0", async () => {
    const file = await fetchAsFile(clipMp4Url, "clip.mp4", "video/mp4");
    const frame = await extractFrame(file, 0, { format: "png" });
    expect(frame.blob.type).toBe("image/png");
    expect(frame.blob.size).toBeGreaterThan(0);
    expect(frame.width).toBeGreaterThan(0);
    expect(frame.height).toBeGreaterThan(0);
  }, 30_000);

  it("extracts a JPEG frame at a non-zero timestamp", async () => {
    const file = await fetchAsFile(clipMp4Url, "clip.mp4", "video/mp4");
    const frame = await extractFrame(file, 1, { format: "jpeg", quality: 0.85 });
    expect(frame.blob.type).toBe("image/jpeg");
    expect(frame.timestamp).toBeGreaterThan(0);
  }, 30_000);

  it("scales the output frame when width/height are provided", async () => {
    const file = await fetchAsFile(clipMp4Url, "clip.mp4", "video/mp4");
    const frame = await extractFrame(file, 0, { format: "png", width: 100 });
    expect(frame.width).toBe(100);
  }, 30_000);

  it("rejects extraction from an audio-only file", async () => {
    const file = await fetchAsFile(audioMp3Url, "audio.mp3", "audio/mpeg");
    await expect(extractFrame(file, 0, { format: "png" })).rejects.toThrow(/no video/);
  }, 30_000);
});

describe("extractFrames — multi-frame", () => {
  it("extracts N evenly-spaced frames when given count", async () => {
    const file = await fetchAsFile(clipMp4Url, "clip.mp4", "video/mp4");
    const frames = await extractFrames(file, { format: "png", count: 3 });
    expect(frames.length).toBe(3);
    // Timestamps should be in ascending order.
    expect(frames[1].timestamp).toBeGreaterThan(frames[0].timestamp);
    expect(frames[2].timestamp).toBeGreaterThan(frames[1].timestamp);
  }, 60_000);

  it("respects an fps option", async () => {
    const file = await fetchAsFile(clipMp4Url, "clip.mp4", "video/mp4");
    const frames = await extractFrames(file, { format: "jpeg", fps: 1 });
    expect(frames.length).toBeGreaterThan(0);
  }, 60_000);

  it("calls onProgress at least once per frame", async () => {
    const file = await fetchAsFile(clipMp4Url, "clip.mp4", "video/mp4");
    const updates: number[] = [];
    await extractFrames(file, {
      format: "png",
      count: 2,
      onProgress: (p) => updates.push(p),
    });
    expect(updates.length).toBeGreaterThanOrEqual(2);
  }, 60_000);
});
