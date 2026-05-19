#!/usr/bin/env node
// Walk test-artifacts/ and emit a single self-contained HTML report that lets
// you visually compare each test's input(s) and output(s) side-by-side. Run
// after `npm run test:e2e` (which fills test-artifacts/ via the e2e `report()`
// helper in e2e/fixtures.ts), then open test-artifacts/index.html.
//
// No build step, no framework — the page uses native <img>/<video>/<audio>
// /<embed>/<pre> tags and inline CSS.

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync, gunzipSync } from "fflate";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ARTIFACTS = join(ROOT, "test-artifacts");

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "avif", "bmp", "ico"]);
const VIDEO_EXTS = new Set(["mp4", "webm", "mov", "mkv", "m4v"]);
const AUDIO_EXTS = new Set(["mp3", "wav", "aac", "flac", "ogg", "oga", "opus", "m4a"]);
const TEXT_EXTS = new Set([
  "txt", "md", "markdown", "html", "htm", "json", "yaml", "yml", "xml",
  "toml", "csv", "tsv", "js", "mjs", "ts", "tsx", "jsx", "css", "scss",
  "sql", "sh", "py", "rb", "go", "rs", "graphql", "vue",
]);
const ARCHIVE_EXTS = new Set(["zip", "tar", "gz", "tgz", "rar", "7z", "bz2"]);

const TEXT_PREVIEW_LIMIT = 16 * 1024; // chars
const ARCHIVE_PREVIEW_LIMIT = 4 * 1024; // chars — per file inside an archive
const ARCHIVE_TEXT_EXTS = new Set([
  "txt", "md", "html", "json", "yaml", "yml", "xml", "toml", "csv", "tsv",
  "js", "ts", "css", "sql", "log", "manifest", "webmanifest",
]);

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

// Minimal ustar TAR reader. Yields { name, bytes } per regular file entry.
// Format ref: https://www.gnu.org/software/tar/manual/html_node/Standard.html
function readTar(bytes) {
  const out = [];
  const dec = new TextDecoder("utf-8", { fatal: false });
  let off = 0;
  while (off + 512 <= bytes.length) {
    const header = bytes.subarray(off, off + 512);
    // All-zero block = end of archive.
    let allZero = true;
    for (let i = 0; i < 512; i++) {
      if (header[i] !== 0) { allZero = false; break; }
    }
    if (allZero) break;

    const name = dec.decode(header.subarray(0, 100)).replace(/\0.*$/, "");
    const sizeOct = dec.decode(header.subarray(124, 136)).replace(/[^0-7]/g, "");
    const size = sizeOct ? parseInt(sizeOct, 8) : 0;
    const typeflag = String.fromCharCode(header[156] || 0x30);

    off += 512;
    if (size > 0) {
      // Regular file (typeflag '0' or '\0') vs directory ('5') vs other.
      if (typeflag === "0" || typeflag === "\0") {
        out.push({ name, bytes: bytes.subarray(off, off + size) });
      }
      off += size;
      // Round up to next 512-byte boundary.
      const pad = (512 - (size % 512)) % 512;
      off += pad;
    }
  }
  return out;
}

