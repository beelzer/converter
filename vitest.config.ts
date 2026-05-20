import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

// Two test projects:
//
//   • node    — jsdom-backed runner for pure-function lib code. Fast: starts
//               in ~200 ms, runs hundreds of tests in seconds.
//   • browser — real Chromium via Playwright for code that needs canvas /
//               OffscreenCanvas / WebCodecs / DOMMatrix / crypto.subtle on a
//               real `document`. Heavier (a few seconds of startup per file)
//               but the only honest way to cover image/decode, av/convert,
//               pdf rendering, etc.
//
// Coverage is collected against the same `include` glob across both projects
// and merged into a single lcov report.

const COVERAGE_INCLUDE = ["src/lib/**/*.ts"];
const COVERAGE_EXCLUDE = [
  "src/lib/**/*.worker.ts",
  "src/lib/**/*.test.ts",
  "src/lib/**/*.spec.ts",
  "src/lib/**/__fixtures.ts",
  // Browser-only entry points where the implementation is a one-line wrapper
  // around a native API. Covered by behaviour in e2e.
  "src/lib/util/clipboard.ts",
];

// Modules that need a real browser. The `node` project excludes these tests
// (jsdom can't run them) and the `browser` project includes them.
const BROWSER_ONLY_GLOBS = [
  "src/lib/av/**/*.test.ts",
  "src/lib/pdf/**/*.test.ts",
  "src/lib/image/convert.test.ts",
  "src/lib/image/decode.test.ts",
  "src/lib/image/encode.test.ts",
  "src/lib/image/resize.test.ts",
  "src/lib/image/exif.test.ts",
  "src/lib/image/favicon.test.ts",
  "src/lib/image/svg.test.ts",
  "src/lib/document/docx.test.ts",
  "src/lib/document/pdfText.test.ts",
  "src/lib/drawing/to-png.test.ts",
  "src/lib/drawing/to-pdf.test.ts",
];

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      include: COVERAGE_INCLUDE,
      exclude: COVERAGE_EXCLUDE,
    },
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "jsdom",
          include: ["src/lib/**/*.{test,spec}.{ts,tsx}"],
          exclude: [
            "**/node_modules/**",
            "e2e/**",
            "scripts/**",
            "dist/**",
            ...BROWSER_ONLY_GLOBS,
          ],
          globals: false,
        },
      },
      {
        extends: true,
        test: {
          name: "browser",
          include: BROWSER_ONLY_GLOBS,
          exclude: ["**/node_modules/**", "e2e/**", "scripts/**", "dist/**"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
          // Browser tests share one Chromium tab and one Vite dev server;
          // parallel files cause pdfjs / WASM bootstrap races. Serial is fast
          // enough (~5–10 s total) and far more reliable.
          fileParallelism: false,
          // Browser-mode tests can be slow on cold start; give them room.
          testTimeout: 30_000,
        },
      },
    ],
  },
});
