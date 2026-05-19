#!/usr/bin/env node
// Build deterministic test fixtures for the e2e suite.
//
// Inputs:  scripts/build-fixtures.mjs (this file) + transient downloads
// Outputs: e2e/fixtures/**/*  (committed binaries — rebuild only if intent changes)
//
// Run: node scripts/build-fixtures.mjs
//
// Requires: ffmpeg on PATH (only when (re)building AV fixtures), internet
// (only on first run to fetch the Big Buck Bunny seed clip).

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { zipSync, gzipSync, strToU8 } from "fflate";
import yaml from "js-yaml";
import { stringify as tomlStringify } from "smol-toml";
import { XMLBuilder } from "fast-xml-parser";
import piexif from "piexifjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT = join(ROOT, "e2e", "fixtures");
const SEED = join(ROOT, "node_modules", ".cache", "fixture-seed");

function ensureDir(p) {
  mkdirSync(p, { recursive: true });
}

function write(rel, bytes) {
  const full = join(OUT, rel);
  ensureDir(dirname(full));
  writeFileSync(full, bytes);
  const size = statSync(full).size;
  console.log(`  ${rel.padEnd(36)} ${size.toString().padStart(8)} bytes`);
}

function runFfmpeg(args) {
  execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], {
    stdio: ["ignore", "inherit", "inherit"],
  });
}

