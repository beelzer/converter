import { describe, expect, it } from "vitest";
import {
  ACCEPT_DRAWING,
  ACCEPT_PLOT_STYLE,
  COLOR_MODES,
  COLOR_MODE_LABEL,
  ORIENTATIONS,
  ORIENTATION_LABEL,
  PAGE_SIZES,
  PAGE_SIZE_LABEL,
  PAGE_SIZE_MM,
  basenameWithoutExt,
  detectFormat,
} from "./formats";

const file = (name: string, type = "") => new File([new Uint8Array(0)], name, { type });

describe("detectFormat", () => {
  it("identifies DWG by extension", () => {
    expect(detectFormat(file("plan.dwg"))).toBe("dwg");
    expect(detectFormat(file("plan.DWG"))).toBe("dwg");
  });

  it("identifies DXF by extension", () => {
    expect(detectFormat(file("plan.dxf"))).toBe("dxf");
  });

  it("identifies SVG by extension or mime", () => {
    expect(detectFormat(file("logo.svg"))).toBe("svg");
    expect(detectFormat(file("anything", "image/svg+xml"))).toBe("svg");
  });

  it("identifies DWG by mime fallback", () => {
    expect(detectFormat(file("anything", "image/vnd.dwg"))).toBe("dwg");
    expect(detectFormat(file("anything", "application/acad"))).toBe("dwg");
  });

  it("returns null for unrelated files", () => {
    expect(detectFormat(file("notes.txt"))).toBeNull();
    expect(detectFormat(file("no-extension"))).toBeNull();
  });
});

describe("basenameWithoutExt", () => {
  it("removes the trailing extension", () => {
    expect(basenameWithoutExt("plan.dwg")).toBe("plan");
    expect(basenameWithoutExt("a.b.c")).toBe("a.b");
    expect(basenameWithoutExt("README")).toBe("README");
  });
});

describe("catalog metadata", () => {
  it("ACCEPT_DRAWING mentions the three input extensions plus ZIP", () => {
    expect(ACCEPT_DRAWING).toContain(".dwg");
    expect(ACCEPT_DRAWING).toContain(".dxf");
    expect(ACCEPT_DRAWING).toContain(".svg");
    expect(ACCEPT_DRAWING).toContain(".zip");
  });

  it("ACCEPT_PLOT_STYLE mentions CTB and STB", () => {
    expect(ACCEPT_PLOT_STYLE).toContain(".ctb");
    expect(ACCEPT_PLOT_STYLE).toContain(".stb");
  });

  it("PAGE_SIZES has a label and dimensions (except 'fit') for every entry", () => {
    for (const size of PAGE_SIZES) {
      expect(PAGE_SIZE_LABEL[size]).toBeTruthy();
      if (size !== "fit") {
        expect(PAGE_SIZE_MM[size].w).toBeGreaterThan(0);
        expect(PAGE_SIZE_MM[size].h).toBeGreaterThan(0);
      }
    }
  });

  it("A4 is 210×297 mm portrait", () => {
    expect(PAGE_SIZE_MM.a4).toEqual({ w: 210, h: 297 });
  });

  it("ORIENTATIONS has a label for every entry", () => {
    for (const o of ORIENTATIONS) {
      expect(ORIENTATION_LABEL[o]).toBeTruthy();
    }
  });

  it("COLOR_MODES has a label for every entry", () => {
    for (const c of COLOR_MODES) {
      expect(COLOR_MODE_LABEL[c]).toBeTruthy();
    }
  });
});
