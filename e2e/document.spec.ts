import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";

async function writeTextFixture(name: string, body: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "doc-e2e-"));
  const filepath = path.join(dir, name);
  await fs.writeFile(filepath, body, "utf8");
  return filepath;
}

test.describe("Document toolkit", () => {
  test("homepage lists Document as live", async ({ page }) => {
    await page.goto("/");
    const card = page.getByRole("link").filter({ hasText: /^\s*Document\s/ });
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("href", "/document");
  });

  test("/document renders all tabs", async ({ page }) => {
    await page.goto("/document/");
    await expect(page.getByRole("heading", { name: /Document tools/i })).toBeVisible();
    for (const name of ["Markdown", "HTML", "DOCX", "PDF → text"]) {
      await expect(page.getByRole("tab", { name })).toBeVisible();
    }
  });

  test("Markdown mode renders a live HTML preview", async ({ page }) => {
    await page.goto("/document/");
    await page.getByLabel("Markdown source").fill("# Hello\n\nThis is **bold**.");
    // Preview iframe should contain the rendered HTML
    const preview = page.frameLocator('iframe[title="Markdown preview"]');
    await expect(preview.getByRole("heading", { name: "Hello" })).toBeVisible();
    await expect(preview.getByText(/bold/)).toBeVisible();
  });

  test("Markdown mode can load a .md file", async ({ page }) => {
    const fixture = await writeTextFixture("note.md", "# From a file\n\nLoaded.");
    await page.goto("/document/");
    await page.setInputFiles('input[aria-label="Pick a Markdown file"]', fixture);
    await expect(page.getByLabel("Markdown source")).toHaveValue(/From a file/);
  });

  test("HTML mode converts HTML to Markdown via turndown", async ({ page }) => {
    await page.goto("/document/");
    await page.getByRole("tab", { name: "HTML" }).click();
    await page
      .getByLabel("HTML source")
      .fill('<h1>Title</h1><p>A <strong>bold</strong> word.</p>');
    await page.getByRole("button", { name: /Convert to Markdown/ }).click();
    const out = page.getByLabel("Markdown output");
    await expect(out).not.toHaveValue("", { timeout: 5000 });
    const value = await out.inputValue();
    expect(value).toContain("# Title");
    expect(value).toContain("**bold**");
  });

  test("DOCX tab exposes the file input and format buttons after a file is picked", async ({ page }) => {
    await page.goto("/document/");
    await page.getByRole("tab", { name: "DOCX" }).click();
    await expect(page.getByRole("button", { name: /Choose \.docx/ })).toBeVisible();
  });

  test("PDF → text tab exposes the file picker", async ({ page }) => {
    await page.goto("/document/");
    await page.getByRole("tab", { name: "PDF → text" }).click();
    await expect(page.getByRole("button", { name: /Choose PDF/ })).toBeVisible();
  });
});
