import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // jsdom gives us a DOM for code that touches document/window (markdown
    // sanitiser, ASCII PNG renderer probe, etc.). Pure-function lib code
    // works fine under it too, so it's a safe default for all suites.
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // The Playwright e2e suite and the visual report builder live under
    // `e2e/` and `scripts/` — don't let vitest pick them up.
    exclude: ["**/node_modules/**", "e2e/**", "scripts/**", "dist/**"],
    globals: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      // Only measure our own source. We don't care about coverage for
      // generated artefacts, third-party code, or visual fixtures.
      include: ["src/lib/**/*.ts"],
      exclude: [
        "src/lib/**/*.worker.ts",
        "src/lib/**/*.test.ts",
        "src/lib/**/*.spec.ts",
        // Worker-bound or DOM-render entry points that wrap thin native API
        // calls. They exercise via e2e, not unit tests.
        "src/lib/util/clipboard.ts",
      ],
    },
  },
});