async function fetchSeed() {
  ensureDir(SEED);
  const seedPath = join(SEED, "bbb-1080p-10s.mp4");
  if (existsSync(seedPath)) return seedPath;
  console.log("Downloading Big Buck Bunny 1080p 10s seed (~5MB, CC-BY 3.0)…");
  const url =
    "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_5MB.mp4";
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`Seed download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(seedPath, buf);
  return seedPath;
}

// ============================================================================
// AV fixtures (derived from Big Buck Bunny 10s clip via ffmpeg)
// ============================================================================

async function buildAv() {
  console.log("\n[av]");
  const seed = await fetchSeed();
  ensureDir(join(OUT, "av"));

  // Seed is video-only. We mux in a synthetic sine-wave audio track so the
  // resulting MP4/WebM exercise both streams (which the A/V tools care about).

  // 2-second 320x180 H.264 + AAC MP4
  runFfmpeg([
    "-i", seed,
    "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=2",
    "-t", "2",
    "-vf", "scale=320:180",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "30",
    "-c:a", "aac", "-b:a", "64k",
    "-shortest",
    join(OUT, "av", "clip.mp4"),
  ]);
  console.log(`  av/clip.mp4`);

  // 2-second WebM (VP9 + Opus) — different container for conversion tests
  runFfmpeg([
    "-i", seed,
    "-f", "lavfi", "-i", "sine=frequency=660:sample_rate=48000:duration=2",
    "-t", "2",
    "-vf", "scale=320:180",
    "-c:v", "libvpx-vp9", "-b:v", "200k", "-deadline", "realtime",
    "-c:a", "libopus", "-b:a", "64k",
    "-shortest",
    join(OUT, "av", "clip.webm"),
  ]);
  console.log(`  av/clip.webm`);

  // 2-second MP3 (audio only, generated sine wave)
  runFfmpeg([
    "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=2",
    "-c:a", "libmp3lame", "-b:a", "96k",
    join(OUT, "av", "audio.mp3"),
  ]);
  console.log(`  av/audio.mp3`);

  // 1-second WAV (uncompressed)
  runFfmpeg([
    "-f", "lavfi", "-i", "sine=frequency=880:sample_rate=22050:duration=1",
    "-ac", "1",
    "-c:a", "pcm_s16le",
    join(OUT, "av", "audio.wav"),
  ]);
  console.log(`  av/audio.wav`);

  // Two short MP4 segments for merge test
  runFfmpeg([
    "-i", seed,
    "-ss", "0", "-t", "1",
    "-vf", "scale=320:180",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "30",
    "-an",
    join(OUT, "av", "segment-a.mp4"),
  ]);
  runFfmpeg([
    "-i", seed,
    "-ss", "5", "-t", "1",
    "-vf", "scale=320:180",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "30",
    "-an",
    join(OUT, "av", "segment-b.mp4"),
  ]);
  console.log(`  av/segment-a.mp4 + segment-b.mp4`);

  // ---- High-resolution variants ----
  // Used by dedicated tests that exercise the HD / FHD pipelines. The bulk
  // of the AV suite still uses the small 320x180 clip above so the suite
  // stays fast; these are opt-in per test.

  // 1-second 720p H.264 + AAC MP4 (HD)
  runFfmpeg([
    "-i", seed,
    "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=1",
    "-t", "1",
    "-vf", "scale=1280:720",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "28",
    "-c:a", "aac", "-b:a", "96k",
    "-shortest",
    join(OUT, "av", "clip-720p.mp4"),
  ]);
  console.log(`  av/clip-720p.mp4`);

  // 1-second 1080p H.264 + AAC MP4 (FHD)
  runFfmpeg([
    "-i", seed,
    "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=1",
    "-t", "1",
    "-vf", "scale=1920:1080",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "28",
    "-c:a", "aac", "-b:a", "128k",
    "-shortest",
    join(OUT, "av", "clip-1080p.mp4"),
  ]);
  console.log(`  av/clip-1080p.mp4`);
}

// ============================================================================
// Image fixtures
// ============================================================================

function makeSolidPng(w, h, rgbArr, alpha = 255) {
  const png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) << 2;
      png.data[i] = rgbArr[0];
      png.data[i + 1] = rgbArr[1];
      png.data[i + 2] = rgbArr[2];
      png.data[i + 3] = alpha;
    }
  }
  return PNG.sync.write(png);
}

function makeGradientPng(w, h) {
  const png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) << 2;
      png.data[i] = Math.round((x / w) * 255);
      png.data[i + 1] = Math.round((y / h) * 255);
      png.data[i + 2] = 128;
      png.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

async function buildImages() {
  console.log("\n[image]");
  ensureDir(join(OUT, "image"));

  // Real PNG with alpha (checkerboard transparency pattern)
  const alphaPng = new PNG({ width: 16, height: 16 });
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const i = (y * 16 + x) << 2;
      const checker = (Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0;
      alphaPng.data[i] = checker ? 255 : 0;
      alphaPng.data[i + 1] = checker ? 100 : 200;
      alphaPng.data[i + 2] = 150;
      alphaPng.data[i + 3] = checker ? 255 : 80;
    }
  }
  write("image/alpha.png", PNG.sync.write(alphaPng));

  // Gradient PNG — full 1080p (1920x1080). Exercises high-res scaling code
  // paths in the Image hub's Resize / Convert / Favicon flows.
  write("image/gradient.png", makeGradientPng(1920, 1080));

  // Solid red PNG (small, for convert tests)
  write("image/solid-red.png", makeSolidPng(32, 32, [220, 20, 60]));

  // Convert one to JPEG and inject realistic EXIF tags via piexifjs.
  // 1080p source so the resulting JPEG is a realistic "photo".
  const tmpPng = join(SEED, "_for-jpg.png");
  ensureDir(SEED);
  writeFileSync(tmpPng, makeGradientPng(1920, 1080));
  const jpgPath = join(OUT, "image", "photo-no-exif.jpg");
  runFfmpeg(["-i", tmpPng, "-q:v", "5", jpgPath]);
  console.log(`  image/photo-no-exif.jpg`);

  // Same JPEG with EXIF tags injected
  const jpgBytes = readFileSync(jpgPath);
  const binStr = jpgBytes.toString("binary");
  const exifObj = {
    "0th": {
      [piexif.ImageIFD.Make]: "tools.dcln.me",
      [piexif.ImageIFD.Model]: "Synthetic Fixture",
      [piexif.ImageIFD.Software]: "build-fixtures.mjs",
      [piexif.ImageIFD.Orientation]: 1,
      [piexif.ImageIFD.XResolution]: [72, 1],
      [piexif.ImageIFD.YResolution]: [72, 1],
      [piexif.ImageIFD.ResolutionUnit]: 2,
    },
    Exif: {
      [piexif.ExifIFD.DateTimeOriginal]: "2026:01:01 12:00:00",
      [piexif.ExifIFD.LensModel]: "Test Lens 50mm",
      [piexif.ExifIFD.FNumber]: [28, 10],
      [piexif.ExifIFD.ISOSpeedRatings]: 100,
    },
    GPS: {
      [piexif.GPSIFD.GPSLatitudeRef]: "N",
      [piexif.GPSIFD.GPSLatitude]: [[51, 1], [30, 1], [0, 1]],
      [piexif.GPSIFD.GPSLongitudeRef]: "W",
      [piexif.GPSIFD.GPSLongitude]: [[0, 1], [7, 1], [0, 1]],
    },
  };
  const exifBytes = piexif.dump(exifObj);
  const withExif = piexif.insert(exifBytes, binStr);
  writeFileSync(
    join(OUT, "image", "photo-with-exif.jpg"),
    Buffer.from(withExif, "binary")
  );
  console.log(`  image/photo-with-exif.jpg`);

  // Minimal but real SVG
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" width="200" height="100">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#20B2AA"/>
      <stop offset="100%" stop-color="#7B2CBF"/>
    </linearGradient>
  </defs>
  <rect width="200" height="100" fill="url(#g)"/>
  <text x="100" y="55" text-anchor="middle" font-family="monospace" font-size="16" fill="#fff">tools.dcln.me</text>
</svg>
`;
  write("image/logo.svg", Buffer.from(svg, "utf8"));

  // Animated GIF (4 frames) via ffmpeg from the gradient PNG sequence
  for (let i = 0; i < 4; i++) {
    const frame = makeSolidPng(32, 32, [40 + i * 40, 80, 200 - i * 30]);
    writeFileSync(join(SEED, `_frame-${i}.png`), frame);
  }
  runFfmpeg([
    "-framerate", "4",
    "-i", join(SEED, "_frame-%d.png"),
    "-vf", "scale=32:32:flags=neighbor",
    join(OUT, "image", "animated.gif"),
  ]);
  console.log(`  image/animated.gif`);

  // WebP via ffmpeg
  runFfmpeg([
    "-i", tmpPng,
    "-q:v", "60",
    join(OUT, "image", "sample.webp"),
  ]);
  console.log(`  image/sample.webp`);
}

