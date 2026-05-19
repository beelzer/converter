import { test, expect } from "@playwright/test";
import { zipSync, gzipSync } from "fflate";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";

async function writeTmp(name: string, bytes: Uint8Array): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "arch-e2e-"));
  const filepath = path.join(dir, name);
  await fs.writeFile(filepath, bytes);
  return filepath;
}

async function writeTmpText(name: string, body: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "arch-e2e-"));
  const filepath = path.join(dir, name);
  await fs.writeFile(filepath, body, "utf8");
  return filepath;
}

test.describe("Archive toolkit", () => {
  test("homepage lists Archive as live", async ({ page }) => {
    await page.goto("/");
    const card = page.getByRole("link").filter({ hasText: /^\s*Archive\s/ });
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("href", "/archive");
  });

  test("/archive renders both tabs", async ({ page }) => {
    await page.goto("/archive/");
    await expect(page.getByRole("heading", { name: /Archive tools/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Create" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Extract" })).toBeVisible();
  });

  test("Create mode lists picked files and exposes format buttons", async ({ page }) => {
    const a = await writeTmpText("a.txt", "alpha");
    const b = await writeTmpText("b.txt", "beta");
    await page.goto("/archive/");
    await page.setInputFiles('input[type="file"]', [a, b]);
    await expect(page.getByText(/Files \(2\)/i)).toBeVisible();
    // The format pill buttons have exact label text.
    for (const label of ["ZIP", "TAR", "TAR.GZ", "GZIP"]) {
      await expect(page.getByRole("button", { name: label, exact: true })).toBeVisible();
    }
  });

  test("Extract mode auto-detects a ZIP and lists its contents", async ({ page }) => {
    const zipBytes = zipSync({
      "alpha.txt": new TextEncoder().encode("alpha"),
      "beta.txt": new TextEncoder().encode("beta"),
    });
    const zipPath = await writeTmp("sample.zip", zipBytes);
    await page.goto("/archive/");
    await page.getByRole("tab", { name: "Extract" }).click();
    await page.setInputFiles('input[type="file"]', zipPath);
    // Look for the file summary line that contains the format + count.
    await expect(page.getByText(/ZIP · 2 files/)).toBeVisible();
    await expect(page.getByText(/alpha\.txt/)).toBeVisible();
    await expect(page.getByText(/beta\.txt/)).toBeVisible();
  });

  test("Extract mode handles a GZIP single file", async ({ page }) => {
    const gz = gzipSync(new TextEncoder().encode("hello, gzip"));
    const gzPath = await writeTmp("note.txt.gz", gz);
    await page.goto("/archive/");
    await page.getByRole("tab", { name: "Extract" }).click();
    await page.setInputFiles('input[type="file"]', gzPath);
    await expect(page.getByText(/GZIP · 1 file/)).toBeVisible();
    await expect(page.getByText(/^note\.txt$/)).toBeVisible();
  });

  test("Extract mode rejects a non-archive", async ({ page }) => {
    const txtPath = await writeTmpText("just-text.txt", "not an archive");
    await page.goto("/archive/");
    await page.getByRole("tab", { name: "Extract" }).click();
    await page.setInputFiles('input[type="file"]', txtPath);
    await expect(page.getByText(/Unrecognised archive format/)).toBeVisible();
  });
});
