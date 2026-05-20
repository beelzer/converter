#!/usr/bin/env node
// Walk test-artifacts/ and emit a single self-contained HTML report that lets
// you visually compare each test's input(s) and output(s) side-by-side. Run
// after `npm run test:e2e` (which fills test-artifacts/ via the e2e `report()`
// helper in e2e/fixtures.ts), then open test-artifacts/index.html.
//
// No build step, no framework — the page uses native <img>/<video>/<audio>
// /<embed>/<pre> tags and inline CSS.

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import { unzipSync, gunzipSync } from "fflate";
import hljs from "highlight.js";
import { diffLines, diffWordsWithSpace } from "diff";
import mammoth from "mammoth";
import yaml from "js-yaml";
import { parse as parseToml } from "smol-toml";
import { XMLParser } from "fast-xml-parser";
import Papa from "papaparse";
import exifr from "exifr";

// Map artifact extension → highlight.js language id. Anything not in the map
// falls back to hljs auto-detect, which is decent but not perfect.
const HLJS_LANG = {
  js: "javascript", mjs: "javascript",
  ts: "typescript", tsx: "typescript", jsx: "javascript",
  css: "css", scss: "scss",
  html: "xml", htm: "xml",
  json: "json", webmanifest: "json", manifest: "json",
  yaml: "yaml", yml: "yaml",
  xml: "xml",
  toml: "ini",   // hljs has no toml grammar; ini is the closest visual match.
  sql: "sql",
  md: "markdown", markdown: "markdown",
  sh: "bash",
  py: "python", rb: "ruby", go: "go", rs: "rust",
  // CSV/TSV are tabular; don't highlight, just render plain.
};

// ----------------------------------------------------------------------------
// ffmpeg-driven enhancements (audio waveforms, image PSNR, video first-frame
// comparison). All optional — if ffmpeg isn't on PATH, the report just omits
// these and the rest still renders.
// ----------------------------------------------------------------------------

