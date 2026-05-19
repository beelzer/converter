import { test, expect } from "./fixtures";

test.describe("404 page", () => {
  test("unknown URL returns 404 status and renders the styled page", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: /Page not found/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /\/pdf/i })).toHaveAttribute("href", "/pdf");
    await expect(page.getByRole("link", { name: /\/image/i })).toHaveAttribute("href", "/image");
    await expect(page.getByRole("link", { name: /audio-video/i })).toHaveAttribute(
      "href",
      "/audio-video"
    );
  });

  test("404 page is excluded from indexing", async ({ page }) => {
    await page.goto("/nope");
    const robots = page.locator('meta[name="robots"]');
    await expect(robots).toHaveAttribute("content", "noindex");
  });
});
