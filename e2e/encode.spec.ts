import { test, expect } from "@playwright/test";

// A real, well-formed JWT with header.payload.signature parts and an expired
// exp claim so the "expired" badge renders.
const SAMPLE_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJzdWIiOiIxMjMiLCJuYW1lIjoiQWRhIiwiZXhwIjoxNTE2MjM5MDIyfQ." +
  "abc";

test.describe("Encoding toolkit", () => {
  test("homepage lists Encode as live", async ({ page }) => {
    await page.goto("/");
    const card = page.getByRole("link").filter({ hasText: /^\s*Encode\s/ });
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("href", "/encode");
  });

  test("/encode renders all tabs", async ({ page }) => {
    await page.goto("/encode/");
    await expect(page.getByRole("heading", { name: /Encoding tools/i })).toBeVisible();
    for (const name of ["Base64", "URL", "JWT", "Hash"]) {
      await expect(page.getByRole("tab", { name })).toBeVisible();
    }
  });

  test("Base64 encode/decode round-trip", async ({ page }) => {
    await page.goto("/encode/");
    await page.getByLabel("Plaintext input").fill("Hello, World!");
    const out = page.getByLabel("Output");
    await expect(out).toHaveValue("SGVsbG8sIFdvcmxkIQ==");

    // Decode mode
    await page.getByRole("radio", { name: "Decode" }).click();
    await page.getByLabel("Base64 input").fill("SGVsbG8sIFdvcmxkIQ==");
    await expect(page.getByLabel("Output")).toHaveValue("Hello, World!");
  });

  test("URL encode produces percent-encoded output", async ({ page }) => {
    await page.goto("/encode/");
    await page.getByRole("tab", { name: "URL" }).click();
    await page.getByLabel("Plain URL input").fill("hello world?x=1&y=2");
    const out = page.getByLabel("Output");
    await expect(out).toHaveValue(/hello%20world%3Fx%3D1%26y%3D2/);
  });

  test("JWT decoder reveals header, payload, and standard claims", async ({ page }) => {
    await page.goto("/encode/");
    await page.getByRole("tab", { name: "JWT" }).click();
    await page.getByLabel("JWT to decode").fill(SAMPLE_JWT);
    await page.getByRole("button", { name: "Decode" }).click();
    await expect(page.getByRole("heading", { name: "Header" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Payload" })).toBeVisible();
    await expect(page.getByText(/sub \(subject\)/i)).toBeVisible();
    await expect(page.getByText(/exp \(expires\)/i)).toBeVisible();
    // 1516239022 is in 2018 — should mark as expired
    await expect(page.getByText(/— expired/i)).toBeVisible();
  });

  test("Hash mode produces SHA-256 of 'hello'", async ({ page }) => {
    await page.goto("/encode/");
    await page.getByRole("tab", { name: "Hash" }).click();
    await page.getByLabel("Input").fill("hello");
    // SHA-256 of "hello" is 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
    await expect(
      page.getByText(/2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824/i)
    ).toBeVisible();
  });
});