const FFMPEG_AVAILABLE = (() => {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

function ffmpegRun(args, { verbose = false } = {}) {
  // Run ffmpeg, return { stdout, stderr, ok } without throwing on non-zero.
  // `verbose` raises the loglevel so summary lines from filters like psnr
  // (which log at info level) make it into stderr.
  const r = spawnSync(
    "ffmpeg",
    ["-y", "-hide_banner", "-loglevel", verbose ? "info" : "warning", ...args],
    { encoding: "utf8" }
  );
  return {
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    ok: r.status === 0,
  };
}

function getMediaDuration(path) {
  if (!FFMPEG_AVAILABLE) return null;
  const r = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
    { encoding: "utf8" }
  );
  if (r.status !== 0) return null;
  const d = parseFloat(r.stdout.trim());
  return Number.isFinite(d) ? d : null;
}

// Render a horizontal waveform PNG (600×80) for an audio file (or any media
// file with an audio track). For short clips, trim to a small slice so the
// individual oscillations are visible — otherwise `showwavespic`'s envelope
// renderer just produces a flat block for constant-amplitude signals.
// Returns the filename relative to the test directory, or null if no audio.
function generateWaveform(mediaPath, outDir, outName) {
  if (!FFMPEG_AVAILABLE) return null;
  const outPath = join(outDir, outName);
  const duration = getMediaDuration(mediaPath);

  // Pick a trim window that shows oscillation detail rather than envelope:
  //   short clips (≤ 3s): first 50 ms (~22 cycles at 440 Hz, clearly visible)
  //   medium       (≤ 30s): first 200 ms (texture without losing context)
  //   long      (> 30s): full overview (envelope dominates anyway)
  let trim;
  if (duration === null) trim = null;
  else if (duration <= 3) trim = 0.05;
  else if (duration <= 30) trim = 0.2;
  else trim = null;

  // `draw=full:filter=peak` traces every sample as a pixel rather than
  // scaling the column to envelope amplitude — combined with the trim
  // window above, this makes individual oscillations visible for short
  // clips (a constant sine tone otherwise renders as a solid block).
  //
  // `silenceremove` drops leading encoder priming (AAC ~48ms, Opus ~6ms,
  // mediabunny-encoded streams often a bit more) so the input and output
  // waveforms align on the actual start of the signal rather than on the
  // file's first decoded PCM sample.
  const wave = "showwavespic=s=600x80:colors=#20b2aa:split_channels=0:draw=full:filter=peak";
  const skipLeadingSilence =
    "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.001:detection=peak";
  const filter = trim
    ? `${skipLeadingSilence},atrim=duration=${trim},aresample=async=0,${wave}`
    : `${skipLeadingSilence},${wave}`;

  const r = ffmpegRun([
    "-i", mediaPath,
    "-filter_complex", filter,
    "-frames:v", "1",
    outPath,
  ]);
  if (!r.ok || !existsSync(outPath)) return null;
  return outName;
}

// EXIF tags worth surfacing in the report. Pulled from any JPEG (or other
// EXIF-bearing format) and written to a sidecar so the sync renderer can
// embed them. Used mainly for the Strip-EXIF test, where seeing the
// before/after metadata side-by-side makes the operation's effect obvious.
const EXIF_TAGS_TO_SHOW = [
  ["Make", "Camera make"],
  ["Model", "Camera model"],
  ["LensModel", "Lens"],
  ["Software", "Software"],
  ["DateTimeOriginal", "Taken"],
  ["CreateDate", "Created"],
  ["ISO", "ISO"],
  ["FNumber", "Aperture"],
  ["ExposureTime", "Shutter speed"],
  ["FocalLength", "Focal length"],
  ["Orientation", "Orientation"],
  ["latitude", "GPS latitude"],
  ["longitude", "GPS longitude"],
  ["GPSAltitude", "GPS altitude"],
];

async function prepareExifSidecars(groups) {
  const EXIF_EXTS = new Set(["jpg", "jpeg", "tif", "tiff", "heic", "heif", "webp", "png"]);
  const tasks = [];
  for (const [spec, entries] of groups) {
    for (const entry of entries) {
      const all = [
        ...(entry.meta.inputs ?? []),
        ...(entry.meta.outputs ?? []),
      ];
      for (const art of all) {
        if (!EXIF_EXTS.has(art.ext?.toLowerCase())) continue;
        const imgPath = join(ARTIFACTS, spec, entry.slug, art.name);
        const sidecarPath = imgPath + ".exif.json";
        if (existsSync(sidecarPath)) continue;
        tasks.push(
          exifr
            .parse(imgPath, { reviveValues: true })
            .then((raw) => {
              const out = {};
              if (raw) {
                for (const [key, label] of EXIF_TAGS_TO_SHOW) {
                  const v = raw[key];
                  if (v === undefined || v === null) continue;
                  out[label] =
                    v instanceof Date
                      ? v.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC")
                      : typeof v === "object"
                      ? JSON.stringify(v)
                      : v;
                }
              }
              writeFileSync(sidecarPath, JSON.stringify(out, null, 2));
            })
            .catch(() => writeFileSync(sidecarPath, "{}"))
        );
      }
    }
  }
  if (tasks.length > 0) await Promise.all(tasks);
}

// Pre-render every DOCX artifact to a sidecar HTML file using mammoth, so
// the sync renderer can embed it inline. Browsers don't natively render
// .docx, but mammoth's HTML output preserves headings, lists, bold/italic.
async function prepareDocxPreviews(groups) {
  const tasks = [];
  for (const [spec, entries] of groups) {
    for (const entry of entries) {
      const all = [
        ...(entry.meta.inputs ?? []),
        ...(entry.meta.outputs ?? []),
      ];
      for (const art of all) {
        if (art.ext?.toLowerCase() !== "docx") continue;
        const docxPath = join(ARTIFACTS, spec, entry.slug, art.name);
        const previewPath = docxPath + ".preview.html";
        if (existsSync(previewPath)) continue;
        tasks.push(
          mammoth
            .convertToHtml({ path: docxPath })
            .then((r) => writeFileSync(previewPath, r.value))
            .catch((err) =>
              console.warn(`docx preview failed for ${docxPath}: ${err.message}`)
            )
        );
      }
    }
  }
  if (tasks.length > 0) await Promise.all(tasks);
}

function hasAudioStream(mediaPath) {
  if (!FFMPEG_AVAILABLE) return false;
  const r = spawnSync(
    "ffprobe",
    ["-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_type", "-of", "csv=p=0", mediaPath],
    { encoding: "utf8" }
  );
  return r.status === 0 && r.stdout.trim().length > 0;
}

// PSNR is roughly: >40 dB = visually identical, 30-40 = good, <30 = visible
// degradation, "inf" = pixel-identical. Returns { psnr, dimsMatch } or null
// if ffmpeg can't compute it (dimensions differ, decode failure, etc.).
function comparePsnr(aPath, bPath) {
  if (!FFMPEG_AVAILABLE) return null;
  const r = ffmpegRun([
    "-i", aPath,
    "-i", bPath,
    "-lavfi", "[0:v][1:v]psnr",
    "-f", "null",
    process.platform === "win32" ? "NUL" : "/dev/null",
  ], { verbose: true });
  // ffmpeg writes the PSNR summary on stderr like:
  //   [Parsed_psnr_0 @ ...] PSNR y:32.123 u:34.456 v:35.789 average:33.123 ...
  const summary = r.stderr.match(/PSNR[^\n]*average:([\d.]+|inf)/i);
  if (!summary) return null;
  const value = summary[1];
  return { psnr: value === "inf" ? Infinity : parseFloat(value) };
}

// Extract the first video frame as PNG so we can compare frames between two
// videos of any container/codec via comparePsnr().
function extractFirstFrame(videoPath, outDir, outName) {
  if (!FFMPEG_AVAILABLE) return null;
  const outPath = join(outDir, outName);
  const r = ffmpegRun([
    "-i", videoPath,
    "-frames:v", "1",
    "-q:v", "2",
    outPath,
  ]);
  if (!r.ok || !existsSync(outPath)) return null;
  return outPath;
}

function fmtSimilarity(psnr) {
  if (!isFinite(psnr)) return "identical pixels";
  return `${psnr.toFixed(1)} dB PSNR`;
}

function similarityClass(psnr) {
  if (!isFinite(psnr) || psnr >= 40) return "sim-great";
  if (psnr >= 30) return "sim-good";
  return "sim-degraded";
}

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

// File-type icons. Branded formats use Simple Icons (CC0-licensed brand-mark
// SVG paths from https://github.com/simple-icons/simple-icons — trademarks
// belong to their original owners; Simple Icons explicitly releases the SVG
// path data as CC0 for exactly this kind of nominative use). Generic formats
// without a strong brand fall back to VS Code's Material Icon Theme (MIT).
// Both are downloaded on first run into scripts/file-icons/ (committed in the
// repo) and inlined in the report so the rendered HTML stays self-contained.
const SIMPLE_ICONS_BASE = "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons";
const MATERIAL_ICONS_BASE =
  "https://raw.githubusercontent.com/PKief/vscode-material-icon-theme/main/icons";
const ICON_DIR = resolve(__dirname, "file-icons");

// Each extension maps to a source ("simple" | "material") + icon slug.
// Simple Icons paths have no fill, so we apply the brand `color`. Material
// Icon Theme icons already include their own colored paths.
const ICON_MAP = {
  // Branded — Simple Icons
  pdf:     { src: "simple",   slug: "adobeacrobatreader", color: "#EC1C24" },
  doc:     { src: "simple",   slug: "microsoftword",      color: "#2B579A" },
  docx:    { src: "simple",   slug: "microsoftword",      color: "#2B579A" },
  xls:     { src: "simple",   slug: "microsoftexcel",     color: "#217346" },
  xlsx:    { src: "simple",   slug: "microsoftexcel",     color: "#217346" },
  csv:     { src: "simple",   slug: "microsoftexcel",     color: "#217346" },
  tsv:     { src: "simple",   slug: "microsoftexcel",     color: "#217346" },
  ppt:     { src: "simple",   slug: "microsoftpowerpoint", color: "#B7472A" },
  pptx:    { src: "simple",   slug: "microsoftpowerpoint", color: "#B7472A" },
  yaml:    { src: "simple",   slug: "yaml",               color: "#CB171E" },
  yml:     { src: "simple",   slug: "yaml",               color: "#CB171E" },
  toml:    { src: "simple",   slug: "toml",               color: "#9C4121" },
  html:    { src: "simple",   slug: "html5",              color: "#E34F26" },
  htm:     { src: "simple",   slug: "html5",              color: "#E34F26" },
  css:     { src: "simple",   slug: "css3",               color: "#1572B6" },
  scss:    { src: "simple",   slug: "sass",               color: "#CC6699" },
  js:      { src: "simple",   slug: "javascript",         color: "#F7DF1E" },
  mjs:     { src: "simple",   slug: "javascript",         color: "#F7DF1E" },
  ts:      { src: "simple",   slug: "typescript",         color: "#3178C6" },
  jsx:     { src: "simple",   slug: "react",              color: "#61DAFB" },
  tsx:     { src: "simple",   slug: "react",              color: "#61DAFB" },
  svg:     { src: "simple",   slug: "svg",                color: "#FFB13B" },
  // Generic — Material Icon Theme (own colored designs)
  json:    { src: "material", slug: "json" },
  xml:     { src: "material", slug: "xml" },
  md:      { src: "material", slug: "markdown" },
  markdown:{ src: "material", slug: "markdown" },
  sql:     { src: "material", slug: "database" },
  zip:     { src: "material", slug: "zip" },
  tar:     { src: "material", slug: "zip" },
  gz:      { src: "material", slug: "zip" },
  tgz:    { src: "material", slug: "zip" },
  rar:     { src: "material", slug: "zip" },
  "7z":    { src: "material", slug: "zip" },
  mp4:     { src: "material", slug: "video" },
  webm:    { src: "material", slug: "video" },
  mov:     { src: "material", slug: "video" },
  mkv:     { src: "material", slug: "video" },
  mp3:     { src: "material", slug: "audio" },
  wav:     { src: "material", slug: "audio" },
  ogg:     { src: "material", slug: "audio" },
  flac:    { src: "material", slug: "audio" },
  aac:     { src: "material", slug: "audio" },
  png:     { src: "material", slug: "image" },
  jpg:     { src: "material", slug: "image" },
  jpeg:    { src: "material", slug: "image" },
  gif:     { src: "material", slug: "image" },
  webp:    { src: "material", slug: "image" },
  bmp:     { src: "material", slug: "image" },
  ico:     { src: "material", slug: "image" },
  txt:     { src: "material", slug: "document" },
  log:     { src: "material", slug: "log" },
  webmanifest: { src: "material", slug: "manifest" },
};

const ICON_FALLBACK = { src: "material", slug: "document" };

async function ensureIconCache() {
  mkdirSync(ICON_DIR, { recursive: true });
  // De-duplicate by source+slug so an icon used by many extensions is fetched
  // only once.
  const wanted = new Map();
  for (const cfg of [ICON_FALLBACK, ...Object.values(ICON_MAP)]) {
    wanted.set(`${cfg.src}.${cfg.slug}`, cfg);
  }
  const missing = [...wanted].filter(
    ([key]) => !existsSync(join(ICON_DIR, `${key}.svg`))
  );
  if (missing.length === 0) return;
  console.log(`  fetching ${missing.length} file-type icons…`);
  await Promise.all(
    missing.map(async ([key, cfg]) => {
      const base = cfg.src === "simple" ? SIMPLE_ICONS_BASE : MATERIAL_ICONS_BASE;
      try {
        const res = await fetch(`${base}/${cfg.slug}.svg`);
        if (!res.ok) return;
        const text = await res.text();
        writeFileSync(join(ICON_DIR, `${key}.svg`), text);
      } catch {
        /* offline / fetch failure — icon just won't render */
      }
    })
  );
}

const iconCache = new Map();
function fileTypeIcon(ext) {
  if (!ext) return "";
  const cfg = ICON_MAP[String(ext).toLowerCase()] || ICON_FALLBACK;
  const key = `${cfg.src}.${cfg.slug}`;
  if (iconCache.has(key)) return iconCache.get(key);
  const path = join(ICON_DIR, `${key}.svg`);
  if (!existsSync(path)) {
    iconCache.set(key, "");
    return "";
  }
  let svg = readFileSync(path, "utf8")
    .replace(/<\?xml[^>]*\?>/g, "")
    .replace(/<!DOCTYPE[^>]*>/g, "");
  // Simple Icons paths have no fill — inject the brand color via the root.
  // Material Icon Theme paths already carry their own fills.
  const extra = cfg.src === "simple" && cfg.color
    ? ` class="file-icon" aria-hidden="true" fill="${cfg.color}"`
    : ` class="file-icon" aria-hidden="true"`;
  svg = svg.replace(/<svg([^>]*?)>/, `<svg$1${extra}>`).trim();
  iconCache.set(key, svg);
  return svg;
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

function highlightCode(body, ext) {
  const lang = HLJS_LANG[ext];
  try {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(body, { language: lang, ignoreIllegals: true }).value;
    }
  } catch {
    // fall through to plain
  }
  return escapeHtml(body);
}

// Token-level diff for same-language transformations (beautify, minify,
// format). Unlike a line diff — which makes the SQL beautify look like
// "the whole input was removed and a fresh output was added" — this view
// keeps the tokens that survived the transformation in their normal color
// and only highlights the actual edits: keywords being uppercased, spaces
// becoming newlines, character substitutions made by csso, etc.
//
// Line counts are still shown in the summary so the headline number stays
// intuitive ("+18 -1") even though the body renders at token granularity.
function renderUnifiedDiff(inputBody, outputBody, ext) {
  // Line-count summary (intuitive headline numbers).
  let added = 0;
  let removed = 0;
  for (const c of diffLines(inputBody, outputBody)) {
    if (!c.added && !c.removed) continue;
    const trailingNewline = c.value.endsWith("\n");
    const n = c.value.split("\n").length - (trailingNewline ? 1 : 0);
    if (c.added) added += n;
    else removed += n;
  }
  if (added === 0 && removed === 0) return "";

  // Body: word + whitespace diff. Kept tokens render as plain text so the
  // "content transferred through" is visible; only the genuine changes get
  // red / green inline highlights.
  //
  // Adjacent del+ins pairs whose word content matches case-insensitively
  // (e.g. sql-formatter's `select` → `SELECT`) collapse into a single
  // muted "case-swap" pill — otherwise SQL beautify drowns in red/green
  // when every keyword's case changes. Surrounding whitespace differences
  // are split out and surfaced as their own ins/del so structure changes
  // still register.
  const splitWs = (s) => {
    const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/);
    return { lead: m ? m[1] : "", core: m ? m[2] : s, trail: m ? m[3] : "" };
  };

  const raw = diffWordsWithSpace(inputBody, outputBody);
  const merged = [];
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    const b = raw[i + 1];
    if (a && b && (a.removed || a.added) && (b.removed || b.added) && a.added !== b.added) {
      const del = a.removed ? a : b;
      const ins = a.added ? a : b;
      const delP = splitWs(del.value);
      const insP = splitWs(ins.value);
      if (
        delP.core.length > 0 &&
        delP.core.toLowerCase() === insP.core.toLowerCase() &&
        delP.core !== insP.core
      ) {
        // Case-only swap on the cores; emit any whitespace deltas around
        // it on either side so structural edits aren't silently dropped.
        if (delP.lead === insP.lead) {
          if (delP.lead) merged.push({ value: delP.lead });
        } else {
          if (delP.lead) merged.push({ removed: true, value: delP.lead });
          if (insP.lead) merged.push({ added: true, value: insP.lead });
        }
        merged.push({ caseSwap: true, value: insP.core });
        if (delP.trail === insP.trail) {
          if (delP.trail) merged.push({ value: delP.trail });
        } else {
          if (delP.trail) merged.push({ removed: true, value: delP.trail });
          if (insP.trail) merged.push({ added: true, value: insP.trail });
        }
        i++; // consume both halves
        continue;
      }
    }
    merged.push(a);
  }

  // Apply syntax highlighting per chunk so kept tokens get the same hljs
  // coloring as the input/output panels above (was plain white before).
  // hljs sees each chunk in isolation rather than the full document, which
  // is fine for our small chunks but means we pass `ignoreIllegals` to
  // avoid false bailouts on partial tokens like `count(o.id)`.
  const lang = HLJS_LANG[ext];
  const hl = (s) => {
    try {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(s, { language: lang, ignoreIllegals: true }).value;
      }
    } catch { /* fall through */ }
    return escapeHtml(s);
  };

  const html = merged
    .map((c) => {
      if (c.caseSwap) {
        return `<span class="diff-case" title="case change">${escapeHtml(c.value)}</span>`;
      }
      const text = hl(c.value);
      if (c.added) return `<ins>${text}</ins>`;
      if (c.removed) return `<del>${text}</del>`;
      return text;
    })
    .join("");

  return `<details class="diff-wrapper" open>
    <summary>
      <span class="diff-summary-label">diff</span>
      <span class="diff-summary-stats">
        <span class="diff-stat-added">+${added}</span>
        <span class="diff-stat-removed">-${removed}</span>
      </span>
    </summary>
    <pre class="diff diff-tokens"><code>${html}</code></pre>
  </details>`;
}

