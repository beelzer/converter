# Third-party licenses

This project is MIT-licensed (see [LICENSE](./LICENSE)). It bundles or
dynamically loads third-party libraries with the following licenses.

All copyleft-licensed code is **dynamically loaded on user intent** — it is not
present in the page's initial bundle and is fetched only after a user picks a
file that needs it. This keeps the homepage and unrelated tools entirely free
of copyleft code.

Permissively-licensed deps (MIT / BSD / Apache-2.0 / ISC) are not enumerated
here individually — `pnpm licenses list` produces the full inventory.

## Copyleft dependencies

### libredwg (via `@mlightcad/libredwg-web`)

- **License:** GPL-3.0-or-later
- **Upstream:** <https://www.gnu.org/software/libredwg/>
- **Wrapper:** <https://github.com/mlightcad/libredwg-web>
- **Used by:** [/drawing](https://tools.dcln.me/drawing) (DWG and DXF parsing)
- **Linkage:** Dynamic. The WebAssembly module is imported lazily *after* the
  user picks a `.dwg` or `.dxf` file. The SVG-only path on the same page does
  not load it.
- **Notes:** Users who visit the page or download a generated PDF are not
  recipients of the libredwg source under GPL terms; nothing about ordinary
  use of the tool propagates the GPL to user files. Forks or redistributions
  of this site's source that retain the `/drawing` route must comply with
  GPL-3.0 — including making their own source available on request.

### FFmpeg core (via `@ffmpeg/core` / `@ffmpeg/core-mt`)

- **License:** GPL-2.0-or-later (the wrapper `@ffmpeg/ffmpeg` is MIT)
- **Upstream:** <https://ffmpeg.org/>
- **Used by:** [/audio-video](https://tools.dcln.me/audio-video) (fallback
  path; mediabunny / WebCodecs is the default)
- **Linkage:** Dynamic. Loaded only when WebCodecs cannot handle a requested
  codec.

## Weak-copyleft dependencies

### mediabunny — MPL-2.0

WebCodecs wrapper for /audio-video. File-level copyleft only — no propagation
to the rest of this project.

### libheif-js — LGPL-3.0

HEIC decoder for /image. WebAssembly module loaded dynamically when a `.heic`
or `.heif` file is picked.

### lightningcss-wasm — MPL-2.0

Bundled in image asset tooling. File-level copyleft only.

---

If you spot a dependency that should be on this list and isn't, please open an
issue at <https://github.com/beelzer/dcln> .
