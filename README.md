# converter

Free file conversion tools that run entirely in your browser.
Live at **[convert.dcln.me](https://convert.dcln.me)**.

No uploads. No accounts. No ads. No cookies. Open source under MIT.

## Why

Most online converters upload your file to a server, process it there, and offer
you the result. The privacy promises are typically *"we delete it after an hour"*
— not *"we never had it."*

Modern browsers can do this work locally. So that's what these tools do.

## Tools

| Slug                | Status | Notes                                        |
| ------------------- | ------ | -------------------------------------------- |
| `pdf-merger`        | live   | Combine multiple PDFs in-browser via pdf-lib |
| `heic-to-jpg`       | soon   | Will use libheif-js (WASM)                   |
| `pdf-splitter`      | soon   | Shares logic with merger                     |
| `image-converter`   | soon   | Canvas-only, PNG ↔ JPG ↔ WebP ↔ AVIF         |
| `favicon-generator` | soon   | One image in, complete bundle out            |
| `csv-json-yaml`     | soon   | Pure JS, sticky for developers               |

## Stack

- **[Astro 6](https://astro.build/)** — multi-page output, islands architecture
- **[Preact](https://preactjs.com/)** — interactive widgets (~10 KB instead of React's ~45 KB)
- **[Tailwind v4](https://tailwindcss.com/)** — via the `@tailwindcss/vite` plugin
- **[pdf-lib](https://pdf-lib.js.org/)** — PDF manipulation
- **[Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)** — hosting
- **[Cloudflare R2](https://developers.cloudflare.com/r2/)** at `cdn.dcln.me` — for WASM blobs that exceed the 25 MiB per-asset cap

## Local development

Node 20+ required.

```sh
npm install
npm run dev      # local dev server at http://localhost:4321
npm run build    # production build → dist/
npm run preview  # serve the production build locally
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

### Web Analytics token

Once the Cloudflare Workers project is created, set the Web Analytics beacon
token as an environment variable:

```sh
# in your .env (gitignored) or as a Workers project variable
PUBLIC_CF_BEACON_TOKEN=<your token>
```

The `ToolLayout.astro` includes the beacon script only if this is set.

## Adding a new tool

Each tool follows this exact pattern. It's mechanical.

1. **Page** at `src/pages/<tool-slug>.astro` — uses `ToolLayout.astro`, sets title/description targeting a privacy-qualified mid-tail keyword (e.g. *"merge pdf without uploading"*), includes long-form explainer content plus `HowTo` + `FAQPage` JSON-LD schemas.
2. **Widget** at `src/components/tools/<ToolName>.tsx` — Preact, hydrated `client:load`. Lazy-load any heavy library on user intent (never on page load). All conversion work runs in a Web Worker.
3. **Logic** at `src/lib/<area>/<tool>.ts` — framework-agnostic, unit-testable.
4. **Worker** at `src/lib/<area>/<tool>.worker.ts` — wraps the lib in a `postMessage` interface.
5. **Homepage card** in `src/pages/index.astro` — add to the `tools` array, status `"live"`.
6. **Sitemap** is automatic.
7. **README** — add a row to the Tools table above.
8. **If WASM > 1 MB** — upload to R2 at `cdn.dcln.me/<lib-name>/<version>/<file>` and load from there. Pin the version. Example:
   ```sh
   wrangler r2 object put dcln-assets/libheif/1.17.1/libheif.wasm --file=./libheif.wasm
   ```

### Non-negotiables for every tool

- Lighthouse ≥95 across Performance, Accessibility, Best Practices, SEO. Release blocker.
- Drag-and-drop must have a keyboard-accessible fallback (visible click-to-select button, arrow buttons for reordering).
- ARIA live region for conversion progress and completion.
- "Files never leave your browser" copy visible above the fold.
- No third-party scripts beyond Cloudflare Web Analytics. No cookie banner.

## License

MIT. See [LICENSE](./LICENSE).
