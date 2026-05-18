import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";

// A 2x2 PNG is the smallest reliable fixture we can generate without
// pulling in an image-encoding lib. Hand-crafted bytes for a 2x2 red square.
// (Built once with `sharp` and embedded — but doing it from a known-good base64
// here avoids any runtime dep.)
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEUlEQVR4nGP8z8DwHwQYGRgAFKEDA1f+gjwAAAAASUVORK5CYII=";

const TINY_JPG_BASE64 =
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAACAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKpgAH//2Q==";

async function writeFixture(
  name: string,
  base64: string
): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "converter-e2e-"));
  const filepath = path.join(dir, name);
  await fs.writeFile(filepath, Buffer.from(base64, "base64"));
  return filepath;
}

test.describe("Images to PDF", () => {
  test("builds a PDF from a PNG and a JPG", async ({ page }) => {
    const pngPath = await writeFixture("alpha.png", TINY_PNG_BASE64);
    const jpgPath = await writeFixture("bravo.jpg", TINY_JPG_BASE64);

    await page.goto("/images-to-pdf/");
    await expect(
      page.getByRole("heading", { name: /Combine images into a PDF/i })
    ).toBeVisible();

    await page.setInputFiles('input[type="file"]', [pngPath, jpgPath]);
    await expect(page.getByRole("button", { name: /Move .* down/i })).toHaveCount(2);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Build PDF/i }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe("alpha.pdf");

    const outPath = path.join(os.tmpdir(), `converter-e2e-imgpdf-${Date.now()}.pdf`);
    await download.saveAs(outPath);
    const result = await PDFDocument.load(await fs.readFile(outPath));
    expect(result.getPageCount()).toBe(2);

    await expect(page.getByText(/Built 2 pages/i)).toBeVisible();
  });

  test("homepage lists Images → PDF as live", async ({ page }) => {
    await page.goto("/");
    const card = page.getByRole("link", { name: /Images → PDF/i });
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("href", "/images-to-pdf");
  });
});
