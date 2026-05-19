# tools

Free file tools that run entirely in your browser.
Live at **[tools.dcln.me](https://tools.dcln.me)**.

No uploads. No accounts. No ads. No cookies. Open source under MIT.

## Why

Most online file tools upload your file to a server, process it there, and offer
you the result. The privacy promises are typically *"we delete it after an hour"*
— not *"we never had it."*

Modern browsers can do this work locally. So that's what these tools do.

## Tools

All nine product families are live. Each lives at a single URL with operations
exposed as tabs — no per-operation URLs.

| Slug | Modes |
| --- | --- |
| [`pdf`](https://tools.dcln.me/pdf) | Merge, split, rotate, organize, images → PDF, PDF → images |
| [`image`](https://tools.dcln.me/image) | Convert, resize, compress, favicon bundle, SVG → raster, strip EXIF |
| [`audio-video`](https://tools.dcln.me/audio-video) | Convert, trim, compress, extract audio, frames, video → GIF, merge — via WebCodecs |
| [`data`](https://tools.dcln.me/data) | JSON / YAML / XML / TOML / CSV / TSV: convert, format, validate, generate TS types |
| [`color`](https://tools.dcln.me/color) | HEX / RGB / HSL / OKLCH / CMYK conversion, harmony palettes, WCAG contrast checker |
| [`encode`](https://tools.dcln.me/encode) | Base64, URL encoding, JWT decoder, SHA-1 / 256 / 384 / 512 via WebCrypto |
| [`document`](https://tools.dcln.me/document) | Markdown ↔ HTML, DOCX → HTML/Markdown/text, PDF → text, browser-native print to PDF |
| [`archive`](https://tools.dcln.me/archive) | Create ZIP / TAR / TAR.GZ / GZIP; extract those plus RAR. Auto-detect on read |
| [`code`](https://tools.dcln.me/code) | Beautify + minify JS, TS, CSS, HTML, JSON, SCSS, Markdown, YAML, GraphQL, Vue, SQL |

The canonical catalog lives in [`src/lib/tools.ts`](src/lib/tools.ts) and feeds
the homepage, 404 page, and sitemap.

## Stack

- **[Astro 6](https://astro.build/)** — multi-page output, islands architecture
- **[Preact](https://preactjs.com/)** (compat) — interactive widgets (~10 KB instead of React's ~45 KB)
- **[Tailwind v4](https://tailwindcss.com/)** — via the `@tailwindcss/vite` plugin

Per-area workhorses:

| Area | Library |
| --- | --- |
| PDF | [pdf-lib](https://pdf-lib.js.org/) (write) + [pdfjs-dist](https://github.com/mozilla/pdf.js) (read) |
| Image | native `createImageBitmap` / `OffscreenCanvas` + [libheif-js](https://github.com/catdad-experiments/libheif-js), [@jsquash/avif](https://github.com/jamsinclair/jSquash), [utif2](https://github.com/twardoch/utif2) for codecs the browser lacks; [exifr](https://github.com/MikeKovarik/exifr) + [piexifjs](https://github.com/hMatoba/piexifjs) for EXIF |
| Audio/Video | [mediabunny](https://mediabunny.dev/) (WebCodecs convert / trim / compress / extract / frame / merge) + [gifenc](https://github.com/mattdesl/gifenc) for video → GIF |
| Data | [js-yaml](https://github.com/nodeca/js-yaml), [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser), [fast-xml-builder](https://github.com/NaturalIntelligence/fast-xml-builder), [smol-toml](https://github.com/squirrelchat/smol-toml), [papaparse](https://www.papaparse.com/) |
| Document | [marked](https://marked.js.org/) (MD → HTML), [turndown](https://github.com/mixmark-io/turndown) (HTML → MD), [mammoth](https://github.com/mwilliamson/mammoth.js) (DOCX → HTML), browser-native print for PDF export |
| Archive | [fflate](https://github.com/101arrowz/fflate) (ZIP/GZIP) + a small custom ustar TAR reader/writer + [node-unrar-js](https://github.com/YuJianrong/node-unrar-js) for RAR extract |
| Code | [prettier](https://prettier.io/) standalone with lazy-loaded parser plugins, [sql-formatter](https://github.com/sql-formatter-org/sql-formatter), [terser](https://terser.org/) for JS/TS minify, [csso](https://github.com/css/csso) for CSS minify |
| Encode | WebCrypto `SubtleCrypto` for hashing; native `btoa`/`atob` for Base64 |
| DnD | [@dnd-kit](https://dndkit.com/) for the PDF organizer thumbnail reorder |

Infrastructure:

- **[Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)** — hosting
- **[Cloudflare R2](https://developers.cloudflare.com/r2/)** at `cdn.dcln.me` — for WASM blobs that exceed the 25 MiB per-asset cap
- **[Cloudflare Web Analytics](https://developers.cloudflare.com/web-analytics/)** — no cookies, no fingerprinting

Native browser APIs are preferred over libraries wherever possible:
`crypto.randomUUID`, `SubtleCrypto`, `CompressionStream`, `OffscreenCanvas`,
`createImageBitmap`, `WebCodecs`. Heavy work runs in Web Workers.

## Local development

Node 22+ required.

```sh
npm install
npm run dev           # local dev server at http://localhost:4321
npm run build         # production build → dist/
npm run preview       # serve the production build locally
npm run check         # astro check (type + Astro template diagnostics)
npm run lint          # eslint
npm run test:e2e      # Playwright suite (102 tests)
npm run test:fixtures # rebuild e2e/fixtures/* from source (needs ffmpeg + network)
```

## Testing

End-to-end tests live in `e2e/*.spec.ts` and exercise every hub against real
fixtures committed under [`e2e/fixtures/`](e2e/fixtures/) — small but authentic
files (Big Buck Bunny clip @ CC-BY 3.0, real DOCX, multi-page PDF with embedded
images, JPEG with real EXIF tags, ZIP/TAR/TAR.GZ archives, etc.).

Fixtures are produced deterministically by
[`scripts/build-fixtures.mjs`](scripts/build-fixtures.mjs); regenerate with
`npm run test:fixtures`. Provenance and licenses are documented in
[`e2e/fixtures/README.md`](e2e/fixtures/README.md).

The Playwright config retries failed tests once locally (twice on CI) to absorb
the occasional WebCodecs race under parallel load. The Audio/Video real-fixture
suite runs in serial mode for the same reason.

## Deploy

Deploys automatically to Cloudflare Workers Static Assets via Workers Builds on
push to `main`. Manual deploy:

```sh
npm run build
npx wrangler deploy
```

`wrangler.toml` configures the asset directory and the `not_found_handling`
strategy.

## Adding a new mode to an existing tool

Modes share a hub (`PdfHub.tsx`, `ImageHub.tsx`, …). To add one:

1. **Library** at `src/lib/<area>/<op>.ts` — framework-agnostic, unit-testable.
2. **Worker** at `src/lib/<area>/<op>.worker.ts` if the work is heavier than ~50 ms — wraps the lib in a `postMessage` interface.
3. **Panel** at `src/components/tools/<PanelName>.tsx` — Preact, manages its own state. Use the shared widgets:
   - [`FileDropZone`](src/components/shared/FileDropZone.tsx) for input
   - [`OutputPanel`](src/components/shared/OutputPanel.tsx) for text outputs with copy/download
   - Unified [`Status`](src/components/shared/Widgets.tsx) discriminated union (`idle | loading | working | done | error`)
   - [`Fieldset` + `Pills`](src/components/shared/Widgets.tsx) for option groups
4. **Register in hub** — add a `Mode` literal and a `ModeSpec` blurb to the hub component, plus a conditional render block. Use the generic [`Hub`](src/components/shared/Hub.tsx) wrapper.
5. **E2E** — extend the relevant `e2e/<hub>.spec.ts` with a tab-click + real-fixture round-trip test.

## Adding a new product family

1. **Catalog entry** in [`src/lib/tools.ts`](src/lib/tools.ts) — slug, name, blurbs. This drives the homepage, 404, and sitemap automatically.
2. **Hub** at `src/components/tools/<Family>Hub.tsx` modelled on an existing hub.
3. **Page** at `src/pages/<family>.astro` — uses [`HubPageLayout`](src/components/HubPageLayout.astro) which assembles the visible markup + `HowTo` + `FAQPage` + `BreadcrumbList` JSON-LD from a single data block.
4. **E2E** at `e2e/<family>.spec.ts` — add a real-fixture spec block. If the new family needs new fixture types, extend [`scripts/build-fixtures.mjs`](scripts/build-fixtures.mjs) and [`e2e/fixtures.ts`](e2e/fixtures.ts).
5. **WASM > 1 MB** — upload to R2 at `cdn.dcln.me/<lib-name>/<version>/<file>` and load from there. Pin the version.
   ```sh
   wrangler r2 object put dcln-assets/libheif/1.19.8/libheif.wasm --file=./libheif.wasm
   ```

### Non-negotiables for every tool

- Lighthouse ≥95 across Performance, Accessibility, Best Practices, SEO. Release blocker.
- Drag-and-drop must have a keyboard-accessible fallback (visible click-to-select button, arrow buttons for reordering).
- ARIA live region for progress and completion.
- "Files never leave your browser" copy visible above the fold.
- No third-party scripts beyond Cloudflare Web Analytics. No cookie banner.

## Commit convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/). Every commit and PR title must follow the pattern:

```text
type(optional-scope): short description
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `ci`, `chore`, `test`, `build`, `revert`.

For new modes, use the family slug as the scope:

```text
feat(image): add SVG → raster mode
fix(pdf): handle password-protected PDFs gracefully
ci: bump lighthouse threshold to error-level 0.95
```

`commitlint` validates commits on every PR via the `Commit Messages` job in `.github/workflows/ci.yml`. Past commits made before this convention was added are not retroactively validated.

## License

MIT. See [LICENSE](LICENSE).

Test fixtures under [`e2e/fixtures/`](e2e/fixtures/) include video frames
derived from Blender Foundation's *Big Buck Bunny* (CC-BY 3.0); see the
[fixtures README](e2e/fixtures/README.md) for full per-file provenance.