function renderArtifact(spec, slug, artifact) {
  const fullPath = join(ARTIFACTS, spec, slug, artifact.name);
  const href = `${encodeURIComponent(spec)}/${encodeURIComponent(slug)}/${encodeURIComponent(artifact.name)}`;
  const ext = artifact.ext.toLowerCase();
  const label = escapeHtml(artifact.label);
  const size = fmtBytes(artifact.size);
  const filename = escapeHtml(artifact.name);

  const header = `
    <figcaption>
      <span class="caption-label">${fileTypeIcon(ext)}<span class="caption-text">${label}</span></span>
      <span class="caption-meta">${filename} · ${size}</span>
    </figcaption>`;

  if (IMAGE_EXTS.has(ext)) {
    // Show EXIF metadata (if any) inline so the Strip-EXIF test reads as
    // "input had these tags, output has none". prepareExifSidecars wrote
    // the sidecar JSON in the async pre-pass.
    let exifBlock = "";
    const exifSidecar = fullPath + ".exif.json";
    if (existsSync(exifSidecar)) {
      try {
        const exif = JSON.parse(readFileSync(exifSidecar, "utf8"));
        const keys = Object.keys(exif);
        if (keys.length > 0) {
          const rows = keys
            .map(
              (k) =>
                `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(String(exif[k]))}</dd>`
            )
            .join("");
          exifBlock = `<details class="exif-block" open>
            <summary>
              <span class="exif-label">EXIF metadata</span>
              <span class="exif-count">${keys.length} field${keys.length === 1 ? "" : "s"}</span>
            </summary>
            <dl class="exif-list">${rows}</dl>
          </details>`;
        }
      } catch { /* ignore */ }
    }
    return `<figure class="art art-image">${header}
      <a href="${href}" target="_blank"><img src="${href}" alt="${label}" loading="lazy"></a>
      ${exifBlock}
    </figure>`;
  }

  // Render a small waveform PNG for any media artifact that has an audio
  // track (audio files always, video files only if they carry audio). The
  // waveform sits under the caption so input/output audio is comparable
  // even when one side is a <video> and the other is an <audio>.
  const buildWaveform = () => {
    const waveName = artifact.name.replace(/\.[^.]+$/, "") + ".waveform.png";
    const wavePath = join(ARTIFACTS, spec, slug, waveName);
    const waveFile = existsSync(wavePath)
      ? waveName
      : generateWaveform(fullPath, join(ARTIFACTS, spec, slug), waveName);
    if (!waveFile) return "";
    const src = `${encodeURIComponent(spec)}/${encodeURIComponent(slug)}/${encodeURIComponent(waveFile)}`;
    return `<img class="waveform" src="${src}" alt="${label} waveform" loading="lazy">`;
  };

  if (VIDEO_EXTS.has(ext)) {
    const waveHtml = hasAudioStream(fullPath) ? buildWaveform() : "";
    return `<figure class="art art-video">${header}
      ${waveHtml}
      <video src="${href}" controls preload="metadata"></video>
    </figure>`;
  }

  if (AUDIO_EXTS.has(ext)) {
    return `<figure class="art art-audio">${header}
      ${buildWaveform()}
      <audio src="${href}" controls preload="metadata"></audio>
    </figure>`;
  }

  if (ext === "pdf") {
    // `download` attribute is the reliable cross-browser action — Chrome
    // sometimes refuses to open PDFs in a new tab from file:// URLs even
    // though they're embeddable inline.
    return `<figure class="art art-pdf">${header}
      <embed src="${href}" type="application/pdf" width="100%" height="500">
      <a class="art-fallback" href="${href}" download="${filename}">${fileTypeIcon("pdf")} Download PDF</a>
    </figure>`;
  }

  if (ext === "docx") {
    // prepareDocxPreviews() ran mammoth in the async pre-pass and wrote a
    // sidecar .docx.preview.html. Embed it for an inline preview that looks
    // like Word's rendering — semantic HTML on a paper-white surface so it
    // pops against the dark report.
    const previewPath = fullPath + ".preview.html";
    if (existsSync(previewPath)) {
      const inner = readFileSync(previewPath, "utf8");
      return `<figure class="art art-docx">${header}
        <div class="docx-preview">${inner}</div>
        <a class="art-fallback" href="${href}" download="${filename}">${fileTypeIcon("docx")} Download .docx</a>
      </figure>`;
    }
    return `<figure class="art art-docx">${header}
      <div class="art-binary">${fileTypeIcon("docx")} <a href="${href}" download="${filename}">Download</a></div>
    </figure>`;
  }

  if (TEXT_EXTS.has(ext)) {
    let body;
    try {
      body = readFileSync(fullPath, "utf8");
    } catch {
      body = "(could not read file as text)";
    }
    const truncated = body.length > TEXT_PREVIEW_LIMIT;
    const display = truncated ? body.slice(0, TEXT_PREVIEW_LIMIT) + "\n…" : body;
    const highlighted = highlightCode(display, ext);
    return `<figure class="art art-text">${header}
      <pre><code class="hljs">${highlighted}</code></pre>
      ${truncated ? `<a class="art-fallback" href="${href}" target="_blank">View full file</a>` : ""}
    </figure>`;
  }

  if (ARCHIVE_EXTS.has(ext)) {
    const inspected = inspectArchive(fullPath, ext);
    if (!inspected) {
      // RAR / 7z / unsupported: fall back to download-only.
      return `<figure class="art art-archive">${header}
        <div class="art-binary">${fileTypeIcon(ext)} Archive — <a href="${href}" download="${filename}">Download</a></div>
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

// Compute a similarity badge for a paired input/output of the same media kind.
// Returns HTML or "" if comparison isn't possible / doesn't make sense.
// Parse a text data file into a JS value, so we can compare across formats.
// Returns undefined if the extension isn't a data format or parsing fails.
const DATA_EXTS_PARSEABLE = new Set([
  "json", "yaml", "yml", "toml", "xml", "csv", "tsv",
]);

function parseDataFile(text, ext) {
  try {
    switch (ext) {
      case "json":
        return JSON.parse(text);
      case "yaml":
      case "yml":
        return yaml.load(text);
      case "toml":
        return parseToml(text);
      case "xml":
        return new XMLParser({ ignoreAttributes: true, trimValues: true }).parse(text);
      case "csv":
      case "tsv": {
        const r = Papa.parse(text, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          delimiter: ext === "tsv" ? "\t" : ",",
        });
        return r.data;
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

// Deep structural equality. Treats missing-key vs undefined-value as equal.
// Does NOT do cross-type coercion (so `"1815"` ≠ `1815`) — but parseDataFile
// with dynamicTyping handles the common case.
function deepEqualData(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqualData(a[i], b[i])) return false;
    }
    return true;
  }
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i++) {
    if (keysA[i] !== keysB[i]) return false;
    if (!deepEqualData(a[keysA[i]], b[keysA[i]])) return false;
  }
  return true;
}

// Render a "data structure preserved across formats" badge for cross-format
// data conversion tests (JSON → YAML, CSV → JSON, etc.). A textual diff is
// meaningless for these — we instead parse both sides and assert the JS
// value trees are equivalent.
function renderStructuralBadge(spec, slug, input, output) {
  const inExt = input.ext.toLowerCase();
  const outExt = output.ext.toLowerCase();
  if (!DATA_EXTS_PARSEABLE.has(inExt) || !DATA_EXTS_PARSEABLE.has(outExt)) return "";
  // Same-ext tests already get a textual diff; the structural check would
  // be redundant noise there.
  if (inExt === outExt) return "";
  try {
    const inText = readFileSync(join(ARTIFACTS, spec, slug, input.name), "utf8");
    const outText = readFileSync(join(ARTIFACTS, spec, slug, output.name), "utf8");
    let inData = parseDataFile(inText, inExt);
    let outData = parseDataFile(outText, outExt);
    if (inData === undefined || outData === undefined) return "";

    // Some converters (CSV → JSON) inflate to an array; the JSON source
    // might be `{ key: [...] }`. Unwrap a single-key wrapper on either
    // side so the "shape" change doesn't mask a true round-trip.
    const unwrap = (v) => {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const keys = Object.keys(v);
        if (keys.length === 1 && Array.isArray(v[keys[0]])) return v[keys[0]];
      }
      return v;
    };
    const inU = unwrap(inData);
    const outU = unwrap(outData);

    const equal = deepEqualData(inData, outData) || deepEqualData(inU, outU);
    if (equal) {
      return `<div class="similarity sim-great">
        <span class="sim-label">data structure</span>
        <span class="sim-value">round-trip preserved across formats</span>
      </div>`;
    }
    return `<div class="similarity sim-degraded">
      <span class="sim-label">data structure</span>
      <span class="sim-value">differs — conversion not lossless</span>
    </div>`;
  } catch {
    return "";
  }
}

function renderSimilarityBadge(spec, slug, input, output) {
  if (!FFMPEG_AVAILABLE) return "";
  const inExt = input.ext.toLowerCase();
  const outExt = output.ext.toLowerCase();
  const dir = join(ARTIFACTS, spec, slug);

  // Image ↔ Image: ffmpeg PSNR works directly across formats provided dims
  // match. (If they don't, ffmpeg errors out and we return null.)
  if (IMAGE_EXTS.has(inExt) && IMAGE_EXTS.has(outExt)) {
    const sim = comparePsnr(join(dir, input.name), join(dir, output.name));
    if (!sim) return "";
    return `<div class="similarity ${similarityClass(sim.psnr)}">
      <span class="sim-label">visual similarity</span>
      <span class="sim-value">${fmtSimilarity(sim.psnr)}</span>
    </div>`;
  }

  // Video ↔ Video: extract first frame from each as JPEGs, compare those.
  if (VIDEO_EXTS.has(inExt) && VIDEO_EXTS.has(outExt)) {
    const aFrame = extractFirstFrame(join(dir, input.name), dir, ".frame-in.jpg");
    const bFrame = extractFirstFrame(join(dir, output.name), dir, ".frame-out.jpg");
    if (!aFrame || !bFrame) return "";
    const sim = comparePsnr(aFrame, bFrame);
    if (!sim) return "";
    return `<div class="similarity ${similarityClass(sim.psnr)}">
      <span class="sim-label">first-frame similarity</span>
      <span class="sim-value">${fmtSimilarity(sim.psnr)}</span>
    </div>`;
  }

  // Video → image (e.g. Frames test): compare extracted-from-source first
  // frame with the produced still.
  if (VIDEO_EXTS.has(inExt) && IMAGE_EXTS.has(outExt)) {
    const aFrame = extractFirstFrame(join(dir, input.name), dir, ".frame-in.jpg");
    if (!aFrame) return "";
    const sim = comparePsnr(aFrame, join(dir, output.name));
    if (!sim) return "";
    return `<div class="similarity ${similarityClass(sim.psnr)}">
      <span class="sim-label">frame vs. source</span>
      <span class="sim-value">${fmtSimilarity(sim.psnr)}</span>
    </div>`;
  }

  return "";
}

function statusBadgeHtml(meta) {
  const status = meta.status;
  if (!status) return "";
  const passed = status === "passed";
  const flaky = passed && (meta.retries ?? 0) > 0;
  const cls = passed
    ? flaky
      ? "test-status status-flaky"
      : "test-status status-passed"
    : "test-status status-failed";
  const label = passed
    ? flaky
      ? `passed (retry ${meta.retries})`
      : "passed"
    : status; // failed / timedOut / interrupted / skipped
  const dur =
    typeof meta.duration === "number"
      ? `<span class="test-duration">${(meta.duration / 1000).toFixed(2)}s</span>`
      : "";
  return `<span class="${cls}">${escapeHtml(label)}</span>${dur}`;
}

function renderErrors(meta) {
  if (!meta.errors || meta.errors.length === 0) return "";
  const items = meta.errors.map((e) => `<li>${escapeHtml(String(e))}</li>`).join("");
  return `<div class="test-errors">
    <h4>Errors</h4>
    <ul>${items}</ul>
  </div>`;
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

  // If there's exactly one input and one output, attempt a similarity badge
  // for the test. Most tests fit this 1:1 shape; for merges (N → 1) we skip.
  let badge = "";
  let diff = "";
  if (inputs.length === 1 && outputs.length === 1) {
    const [inArt, outArt] = [inputs[0], outputs[0]];
    // Media similarity (PSNR) takes priority when both sides are media.
    // For cross-format data converts (different parseable extensions),
    // fall back to a structural-equivalence check.
    badge =
      renderSimilarityBadge(spec, slug, inArt, outArt) ||
      renderStructuralBadge(spec, slug, inArt, outArt);

    // GitHub-style unified diff for same-extension text artifacts
    // (beautify, minify, format, identical-passthrough). Cross-format
    // conversions like JSON → YAML or HTML → Markdown skip this.
    const inExt = inArt.ext.toLowerCase();
    const outExt = outArt.ext.toLowerCase();
    if (
      inExt === outExt &&
      TEXT_EXTS.has(inExt) &&
      !ARCHIVE_EXTS.has(inExt) &&
      !AUDIO_EXTS.has(inExt) &&
      !VIDEO_EXTS.has(inExt) &&
      !IMAGE_EXTS.has(inExt)
    ) {
      try {
        const inBody = readFileSync(join(ARTIFACTS, spec, slug, inArt.name), "utf8");
        const outBody = readFileSync(join(ARTIFACTS, spec, slug, outArt.name), "utf8");
        diff = renderUnifiedDiff(inBody, outBody, inExt);
      } catch {
        // Couldn't read as text — skip diff silently.
      }
    }
  }

  const passedFlag = meta.status ? (meta.status === "passed" ? "passed" : "failed") : "unknown";

  return `<article class="test status-${passedFlag}" id="${escapeHtml(`${spec}-${slug}`)}">
    <div class="test-header">
      <h3>${escapeHtml(meta.title)}</h3>
      ${statusBadgeHtml(meta)}
    </div>
    ${meta.notes ? `<p class="notes">${escapeHtml(meta.notes)}</p>` : ""}
    ${renderErrors(meta)}
    ${badge}
    <div class="cols">
      ${renderColumn("Inputs", inputs)}
      ${renderColumn("Outputs", outputs)}
    </div>
    ${diff}
  </article>`;
}

function countStatuses(entries) {
  let passed = 0;
  let failed = 0;
  let unknown = 0;
  for (const e of entries) {
    const s = e.meta.status;
    if (s === "passed") passed++;
    else if (s) failed++; // failed, timedOut, interrupted, skipped
    else unknown++;
  }
  return { passed, failed, unknown, total: entries.length };
}

function renderSection(spec, entries) {
  const { passed, failed, total } = countStatuses(entries);
  const sub = failed > 0
    ? `<span class="count count-fail">${failed} failed</span> <span class="count">/ ${total} tests</span>`
    : `<span class="count count-pass">${passed} passed</span> <span class="count">/ ${total} tests</span>`;
  return `<section id="${escapeHtml(spec)}">
    <h2>${escapeHtml(spec)} <span class="counts">${sub}</span></h2>
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
  display: flex;
  align-items: stretch;
  min-height: 100vh;
}
aside.sidebar {
  position: sticky;
  top: 0;
  align-self: flex-start;
  width: 240px;
  flex: 0 0 240px;
  height: 100vh;
  overflow-y: auto;
  background: var(--surface);
  border-right: 1px solid var(--border);
  padding: 1.5rem 1.25rem;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 0.85rem;
}
.sidebar h1 {
  margin: 0 0 0.25rem;
  font-size: 1.1rem;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  letter-spacing: 0.02em;
}
.sidebar .subtitle {
  margin: 0 0 1.25rem;
  color: var(--fg-dim);
  font-size: 0.72rem;
  line-height: 1.45;
}
.sidebar nav { display: flex; flex-direction: column; gap: 0.2rem; }
.sidebar nav a {
  color: var(--fg-dim);
  text-decoration: none;
  padding: 0.4rem 0.6rem;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
  border-left: 2px solid transparent;
}
.sidebar nav a:hover {
  color: var(--fg);
  background: rgba(255, 255, 255, 0.03);
}
.sidebar nav a.active {
  color: var(--accent);
  border-left-color: var(--accent);
  background: rgba(32, 178, 170, 0.08);
}
.sidebar nav a .nav-count {
  color: var(--fg-dim);
  font-size: 0.72rem;
}
main {
  flex: 1;
  min-width: 0;
  padding: 1.5rem 2.5rem 4rem;
  max-width: 1600px;
}
section { padding-top: 0.5rem; }
.summary {
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 10px;
  margin-bottom: 1.75rem;
  overflow: hidden;
}
.summary.summary-passed { border-color: rgba(63, 185, 80, 0.45); }
.summary.summary-flaky  { border-color: rgba(210, 153, 34, 0.45); }
.summary.summary-failed { border-color: rgba(248, 81, 73, 0.55); }
.summary-head {
  padding: 1rem 1.25rem 0;
}
.summary-status {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.6rem 1rem;
  margin-bottom: 0.85rem;
}
.summary-glyph {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1;
}
.summary.summary-passed .summary-glyph { color: #3fb950; }
.summary.summary-flaky  .summary-glyph { color: #d29922; }
.summary.summary-failed .summary-glyph { color: #f85149; }
.summary-headline {
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--fg);
  letter-spacing: -0.005em;
}
.summary.summary-failed .summary-headline { color: #f85149; }
.summary-aside {
  margin-left: auto;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 0.78rem;
  color: var(--fg-dim);
}
.summary-bar {
  display: flex;
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.04);
}
.summary-bar > span { display: block; height: 100%; }
.summary-bar .bar-pass  { background: #3fb950; }
.summary-bar .bar-flaky { background: #d29922; }
.summary-bar .bar-fail  { background: #f85149; }

.hub-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(135px, 1fr));
  gap: 0.5rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--border);
  margin-top: 1rem;
  background: var(--bg);
}
.hub-tile {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  text-decoration: none;
  font-size: 0.78rem;
  transition: border-color 120ms, transform 120ms;
}
.hub-tile.hub-pass { border-left: 3px solid #3fb950; }
.hub-tile.hub-fail { border-left: 3px solid #f85149; }
.hub-tile:hover {
  border-color: var(--accent);
  transform: translateY(-1px);
}
.hub-tile.hub-pass:hover { border-color: #3fb950; }
.hub-tile.hub-fail:hover { border-color: #f85149; }
.hub-name { color: var(--fg); }
.hub-numbers { font-size: 0.72rem; white-space: nowrap; }
.hub-pass-count { color: #3fb950; }
.hub-fail-count { color: #f85149; }
.hub-total { color: var(--fg-dim); margin-left: 0.2rem; }

.summary-failed-list {
  border-top: 1px solid var(--border);
  padding: 1rem 1.25rem 1.1rem;
}
.summary-failed-list h3 {
  margin: 0 0 0.6rem;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 0.75rem;
  color: #f85149;
}
.summary-failed-list ul { margin: 0; padding-left: 1rem; }
.summary-failed-list li { margin-bottom: 0.55rem; }
.summary-failed-list a { color: var(--fg); text-decoration: none; }
.summary-failed-list a:hover { color: var(--accent); }
.failed-spec {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 0.75rem;
  color: var(--accent);
}
.failed-error {
  margin-top: 0.25rem;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 0.72rem;
  color: var(--fg-dim);
}
section + section { margin-top: 2.25rem; }
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
@media (max-width: 800px) {
  body { flex-direction: column; }
  aside.sidebar {
    position: static;
    width: 100%;
    flex: 0 0 auto;
    height: auto;
    border-right: none;
    border-bottom: 1px solid var(--border);
  }
  .sidebar nav { flex-direction: row; flex-wrap: wrap; }
}
.test {
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 8px;
  padding: 1.25rem 1.5rem 1.5rem;
  margin-bottom: 1.25rem;
}
.test.status-failed { border-color: rgba(248, 81, 73, 0.55); }
.test-header {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin: 0 0 0.5rem;
}
.test h3 { margin: 0; font-size: 1.05rem; font-weight: 600; flex: 1; min-width: 0; }
.test-status {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg);
  white-space: nowrap;
}
.test-status.status-passed { color: #3fb950; border-color: rgba(63, 185, 80, 0.5); }
.test-status.status-flaky  { color: #d29922; border-color: rgba(210, 153, 34, 0.5); }
.test-status.status-failed { color: #f85149; border-color: rgba(248, 81, 73, 0.6); background: rgba(248, 81, 73, 0.08); }
.test-duration {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 0.7rem;
  color: var(--fg-dim);
  white-space: nowrap;
}
.test-errors {
  border: 1px solid rgba(248, 81, 73, 0.5);
  background: rgba(248, 81, 73, 0.08);
  border-radius: 6px;
  padding: 0.6rem 0.9rem;
  margin-bottom: 0.9rem;
}
.test-errors h4 {
  margin: 0 0 0.4rem;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #f85149;
}
.test-errors ul {
  margin: 0;
  padding-left: 1.1rem;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 0.78rem;
  color: var(--fg);
}
/* Sidebar + section header status colors. */
h2 .counts { font-size: 0.85rem; margin-left: 0.5rem; font-weight: normal; }
h2 .count.count-pass { color: #3fb950; }
h2 .count.count-fail { color: #f85149; }
h2 .count { color: var(--fg-dim); }
.sidebar nav a.has-failed .nav-name { color: #f85149; }
.sidebar nav a .nav-count.nav-fail { color: #f85149; font-weight: bold; }
.sidebar .overall-pass { color: #3fb950; font-weight: 600; }
.sidebar .overall-fail { color: #f85149; font-weight: 600; }
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
@media (max-width: 1200px) {
  .cols { grid-template-columns: 1fr; }
}
@media (max-width: 800px) {
  main { padding: 1rem; }
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
/* Material Icon Theme file-type icons (downloaded + inlined at build) */
.file-icon {
  width: 18px;
  height: 18px;
  vertical-align: middle;
  flex-shrink: 0;
}
.caption-label {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}
.caption-text { color: var(--fg); }
.art-fallback .file-icon {
  width: 16px;
  height: 16px;
  margin-right: 0.4rem;
}
.art-binary .file-icon {
  width: 18px;
  height: 18px;
  margin-right: 0.4rem;
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
.exif-block {
  border-top: 1px solid var(--border);
  background: var(--surface);
}
.exif-block > summary {
  padding: 0.55rem 0.85rem;
  cursor: pointer;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 0.75rem;
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  user-select: none;
}
.exif-label {
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fg-dim);
}
.exif-count { color: var(--fg); }
.exif-list {
  margin: 0;
  padding: 0.5rem 0.85rem 0.75rem;
  display: grid;
  grid-template-columns: minmax(7rem, max-content) 1fr;
  column-gap: 1rem;
  row-gap: 0.25rem;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 0.74rem;
  border-top: 1px dashed var(--border);
}
.exif-list dt { color: var(--fg-dim); }
.exif-list dd { margin: 0; color: var(--fg); word-break: break-word; }
.waveform {
  display: block;
  width: 100%;
  height: 80px;
  background: #0a0d11;
  border-bottom: 1px solid var(--border);
}
.art-pdf embed { display: block; width: 100%; min-height: 500px; background: #fff; }
.docx-preview {
  background: #fff;
  color: #111;
  padding: 1.25rem 1.5rem;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 0.9rem;
  line-height: 1.55;
  max-height: 500px;
  overflow: auto;
}
.docx-preview *:first-child { margin-top: 0; }
.docx-preview h1 { font-size: 1.45rem; margin: 0 0 0.75rem; color: #111; }
.docx-preview h2 { font-size: 1.2rem; margin: 1rem 0 0.5rem; color: #111; }
.docx-preview h3 { font-size: 1.05rem; margin: 0.9rem 0 0.4rem; color: #111; }
.docx-preview p  { margin: 0.5rem 0; }
.docx-preview ul, .docx-preview ol { margin: 0.5rem 0 0.5rem 1.5rem; }
.docx-preview a { color: #0969da; }
.docx-preview table { border-collapse: collapse; margin: 0.75rem 0; }
.docx-preview td, .docx-preview th { border: 1px solid #d0d7de; padding: 0.3rem 0.6rem; }
.docx-preview img { max-width: 100%; height: auto; }
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

/* Similarity badge shown above the input/output columns */
.similarity {
  display: inline-flex;
  align-items: baseline;
  gap: 0.5rem;
  margin: 0 0 0.9rem;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 0.75rem;
  background: var(--surface);
  border: 1px solid var(--border);
}
.similarity .sim-label {
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 0.65rem;
  color: var(--fg-dim);
}
.similarity .sim-value { color: var(--fg); }
.similarity.sim-great { border-color: rgba(63, 185, 80, 0.5); }
.similarity.sim-great .sim-value { color: #3fb950; }
.similarity.sim-good  { border-color: rgba(210, 153, 34, 0.5); }
.similarity.sim-good  .sim-value { color: #d29922; }
.similarity.sim-degraded { border-color: rgba(248, 81, 73, 0.5); }
.similarity.sim-degraded .sim-value { color: #f85149; }

/* Unified diff (GitHub-style red/green) — shown for same-ext text artifacts */
.diff-wrapper {
  margin-top: 1rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  overflow: hidden;
}
.diff-wrapper > summary {
  padding: 0.6rem 0.9rem;
  cursor: pointer;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 0.8rem;
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  user-select: none;
  background: var(--surface);
}
.diff-wrapper[open] > summary { border-bottom: 1px solid var(--border); }
.diff-summary-label {
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 0.7rem;
  color: var(--fg-dim);
}
.diff-summary-stats { display: inline-flex; gap: 0.5rem; }
.diff-stat-added { color: #3fb950; }
.diff-stat-removed { color: #f85149; }
.diff {
  margin: 0;
  padding: 0.75rem 1rem;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 0.78rem;
  max-height: 600px;
  overflow: auto;
}
.diff code { display: block; }
/* Token diff: kept content renders as plain text; only edits get
   colored backgrounds so the "stuff that transferred through" stays
   visible as the anchor for reading the change. */
.diff-tokens {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.55;
  color: var(--fg);
}
.diff-tokens ins {
  background: rgba(63, 185, 80, 0.20);
  color: #3fb950;
  text-decoration: none;
  border-radius: 2px;
  padding: 1px 2px;
  box-shadow: inset 0 -1px 0 rgba(63, 185, 80, 0.45);
}
.diff-tokens del {
  background: rgba(248, 81, 73, 0.16);
  color: #f85149;
  text-decoration: line-through;
  text-decoration-color: rgba(248, 81, 73, 0.6);
  border-radius: 2px;
  padding: 1px 2px;
  box-shadow: inset 0 -1px 0 rgba(248, 81, 73, 0.45);
}
/* Case-only swap (e.g. sql-formatter's select → SELECT). Render the new
   value with a muted blue highlight so it's flagged as "changed" without
   contributing to the red/green noise. */
.diff-tokens .diff-case {
  background: rgba(125, 156, 245, 0.18);
  color: #79c0ff;
  border-radius: 2px;
  padding: 1px 2px;
  box-shadow: inset 0 -1px 0 rgba(125, 156, 245, 0.45);
}
/* Make whitespace-only edits visible: a tiny pill is hard to miss
   even when there's no glyph inside. */
.diff-tokens ins:empty,
.diff-tokens del:empty { min-width: 0.6em; display: inline-block; }

/* highlight.js — github-dark-ish palette, tuned to the report colors. */
.hljs { color: var(--fg); background: transparent; }
.hljs-comment, .hljs-quote { color: #8b949e; font-style: italic; }
.hljs-keyword, .hljs-selector-tag, .hljs-literal,
.hljs-name, .hljs-tag .hljs-name { color: #ff7b72; }
.hljs-string, .hljs-attr, .hljs-attribute,
.hljs-doctag, .hljs-regexp { color: #a5d6ff; }
.hljs-number, .hljs-symbol, .hljs-bullet,
.hljs-meta, .hljs-deletion { color: #79c0ff; }
.hljs-built_in, .hljs-builtin-name, .hljs-type,
.hljs-class .hljs-title, .hljs-section { color: #ffa657; }
.hljs-title, .hljs-title.function_, .hljs-title.class_,
.hljs-variable, .hljs-template-variable { color: #d2a8ff; }
.hljs-params { color: var(--fg); }
.hljs-tag, .hljs-tag .hljs-attr, .hljs-tag .hljs-string { color: var(--fg-dim); }
.hljs-property, .hljs-attr { color: #79c0ff; }
.hljs-selector-class, .hljs-selector-id, .hljs-selector-pseudo,
.hljs-selector-attr { color: #ffa657; }
.hljs-attribute { color: #79c0ff; }
.hljs-punctuation { color: var(--fg-dim); }
.hljs-emphasis { font-style: italic; }
.hljs-strong { font-weight: bold; }
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

  // Aggregate pass/fail counts for the sidebar.
  let totalPassed = 0;
  let totalFailed = 0;
  const specStats = new Map();
  for (const s of sortedSpecs) {
    const stats = countStatuses(groups.get(s));
    specStats.set(s, stats);
    totalPassed += stats.passed;
    totalFailed += stats.failed;
  }

  const navLinks = sortedSpecs
    .map((s) => {
      const stats = specStats.get(s);
      const cls = stats.failed > 0 ? "has-failed" : "all-passed";
      const countHtml =
        stats.failed > 0
          ? `<span class="nav-count nav-fail">${stats.failed}f</span>`
          : `<span class="nav-count">${stats.total}</span>`;
      return (
        `<a href="#${escapeHtml(s)}" data-target="${escapeHtml(s)}" class="${cls}">` +
        `<span class="nav-name">${escapeHtml(s)}</span>` +
        countHtml +
        `</a>`
      );
    })
    .join("");

  // Aggregate per-hub stats + a list of failed tests for the summary card.
  const failedList = [];
  let totalDuration = 0;
  let totalFlaky = 0;
  for (const [spec, entries] of groups) {
    for (const e of entries) {
      const meta = e.meta;
      if (typeof meta.duration === "number") totalDuration += meta.duration;
      if (meta.status === "passed" && (meta.retries ?? 0) > 0) totalFlaky++;
      if (meta.status && meta.status !== "passed") {
        failedList.push({
          spec,
          slug: e.slug,
          title: meta.title,
          status: meta.status,
          firstError: meta.errors?.[0],
        });
      }
    }
  }
  const totalSeconds = (totalDuration / 1000).toFixed(2);
  const overallClass =
    totalFailed > 0 ? "summary-failed" : totalFlaky > 0 ? "summary-flaky" : "summary-passed";

  const hubGrid = sortedSpecs
    .map((s) => {
      const stats = specStats.get(s);
      const cls = stats.failed > 0 ? "hub-fail" : "hub-pass";
      return `<a class="hub-tile ${cls}" href="#${escapeHtml(s)}">
        <span class="hub-name">${escapeHtml(s)}</span>
        <span class="hub-numbers">
          ${stats.failed > 0
            ? `<span class="hub-fail-count">${stats.failed} failed</span>`
            : `<span class="hub-pass-count">${stats.passed} passed</span>`}
          <span class="hub-total">/ ${stats.total}</span>
        </span>
      </a>`;
    })
    .join("");

  const failedListHtml = failedList.length > 0
    ? `<div class="summary-failed-list">
        <h3>Failed tests</h3>
        <ul>
          ${failedList
            .map(
              (f) =>
                `<li><a href="#${escapeHtml(`${f.spec}-${f.slug}`)}"><span class="failed-spec">${escapeHtml(f.spec)}</span> · ${escapeHtml(f.title)}</a>${
                  f.firstError ? `<div class="failed-error">${escapeHtml(String(f.firstError))}</div>` : ""
                }</li>`
            )
            .join("")}
        </ul>
      </div>`
    : "";

  // Bar segments — green for passed, amber for flaky, red for failed.
  // Always normalize to the same total so the bar visually sums to 100%.
  const passedShare = totalTests > 0 ? (totalPassed - totalFlaky) / totalTests * 100 : 0;
  const flakyShare = totalTests > 0 ? totalFlaky / totalTests * 100 : 0;
  const failedShare = totalTests > 0 ? totalFailed / totalTests * 100 : 0;

  const headlineText = totalFailed > 0
    ? `${totalFailed} failed`
    : totalFlaky > 0
      ? `${totalPassed} passed · ${totalFlaky} flaky`
      : `All ${totalPassed} passed`;

  const summaryCard = `<section class="summary ${overallClass}">
    <header class="summary-head">
      <div class="summary-status">
        <span class="summary-glyph">${totalFailed > 0 ? "✕" : "✓"}</span>
        <span class="summary-headline">${headlineText}</span>
        <span class="summary-aside">${totalTests} tests · ${groups.size} hubs · ${totalSeconds}s</span>
      </div>
      <div class="summary-bar" role="img" aria-label="${totalPassed} passed, ${totalFlaky} flaky, ${totalFailed} failed of ${totalTests}">
        ${passedShare > 0 ? `<span class="bar-pass" style="width:${passedShare.toFixed(2)}%"></span>` : ""}
        ${flakyShare > 0 ? `<span class="bar-flaky" style="width:${flakyShare.toFixed(2)}%"></span>` : ""}
        ${failedShare > 0 ? `<span class="bar-fail" style="width:${failedShare.toFixed(2)}%"></span>` : ""}
      </div>
    </header>
    <div class="hub-grid">${hubGrid}</div>
    ${failedListHtml}
  </section>`;

  const sections = sortedSpecs.map((s) => renderSection(s, groups.get(s))).join("\n");

  // Active-section tracking via IntersectionObserver. Tiny vanilla JS — no
  // framework or external script. The first section whose top has scrolled
  // into the upper portion of the viewport wins.
  const activeScript = `
(function() {
  const links = new Map();
  document.querySelectorAll('.sidebar nav a[data-target]').forEach(a => {
    links.set(a.dataset.target, a);
  });
  const setActive = (id) => {
    for (const [target, a] of links) {
      a.classList.toggle('active', target === id);
    }
  };
  const sections = Array.from(document.querySelectorAll('main > section'));
  if (sections.length === 0) return;
  const io = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.target.offsetTop - b.target.offsetTop);
      if (visible.length > 0) setActive(visible[0].target.id);
    },
    { rootMargin: '-10% 0px -75% 0px', threshold: 0 }
  );
  sections.forEach((s) => io.observe(s));
  setActive(sections[0].id);
})();
`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>tools.dcln.me — visual e2e report</title>
  <style>${CSS}</style>
</head>
<body>
  <aside class="sidebar">
    <h1>visual e2e report</h1>
    <p class="subtitle">
      ${totalFailed > 0
        ? `<span class="overall-fail">${totalFailed} failed</span> / ${totalTests} tests`
        : `<span class="overall-pass">all ${totalPassed} passed</span>`}
      · ${groups.size} hubs<br>generated ${escapeHtml(generatedAt)}
    </p>
    <nav>${navLinks}</nav>
  </aside>
  <main>${summaryCard}${sections}</main>
  <script>${activeScript}</script>
</body>
</html>
`;
}

async function main() {
  if (!existsSync(ARTIFACTS)) {
    console.error(`No test-artifacts/ directory. Run \`npm run test:e2e\` first.`);
    process.exit(1);
  }
  const groups = readMetas();
  if (groups.size === 0) {
    console.error("test-artifacts/ exists but contains no meta.json files.");
    process.exit(1);
  }
  // Pre-generate sidecar previews that need async work (DOCX → HTML via
  // mammoth, EXIF extraction via exifr) and fetch the file-type icons on
  // first run. The sync renderer below just reads from disk.
  await Promise.all([
    prepareDocxPreviews(groups),
    prepareExifSidecars(groups),
    ensureIconCache(),
  ]);
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
