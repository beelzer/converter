import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { unzipSync } from "fflate";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEUlEQVR4nGP8z8DwHwQYGRgAFKEDA1f+gjwAAAAASUVORK5CYII=";

async function makeFixturePdf(label: string, pages = 1): Promise<Uint8Array> {
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

async function writeFixture(name: string, base64: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "converter-e2e-"));
  const filepath = path.join(dir, name);
  await fs.writeFile(filepath, Buffer.from(base64, "base64"));
  return filepath;
}

test.describe("PDF toolkit", () => {
  test("homepage lists PDF tools as live", async ({ page }) => {
    await page.goto("/");
    const card = page.getByRole("link", { name: /PDF/i }).first();
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("href", "/pdf");
  });

  test("loads with Merge mode active and merges two PDFs", async ({ page }) => {
    const pdf1 = await writeTempPdf("alpha", await makeFixturePdf("alpha", 1));
    const pdf2 = await writeTempPdf("bravo", await makeFixturePdf("bravo", 2));

    await page.goto("/pdf/");
    await expect(page.getByRole("heading", { name: /PDF tools/i })).toBeVisible();

    // Merge tab is selected by default.
    await expect(page.getByRole("tab", { name: /^Merge$/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await page.setInputFiles('input[type="file"]', [pdf1, pdf2]);
    await expect(page.getByRole("button", { name: /Move .* down/i })).toHaveCount(2);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Merge & download/i }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe("alpha-merged.pdf");

    const outPath = path.join(os.tmpdir(), `e2e-merge-${Date.now()}.pdf`);
    await download.saveAs(outPath);
    const merged = await PDFDocument.load(await fs.readFile(outPath));
    expect(merged.getPageCount()).toBe(3);
  });

  test("switches to Split mode and extracts a page range", async ({ page }) => {
    const source = await writeTempPdf("src", await makeFixturePdf("src", 10));

    await page.goto("/pdf/");
    await page.getByRole("tab", { name: /^Split$/ }).click();
    await expect(page.getByRole("tab", { name: /^Split$/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await page.setInputFiles('input[type="file"]', source);
    await expect(page.getByText(/10 pages/i)).toBeVisible();

    await page.getByLabel(/Pages to extract/i).fill("2-4, 7");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Extract & download/i }).click();
    const download = await downloadPromise;

    const outPath = path.join(os.tmpdir(), `e2e-split-${Date.now()}.pdf`);
    await download.saveAs(outPath);
    const result = await PDFDocument.load(await fs.readFile(outPath));
    expect(result.getPageCount()).toBe(4);
  });

  test("switches to Rotate mode and rotates every page 90°", async ({ page }) => {
    const source = await writeTempPdf("rot", await makeFixturePdf("rot", 3));

    await page.goto("/pdf/");
    await page.getByRole("tab", { name: /^Rotate$/ }).click();

    await page.setInputFiles('input[type="file"]', source);
    await expect(page.getByText(/3 pages/i)).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Rotate & download/i }).click();
    const download = await downloadPromise;

    const outPath = path.join(os.tmpdir(), `e2e-rotate-${Date.now()}.pdf`);
    await download.saveAs(outPath);
    const result = await PDFDocument.load(await fs.readFile(outPath));
    for (const p of result.getPages()) {
      expect(p.getRotation().angle).toBe(90);
    }
  });

  test("switches to Images → PDF and builds a PDF from PNGs", async ({ page }) => {
    const png1 = await writeFixture("a.png", TINY_PNG_BASE64);
    const png2 = await writeFixture("b.png", TINY_PNG_BASE64);

    await page.goto("/pdf/");
    await page.getByRole("tab", { name: /Images → PDF/i }).click();

    await page.setInputFiles('input[type="file"]', [png1, png2]);
    await expect(page.getByRole("button", { name: /Move .* down/i })).toHaveCount(2);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Build PDF/i }).click();
    const download = await downloadPromise;

    const outPath = path.join(os.tmpdir(), `e2e-img2pdf-${Date.now()}.pdf`);
    await download.saveAs(outPath);
    const result = await PDFDocument.load(await fs.readFile(outPath));
    expect(result.getPageCount()).toBe(2);
  });

  test("switches to PDF → Images and renders a multi-page PDF as ZIP", async ({
    page,
  }) => {
    const source = await writeTempPdf("multi", await makeFixturePdf("multi", 3));

    await page.goto("/pdf/");
    await page.getByRole("tab", { name: /PDF → Images/i }).click();

    await page.setInputFiles('input[type="file"]', source);
    await expect(page.getByText(/3 pages/i)).toBeVisible();

    await page.getByRole("button", { name: /^PNG$/ }).click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Convert & download/i }).click();
    const download = await downloadPromise;

    const outPath = path.join(os.tmpdir(), `e2e-pdf2img-${Date.now()}.zip`);
    await download.saveAs(outPath);
    const zip = await fs.readFile(outPath);
    const files = unzipSync(zip);
    expect(Object.keys(files).sort()).toEqual([
      "multi-page-1.png",
      "multi-page-2.png",
      "multi-page-3.png",
    ]);
  });

  test("Organize mode shows page cards for each source page", async ({ page }) => {
    const source = await writeTempPdf("org", await makeFixturePdf("org", 3));

    await page.goto("/pdf/");
    await page.getByRole("tab", { name: /^Organize$/ }).click();

    await page.setInputFiles('input[type="file"]', source);
    await expect(page.getByRole("button", { name: /Delete page 1/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Delete page 2/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Delete page 3/i })).toBeVisible();
  });
});
