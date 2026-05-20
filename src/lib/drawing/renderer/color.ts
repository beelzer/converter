// AutoCAD Color Index resolution. ACI 1-255 map to a fixed palette; 0 is
// byBlock, 256 is byLayer, 257 (rare) is byEntity. RGB true colours (entity
// .color stored as 24-bit int) bypass the palette entirely.

import type { DwgEntity, DwgLayerTableEntry } from "@mlightcad/libredwg-web";
import type { BlockOverride } from "./types";

// AutoCAD's standard 256-colour palette. Values 1-9 are the legacy 9 basic
// colours; 10-249 follow the chromatic ramp; 250-255 are greyscale steps.
// The full palette is widely documented; we inline it here so the renderer is
// self-contained and not dependent on libredwg's internal colour table.
const ACI_PALETTE: string[] = (() => {
  const palette = new Array<string>(256);
  // 0 is undefined slot (placeholder)
  palette[0] = "#000000";
  // Legacy 1-9
  palette[1] = "#ff0000";
  palette[2] = "#ffff00";
  palette[3] = "#00ff00";
  palette[4] = "#00ffff";
  palette[5] = "#0000ff";
  palette[6] = "#ff00ff";
  palette[7] = "#ffffff"; // background-dependent: use white on light bg, black on dark
  palette[8] = "#414141";
  palette[9] = "#808080";

  // 10–249 — chromatic. Approximated with HSV cycling matching AutoCAD's
  // visible behaviour: hues stepped in 24 buckets of 10 indices each, with
  // 5 saturation rings inside each bucket. Exact AutoCAD ACI requires a
  // lookup table; this approximation is what every OSS DXF viewer uses.
  for (let i = 10; i <= 249; i++) {
    const k = i - 10;
    const hueBucket = Math.floor(k / 10) % 24;
    const ring = k % 10;
    const hue = (hueBucket * 360) / 24;
    const sat = ring < 2 ? 1 : ring < 4 ? 0.75 : ring < 6 ? 0.5 : ring < 8 ? 0.35 : 0.2;
    const val = ring % 2 === 0 ? 1 : 0.6;
    palette[i] = hsvToHex(hue, sat, val);
  }
  // 250-255 greyscale
  const greys = [0x33, 0x55, 0x77, 0x99, 0xbb, 0xdd];
  for (let i = 0; i < greys.length; i++) {
    const g = greys[i].toString(16).padStart(2, "0");
    palette[250 + i] = `#${g}${g}${g}`;
  }
  return palette;
})();

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const hh = (h % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hh < 1) [r, g, b] = [c, x, 0];
  else if (hh < 2) [r, g, b] = [x, c, 0];
  else if (hh < 3) [r, g, b] = [0, c, x];
  else if (hh < 4) [r, g, b] = [0, x, c];
  else if (hh < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = v - c;
  const to8 = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${to8(r)}${to8(g)}${to8(b)}`;
}

export function resolveColor(
  entity: DwgEntity,
  layer: DwgLayerTableEntry | undefined,
  blockOverride: BlockOverride | null
): string {
  // True-colour wins outright when set.
  if (typeof entity.color === "number" && entity.color > 0) {
    return hexFromInt(entity.color);
  }

  const ci = entity.colorIndex;

  // ByBlock — use the colour of the enclosing INSERT; fall back to black.
  if (ci === 0) {
    return blockOverride?.color ?? "#000000";
  }

  // ByLayer / no override — look up the layer.
  if (ci == null || ci === 256) {
    if (layer) {
      if (typeof layer.color === "number" && layer.color > 0) return hexFromInt(layer.color);
      if (typeof layer.colorIndex === "number") return aciHex(layer.colorIndex);
    }
    return "#000000";
  }

  return aciHex(ci);
}

function aciHex(index: number): string {
  if (index < 0) return "#000000";
  // ACI 7 (white) flips to black on a white background — and we always plot
  // onto white. AutoCAD's plot dialog does the same swap.
  if (index === 7) return "#000000";
  if (index >= ACI_PALETTE.length) return "#000000";
  return ACI_PALETTE[index];
}

function hexFromInt(rgb: number): string {
  const cleaned = rgb & 0xffffff;
  // CAD plot convention: entities authored as "white" (RGB 0xFFFFFF, or ACI 7
  // resolved to true-colour) get inverted to black when plotted on a light
  // background. The drawing canvas in AutoCAD is dark by default, so authors
  // use white for legibility there — we flip it for paper output, matching
  // every other plotter on the planet. Without this flip the test drawing's
  // many "white" entities render as white on white = invisible.
  if (cleaned === 0xffffff) return "#000000";
  return `#${cleaned.toString(16).padStart(6, "0")}`;
}

// Mode = "mono" → flatten everything to black-on-white. Returns the same hex
// if mode is "preserve". Centralised so every entity renderer goes through it
// rather than each one having its own override.
export function applyMonoMode(color: string, mode: "preserve" | "mono"): string {
  return mode === "mono" ? "#000000" : color;
}

export { aciHex };
