import { test, expect } from "@playwright/test";

const TAB_NAMES = [
  "Convert",
  "Trim",
  "Extract audio",
  "Video → GIF",
  "Compress",
  "Frames",
  "Merge",
];

test.describe("Audio/video toolkit", () => {
  test("homepage lists Audio / Video as live", async ({ page }) => {
    await page.goto("/");
    const card = page.getByRole("link").filter({ hasText: /^\s*Audio\s*\/\s*Video\s/ });
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("href", "/audio-video");
  });

  test("/audio-video renders the hub with all tabs and SEO content", async ({ page }) => {
    await page.goto("/audio-video/");
    await expect(page.getByRole("heading", { name: /Audio.*video tools/i })).toBeVisible();

    for (const name of TAB_NAMES) {
      await expect(page.getByRole("tab", { name })).toBeVisible();
    }

    await expect(page.getByRole("tab", { name: "Convert" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await expect(page.getByRole("heading", { name: /FAQ/i })).toBeVisible();
    await expect(page.getByText(/Does my video get uploaded anywhere/i)).toBeVisible();
  });

  test("each tab swaps the drop zone label", async ({ page }) => {
    await page.goto("/audio-video/");

    for (const name of TAB_NAMES) {
      await page.getByRole("tab", { name }).click();
      await expect(page.getByRole("tab", { name })).toHaveAttribute(
        "aria-selected",
        "true"
      );
      await expect(page.locator('input[type="file"]')).toBeAttached();
    }
  });

  test("Merge tab accepts the multiple attribute", async ({ page }) => {
    await page.goto("/audio-video/");
    await page.getByRole("tab", { name: "Merge" }).click();
    const input = page.locator('input[type="file"]');
    await expect(input).toHaveAttribute("multiple", "");
  });
});
