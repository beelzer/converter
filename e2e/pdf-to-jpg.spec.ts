import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { unzipSync } from "fflate";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";

async function makeFixturePdf(label: string, pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([612, 792]);
    page.drawText(`${label} — page ${i + 1}`, { x: 50, y: 700, size: 24 });
  }
  return await doc.save();
}

async function writeTempPdf(name: string, bytes: Uint8Array): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "converter-e2e-"));
  const filepath = path.join(dir, `${name}.pdf`);
  await fs.writeFile(filepath, bytes);
  return filepath;
}

test.describe("PDF to image", () => {
  test("renders a single-page PDF directly as a JPG", async ({ page }) => {
    const sourcePath = await writeTempPdf("solo", await makeFixturePdf("solo", 1));

    await page.goto("/pdf-to-jpg/");
    await expect(
      page.getByRole("heading", { name: /Convert a PDF to JPG or PNG/i })
    ).toBeVisible();

    await page.setInputFiles('input[type="file"]', sourcePath);
    await expect(page.getByText(/1 pages/i)).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Convert & download/i }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe("solo-page-1.jpg");
    const outPath = path.join(os.tmpdir(), `converter-e2e-pdf2jpg-${Date.now()}.jpg`);
    await download.saveAs(outPath);
    const buf = await fs.readFile(outPath);
    // JPEG SOI marker — quick sanity check the bytes really are a JPG.
    expect(buf[0]).toBe(0xff);
    expect(buf[1]).toBe(0xd8);

    await expect(page.getByText(/Converted 1 page/i)).toBeVisible();
  });

  test("renders a multi-page PDF as a ZIP of PNGs", async ({ page }) => {
    const sourcePath = await writeTempPdf("multi", await makeFixturePdf("multi", 3));

    await page.goto("/pdf-to-jpg/");
    await page.setInputFiles('input[type="file"]', sourcePath);
    await expect(page.getByText(/3 pages/i)).toBeVisible();

    await page.getByRole("button", { name: /^PNG$/ }).click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Convert & download/i }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe("multi-png.zip");
    const outPath = path.join(os.tmpdir(), `converter-e2e-pdf2png-${Date.now()}.zip`);
    await download.saveAs(outPath);

    const zip = await fs.readFile(outPath);
    const files = unzipSync(zip);
    const names = Object.keys(files).sort();
    expect(names).toEqual([
      "multi-page-1.png",
      "multi-page-2.png",
      "multi-page-3.png",
    ]);
    // PNG signature on the first entry.
    const firstPng = files[names[0]];
    expect(firstPng[0]).toBe(0x89);
    expect(firstPng[1]).toBe(0x50);
    expect(firstPng[2]).toBe(0x4e);
    expect(firstPng[3]).toBe(0x47);

    await expect(page.getByText(/Converted 3 pages/i)).toBeVisible();
  });

  test("homepage lists the PDF → JPG tool as live", async ({ page }) => {
    await page.goto("/");
    const card = page.getByRole("link", { name: /PDF → JPG/i });
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("href", "/pdf-to-jpg");
  });
});
