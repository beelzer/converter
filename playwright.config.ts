import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",

  use: {
    baseURL: "http://localhost:4321",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    // Pure-static output — astro preview serves dist/ on the given port.
    command: "npm run preview -- --port 4321 --host 127.0.0.1",
    url: "http://127.0.0.1:4321/",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
