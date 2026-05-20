import { describe, expect, it } from "vitest";
import {
  ACCEPT_AUDIO,
  ACCEPT_MEDIA,
  ACCEPT_VIDEO,
  AUDIO_CONTAINERS,
  AUDIO_CONTAINER_LABEL,
  VIDEO_CONTAINERS,
  VIDEO_CONTAINER_LABEL,
  audioContainerOutput,
  extensionFor,
  formatDuration,
  mimeForAudio,
  mimeForVideo,
  videoContainerOutput,
} from "./formats";

describe("AV container catalog", () => {
  it("lists the supported video containers", () => {
    expect(VIDEO_CONTAINERS).toEqual(["mp4", "webm", "mkv", "mov"]);
  });

  it("lists the supported audio containers", () => {
    expect(AUDIO_CONTAINERS).toEqual(["mp3", "wav", "aac", "flac", "ogg"]);
  });

  it("has a label and mime for every video container", () => {
    for (const c of VIDEO_CONTAINERS) {
      expect(VIDEO_CONTAINER_LABEL[c]).toBeTruthy();
      expect(mimeForVideo(c)).toMatch(/^video\//);
    }
  });

  it("has a label and mime for every audio container", () => {
    for (const c of AUDIO_CONTAINERS) {
      expect(AUDIO_CONTAINER_LABEL[c]).toBeTruthy();
      expect(mimeForAudio(c)).toMatch(/^audio\//);
    }
  });

  it("extensionFor returns the container name unchanged", () => {
    expect(extensionFor("mp4")).toBe("mp4");
    expect(extensionFor("flac")).toBe("flac");
  });

  it("ACCEPT_MEDIA is the union of audio + video", () => {
    expect(ACCEPT_MEDIA).toContain(ACCEPT_VIDEO);
    expect(ACCEPT_MEDIA).toContain(ACCEPT_AUDIO);
  });
});

describe("videoContainerOutput / audioContainerOutput", () => {
  it("returns a mediabunny OutputFormat instance for every video container", () => {
    for (const c of VIDEO_CONTAINERS) {
      const fmt = videoContainerOutput(c);
      expect(fmt).toBeTruthy();
      expect(typeof fmt).toBe("object");
    }
  });

  it("returns a mediabunny OutputFormat instance for every audio container", () => {
    for (const c of AUDIO_CONTAINERS) {
      const fmt = audioContainerOutput(c);
      expect(fmt).toBeTruthy();
    }
  });
});

describe("formatDuration", () => {
  it("formats seconds as M:SS for under-an-hour durations", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(5)).toBe("0:05");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(1234)).toBe("20:34");
  });

  it("includes hours when the duration exceeds 3600 seconds", () => {
    expect(formatDuration(3600)).toBe("1:00:00");
    expect(formatDuration(3661)).toBe("1:01:01");
    expect(formatDuration(7325)).toBe("2:02:05");
  });

  it("renders nonsense input as 0:00", () => {
    expect(formatDuration(NaN)).toBe("0:00");
    expect(formatDuration(-5)).toBe("0:00");
    expect(formatDuration(Infinity)).toBe("0:00");
  });
});
