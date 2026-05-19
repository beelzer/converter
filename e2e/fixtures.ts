// Centralized accessor for committed e2e fixtures.
//
// All paths are absolute so Playwright's setInputFiles can consume them
// directly. The files are produced by scripts/build-fixtures.mjs and committed
// under e2e/fixtures/ — see e2e/fixtures/README.md for provenance/licenses.

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TestInfo } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "fixtures");

const f = (rel: string) => path.join(root, rel);

// ----------------------------------------------------------------------------
// Visual test-report helper.
//
// Tests call `report(testInfo, { input, output, notes })` after they produce
// a download. The helper copies the input + output files into
// `test-artifacts/<spec>/<test-slug>/` and writes a `meta.json` sidecar.
// `scripts/build-test-report.mjs` walks that tree and emits a single
// self-contained `index.html` for manual visual review.
//
// Disable per-run with REPORT_ARTIFACTS=0 (skips file copies; tests still run).
// ----------------------------------------------------------------------------

const ARTIFACTS_DIR = path.resolve(here, "..", "test-artifacts");

export interface ReportArtifact {
  /** Absolute path to the file on disk. */
  path: string;
  /** Human-readable description shown above the artifact in the report. */
  label?: string;
}

export interface ReportInput {
  inputs?: ReportArtifact[];
  outputs?: ReportArtifact[];
  /** Convenience shorthand for `inputs: [input]`. */
  input?: ReportArtifact;
  /** Convenience shorthand for `outputs: [output]`. */
  output?: ReportArtifact;
  /** Free-form prose explaining what should be visible in the diff. */
  notes?: string;
}

interface ArtifactMeta {
  name: string;
  label: string;
  size: number;
  ext: string;
}

interface ReportMeta {
  spec: string;
  title: string;
  project: string;
  notes?: string;
  inputs: ArtifactMeta[];
  outputs: ArtifactMeta[];
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function copyArtifact(
  dir: string,
  src: ReportArtifact,
  role: "input" | "output",
  index: number
): ArtifactMeta {
  if (!existsSync(src.path)) {
    throw new Error(`report(): artifact does not exist on disk: ${src.path}`);
  }
  const base = path.basename(src.path);
  const ext = path.extname(base).replace(/^\./, "").toLowerCase();
  const name = `${role}-${index}-${base}`;
  copyFileSync(src.path, path.join(dir, name));
  return {
    name,
    label: src.label ?? base,
    size: statSync(src.path).size,
    ext,
  };
}

export function report(testInfo: TestInfo, r: ReportInput): void {
  if (process.env.REPORT_ARTIFACTS === "0") return;
  const specBase = path.basename(testInfo.file).replace(/\.spec\.ts$/, "");
  const dir = path.join(ARTIFACTS_DIR, specBase, slugify(testInfo.title));
  // Clear any artifacts from a previous run for this test so the report
  // doesn't accumulate stale outputs that no longer correspond to the meta.
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const ins = r.inputs ?? (r.input ? [r.input] : []);
  const outs = r.outputs ?? (r.output ? [r.output] : []);

  const meta: ReportMeta = {
    spec: specBase,
    title: testInfo.title,
    project: testInfo.project.name,
    notes: r.notes,
    inputs: ins.map((a, i) => copyArtifact(dir, a, "input", i)),
    outputs: outs.map((a, i) => copyArtifact(dir, a, "output", i)),
  };

  writeFileSync(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2));
}

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
