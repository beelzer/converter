// Centralized accessor for committed e2e fixtures.
//
// All paths are absolute so Playwright's setInputFiles can consume them
// directly. The files are produced by scripts/build-fixtures.mjs and committed
// under e2e/fixtures/ — see e2e/fixtures/README.md for provenance/licenses.

import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "fixtures");

const f = (rel: string) => path.join(root, rel);

export const FIXTURES = {
  av: {
    clipMp4: f("av/clip.mp4"),
    clipWebm: f("av/clip.webm"),
    audioMp3: f("av/audio.mp3"),
    audioWav: f("av/audio.wav"),
    segmentA: f("av/segment-a.mp4"),
    segmentB: f("av/segment-b.mp4"),
  },
  image: {
    alphaPng: f("image/alpha.png"),
    gradientPng: f("image/gradient.png"),
    solidRedPng: f("image/solid-red.png"),
    photoNoExifJpg: f("image/photo-no-exif.jpg"),
    photoWithExifJpg: f("image/photo-with-exif.jpg"),
    logoSvg: f("image/logo.svg"),
    animatedGif: f("image/animated.gif"),
    webp: f("image/sample.webp"),
  },
  pdf: {
    multiPage: f("pdf/multi-page.pdf"),
    rotated: f("pdf/rotated.pdf"),
    scanned: f("pdf/scanned.pdf"),
  },
  document: {
    docx: f("document/sample.docx"),
    md: f("document/sample.md"),
    html: f("document/sample.html"),
  },
  archive: {
    zip: f("archive/files.zip"),
    nestedZip: f("archive/nested.zip"),
    tar: f("archive/files.tar"),
    tarGz: f("archive/files.tar.gz"),
    noteTxtGz: f("archive/note.txt.gz"),
  },
  data: {
    json: f("data/people.json"),
    yaml: f("data/people.yaml"),
    xml: f("data/people.xml"),
    toml: f("data/people.toml"),
    csv: f("data/people.csv"),
    tsv: f("data/people.tsv"),
  },
  code: {
    js: f("code/messy.js"),
    ts: f("code/messy.ts"),
    css: f("code/messy.css"),
    html: f("code/messy.html"),
    json: f("code/messy.json"),
    sql: f("code/messy.sql"),
  },
} as const;
