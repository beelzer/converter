// CAD drawing input formats supported by /drawing.
//
// DWG and DXF are both parsed by libredwg-web's WASM (default published build
// supports both; see drawing-v1-scope memory). SVG is native — no parser.

export type DrawingFormat = "dwg" | "dxf" | "svg";

export const ACCEPT_DRAWING = ".dwg,.dxf,.svg,.zip,image/svg+xml,application/zip";
export const ACCEPT_PLOT_STYLE = ".ctb,.stb";

export function detectFormat(file: File): DrawingFormat | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "dwg") return "dwg";
  if (ext === "dxf") return "dxf";
  if (ext === "svg") return "svg";
  if (file.type === "image/svg+xml") return "svg";
  if (file.type === "image/vnd.dwg" || file.type === "application/acad") return "dwg";
  return null;
}

export function basenameWithoutExt(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

// Page sizes in millimetres (jsPDF works in mm by default).
export type PageSize = "fit" | "a4" | "a3" | "a2" | "a1" | "a0" | "letter" | "tabloid";
export const PAGE_SIZES: readonly PageSize[] = [
  "fit",
  "a4",
  "a3",
  "a2",
  "a1",
  "a0",
  "letter",
  "tabloid",
];
export const PAGE_SIZE_LABEL: Record<PageSize, string> = {
  fit: "Fit to drawing",
  a4: "A4 (210×297)",
  a3: "A3 (297×420)",
  a2: "A2 (420×594)",
  a1: "A1 (594×841)",
  a0: "A0 (841×1189)",
  letter: "Letter (216×279)",
  tabloid: "Tabloid (279×432)",
};
// Portrait dimensions in mm. Landscape swaps width/height.
export const PAGE_SIZE_MM: Record<Exclude<PageSize, "fit">, { w: number; h: number }> = {
  a4: { w: 210, h: 297 },
  a3: { w: 297, h: 420 },
  a2: { w: 420, h: 594 },
  a1: { w: 594, h: 841 },
  a0: { w: 841, h: 1189 },
  letter: { w: 216, h: 279 },
  tabloid: { w: 279, h: 432 },
};

export type Orientation = "auto" | "portrait" | "landscape";
export const ORIENTATIONS: readonly Orientation[] = ["auto", "portrait", "landscape"];
export const ORIENTATION_LABEL: Record<Orientation, string> = {
  auto: "Auto",
  portrait: "Portrait",
  landscape: "Landscape",
};

export type ColorMode = "preserve" | "mono";
export const COLOR_MODES: readonly ColorMode[] = ["preserve", "mono"];
export const COLOR_MODE_LABEL: Record<ColorMode, string> = {
  preserve: "Preserve colors",
  mono: "Black on white",
};