// ============================================================================
// PDF fixtures (multi-page with text + image, rotated, scanned-style)
// ============================================================================

async function buildPdfs() {
  console.log("\n[pdf]");
  ensureDir(join(OUT, "pdf"));

  // 5-page PDF with real text, embedded raster image, varied fonts.
  const doc = await PDFDocument.create();
  doc.setTitle("tools.dcln.me — fixture PDF");
  doc.setAuthor("build-fixtures.mjs");
  doc.setCreator("pdf-lib");
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const courier = await doc.embedFont(StandardFonts.Courier);

  const pngBytes = makeGradientPng(120, 80);
  const embeddedImage = await doc.embedPng(pngBytes);

  for (let i = 1; i <= 5; i++) {
    const page = doc.addPage([612, 792]);
    page.drawText(`tools.dcln.me — sample PDF`, {
      x: 72, y: 720, size: 18, font: helv, color: rgb(0, 0.1, 0.4),
    });
    page.drawText(`Page ${i} of 5`, {
      x: 72, y: 692, size: 12, font: helv,
    });
    page.drawText(
      "The quick brown fox jumps over the lazy dog.\n" +
      "0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ\n" +
      "abcdefghijklmnopqrstuvwxyz",
      { x: 72, y: 640, size: 11, font: helv, lineHeight: 16 }
    );
    page.drawText(`monospace block on page ${i}`, {
      x: 72, y: 580, size: 11, font: courier,
    });
    page.drawImage(embeddedImage, { x: 72, y: 460, width: 240, height: 160 });
    page.drawText(`Embedded gradient image above (PNG, 120x80).`, {
      x: 72, y: 440, size: 9, font: helv, color: rgb(0.4, 0.4, 0.4),
    });
  }
  write("pdf/multi-page.pdf", Buffer.from(await doc.save()));

  // 3-page rotated PDF (each page declares a 90° rotation)
  const rot = await PDFDocument.create();
  const rotFont = await rot.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 3; i++) {
    const page = rot.addPage([612, 792]);
    page.setRotation(degrees(90));
    page.drawText(`Rotated page ${i}`, { x: 72, y: 700, size: 24, font: rotFont });
  }
  write("pdf/rotated.pdf", Buffer.from(await rot.save()));

  // "Scanned" PDF: image-only, no extractable text
  const scan = await PDFDocument.create();
  const img = await scan.embedPng(makeGradientPng(400, 520));
  const scanPage = scan.addPage([612, 792]);
  scanPage.drawImage(img, { x: 106, y: 136, width: 400, height: 520 });
  write("pdf/scanned.pdf", Buffer.from(await scan.save()));
}

