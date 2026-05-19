import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { FIXTURES, report } from "./fixtures";

async function snapshot(text: string, ext: string, hint: string): Promise<string> {
  const filepath = path.join(os.tmpdir(), `e2e-${hint}-${Date.now()}.${ext}`);
  await fs.writeFile(filepath, text, "utf8");
  return filepath;
}

test.describe("Code toolkit", () => {
  test("homepage lists Code as live", async ({ page }) => {
    await page.goto("/");
    const card = page.getByRole("link").filter({ hasText: /^\s*Code\s/ });
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("href", "/code");
  });

  test("/code renders both tabs", async ({ page }) => {
    await page.goto("/code/");
    await expect(page.getByRole("heading", { name: /Code tools/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Beautify" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Minify" })).toBeVisible();
  });

  test("Beautify mode formats messy JSON", async ({ page }) => {
    await page.goto("/code/");
    await page.getByLabel("Language").selectOption("json");
    await page.getByLabel("Code to beautify").fill('{"a":1,"b":[2,3],"c":{"d":"e"}}');
    await page.getByRole("button", { name: /Format JSON/ }).click();
    const out = page.getByLabel("Formatted output");
    await expect(out).not.toHaveValue("", { timeout: 5000 });
    const value = await out.inputValue();
    // Pretty JSON has newlines and indentation
    expect(value).toMatch(/\n/);
    expect(value).toContain('"a": 1');
  });

  test("Beautify mode upper-cases SQL keywords", async ({ page }) => {
    await page.goto("/code/");
    await page.getByLabel("Language").selectOption("sql");
    await page.getByLabel("Code to beautify").fill("select id, name from users where id = 1");
    await page.getByRole("button", { name: /Format SQL/ }).click();
    const out = page.getByLabel("Formatted output");
    await expect(out).not.toHaveValue("", { timeout: 5000 });
    const value = await out.inputValue();
    expect(value).toContain("SELECT");
    expect(value).toContain("FROM");
    expect(value).toContain("WHERE");
  });

  test("Minify mode compacts JSON", async ({ page }) => {
    await page.goto("/code/");
    await page.getByRole("tab", { name: "Minify" }).click();
    await page.getByLabel("Language").selectOption("json");
    await page.getByLabel("Code to minify").fill('{\n  "a": 1,\n  "b": [2, 3]\n}');
    await page.getByRole("button", { name: /Minify JSON/ }).click();
    const out = page.getByLabel("Minified output");
    await expect(out).not.toHaveValue("", { timeout: 5000 });
    const value = await out.inputValue();
    expect(value).toBe('{"a":1,"b":[2,3]}');
  });

  test("Minify mode compresses JavaScript with terser", async ({ page }) => {
    await page.goto("/code/");
    await page.getByRole("tab", { name: "Minify" }).click();
    await page.getByLabel("Language").selectOption("javascript");
    await page
      .getByLabel("Code to minify")
      .fill("function add(x, y) {\n  // sum two things\n  return x + y;\n}\nconsole.log(add(1, 2));");
    await page.getByRole("button", { name: /Minify JavaScript/ }).click();
    const out = page.getByLabel("Minified output");
    await expect(out).not.toHaveValue("", { timeout: 10000 });
    const value = await out.inputValue();
    // terser strips comments and whitespace
    expect(value).not.toContain("sum two things");
    expect(value.length).toBeLessThan(80);
  });

  test("Beautify mode picks a real JS fixture and formats it", async ({
    page,
  }, testInfo) => {
    await page.goto("/code/");
    await page.setInputFiles(
      'input[aria-label="Pick a source file"]',
      FIXTURES.code.js
    );
    // detectFromFile should switch the language select to JavaScript.
    await expect(page.getByLabel("Language")).toHaveValue("javascript");
    await page.getByRole("button", { name: /Format JavaScript/ }).click();

    const out = page.getByLabel("Formatted output");
    await expect(out).not.toHaveValue("", { timeout: 5000 });
    const value = await out.inputValue();
    // Prettier should expand the one-liner into multiple lines.
    expect(value.split("\n").length).toBeGreaterThan(3);
    expect(value).toContain("fibonacci");

    report(testInfo, {
      input: { path: FIXTURES.code.js, label: "messy.js (one-liner)" },
      output: { path: await snapshot(value, "js", "js-beautify"), label: "Formatted by prettier" },
    });
  });

  test("Beautify mode formats a real SQL fixture", async ({ page }, testInfo) => {
    await page.goto("/code/");
    await page.setInputFiles(
      'input[aria-label="Pick a source file"]',
      FIXTURES.code.sql
    );
    await expect(page.getByLabel("Language")).toHaveValue("sql");
    await page.getByRole("button", { name: /Format SQL/ }).click();

    const out = page.getByLabel("Formatted output");
    await expect(out).not.toHaveValue("", { timeout: 5000 });
    const value = await out.inputValue();
    expect(value).toContain("SELECT");
    expect(value).toContain("LEFT JOIN");
    expect(value).toContain("GROUP BY");

    report(testInfo, {
      input: { path: FIXTURES.code.sql, label: "messy.sql (lowercase, single line)" },
      output: { path: await snapshot(value, "sql", "sql-beautify"), label: "Formatted (sql-formatter)" },
    });
  });

  test("Beautify mode formats a real CSS fixture", async ({ page }, testInfo) => {
    await page.goto("/code/");
    await page.setInputFiles(
      'input[aria-label="Pick a source file"]',
      FIXTURES.code.css
    );
    await expect(page.getByLabel("Language")).toHaveValue("css");
    await page.getByRole("button", { name: /Format CSS/ }).click();
    const out = page.getByLabel("Formatted output");
    await expect(out).not.toHaveValue("", { timeout: 5000 });
    const value = await out.inputValue();
    expect(value.split("\n").length).toBeGreaterThan(3);

    report(testInfo, {
      input: { path: FIXTURES.code.css, label: "messy.css (packed)" },
      output: { path: await snapshot(value, "css", "css-beautify"), label: "Formatted CSS" },
    });
  });

  test("Minify mode shrinks a real CSS fixture", async ({ page }, testInfo) => {
    await page.goto("/code/");
    await page.getByRole("tab", { name: "Minify" }).click();
    await page.setInputFiles(
      'input[aria-label="Pick a source file"]',
      FIXTURES.code.css
    );
    await expect(page.getByLabel("Language")).toHaveValue("css");
    await page.getByRole("button", { name: /Minify CSS/ }).click();
    const out = page.getByLabel("Minified output");
    await expect(out).not.toHaveValue("", { timeout: 5000 });
    const value = await out.inputValue();
    // csso should drop the comment block and the unused class.
    expect(value).not.toContain("button styles");
    expect(value.length).toBeLessThan(150);

    report(testInfo, {
      input: { path: FIXTURES.code.css, label: "messy.css (with comment + unused class)" },
      output: { path: await snapshot(value, "css", "css-minify"), label: "Minified by csso" },
    });
  });

  test("Minify mode collapses a real HTML fixture", async ({ page }, testInfo) => {
    await page.goto("/code/");
    await page.getByRole("tab", { name: "Minify" }).click();
    await page.setInputFiles(
      'input[aria-label="Pick a source file"]',
      FIXTURES.code.html
    );
    await expect(page.getByLabel("Language")).toHaveValue("html");
    await page.getByRole("button", { name: /Minify HTML/ }).click();
    const out = page.getByLabel("Minified output");
    await expect(out).not.toHaveValue("", { timeout: 5000 });
    const value = await out.inputValue();
    // No newlines between sibling tags after minification.
    expect(value).not.toMatch(/<body>\s+<h1>/);

    report(testInfo, {
      input: { path: FIXTURES.code.html, label: "messy.html (indented)" },
      output: { path: await snapshot(value, "html", "html-minify"), label: "Collapsed HTML" },
    });
  });

  test("Minify mode compacts CSS via csso", async ({ page }) => {
    await page.goto("/code/");
    await page.getByRole("tab", { name: "Minify" }).click();
    await page.getByLabel("Language").selectOption("css");
    await page
      .getByLabel("Code to minify")
      .fill(".btn {\n  color: #ff0000;\n  /* comment */\n  padding: 10px 10px 10px 10px;\n}");
    await page.getByRole("button", { name: /Minify CSS/ }).click();
    const out = page.getByLabel("Minified output");
    await expect(out).not.toHaveValue("", { timeout: 5000 });
    const value = await out.inputValue();
    expect(value).not.toContain("comment");
    expect(value).toContain(".btn");
  });
});
