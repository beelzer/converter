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

test.describe("PDF organizer", () => {
  test("saves the source unchanged when no edits are made", async ({ page }) => {
    const sourcePath = await writeTempPdf("org", await makeFixturePdf("org", 3));

    await page.goto("/pdf-organizer/");
    await expect(
      page.getByRole("heading", { name: /Reorder and delete PDF pages/i })
    ).toBeVisible();

    await page.setInputFiles('input[type="file"]', sourcePath);
    await expect(
      page.getByRole("button", { name: /Delete page 1/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Delete page 2/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Delete page 3/i })
    ).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Save & download/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("org-organized.pdf");

    const outPath = path.join(os.tmpdir(), `converter-e2e-org-${Date.now()}.pdf`);
    await download.saveAs(outPath);
    const saved = await PDFDocument.load(await fs.readFile(outPath));
    expect(saved.getPageCount()).toBe(3);
  });

  test("deletes a page and saves the remaining pages", async ({ page }) => {
    const sourcePath = await writeTempPdf("del", await makeFixturePdf("del", 4));

    await page.goto("/pdf-organizer/");
    await page.setInputFiles('input[type="file"]', sourcePath);

    // Delete page 2 (the second card).
    await page.getByRole("button", { name: /Delete page 2/i }).click();

    // Now only 3 cards remain.
    await expect(page.getByRole("button", { name: /Delete page 1/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Delete page 3/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Delete page 4/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Delete page 2/i })).toHaveCount(0);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Save & download/i }).click();
    const download = await downloadPromise;

    const outPath = path.join(os.tmpdir(), `converter-e2e-org-del-${Date.now()}.pdf`);
    await download.saveAs(outPath);
    const saved = await PDFDocument.load(await fs.readFile(outPath));
    expect(saved.getPageCount()).toBe(3);

    await expect(page.getByText(/Saved 3 pages/i)).toBeVisible();
  });

  test("homepage lists the page organizer as live", async ({ page }) => {
    await page.goto("/");
    const card = page.getByRole("link", { name: /PDF page organizer/i });
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("href", "/pdf-organizer");
  });
});