// ============================================================================
// Document fixtures (DOCX, Markdown, HTML)
// ============================================================================

function buildDocx() {
  // Minimal but real DOCX = ZIP containing the required XML parts.
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>tools.dcln.me — sample document</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>This DOCX is generated by the fixture build script. It contains </w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>bold</w:t></w:r>
      <w:r><w:t> text, </w:t></w:r>
      <w:r><w:rPr><w:i/></w:rPr><w:t>italic</w:t></w:r>
      <w:r><w:t> text, and a list:</w:t></w:r>
    </w:p>
    <w:p><w:r><w:t>• First item</w:t></w:r></w:p>
    <w:p><w:r><w:t>• Second item</w:t></w:r></w:p>
    <w:p><w:r><w:t>• Third item</w:t></w:r></w:p>
    <w:p>
      <w:r><w:t>The quick brown fox jumps over the lazy dog.</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;
  const zip = zipSync({
    "[Content_Types].xml": strToU8(contentTypes),
    "_rels/.rels": strToU8(rels),
    "word/document.xml": strToU8(document),
  });
  write("document/sample.docx", Buffer.from(zip));
}

function buildDocs() {
  console.log("\n[document]");
  ensureDir(join(OUT, "document"));

  buildDocx();

  const md = `# Sample Markdown

This file is committed as an e2e fixture for the **Document** hub.

## Lists

- alpha
- bravo
- charlie

## Code

\`\`\`js
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`

## Link

See [tools.dcln.me](https://tools.dcln.me).
`;
  write("document/sample.md", Buffer.from(md, "utf8"));

  const html = `<!DOCTYPE html>
<html>
<head><title>Sample HTML</title></head>
<body>
  <h1>Sample HTML</h1>
  <p>This is a <strong>bold</strong> word and an <em>italic</em> word.</p>
  <ul>
    <li>alpha</li>
    <li>bravo</li>
    <li>charlie</li>
  </ul>
  <p>Visit <a href="https://tools.dcln.me">tools.dcln.me</a>.</p>
</body>
</html>
`;
  write("document/sample.html", Buffer.from(html, "utf8"));
}

// ============================================================================
// Archive fixtures (ZIP, TAR, TAR.GZ, GZIP, nested)
// ============================================================================

function makeUstarTar(entries) {
  // Minimal ustar TAR writer for fixtures.
  const blocks = [];
  for (const entry of entries) {
    const name = entry.name;
    const data = entry.data;
    const header = new Uint8Array(512);
    const enc = new TextEncoder();
    const writeField = (str, offset, length) => {
      const bytes = enc.encode(str);
      header.set(bytes.subarray(0, Math.min(bytes.length, length)), offset);
    };
    writeField(name, 0, 100);
    writeField("0000644 ", 100, 8);
    writeField("0000000 ", 108, 8);
    writeField("0000000 ", 116, 8);
    writeField(data.length.toString(8).padStart(11, "0") + " ", 124, 12);
    writeField("00000000000 ", 136, 12);
    writeField("        ", 148, 8); // checksum placeholder
    header[156] = 0x30; // typeflag '0' = regular file
    writeField("ustar  ", 257, 8);
    // Checksum
    let cksum = 0;
    for (let i = 0; i < 512; i++) cksum += header[i];
    writeField(cksum.toString(8).padStart(6, "0") + "\0 ", 148, 8);
    blocks.push(header);
    blocks.push(data);
    const pad = (512 - (data.length % 512)) % 512;
    if (pad) blocks.push(new Uint8Array(pad));
  }
  blocks.push(new Uint8Array(1024)); // end-of-archive
  const total = blocks.reduce((n, b) => n + b.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const b of blocks) { out.set(b, off); off += b.length; }
  return out;
}

function buildArchives() {
  console.log("\n[archive]");
  ensureDir(join(OUT, "archive"));

  const enc = new TextEncoder();
  const files = {
    "readme.txt": enc.encode("This archive is an e2e fixture for tools.dcln.me.\n"),
    "data.json": enc.encode(JSON.stringify({ name: "Ada", role: "fixture" }, null, 2) + "\n"),
    "notes.md": enc.encode("# Notes\n\nA committed fixture.\n"),
  };

  // ZIP
  write("archive/files.zip", Buffer.from(zipSync(files)));

  // Nested ZIP (subdirectories)
  write(
    "archive/nested.zip",
    Buffer.from(
      zipSync({
        "top.txt": enc.encode("at the top\n"),
        "docs/inner.txt": enc.encode("inside docs\n"),
        "docs/deep/leaf.txt": enc.encode("buried\n"),
      })
    )
  );

  // TAR
  const tarBytes = makeUstarTar(
    Object.entries(files).map(([name, data]) => ({ name, data }))
  );
  write("archive/files.tar", Buffer.from(tarBytes));

  // TAR.GZ
  write("archive/files.tar.gz", Buffer.from(gzipSync(tarBytes)));

  // Single-file GZIP
  write(
    "archive/note.txt.gz",
    Buffer.from(gzipSync(enc.encode("Hello from a real gzipped fixture.\n")))
  );
}

// ============================================================================
// Data fixtures (JSON/YAML/XML/TOML/CSV/TSV — all the same logical record set)
// ============================================================================

const PEOPLE = [
  { name: "Ada Lovelace", born: 1815, role: "mathematician", languages: ["analytical-engine"], active: false },
  { name: "Grace Hopper", born: 1906, role: "rear admiral", languages: ["COBOL", "FLOW-MATIC"], active: false },
  { name: "Hedy Lamarr", born: 1914, role: "inventor", languages: [], active: false },
];

function buildData() {
  console.log("\n[data]");
  ensureDir(join(OUT, "data"));

  write("data/people.json", Buffer.from(JSON.stringify({ people: PEOPLE }, null, 2) + "\n"));
  write("data/people.yaml", Buffer.from(yaml.dump({ people: PEOPLE })));
  write("data/people.toml", Buffer.from(tomlStringify({ people: PEOPLE })));

  // XML
  const xml = new XMLBuilder({ format: true, indentBy: "  " }).build({
    people: { person: PEOPLE },
  });
  write("data/people.xml", Buffer.from('<?xml version="1.0" encoding="UTF-8"?>\n' + xml));

  // CSV — one row per person (languages joined)
  const csvHeader = "name,born,role,languages,active";
  const csvRows = PEOPLE.map((p) =>
    [
      JSON.stringify(p.name),
      p.born,
      JSON.stringify(p.role),
      JSON.stringify(p.languages.join("|")),
      p.active,
    ].join(",")
  );
  write("data/people.csv", Buffer.from(csvHeader + "\n" + csvRows.join("\n") + "\n"));

  // TSV
  const tsvHeader = "name\tborn\trole\tlanguages\tactive";
  const tsvRows = PEOPLE.map((p) =>
    [p.name, p.born, p.role, p.languages.join("|"), p.active].join("\t")
  );
  write("data/people.tsv", Buffer.from(tsvHeader + "\n" + tsvRows.join("\n") + "\n"));
}

// ============================================================================
// Code fixtures (real-world ugly source for beautify + already-pretty for minify)
// ============================================================================

function buildCode() {
  console.log("\n[code]");
  ensureDir(join(OUT, "code"));

  // Ugly JS in need of beautify + minify
  write(
    "code/messy.js",
    Buffer.from(
      `function fibonacci(n){if(n<2)return n;return fibonacci(n-1)+fibonacci(n-2);}\nconst memo={};function fastFib(n){if(n in memo)return memo[n];if(n<2)return n;return memo[n]=fastFib(n-1)+fastFib(n-2);}\nconsole.log(fibonacci(10),fastFib(40));\n`,
      "utf8"
    )
  );

  // CSS with comments + redundant declarations
  write(
    "code/messy.css",
    Buffer.from(
      `/* button styles */\n.btn{color:#ff0000;background-color:#ffffff;padding:10px 10px 10px 10px;margin:0;border:1px solid #cccccc;}\n.btn:hover{color:#ff0000;background-color:#f0f0f0;}\n.unused{display:none}\n`,
      "utf8"
    )
  );

  // HTML with extra whitespace
  write(
    "code/messy.html",
    Buffer.from(
      `<!doctype html>\n<html><head><title>messy</title></head>\n<body>\n    <h1>Title</h1>\n    <p>This   has   extra   spaces.</p>\n    <ul><li>one</li><li>two</li><li>three</li></ul>\n</body>\n</html>\n`,
      "utf8"
    )
  );

  // SQL needing keyword case + indentation
  write(
    "code/messy.sql",
    Buffer.from(
      `select u.id, u.name, count(o.id) as orders from users u left join orders o on o.user_id = u.id where u.active = true group by u.id, u.name having count(o.id) > 5 order by orders desc limit 20;\n`,
      "utf8"
    )
  );

  // Minified JSON
  write(
    "code/messy.json",
    Buffer.from(
      `{"name":"tools","tools":[{"slug":"pdf","live":true},{"slug":"image","live":true}],"meta":{"version":1,"author":"d.j.flitcroft"}}\n`,
      "utf8"
    )
  );

  // TypeScript with comments + unused vars
  write(
    "code/messy.ts",
    Buffer.from(
      `// pricing utility\nexport function priceWithTax(amount: number, taxRate: number = 0.2): number {\n  const tax = amount * taxRate;\n  return amount + tax;\n}\nconst _unused = 42;\nconsole.log(priceWithTax(100));\n`,
      "utf8"
    )
  );
}

// ============================================================================
// Entry point
// ============================================================================

async function main() {
  const only = process.argv[2];
  console.log(`Building fixtures to ${OUT}`);
  if (!only || only === "av") await buildAv();
  if (!only || only === "image") await buildImages();
  if (!only || only === "pdf") await buildPdfs();
  if (!only || only === "doc") buildDocs();
  if (!only || only === "archive") buildArchives();
  if (!only || only === "data") buildData();
  if (!only || only === "code") buildCode();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
