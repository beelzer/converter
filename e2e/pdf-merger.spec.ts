import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";

async function makeFixturePdf(label: string, pages = 1): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([612, 792]);
    page.drawText(`${label} — page ${i + 1}`, { x: 50, y: 700, size: 24 });
  }
  return await doc.save();
}

async function writeTempPdf(name: string, bytes: Uint8Array): Promise<string> {
  // Each fixture lives in its own tmp subdir so basenames stay stable (no timestamp
  // suffix) — the widget's filename-derivation logic uses the basename.
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "converter-e2e-"));
  const filepath = path.join(dir, `${name}.pdf`);
  await fs.writeFile(filepath, bytes);
  return filepath;
}

test.describe("PDF merger", () => {
  test("merges two PDFs into one with the combined page count", async ({ page }) => {
    // Generate fixtures at runtime — no binary files in the repo.
    const pdf1 = await writeTempPdf("alpha", await makeFixturePdf("alpha", 1));
    const pdf2 = await writeTempPdf("bravo", await makeFixturePdf("bravo", 2));

    await page.goto("/pdf-merger/");

    // Heading is present (also acts as a wait-for-hydration sanity check).
    await expect(
      page.getByRole("heading", { name: /Merge PDF files in your browser/i })
    ).toBeVisible();

    // Attach via the hidden input — drag-drop is harder to simulate cross-browser.
    await page.setInputFiles('input[type="file"]', [pdf1, pdf2]);

    // Queue should now show 2 items (each row has a Move-down button per accessibility rules).
    await expect(page.getByRole("button", { name: /Move .* down/i })).toHaveCount(2);

    // Capture the download triggered by the merge button.
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Merge & download/i }).click();
    const download = await downloadPromise;

    // Filename should be derived from the first input's basename.
    expect(download.suggestedFilename()).toBe("alpha-merged.pdf");

    // Save the downloaded blob and verify the page count matches our fixtures (1 + 2 = 3).
    const outPath = path.join(os.tmpdir(), `converter-e2e-merged-${Date.now()}.pdf`);
    await download.saveAs(outPath);

    const mergedBytes = await fs.readFile(outPath);
    const merged = await PDFDocument.load(mergedBytes);
    expect(merged.getPageCount()).toBe(3);

    // ARIA live region surfaced the success state.
    await expect(page.getByText(/Merged 3 pages/i)).toBeVisible();
  });

  test("shows the privacy hero copy above the fold", async ({ page }) => {
    await page.goto("/pdf-merger/");
    await expect(page.getByText(/Stays on your device\. Nothing is uploaded\./i)).toBeVisible();
  });

  test("homepage lists the PDF merger as live", async ({ page }) => {
    await page.goto("/");
    const card = page.getByRole("link", { name: /PDF merger/i });
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("href", "/pdf-merger");
  });
});
