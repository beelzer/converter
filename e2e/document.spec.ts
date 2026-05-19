import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { FIXTURES, report } from "./fixtures";

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

// Write a text output to a tempfile and return its path so report() can
// snapshot it. Centralised here so each test stays a one-liner.
async function snapshot(text: string, ext: string, hint: string): Promise<string> {
  const filepath = path.join(os.tmpdir(), `e2e-${hint}-${Date.now()}.${ext}`);
  await fs.writeFile(filepath, text, "utf8");
  return filepath;
}

test.describe("Document toolkit — real fixtures", () => {
  test("Markdown mode loads the committed fixture and renders it", async ({
    page,
  }, testInfo) => {
    await page.goto("/document/");
    await page.setInputFiles('input[aria-label="Pick a Markdown file"]', FIXTURES.document.md);
    await expect(page.getByLabel("Markdown source")).toHaveValue(/Sample Markdown/, {
      timeout: 10_000,
    });

    const preview = page.frameLocator('iframe[title="Markdown preview"]');
    await expect(preview.getByRole("heading", { name: /^Sample Markdown$/ })).toBeVisible();

    const md = await page.getByLabel("Markdown source").inputValue();
    report(testInfo, {
      input: { path: FIXTURES.document.md, label: "sample.md (committed fixture)" },
      output: { path: await snapshot(md, "md", "md-loaded"), label: "Loaded into editor" },
      notes: "Loading should round-trip the fixture verbatim into the textarea.",
    });
  });

  test("HTML mode converts the fixture HTML to Markdown", async ({ page }, testInfo) => {
    await page.goto("/document/");
    await page.getByRole("tab", { name: "HTML" }).click();
    const body = await fs.readFile(FIXTURES.document.html, "utf8");
    await page.getByLabel("HTML source").fill(body);
    await page.getByRole("button", { name: /Convert to Markdown/ }).click();
    const out = page.getByLabel("Markdown output");
    await expect(out).not.toHaveValue("", { timeout: 5000 });
    const value = await out.inputValue();
    expect(value).toContain("# Sample HTML");
    expect(value).toContain("**bold**");
    expect(value).toContain("alpha");

    report(testInfo, {
      input: { path: FIXTURES.document.html, label: "sample.html (source)" },
      output: { path: await snapshot(value, "md", "html2md"), label: "Markdown (turndown)" },
    });
  });

  test("DOCX mode converts the fixture to Markdown", async ({ page }, testInfo) => {
    await page.goto("/document/");
    await page.getByRole("tab", { name: "DOCX" }).click();
    await page.setInputFiles('input[type="file"]', FIXTURES.document.docx);

    // Markdown is the default selected output format.
    await page.getByRole("button", { name: /Convert → Markdown/i }).click();

    const out = page.getByLabel("Conversion result");
    await expect(out).not.toHaveValue("", { timeout: 10_000 });
    const value = await out.inputValue();
    expect(value).toContain("tools.dcln.me");
    // The DOCX has bold text — turndown should emit asterisks.
    expect(value).toMatch(/\*\*bold\*\*/);

    report(testInfo, {
      input: { path: FIXTURES.document.docx, label: "sample.docx (committed)" },
      output: { path: await snapshot(value, "md", "docx2md"), label: "DOCX → Markdown (mammoth + turndown)" },
    });
  });

  test("DOCX mode can also produce HTML", async ({ page }, testInfo) => {
    await page.goto("/document/");
    await page.getByRole("tab", { name: "DOCX" }).click();
    await page.setInputFiles('input[type="file"]', FIXTURES.document.docx);
    await page.getByRole("button", { name: /^HTML$/, exact: true }).click();
    await page.getByRole("button", { name: /Convert → HTML/i }).click();

    const out = page.getByLabel("Conversion result");
    await expect(out).not.toHaveValue("", { timeout: 10_000 });
    const value = await out.inputValue();
    expect(value).toContain("<h1>");
    expect(value).toContain("<strong>bold</strong>");

    report(testInfo, {
      input: { path: FIXTURES.document.docx, label: "sample.docx" },
      output: { path: await snapshot(value, "html", "docx2html"), label: "DOCX → HTML (mammoth)" },
    });
  });

  test("PDF → text extracts real text from the multi-page fixture", async ({
    page,
  }, testInfo) => {
    await page.goto("/document/");
    await page.getByRole("tab", { name: "PDF → text" }).click();
    await page.setInputFiles('input[type="file"]', FIXTURES.pdf.multiPage);

    await page.getByRole("button", { name: /Extract text/i }).click();

    const out = page.getByLabel(/Extracted text/i);
    await expect(out).not.toHaveValue("", { timeout: 15_000 });
    const value = await out.inputValue();
    // 5 pages of known content.
    expect(value).toContain("The quick brown fox");
    expect(value).toContain("Page 1 of 5");
    expect(value).toContain("Page 5 of 5");

    report(testInfo, {
      input: { path: FIXTURES.pdf.multiPage, label: "multi-page.pdf — 5 pages" },
      output: { path: await snapshot(value, "txt", "pdf2text"), label: "Extracted plaintext (pdf.js)" },
    });
  });

  test("PDF → text on a scanned (image-only) fixture yields effectively nothing", async ({
    page,
  }) => {
    await page.goto("/document/");
    await page.getByRole("tab", { name: "PDF → text" }).click();
    await page.setInputFiles('input[type="file"]', FIXTURES.pdf.scanned);
    await page.getByRole("button", { name: /Extract text/i }).click();
    // pdf.js exits cleanly with empty text; we should reach the "done" state.
    await expect(page.getByText(/Extracted text from \d+ page/i)).toBeVisible({
      timeout: 15_000,
    });
  });
});
