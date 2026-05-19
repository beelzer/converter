import { test, expect } from "@playwright/test";
import { unzipSync } from "fflate";
import { PNG } from "pngjs";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { FIXTURES } from "./fixtures";

// Minimal SVG fixture.
const SVG_TEXT =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><rect width="100" height="50" fill="red"/></svg>';

function makePngBytes(width: number, height: number, rgb: [number, number, number]): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      png.data[idx] = rgb[0];
      png.data[idx + 1] = rgb[1];
      png.data[idx + 2] = rgb[2];
      png.data[idx + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

async function writePng(name: string, w: number, h: number, rgb: [number, number, number]): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "converter-e2e-"));
  const filepath = path.join(dir, name);
  await fs.writeFile(filepath, makePngBytes(w, h, rgb));
  return filepath;
}

async function writeTextFixture(name: string, body: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "converter-e2e-"));
  const filepath = path.join(dir, name);
  await fs.writeFile(filepath, body, "utf8");
  return filepath;
}

test.describe("Image toolkit", () => {
  test("homepage lists Image tools as live", async ({ page }) => {
    await page.goto("/");
    // The Image card link's accessible name includes the full card text.
    // Match on a substring instead of anchoring.
    const card = page.getByRole("link").filter({ hasText: /^\s*Image\s/ });
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("href", "/image");
  });

  test("Convert mode converts a PNG to JPG", async ({ page }) => {
    const png = await writePng("alpha.png", 4, 4, [255, 0, 0]);

    await page.goto("/image/");
    await expect(page.getByRole("heading", { name: /^Image tools/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Convert$/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await page.setInputFiles('input[type="file"]', png);
    await page.getByRole("button", { name: /Convert .* JPG/i }).click();

    const download = await page.waitForEvent("download");
    expect(download.suggestedFilename()).toBe("alpha.jpg");

    const outPath = path.join(os.tmpdir(), `e2e-img-conv-${Date.now()}.jpg`);
    await download.saveAs(outPath);
    const bytes = await fs.readFile(outPath);
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8);
  });

  test("Convert mode produces a ZIP when given multiple files", async ({ page }) => {
    const png1 = await writePng("a.png", 4, 4, [255, 0, 0]);
    const png2 = await writePng("b.png", 4, 4, [0, 255, 0]);

    await page.goto("/image/");
    await page.setInputFiles('input[type="file"]', [png1, png2]);
    // Pick PNG output so both files re-encode to the same target.
    await page.getByRole("button", { name: /^PNG$/ }).click();
    await page.getByRole("button", { name: /Convert .* PNG/i }).click();

    const download = await page.waitForEvent("download");
    const outPath = path.join(os.tmpdir(), `e2e-img-batch-${Date.now()}.zip`);
    await download.saveAs(outPath);
    const zip = await fs.readFile(outPath);
    const files = unzipSync(zip);
    expect(Object.keys(files).sort()).toEqual(["a.png", "b.png"]);
  });

  test("Resize mode shrinks an image to within bounds", async ({ page }) => {
    const png = await writePng("solo.png", 10, 10, [0, 0, 255]);

    await page.goto("/image/");
    await page.getByRole("tab", { name: /^Resize$/ }).click();

    await page.setInputFiles('input[type="file"]', png);
    await page.getByLabel(/Max width/i).fill("3");
    await page.getByLabel(/Max height/i).fill("3");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Resize & download/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("solo-3x3.png");
  });

  test("SVG mode rasterizes an SVG to PNG", async ({ page }) => {
    const svg = await writeTextFixture("logo.svg", SVG_TEXT);

    await page.goto("/image/");
    await page.getByRole("tab", { name: /SVG → Raster/ }).click();

    await page.setInputFiles('input[type="file"]', svg);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Rasterize & download/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("logo-1024x512.png");
  });

  test("Favicon mode generates a ZIP bundle", async ({ page }) => {
    const png = await writePng("brand.png", 64, 64, [128, 64, 200]);

    await page.goto("/image/");
    await page.getByRole("tab", { name: /^Favicon$/ }).click();

    await page.setInputFiles('input[type="file"]', png);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Generate & download/i }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe("favicon-bundle.zip");

    const outPath = path.join(os.tmpdir(), `e2e-favicon-${Date.now()}.zip`);
    await download.saveAs(outPath);
    const zip = await fs.readFile(outPath);
    const files = unzipSync(zip);
    expect(Object.keys(files)).toContain("favicon.ico");
    expect(Object.keys(files)).toContain("apple-touch-icon.png");
    expect(Object.keys(files)).toContain("site.webmanifest");
  });

  test("Convert mode converts a real WebP fixture to PNG", async ({ page }) => {
    await page.goto("/image/");
    await page.setInputFiles('input[type="file"]', FIXTURES.image.webp);
    await page.getByRole("button", { name: /^PNG$/ }).click();
    await page.getByRole("button", { name: /Convert .* PNG/i }).click();

    const dl = await page.waitForEvent("download");
    expect(dl.suggestedFilename()).toBe("sample.png");
    const outPath = path.join(os.tmpdir(), `e2e-webp2png-${Date.now()}.png`);
    await dl.saveAs(outPath);
    const bytes = await fs.readFile(outPath);
    // PNG signature
    expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  test("Convert mode converts a real animated GIF to PNG (first frame)", async ({
    page,
  }) => {
    await page.goto("/image/");
    await page.setInputFiles('input[type="file"]', FIXTURES.image.animatedGif);
    await page.getByRole("button", { name: /^PNG$/ }).click();
    await page.getByRole("button", { name: /Convert .* PNG/i }).click();

    const dl = await page.waitForEvent("download");
    expect(dl.suggestedFilename()).toBe("animated.png");
  });

  test("Resize mode shrinks the real gradient PNG to specific bounds", async ({
    page,
  }) => {
    await page.goto("/image/");
    await page.getByRole("tab", { name: /^Resize$/ }).click();
    await page.setInputFiles('input[type="file"]', FIXTURES.image.gradientPng);

    await page.getByLabel(/Max width/i).fill("50");
    await page.getByLabel(/Max height/i).fill("50");

    const dl = page.waitForEvent("download");
    await page.getByRole("button", { name: /Resize & download/i }).click();
    const download = await dl;
    // 200x150 source clamped to 50x50 bounds → preserves aspect → 50x38 (or 67x50).
    expect(download.suggestedFilename()).toMatch(/^gradient-\d+x\d+\.png$/);

    const outPath = path.join(os.tmpdir(), `e2e-real-resize-${Date.now()}.png`);
    await download.saveAs(outPath);
    const bytes = await fs.readFile(outPath);
    const png = PNG.sync.read(bytes);
    expect(png.width).toBeLessThanOrEqual(50);
    expect(png.height).toBeLessThanOrEqual(50);
  });

  test("SVG → Raster rasterizes the real fixture SVG", async ({ page }) => {
    await page.goto("/image/");
    await page.getByRole("tab", { name: /SVG → Raster/ }).click();
    await page.setInputFiles('input[type="file"]', FIXTURES.image.logoSvg);
    const dl = page.waitForEvent("download");
    await page.getByRole("button", { name: /Rasterize & download/i }).click();
    const download = await dl;
    // 200x100 viewBox doubled by default 1024 scale = 1024x512 (or so).
    expect(download.suggestedFilename()).toMatch(/^logo-\d+x\d+\.png$/);
  });

  test("Strip EXIF mode reads the EXIF tags from the fixture JPG", async ({ page }) => {
    await page.goto("/image/");
    await page.getByRole("tab", { name: /Strip EXIF/i }).click();
    await page.setInputFiles('input[type="file"]', FIXTURES.image.photoWithExifJpg);

    // The exif readout should surface the values we baked in.
    await expect(page.getByText(/tools\.dcln\.me/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Synthetic Fixture/)).toBeVisible();

    const dl = page.waitForEvent("download");
    await page.getByRole("button", { name: /Strip EXIF & download/i }).click();
    const download = await dl;
    expect(download.suggestedFilename()).toBe("photo-with-exif-no-exif.jpg");

    const outPath = path.join(os.tmpdir(), `e2e-real-noexif-${Date.now()}.jpg`);
    await download.saveAs(outPath);
    const bytes = await fs.readFile(outPath);
    // JPEG SOI
    expect([bytes[0], bytes[1]]).toEqual([0xff, 0xd8]);
    // The original camera-make string should no longer appear in the bytes.
    const haystack = bytes.toString("binary");
    expect(haystack).not.toContain("tools.dcln.me");
    expect(haystack).not.toContain("Synthetic Fixture");
  });

  test("Favicon mode emits a complete bundle from the real gradient PNG", async ({
    page,
  }) => {
    await page.goto("/image/");
    await page.getByRole("tab", { name: /^Favicon$/ }).click();
    await page.setInputFiles('input[type="file"]', FIXTURES.image.gradientPng);
    const dl = page.waitForEvent("download");
    await page.getByRole("button", { name: /Generate & download/i }).click();
    const download = await dl;
    expect(download.suggestedFilename()).toBe("favicon-bundle.zip");

    const outPath = path.join(os.tmpdir(), `e2e-real-favicon-${Date.now()}.zip`);
    await download.saveAs(outPath);
    const files = unzipSync(await fs.readFile(outPath));
    expect(Object.keys(files)).toContain("favicon.ico");
    expect(Object.keys(files)).toContain("apple-touch-icon.png");
    expect(Object.keys(files)).toContain("site.webmanifest");
  });

  test("Strip EXIF mode accepts a JPG and produces a JPG output", async ({ page }) => {
    // A real JPEG is needed here. The image converter has just produced one
    // for us in another test, but tests are independent — generate inline by
    // converting a tiny PNG to JPG via the convert flow, then re-uploading.
    //
    // Simpler path: drive the convert flow first, save the JPG to disk, then
    // feed it to the EXIF stripper. That keeps the spec self-contained without
    // needing a JPG encoder in Node.
    const png = await writePng("photo.png", 4, 4, [200, 100, 50]);

    await page.goto("/image/");
    await page.setInputFiles('input[type="file"]', png);
    await page.getByRole("button", { name: /Convert .* JPG/i }).click();
    const convertDownload = await page.waitForEvent("download");
    const jpgPath = path.join(os.tmpdir(), `e2e-img-exif-src-${Date.now()}.jpg`);
    await convertDownload.saveAs(jpgPath);

    await page.getByRole("tab", { name: /Strip EXIF/i }).click();
    await page.setInputFiles('input[type="file"]', jpgPath);

    await expect(
      page.getByRole("button", { name: /Strip EXIF & download/i })
    ).toBeEnabled();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Strip EXIF & download/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/-no-exif\.jpg$/);
  });
});
