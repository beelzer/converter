import { test, expect } from "@playwright/test";

test.describe("Color toolkit", () => {
  test("homepage lists Color as live", async ({ page }) => {
    await page.goto("/");
    const card = page.getByRole("link").filter({ hasText: /^\s*Color\s/ });
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("href", "/color");
  });

  test("/color renders all tabs", async ({ page }) => {
    await page.goto("/color/");
    await expect(page.getByRole("heading", { name: /Color tools/i })).toBeVisible();
    for (const name of ["Convert", "Palette", "Contrast"]) {
      await expect(page.getByRole("tab", { name })).toBeVisible();
    }
  });

  test("Convert mode renders HEX → RGB / HSL / OKLCH / CMYK rows", async ({ page }) => {
    await page.goto("/color/");
    const input = page.getByLabel(/^Color$/);
    await input.fill("#ff0000");
    // All five rows present
    for (const label of ["HEX", "RGB", "HSL", "OKLCH", "CMYK"]) {
      await expect(page.getByText(label).first()).toBeVisible();
    }
    // RGB value should reflect red
    await expect(page.getByText(/rgb\(255 0 0\)/)).toBeVisible();
  });

  test("Palette mode emits multiple swatches", async ({ page }) => {
    await page.goto("/color/");
    await page.getByRole("tab", { name: "Palette" }).click();
    await page.getByRole("button", { name: "Triadic" }).click();
    // Triadic = 3 swatches; each swatch button has label "Copy #XXXXXX"
    const swatches = page.getByRole("button", { name: /^Copy #[0-9A-Fa-f]{6}$/ });
    await expect(swatches).toHaveCount(3);
  });

  test("Contrast mode shows the WCAG verdict", async ({ page }) => {
    await page.goto("/color/");
    await page.getByRole("tab", { name: "Contrast" }).click();
    // Default colors should produce a high contrast ratio
    await expect(page.getByText(/contrast ratio/i)).toBeVisible();
    await expect(page.getByText(/WCAG AA \(normal text/i)).toBeVisible();
  });
});
