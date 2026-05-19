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

| Slug          | Status | Modes                                                                        |
| ------------- | ------ | ---------------------------------------------------------------------------- |
| `pdf`         | live   | Merge, split, rotate, organize, images→PDF, PDF→images                       |
| `image`       | live   | Convert, resize, compress, favicon bundle, strip EXIF, SVG→raster            |
| `data`        | soon   | CSV / JSON / YAML / XML / TOML / Excel — convert, format, validate, type-gen |
| `audio-video` | soon   | WebCodecs-based audio + video conversion, trim, compress, extract audio      |

Each product family lives at a single URL (`/pdf`, `/image`, etc.) with operations exposed as tabs inside the tool. No per-operation URLs — one hub per product.

## Stack

- **[Astro 6](https://astro.build/)** — multi-page output, islands architecture
- **[Preact](https://preactjs.com/)** — interactive widgets (~10 KB instead of React's ~45 KB)
- **[Tailwind v4](https://tailwindcss.com/)** — via the `@tailwindcss/vite` plugin
- **[pdf-lib](https://pdf-lib.js.org/)** + **[pdfjs-dist](https://github.com/mozilla/pdf.js)** — PDF write + read
- **[fflate](https://github.com/101arrowz/fflate)** — ZIP packaging for multi-file outputs
- **[libheif-js](https://github.com/catdad-experiments/libheif-js)** + **[@jsquash/avif](https://github.com/jamsinclair/jSquash)** + **[utif2](https://github.com/twardoch/utif2)** — image codecs not natively supported by the browser
- **[Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)** — hosting
- **[Cloudflare R2](https://developers.cloudflare.com/r2/)** at `cdn.dcln.me` — for WASM blobs that exceed the 25 MiB per-asset cap

## Local development

Node 22+ required.

```sh
npm install
npm run dev      # local dev server at http://localhost:4321
npm run build    # production build → dist/
npm run preview  # serve the production build locally
npm run test:e2e # Playwright suite
```

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
3. **Panel** at `src/components/tools/<PanelName>.tsx` — Preact, manages its own state, uses `FileDropZone` + `lib/util/file` helpers.
4. **Register in hub** — add a `Mode` literal and a `ModeSpec` blurb to the hub component, plus a conditional render block.
5. **E2E** — extend the relevant `e2e/<hub>.spec.ts` with a tab-click + round-trip test.

## Adding a new product family

1. **Hub** at `src/components/tools/<Family>Hub.tsx` modelled on `PdfHub.tsx`.
2. **Page** at `src/pages/<family>.astro` — uses `ToolLayout.astro`, sets title/description, includes `HowTo` + `FAQPage` + `BreadcrumbList` JSON-LD.
3. **Homepage card** in `src/pages/index.astro` — add to the `tools` array, status `"live"`.
4. **E2E** at `e2e/<family>.spec.ts`.
5. **Sitemap** is automatic.
6. **If WASM > 1 MB** — upload to R2 at `cdn.dcln.me/<lib-name>/<version>/<file>` and load from there. Pin the version.
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

MIT. See [LICENSE](./LICENSE).
