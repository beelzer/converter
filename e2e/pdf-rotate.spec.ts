import { test, expect } from "@playwright/test";
import { PDFDocument, degrees } from "pdf-lib";
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

test.describe("PDF rotate", () => {
  test("rotates every page 90° clockwise by default", async ({ page }) => {
    const sourcePath = await writeTempPdf("rot-all", await makeFixturePdf("rot-all", 3));

    await page.goto("/pdf-rotate/");

    await expect(
      page.getByRole("heading", { name: /Rotate PDF pages in your browser/i })
    ).toBeVisible();

    await page.setInputFiles('input[type="file"]', sourcePath);
    await expect(page.getByText(/3 pages/i)).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Rotate & download/i }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe("rot-all-rotated.pdf");

    const outPath = path.join(os.tmpdir(), `converter-e2e-rotate-${Date.now()}.pdf`);
    await download.saveAs(outPath);

    const rotatedBytes = await fs.readFile(outPath);
    const rotated = await PDFDocument.load(rotatedBytes);
    expect(rotated.getPageCount()).toBe(3);
    for (const p of rotated.getPages()) {
      expect(p.getRotation().angle).toBe(90);
    }
    await expect(page.getByText(/Rotated 3 of 3 pages/i)).toBeVisible();
  });

  test("rotates only specified pages when a range is given", async ({ page }) => {
    const sourcePath = await writeTempPdf("rot-range", await makeFixturePdf("rot-range", 5));

    await page.goto("/pdf-rotate/");
    await page.setInputFiles('input[type="file"]', sourcePath);
    await expect(page.getByText(/5 pages/i)).toBeVisible();

    // Pick 180° and target only pages 2 and 4.
    await page.getByRole("button", { name: /180° clockwise/i }).click();
    await page.getByLabel(/Which pages/i).fill("2, 4");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Rotate & download/i }).click();
    const download = await downloadPromise;

    const outPath = path.join(os.tmpdir(), `converter-e2e-rotate-range-${Date.now()}.pdf`);
    await download.saveAs(outPath);

    const rotated = await PDFDocument.load(await fs.readFile(outPath));
    const angles = rotated.getPages().map((p) => p.getRotation().angle);
    expect(angles).toEqual([0, 180, 0, 180, 0]);

    await expect(page.getByText(/Rotated 2 of 5 pages/i)).toBeVisible();
  });

  test("homepage lists the PDF rotate tool as live", async ({ page }) => {
    await page.goto("/");
    const card = page.getByRole("link", { name: /PDF rotate/i });
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("href", "/pdf-rotate");
  });
});

// Reference `degrees` so its import is not pruned in some setups.
void degrees;
