// SVG → vector PDF using jsPDF + svg2pdf.js. svg2pdf renders SVG primitives
// as native PDF paths so the output stays vector — important for CAD where
// users zoom in to inspect tolerances.
//
// Both libs are MIT. svg2pdf is loaded dynamically because jsPDF is ~280 KB
// and we only need it once a user clicks Convert.

import type { Orientation, PageSize } from "./formats";
import { PAGE_SIZE_MM } from "./formats";

export interface PdfOptions {
  pageSize: PageSize;
  orientation: Orientation;
  // Pre-rendered SVG width / height (svg user units). Used both for page
  // sizing when pageSize === "fit" and for fit-inside-page scale otherwise.
  drawingWidth: number;
  drawingHeight: number;
}

const MARGIN_MM = 8;

export async function svgToPdf(svg: string, options: PdfOptions): Promise<Uint8Array> {
  const { default: jsPDFCtor } = await import("jspdf");
  const { svg2pdf } = await import("svg2pdf.js");

  const { pageW, pageH, orientation } = resolvePage(options);

  const doc = new jsPDFCtor({
    unit: "mm",
    format: [pageW, pageH],
    orientation,
    compress: true,
  });

  const svgEl = new DOMParser().parseFromString(svg, "image/svg+xml").documentElement;
  if (svgEl.tagName === "parsererror") {
    throw new Error("The rendered SVG was malformed and could not be embedded in PDF.");
  }

  const drawableW = pageW - MARGIN_MM * 2;
  const drawableH = pageH - MARGIN_MM * 2;
  const scale = Math.min(
    drawableW / Math.max(options.drawingWidth, 1),
    drawableH / Math.max(options.drawingHeight, 1)
  );
  const renderW = options.drawingWidth * scale;
  const renderH = options.drawingHeight * scale;
  const x = (pageW - renderW) / 2;
  const y = (pageH - renderH) / 2;

  // svg2pdf needs the SVG element to have a real layout to compute internal
  // scaling. A detached element with width="100%" / height="100%" reports a
  // computed size of 0×0 and svg2pdf renders nothing. Fix: drop the percent
  // sizes for concrete pixels, then attach the element to the document for
  // the duration of the conversion. The hidden wrapper keeps it off-screen.
  svgEl.setAttribute("width", `${renderW}`);
  svgEl.setAttribute("height", `${renderH}`);

  const host = document.createElement("div");
  host.style.cssText =
    "position:absolute;left:-99999px;top:0;width:0;height:0;overflow:hidden;visibility:hidden;";
  host.appendChild(svgEl);
  document.body.appendChild(host);

  try {
    await svg2pdf(svgEl as unknown as HTMLElement, doc, {
      x,
      y,
      width: renderW,
      height: renderH,
    });
  } finally {
    document.body.removeChild(host);
  }

  const output = doc.output("arraybuffer") as ArrayBuffer;
  return new Uint8Array(output);
}

function resolvePage(options: PdfOptions): {
  pageW: number;
  pageH: number;
  orientation: "p" | "l";
} {
  const aspectLandscape = options.drawingWidth >= options.drawingHeight;
  let orientation: "p" | "l";
  switch (options.orientation) {
    case "portrait":
      orientation = "p";
      break;
    case "landscape":
      orientation = "l";
      break;
    default:
      orientation = aspectLandscape ? "l" : "p";
  }

  if (options.pageSize === "fit") {
    // Treat SVG user units as mm, clamped to a sane range so we don't ask
    // jsPDF to produce a 50 km PDF if a DWG has crazy units.
    const w = clamp(options.drawingWidth + MARGIN_MM * 2, 50, 5000);
    const h = clamp(options.drawingHeight + MARGIN_MM * 2, 50, 5000);
    // For fit, ignore "auto" — the SVG itself already dictates the page shape.
    return options.orientation === "landscape"
      ? { pageW: Math.max(w, h), pageH: Math.min(w, h), orientation: "l" }
      : options.orientation === "portrait"
        ? { pageW: Math.min(w, h), pageH: Math.max(w, h), orientation: "p" }
        : { pageW: w, pageH: h, orientation: w >= h ? "l" : "p" };
  }

  const base = PAGE_SIZE_MM[options.pageSize];
  return orientation === "l"
    ? { pageW: base.h, pageH: base.w, orientation: "l" }
    : { pageW: base.w, pageH: base.h, orientation: "p" };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
