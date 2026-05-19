import { test, expect } from "@playwright/test";

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
