import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { FIXTURES } from "./fixtures";

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

test.describe("Data toolkit — real fixtures", () => {
  test("Convert: real JSON → YAML preserves the person records", async ({ page }) => {
    await page.goto("/data/");
    await page.setInputFiles('input[type="file"]', FIXTURES.data.json);
    await expect(page.locator("#format-from")).toHaveValue("json");
    await page.locator("#format-to").selectOption("yaml");
    await page.getByRole("button", { name: /JSON.*YAML/i }).click();

    const out = page.getByLabel("Output data");
    await expect(out).not.toHaveValue("", { timeout: 5000 });
    const value = await out.inputValue();
    expect(value).toContain("name: Ada Lovelace");
    expect(value).toContain("name: Grace Hopper");
    expect(value).toContain("born: 1815");
  });

  test("Convert: real YAML → JSON round-trips correctly", async ({ page }) => {
    await page.goto("/data/");
    await page.setInputFiles('input[type="file"]', FIXTURES.data.yaml);
    await expect(page.locator("#format-from")).toHaveValue("yaml");
    await page.locator("#format-to").selectOption("json");
    await page.getByRole("button", { name: /YAML.*JSON/i }).click();

    const out = page.getByLabel("Output data");
    await expect(out).not.toHaveValue("", { timeout: 5000 });
    const value = await out.inputValue();
    const parsed = JSON.parse(value);
    expect(parsed.people).toHaveLength(3);
    expect(parsed.people[0].name).toBe("Ada Lovelace");
  });

  test("Convert: real CSV → JSON inflates the table rows", async ({ page }) => {
    await page.goto("/data/");
    await page.setInputFiles('input[type="file"]', FIXTURES.data.csv);
    await expect(page.locator("#format-from")).toHaveValue("csv");
    await page.locator("#format-to").selectOption("json");
    await page.getByRole("button", { name: /CSV.*JSON/i }).click();

    const out = page.getByLabel("Output data");
    await expect(out).not.toHaveValue("", { timeout: 5000 });
    const parsed = JSON.parse(await out.inputValue());
    // CSV inflates to an array of row objects.
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(3);
    expect(parsed[0]).toHaveProperty("name");
  });

  test("Validate: each real fixture confirms valid for its format", async ({ page }) => {
    await page.goto("/data/");
    await page.getByRole("tab", { name: "Validate" }).click();

    const cases: Array<{ file: string; format: string; expect: RegExp }> = [
      { file: FIXTURES.data.json, format: "json", expect: /Valid JSON/i },
      { file: FIXTURES.data.yaml, format: "yaml", expect: /Valid YAML/i },
      { file: FIXTURES.data.xml, format: "xml", expect: /Valid XML/i },
      { file: FIXTURES.data.toml, format: "toml", expect: /Valid TOML/i },
    ];

    for (const c of cases) {
      const body = await fs.readFile(c.file, "utf8");
      await page.getByLabel("Input data to validate").fill(body);
      await page.getByLabel("Format").selectOption(c.format);
      await page
        .getByRole("button", { name: new RegExp(`Validate ${c.format}`, "i") })
        .click();
      await expect(page.getByText(c.expect)).toBeVisible({ timeout: 5000 });
    }
  });

  test("TS Types: real JSON fixture produces an interface with the expected fields", async ({
    page,
  }) => {
    await page.goto("/data/");
    await page.getByRole("tab", { name: "TS Types" }).click();
    const body = await fs.readFile(FIXTURES.data.json, "utf8");
    await page.getByLabel("Input data to infer types from").fill(body);
    await page.getByRole("button", { name: /Generate TypeScript/i }).click();

    const out = page.getByLabel("Generated TypeScript");
    await expect(out).not.toHaveValue("", { timeout: 5000 });
    const value = await out.inputValue();
    expect(value).toContain("export interface Root");
    // The TS generator emits either a single element type or a union for the
    // people array (the languages field varies). Either is acceptable.
    expect(value).toMatch(/people\s*:\s*\(?[\w\s|]+\)?\[\]/);
    expect(value).toContain("name: string");
    expect(value).toMatch(/born\s*:\s*number/);
  });

  test("Format: real TOML round-trips through the pretty serializer", async ({ page }) => {
    await page.goto("/data/");
    await page.getByRole("tab", { name: "Format / Minify" }).click();
    const body = await fs.readFile(FIXTURES.data.toml, "utf8");
    await page.getByLabel("Input data to format").fill(body);
    // Auto-detection is best-effort; force TOML explicitly.
    await page.getByLabel("Format", { exact: true }).selectOption("toml");
    await page.getByRole("button", { name: /^Format$/ }).click();

    const out = page.getByLabel("Formatted output");
    await expect(out).not.toHaveValue("", { timeout: 5000 });
    const value = await out.inputValue();
    expect(value).toContain("name");
    expect(value).toContain("born");
  });

});
