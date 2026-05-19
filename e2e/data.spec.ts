import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";

async function writeTextFixture(name: string, body: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "data-e2e-"));
  const filepath = path.join(dir, name);
  await fs.writeFile(filepath, body, "utf8");
  return filepath;
}

const SAMPLE_JSON = JSON.stringify(
  { name: "Ada", age: 36, languages: ["go", "ts"], active: true },
  null,
  2
);

test.describe("Data toolkit", () => {
  test("homepage lists Data tools as live", async ({ page }) => {
    await page.goto("/");
    const card = page.getByRole("link").filter({ hasText: /^\s*Data\s/ });
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("href", "/data");
  });

  test("/data renders the hub with all tabs", async ({ page }) => {
    await page.goto("/data/");
    await expect(page.getByRole("heading", { name: /Data tools/i })).toBeVisible();
    for (const name of ["Convert", "Format / Minify", "Validate", "TS Types"]) {
      await expect(page.getByRole("tab", { name })).toBeVisible();
    }
    await expect(page.getByRole("tab", { name: "Convert" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.getByRole("heading", { name: /FAQ/i })).toBeVisible();
  });

  test("Convert mode turns JSON into YAML", async ({ page }) => {
    await page.goto("/data/");
    await page.getByLabel("Input data").fill(SAMPLE_JSON);
    // Output dropdown to YAML
    await page.locator("#format-to").selectOption("yaml");
    await page.getByRole("button", { name: /JSON.*YAML/ }).click();
    const output = page.getByLabel("Output data");
    await expect(output).not.toHaveValue("", { timeout: 5000 });
    const value = await output.inputValue();
    expect(value).toContain("name: Ada");
    expect(value).toContain("languages:");
  });

  test("Validate mode flags an invalid JSON", async ({ page }) => {
    await page.goto("/data/");
    await page.getByRole("tab", { name: "Validate" }).click();
    await page.getByLabel("Input data to validate").fill('{"missing":');
    // Override format detection — the input also matches YAML's broader rules.
    await page.getByLabel("Format").selectOption("json");
    await page.getByRole("button", { name: /Validate JSON/ }).click();
    await expect(page.getByText(/Invalid JSON/i)).toBeVisible();
  });

  test("Validate mode confirms valid JSON", async ({ page }) => {
    await page.goto("/data/");
    await page.getByRole("tab", { name: "Validate" }).click();
    await page.getByLabel("Input data to validate").fill('{"ok":true}');
    await page.getByRole("button", { name: /Validate JSON/ }).click();
    await expect(page.getByText(/Valid JSON/i)).toBeVisible();
  });

  test("TS Types mode generates an interface", async ({ page }) => {
    await page.goto("/data/");
    await page.getByRole("tab", { name: "TS Types" }).click();
    await page.getByLabel("Input data to infer types from").fill(SAMPLE_JSON);
    await page.getByRole("button", { name: /Generate TypeScript/ }).click();
    const output = page.getByLabel("Generated TypeScript");
    await expect(output).not.toHaveValue("", { timeout: 5000 });
    const value = await output.inputValue();
    expect(value).toContain("export interface Root");
    expect(value).toContain("name: string");
    expect(value).toContain("age: number");
  });

  test("Format mode pretty-prints minified JSON", async ({ page }) => {
    await page.goto("/data/");
    await page.getByRole("tab", { name: "Format / Minify" }).click();
    await page.getByLabel("Input data to format").fill('{"a":1,"b":[2,3]}');
    await page.getByRole("button", { name: /^Format$/ }).click();
    const out = page.getByLabel("Formatted output");
    await expect(out).not.toHaveValue("", { timeout: 5000 });
    const value = await out.inputValue();
    // Pretty-printed JSON has newlines
    expect(value).toMatch(/\n/);
    expect(value).toContain('"a": 1');
  });

  test("dropping a CSV file populates the input and detects the format", async ({ page }) => {
    const csv = await writeTextFixture("people.csv", "name,age\nAda,36\nGrace,42\n");
    await page.goto("/data/");
    await page.setInputFiles('input[type="file"]', csv);
    const input = page.getByLabel("Input data");
    await expect(input).toHaveValue(/name,age/);
    // Format select for "from" should now be CSV
    await expect(page.locator("#format-from")).toHaveValue("csv");
  });
});
