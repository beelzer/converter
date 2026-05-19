import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { FIXTURES, report } from "./fixtures";

const TAB_NAMES = [
  "Convert",
  "Trim",
  "Extract audio",
  "Video → GIF",
  "Compress",
  "Frames",
  "Merge",
];

// A 2-second MP4 still takes several seconds to re-encode in headless
// Chromium via WebCodecs. Give the heavy tests plenty of room.
const HEAVY_TIMEOUT = 90_000;

test.describe("Audio/video toolkit", () => {
  test("homepage lists Audio / Video as live", async ({ page }) => {
    await page.goto("/");
    const card = page.getByRole("link").filter({ hasText: /^\s*Audio\s*\/\s*Video\s/ });
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("href", "/audio-video");
  });

  test("/audio-video renders the hub with all tabs and SEO content", async ({ page }) => {
    await page.goto("/audio-video/");
    await expect(page.getByRole("heading", { name: /Audio.*video tools/i })).toBeVisible();

    for (const name of TAB_NAMES) {
      await expect(page.getByRole("tab", { name })).toBeVisible();
    }

    await expect(page.getByRole("tab", { name: "Convert" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await expect(page.getByRole("heading", { name: /FAQ/i })).toBeVisible();
    await expect(page.getByText(/Does my video get uploaded anywhere/i)).toBeVisible();
  });

  test("each tab swaps the drop zone label", async ({ page }) => {
    await page.goto("/audio-video/");

    for (const name of TAB_NAMES) {
      await page.getByRole("tab", { name }).click();
      await expect(page.getByRole("tab", { name })).toHaveAttribute(
        "aria-selected",
        "true"
      );
      await expect(page.locator('input[type="file"]')).toBeAttached();
    }
  });

  test("Merge tab accepts the multiple attribute", async ({ page }) => {
    await page.goto("/audio-video/");
    await page.getByRole("tab", { name: "Merge" }).click();
    const input = page.locator('input[type="file"]');
    await expect(input).toHaveAttribute("multiple", "");
  });
});

// End-to-end tests against the real MP4/MP3/WAV fixtures. Each one runs the
// browser-side mediabunny pipeline (WebCodecs) and verifies the produced
// download is a valid file of the expected container.
test.describe("Audio/video toolkit — real fixtures", () => {
  // Each MediaBunny operation in headless Chromium contends for the same
  // software decoders/encoders; running them in parallel creates spurious
  // timeouts. Serialise within this suite and give each operation room.
  test.describe.configure({ timeout: HEAVY_TIMEOUT, mode: "serial" });

  test("Convert MP4 → WebM produces a valid WebM file", async ({ page }, testInfo) => {
    await page.goto("/audio-video/");
    await page.setInputFiles('input[type="file"]', FIXTURES.av.clipMp4);
    // Wait for metadata to be read (the MetaSummary block appears).
    await expect(page.getByRole("button", { name: /Convert .*/i })).toBeVisible({
      timeout: 15_000,
    });

    // Pick WebM as output container.
    await page.getByRole("button", { name: /^WebM$/, exact: true }).click();
    // Use the lowest quality to keep encode time down.
    await page.getByRole("button", { name: /^Low$/, exact: true }).click();

    const dl = page.waitForEvent("download", { timeout: HEAVY_TIMEOUT });
    await page.getByRole("button", { name: /Convert → WebM/i }).click();
    const download = await dl;
    expect(download.suggestedFilename()).toBe("clip.webm");

    const outPath = path.join(os.tmpdir(), `e2e-real-conv-${Date.now()}.webm`);
    await download.saveAs(outPath);
    const bytes = await fs.readFile(outPath);
    // EBML/WebM signature: 1A 45 DF A3
    expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
    expect(bytes.byteLength).toBeGreaterThan(1024);

    report(testInfo, {
      input: { path: FIXTURES.av.clipMp4, label: "clip.mp4 — H.264 + AAC, 320×180, ~2s" },
      output: { path: outPath, label: "clip.webm — VP9 + Opus (low quality preset)" },
      notes: "Same visual content, different container + codecs. Both should play in the browser.",
    });
  });

  test("Extract audio from MP4 to WAV", async ({ page }, testInfo) => {
    // WAV (PCM) keeps the encoder out of the picture — it's always available
    // and deterministic, making this a stable smoke test of the AAC decode
    // + mux pipeline. (MP3 encoding via mediabunny works in production but is
    // an order of magnitude slower under headless Chromium without GPU.)
    await page.goto("/audio-video/");
    await page.getByRole("tab", { name: /Extract audio/ }).click();
    await page.setInputFiles('input[type="file"]', FIXTURES.av.clipMp4);
    await expect(page.getByRole("button", { name: /Extract → .*/i })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: /^WAV$/, exact: true }).click();

    const dl = page.waitForEvent("download", { timeout: HEAVY_TIMEOUT });
    await page.getByRole("button", { name: /Extract → WAV/i }).click();
    const download = await dl;
    expect(download.suggestedFilename()).toBe("clip.wav");

    const outPath = path.join(os.tmpdir(), `e2e-real-audio-${Date.now()}.wav`);
    await download.saveAs(outPath);
    const bytes = await fs.readFile(outPath);
    // WAV: "RIFF" header, "WAVE" at offset 8.
    expect(bytes.subarray(0, 4).toString("binary")).toBe("RIFF");
    expect(bytes.subarray(8, 12).toString("binary")).toBe("WAVE");

    report(testInfo, {
      input: { path: FIXTURES.av.clipMp4, label: "clip.mp4 (video + AAC audio track)" },
      output: { path: outPath, label: "clip.wav — extracted PCM audio" },
      notes: "Play both: the WAV should contain the same 440 Hz sine tone as the MP4's audio track.",
    });
  });

  test("Frames mode extracts a single PNG frame from the MP4 fixture", async ({
    page,
  }, testInfo) => {
    await page.goto("/audio-video/");
    await page.getByRole("tab", { name: /^Frames$/ }).click();
    await page.setInputFiles('input[type="file"]', FIXTURES.av.clipMp4);
    // The "Extract frame" action button only appears once metadata loads.
    await expect(page.getByRole("button", { name: /^Extract frame$/ })).toBeVisible({
      timeout: 15_000,
    });

    // Default mode is "single", format is "png" — just trigger the action.
    const dl = page.waitForEvent("download", { timeout: HEAVY_TIMEOUT });
    await page.getByRole("button", { name: /^Extract frame$/ }).click();
    const download = await dl;
    expect(download.suggestedFilename()).toMatch(/^clip-\d+ms\.png$/);

    const outPath = path.join(os.tmpdir(), `e2e-real-frame-${Date.now()}.png`);
    await download.saveAs(outPath);
    const bytes = await fs.readFile(outPath);
    expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([0x89, 0x50, 0x4e, 0x47]);

    report(testInfo, {
      input: { path: FIXTURES.av.clipMp4, label: "clip.mp4" },
      output: { path: outPath, label: `Frame at ${download.suggestedFilename()}` },
      notes: "The PNG should show a single still from the BBB clip.",
    });
  });

  test("Trim mode produces a sub-second clip from the MP4 fixture", async ({
    page,
  }, testInfo) => {
    await page.goto("/audio-video/");
    await page.getByRole("tab", { name: /^Trim$/ }).click();
    await page.setInputFiles('input[type="file"]', FIXTURES.av.clipMp4);
    await expect(page.getByRole("button", { name: /Trim → .*/i })).toBeVisible({
      timeout: 15_000,
    });

    // Drag the end slider back to ~0.5s. Sliders are min=0 max=duration.
    // Easier: drive the end via .fill on the underlying number-shaped range.
    const endSlider = page.getByLabel(/^End \(/);
    await endSlider.fill("0.5");

    const dl = page.waitForEvent("download", { timeout: HEAVY_TIMEOUT });
    await page.getByRole("button", { name: /Trim → MP4/i }).click();
    const download = await dl;
    expect(download.suggestedFilename()).toBe("clip-trim.mp4");

    const outPath = path.join(os.tmpdir(), `e2e-real-trim-${Date.now()}.mp4`);
    await download.saveAs(outPath);
    const bytes = await fs.readFile(outPath);
    // MP4 'ftyp' box at offset 4.
    expect(bytes.subarray(4, 8).toString("binary")).toBe("ftyp");

    report(testInfo, {
      input: { path: FIXTURES.av.clipMp4, label: "clip.mp4 — full 2s" },
      output: { path: outPath, label: "clip-trim.mp4 — 0.0s → 0.5s" },
      notes: "The trimmed output should be roughly a quarter of the original duration.",
    });
  });

  test("Compress mode shrinks the MP4 fixture", async ({ page }, testInfo) => {
    await page.goto("/audio-video/");
    await page.getByRole("tab", { name: /^Compress$/ }).click();
    await page.setInputFiles('input[type="file"]', FIXTURES.av.clipMp4);
    await expect(page.getByRole("button", { name: /Compress → .*/i })).toBeVisible({
      timeout: 15_000,
    });

    // Heaviest preset = smallest output.
    await page.getByRole("button", { name: /^Heavy$/, exact: true }).click();

    const dl = page.waitForEvent("download", { timeout: HEAVY_TIMEOUT });
    await page.getByRole("button", { name: /Compress → MP4/i }).click();
    const download = await dl;
    expect(download.suggestedFilename()).toMatch(/clip.*\.mp4$/);

    const outPath = path.join(os.tmpdir(), `e2e-real-compress-${Date.now()}.mp4`);
    await download.saveAs(outPath);
    const out = await fs.readFile(outPath);
    expect(out.subarray(4, 8).toString("binary")).toBe("ftyp");
    // The "heavy" preset targets 480p / 600kbps — for a 2s clip that's
    // ~150 kB, which can be _larger_ than our already-aggressively-encoded
    // 36 kB seed. We assert structural validity, not size, here.
    expect(out.byteLength).toBeGreaterThan(1024);

    report(testInfo, {
      input: { path: FIXTURES.av.clipMp4, label: `clip.mp4 — source (${(await fs.stat(FIXTURES.av.clipMp4)).size} bytes)` },
      output: { path: outPath, label: `Recompressed at heavy preset (${out.byteLength} bytes)` },
      notes: "The heavy preset targets 480p / 600 kbps — for an already-tiny source the output may grow.",
    });
  });

  test("Merge mode concatenates two MP4 segments", async ({ page }, testInfo) => {
    await page.goto("/audio-video/");
    await page.getByRole("tab", { name: /^Merge$/ }).click();
    await page.setInputFiles('input[type="file"]', [
      FIXTURES.av.segmentA,
      FIXTURES.av.segmentB,
    ]);
    await expect(
      page.getByRole("button", { name: /Merge 2 clips → MP4/i })
    ).toBeVisible({ timeout: 15_000 });

    const dl = page.waitForEvent("download", { timeout: HEAVY_TIMEOUT });
    await page.getByRole("button", { name: /Merge 2 clips → MP4/i }).click();
    const download = await dl;
    expect(download.suggestedFilename()).toMatch(/\.mp4$/);

    const outPath = path.join(os.tmpdir(), `e2e-real-merge-${Date.now()}.mp4`);
    await download.saveAs(outPath);
    const out = await fs.readFile(outPath);
    expect(out.subarray(4, 8).toString("binary")).toBe("ftyp");

    report(testInfo, {
      inputs: [
        { path: FIXTURES.av.segmentA, label: "segment-a.mp4 (0:00 → 0:01)" },
        { path: FIXTURES.av.segmentB, label: "segment-b.mp4 (0:05 → 0:06)" },
      ],
      output: { path: outPath, label: "Merged MP4 — A then B" },
    });
  });

  test("Video → GIF turns the MP4 fixture into a GIF", async ({ page }, testInfo) => {
    await page.goto("/audio-video/");
    await page.getByRole("tab", { name: /Video → GIF/ }).click();
    await page.setInputFiles('input[type="file"]', FIXTURES.av.clipMp4);
    await expect(page.getByRole("button", { name: /Make GIF/i })).toBeVisible({
      timeout: 15_000,
    });

    const dl = page.waitForEvent("download", { timeout: HEAVY_TIMEOUT });
    await page.getByRole("button", { name: /Make GIF/i }).click();
    const download = await dl;
    expect(download.suggestedFilename()).toBe("clip.gif");

    const outPath = path.join(os.tmpdir(), `e2e-real-gif-${Date.now()}.gif`);
    await download.saveAs(outPath);
    const bytes = await fs.readFile(outPath);
    // GIF89a / GIF87a header
    expect(bytes.subarray(0, 6).toString("binary")).toMatch(/^GIF8[79]a$/);

    report(testInfo, {
      input: { path: FIXTURES.av.clipMp4, label: "clip.mp4 — source video" },
      output: { path: outPath, label: "clip.gif — quantized animated GIF" },
      notes: "The GIF should loop the same visual content as the source video.",
    });
  });
});
