import { test, expect } from "@playwright/test";
import { zipSync, gzipSync, unzipSync } from "fflate";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { FIXTURES } from "./fixtures";

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

test.describe("Archive toolkit — real fixtures", () => {
  test("Extract a real ZIP and download all to a re-ZIP", async ({ page }) => {
    await page.goto("/archive/");
    await page.getByRole("tab", { name: "Extract" }).click();
    await page.setInputFiles('input[type="file"]', FIXTURES.archive.zip);

    // Three real files were committed: data.json, notes.md, readme.txt.
    await expect(page.getByText(/ZIP · 3 files/)).toBeVisible();
    for (const name of ["readme.txt", "data.json", "notes.md"]) {
      await expect(page.getByText(new RegExp(`^${name}$`))).toBeVisible();
    }

    const dl = page.waitForEvent("download");
    await page.getByRole("button", { name: /Download all/i }).click();
    const download = await dl;
    expect(download.suggestedFilename()).toBe("files-extracted.zip");

    const outPath = path.join(os.tmpdir(), `e2e-real-zip-${Date.now()}.zip`);
    await download.saveAs(outPath);
    const round = unzipSync(await fs.readFile(outPath));
    expect(Object.keys(round).sort()).toEqual(["data.json", "notes.md", "readme.txt"]);
  });

  test("Extract a real TAR.GZ archive and list its files", async ({ page }) => {
    await page.goto("/archive/");
    await page.getByRole("tab", { name: "Extract" }).click();
    await page.setInputFiles('input[type="file"]', FIXTURES.archive.tarGz);

    await expect(page.getByText(/TAR\.GZ · 3 files/)).toBeVisible();
    for (const name of ["readme.txt", "data.json", "notes.md"]) {
      await expect(page.getByText(new RegExp(`^${name}$`))).toBeVisible();
    }
  });

  test("Extract a real TAR archive and list its files", async ({ page }) => {
    await page.goto("/archive/");
    await page.getByRole("tab", { name: "Extract" }).click();
    await page.setInputFiles('input[type="file"]', FIXTURES.archive.tar);
    await expect(page.getByText(/TAR · 3 files/)).toBeVisible();
  });

  test("Extract a nested ZIP preserves subdirectory paths", async ({ page }) => {
    await page.goto("/archive/");
    await page.getByRole("tab", { name: "Extract" }).click();
    await page.setInputFiles('input[type="file"]', FIXTURES.archive.nestedZip);

    await expect(page.getByText(/ZIP · 3 files/)).toBeVisible();
    await expect(page.getByText(/^top\.txt$/)).toBeVisible();
    await expect(page.getByText(/docs\/inner\.txt/)).toBeVisible();
    await expect(page.getByText(/docs\/deep\/leaf\.txt/)).toBeVisible();
  });

  test("Extract a real single-file GZIP shows the inferred filename", async ({ page }) => {
    await page.goto("/archive/");
    await page.getByRole("tab", { name: "Extract" }).click();
    await page.setInputFiles('input[type="file"]', FIXTURES.archive.noteTxtGz);
    await expect(page.getByText(/GZIP · 1 file/)).toBeVisible();
    await expect(page.getByText(/^note\.txt$/)).toBeVisible();

    // Single-file archive: button reads "Download" not "Download all".
    const dl = page.waitForEvent("download");
    await page.getByRole("button", { name: /^Download$/ }).click();
    const download = await dl;
    expect(download.suggestedFilename()).toBe("note.txt");
  });

  test("Create mode bundles the data-file fixtures into a downloadable ZIP", async ({
    page,
  }) => {
    await page.goto("/archive/");
    await page.setInputFiles('input[type="file"]', [
      FIXTURES.data.json,
      FIXTURES.data.yaml,
      FIXTURES.data.csv,
    ]);
    await expect(page.getByText(/Files \(3\)/i)).toBeVisible();

    // Default format is ZIP.
    const dl = page.waitForEvent("download");
    await page.getByRole("button", { name: /^Create ZIP/i }).click();
    const download = await dl;
    expect(download.suggestedFilename()).toMatch(/\.zip$/);

    const outPath = path.join(os.tmpdir(), `e2e-real-create-${Date.now()}.zip`);
    await download.saveAs(outPath);
    const round = unzipSync(await fs.readFile(outPath));
    expect(Object.keys(round).sort()).toEqual(["people.csv", "people.json", "people.yaml"]);
  });
});
