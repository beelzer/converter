import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
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

test.describe("PDF splitter", () => {
  test("extracts a page range into a new PDF", async ({ page }) => {
    const sourcePath = await writeTempPdf("source", await makeFixturePdf("source", 10));

    await page.goto("/pdf-splitter/");

    await expect(
      page.getByRole("heading", { name: /Split a PDF in your browser/i })
    ).toBeVisible();

    await page.setInputFiles('input[type="file"]', sourcePath);

    // The page-count label appears once the file is read.
    await expect(page.getByText(/10 pages/i)).toBeVisible();

    // Default range pre-fills to the full doc; replace with a smaller range.
    const pagesInput = page.getByLabel(/Pages to extract/i);
    await pagesInput.fill("2-4, 7");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Extract & download/i }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe("source-pages.pdf");

    const outPath = path.join(os.tmpdir(), `converter-e2e-split-${Date.now()}.pdf`);
    await download.saveAs(outPath);

    const splitBytes = await fs.readFile(outPath);
    const split = await PDFDocument.load(splitBytes);
    // 2-4 = 3 pages, plus page 7 = 4 total.
    expect(split.getPageCount()).toBe(4);

    await expect(page.getByText(/Extracted 4 pages/i)).toBeVisible();
  });

  test("surfaces a clear error for an out-of-range page", async ({ page }) => {
    const sourcePath = await writeTempPdf("tiny", await makeFixturePdf("tiny", 3));

    await page.goto("/pdf-splitter/");
    await page.setInputFiles('input[type="file"]', sourcePath);
    await expect(page.getByText(/3 pages/i)).toBeVisible();

    await page.getByLabel(/Pages to extract/i).fill("1, 99");
    await page.getByRole("button", { name: /Extract & download/i }).click();

    await expect(page.getByText(/out of bounds/i)).toBeVisible();
  });

  test("homepage lists the PDF splitter as live", async ({ page }) => {
    await page.goto("/");
    const card = page.getByRole("link", { name: /PDF splitter/i });
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("href", "/pdf-splitter");
  });
});