// Returns { entries: [{name, size, bytes?}], totalBytes } or null if we can't
// read the archive (RAR / 7z / corrupt). `bytes` is only populated for small
// text entries we want to inline-preview.
function inspectArchive(filePath, ext) {
  let raw;
  try {
    raw = readFileSync(filePath);
  } catch {
    return null;
  }
  let entries;
  try {
    if (ext === "zip") {
      const unzipped = unzipSync(raw);
      entries = Object.entries(unzipped).map(([name, bytes]) => ({ name, bytes }));
    } else if (ext === "tar") {
      entries = readTar(raw);
    } else if (ext === "gz" || ext === "tgz") {
      const inner = gunzipSync(raw);
      // .tar.gz / .tgz — sniff for the ustar magic at offset 257 of the
      // first 512-byte block. Otherwise treat as a single-file gzip.
      const magic = inner.subarray(257, 263);
      const isTar = inner.length >= 512 &&
        magic[0] === 0x75 && magic[1] === 0x73 && magic[2] === 0x74 && magic[3] === 0x61 && magic[4] === 0x72;
      if (isTar) {
        entries = readTar(inner);
      } else {
        // Single-file gzip: inferred name is the path with .gz stripped.
        const base = filePath.split(/[/\\]/).pop().replace(/\.gz$/i, "");
        entries = [{ name: base, bytes: inner }];
      }
    } else {
      return null; // rar, 7z, bz2 — no inspector
    }
  } catch (err) {
    return { entries: [], error: err.message };
  }
  let totalBytes = 0;
  const decorated = entries.map((e) => {
    totalBytes += e.bytes.length;
    return { name: e.name, size: e.bytes.length, bytes: e.bytes };
  });
  decorated.sort((a, b) => a.name.localeCompare(b.name));
  return { entries: decorated, totalBytes };
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function readMetas() {
  const groups = new Map(); // spec → Array<{ dir, meta }>
  if (!existsSync(ARTIFACTS)) return groups;
  for (const spec of readdirSync(ARTIFACTS)) {
    const specDir = join(ARTIFACTS, spec);
    if (!statSync(specDir).isDirectory()) continue;
    const entries = [];
    for (const testSlug of readdirSync(specDir)) {
      const dir = join(specDir, testSlug);
      if (!statSync(dir).isDirectory()) continue;
      const metaPath = join(dir, "meta.json");
      if (!existsSync(metaPath)) continue;
      try {
        const meta = JSON.parse(readFileSync(metaPath, "utf8"));
        entries.push({ slug: testSlug, dir, meta });
      } catch (err) {
        console.warn(`skip ${metaPath}: ${err.message}`);
      }
    }
    entries.sort((a, b) => a.meta.title.localeCompare(b.meta.title));
    if (entries.length > 0) groups.set(spec, entries);
  }
  return groups;
}

function renderArchiveContents(inspected, downloadHref, ext) {
  const { entries, totalBytes, error } = inspected;
  const dec = new TextDecoder("utf-8", { fatal: false });

  if (error) {
    return `<div class="art-binary">⚠ Could not read ${escapeHtml(ext.toUpperCase())}: ${escapeHtml(error)} — <a href="${downloadHref}" target="_blank">download raw</a></div>`;
  }
  if (entries.length === 0) {
    return `<div class="art-binary">Archive is empty — <a href="${downloadHref}" target="_blank">download raw</a></div>`;
  }

  const rows = entries.map((e) => {
    const entryExt = (e.name.match(/\.([^.\\/]+)$/) || [, ""])[1].toLowerCase();
    const isTextPreview = ARCHIVE_TEXT_EXTS.has(entryExt) && e.size > 0;
    let previewBlock = "";
    if (isTextPreview) {
      const body = dec.decode(e.bytes);
      const truncated = body.length > ARCHIVE_PREVIEW_LIMIT;
      const display = truncated ? body.slice(0, ARCHIVE_PREVIEW_LIMIT) + "\n…" : body;
      previewBlock = `<details class="archive-preview"><summary>preview</summary><pre><code>${escapeHtml(display)}</code></pre></details>`;
    }
    return `<li>
      <span class="archive-name">${escapeHtml(e.name)}</span>
      <span class="archive-size">${fmtBytes(e.size)}</span>
      ${previewBlock}
    </li>`;
  }).join("\n");

  return `<div class="archive-contents">
    <div class="archive-summary">
      <strong>${entries.length}</strong> file${entries.length === 1 ? "" : "s"}
      · ${fmtBytes(totalBytes)} uncompressed
      · <a href="${downloadHref}" target="_blank">download archive</a>
    </div>
    <ul class="archive-list">${rows}</ul>
  </div>`;
}

function renderArtifact(spec, slug, artifact) {
  const href = `${encodeURIComponent(spec)}/${encodeURIComponent(slug)}/${encodeURIComponent(artifact.name)}`;
  const ext = artifact.ext.toLowerCase();
  const label = escapeHtml(artifact.label);
  const size = fmtBytes(artifact.size);
  const filename = escapeHtml(artifact.name);

  const header = `
    <figcaption>
      <span class="caption-label">${label}</span>
      <span class="caption-meta">${filename} · ${size}</span>
    </figcaption>`;

  if (IMAGE_EXTS.has(ext)) {
    return `<figure class="art art-image">${header}
      <a href="${href}" target="_blank"><img src="${href}" alt="${label}" loading="lazy"></a>
    </figure>`;
  }

  if (VIDEO_EXTS.has(ext)) {
    return `<figure class="art art-video">${header}
      <video src="${href}" controls preload="metadata"></video>
    </figure>`;
  }

  if (AUDIO_EXTS.has(ext)) {
    return `<figure class="art art-audio">${header}
      <audio src="${href}" controls preload="metadata"></audio>
    </figure>`;
  }

  if (ext === "pdf") {
    return `<figure class="art art-pdf">${header}
      <embed src="${href}" type="application/pdf" width="100%" height="500">
      <a class="art-fallback" href="${href}" target="_blank">Open PDF in new tab</a>
    </figure>`;
  }

  if (TEXT_EXTS.has(ext)) {
    let body;
    try {
      const fullPath = join(ARTIFACTS, spec, slug, artifact.name);
      body = readFileSync(fullPath, "utf8");
    } catch {
      body = "(could not read file as text)";
    }
    const truncated = body.length > TEXT_PREVIEW_LIMIT;
    const display = truncated ? body.slice(0, TEXT_PREVIEW_LIMIT) + "\n…" : body;
    return `<figure class="art art-text">${header}
      <pre><code>${escapeHtml(display)}</code></pre>
      ${truncated ? `<a class="art-fallback" href="${href}" target="_blank">View full file</a>` : ""}
    </figure>`;
  }

  if (ARCHIVE_EXTS.has(ext)) {
    const fullPath = join(ARTIFACTS, spec, slug, artifact.name);
    const inspected = inspectArchive(fullPath, ext);
    if (!inspected) {
      // RAR / 7z / unsupported: fall back to download-only.
      return `<figure class="art art-archive">${header}
        <div class="art-binary">📦 Archive (${escapeHtml(ext.toUpperCase())}) — <a href="${href}" target="_blank">download</a></div>
      </figure>`;
    }
    return `<figure class="art art-archive">${header}
      ${renderArchiveContents(inspected, href, ext)}
    </figure>`;
  }

  return `<figure class="art art-binary">${header}
    <div class="art-binary">Binary blob — <a href="${href}" target="_blank">download</a></div>
  </figure>`;
}

function renderTest(spec, entry) {
  const { meta, slug } = entry;
  const inputs = meta.inputs ?? [];
  const outputs = meta.outputs ?? [];

  const renderColumn = (label, arts) => `
    <div class="col">
      <h4>${escapeHtml(label)} (${arts.length})</h4>
      ${arts.map((a) => renderArtifact(spec, slug, a)).join("\n")}
    </div>`;

  return `<article class="test" id="${escapeHtml(`${spec}-${slug}`)}">
    <h3>${escapeHtml(meta.title)}</h3>
    ${meta.notes ? `<p class="notes">${escapeHtml(meta.notes)}</p>` : ""}
    <div class="cols">
      ${renderColumn("Inputs", inputs)}
      ${renderColumn("Outputs", outputs)}
    </div>
  </article>`;
}

function renderSection(spec, entries) {
  return `<section id="${escapeHtml(spec)}">
    <h2>${escapeHtml(spec)} <span class="count">(${entries.length} tests)</span></h2>
    ${entries.map((e) => renderTest(spec, e)).join("\n")}
  </section>`;
}

const CSS = `
:root {
  --bg: #0d1117;
  --fg: #e6edf3;
  --fg-dim: #8b949e;
  --accent: #20b2aa;
  --border: #30363d;
  --surface: #161b22;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: var(--bg);
  color: var(--fg);
  line-height: 1.5;
}
header {
  padding: 2rem 2.5rem 1.5rem;
  border-bottom: 1px solid var(--border);
}
h1 { margin: 0 0 0.25rem; font-size: 1.75rem; }
header p { margin: 0; color: var(--fg-dim); font-size: 0.9rem; }
nav {
  position: sticky;
  top: 0;
  background: var(--bg);
  padding: 0.75rem 2.5rem;
  border-bottom: 1px solid var(--border);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 0.85rem;
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  z-index: 10;
}
nav a { color: var(--fg-dim); text-decoration: none; }
nav a:hover { color: var(--accent); }
main { padding: 1.5rem 2.5rem 4rem; max-width: 1800px; }
section {
  margin-top: 2rem;
  padding-top: 1rem;
}
h2 {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 1rem;
  color: var(--accent);
  border-top: 1px solid var(--border);
  padding-top: 1.5rem;
  margin: 0 0 1.5rem;
}
h2 .count { color: var(--fg-dim); margin-left: 0.5rem; font-weight: normal; }
.test {
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 8px;
  padding: 1.25rem 1.5rem 1.5rem;
  margin-bottom: 1.25rem;
}
.test h3 { margin: 0 0 0.5rem; font-size: 1.05rem; font-weight: 600; }
.test .notes {
  font-size: 0.875rem;
  color: var(--fg-dim);
  margin: 0 0 1rem;
  border-left: 3px solid var(--accent);
  padding: 0.25rem 0.75rem;
  background: rgba(32, 178, 170, 0.06);
}
.cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}
@media (max-width: 900px) {
  .cols { grid-template-columns: 1fr; }
  header, nav, main { padding-left: 1rem; padding-right: 1rem; }
}
.col h4 {
  margin: 0 0 0.75rem;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 0.7rem;
  color: var(--fg-dim);
}
.art {
  margin: 0 0 1rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  overflow: hidden;
}
.art figcaption {
  padding: 0.6rem 0.8rem;
  border-bottom: 1px solid var(--border);
  font-size: 0.85rem;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
}
.caption-label { color: var(--fg); }
.caption-meta {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 0.7rem;
  color: var(--fg-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.art-image img {
  display: block;
  max-width: 100%;
  max-height: 600px;
  margin: 0 auto;
  background:
    linear-gradient(45deg, #222 25%, transparent 25%),
    linear-gradient(-45deg, #222 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #222 75%),
    linear-gradient(-45deg, transparent 75%, #222 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0;
}
.art-video video, .art-audio audio { display: block; width: 100%; }
.art-pdf embed { display: block; width: 100%; min-height: 500px; background: #fff; }
.art-text pre {
  margin: 0;
  padding: 0.8rem 1rem;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 0.78rem;
  max-height: 480px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
.art-binary, .art-archive .art-binary {
  padding: 1rem;
  color: var(--fg-dim);
  font-size: 0.9rem;
}
.archive-contents { padding: 0.5rem 0.75rem 0.75rem; }
.archive-summary {
  font-size: 0.8rem;
  color: var(--fg-dim);
  padding: 0.25rem 0.25rem 0.5rem;
  border-bottom: 1px dashed var(--border);
  margin-bottom: 0.4rem;
}
.archive-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 360px;
  overflow-y: auto;
}
.archive-list li {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.3rem 0.25rem;
  border-bottom: 1px solid var(--border);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 0.78rem;
}
.archive-list li:last-child { border-bottom: none; }
.archive-name {
  color: var(--fg);
  word-break: break-all;
  min-width: 0;
}
.archive-size { color: var(--fg-dim); white-space: nowrap; }
.archive-preview {
  grid-column: 1 / -1;
  margin-top: 0.3rem;
}
.archive-preview summary {
  cursor: pointer;
  font-size: 0.7rem;
  color: var(--accent);
  user-select: none;
}
.archive-preview pre {
  margin: 0.4rem 0 0;
  padding: 0.5rem 0.6rem;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 0.72rem;
  max-height: 240px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
.art-fallback {
  display: block;
  padding: 0.5rem 0.8rem;
  font-size: 0.75rem;
  color: var(--accent);
  border-top: 1px solid var(--border);
}
a { color: var(--accent); }
`;

function renderHtml(groups) {
  const totalTests = Array.from(groups.values()).reduce((n, v) => n + v.length, 0);
  const generatedAt = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const sortedSpecs = Array.from(groups.keys()).sort();

  const navLinks = sortedSpecs
    .map((s) => `<a href="#${escapeHtml(s)}">${escapeHtml(s)} <span>(${groups.get(s).length})</span></a>`)
    .join("");

  const sections = sortedSpecs.map((s) => renderSection(s, groups.get(s))).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>tools.dcln.me — visual e2e report</title>
  <style>${CSS}</style>
</head>
<body>
  <header>
    <h1>Visual e2e report</h1>
    <p>${totalTests} tests across ${groups.size} hubs · generated ${escapeHtml(generatedAt)}</p>
  </header>
  <nav>${navLinks}</nav>
  <main>${sections}</main>
</body>
</html>
`;
}

function main() {
  if (!existsSync(ARTIFACTS)) {
    console.error(`No test-artifacts/ directory. Run \`npm run test:e2e\` first.`);
    process.exit(1);
  }
  const groups = readMetas();
  if (groups.size === 0) {
    console.error("test-artifacts/ exists but contains no meta.json files.");
    process.exit(1);
  }
  const html = renderHtml(groups);
  const out = join(ARTIFACTS, "index.html");
  writeFileSync(out, html);

  let total = 0;
  for (const [spec, entries] of groups) {
    console.log(`  ${spec.padEnd(20)} ${entries.length} tests`);
    total += entries.length;
  }
  console.log(`\n  Wrote ${out}`);
  console.log(`  Open it in a browser to review ${total} tests.`);
}

main();
