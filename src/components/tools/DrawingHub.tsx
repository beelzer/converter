import { Hub, type ModeSpec } from "../shared/Hub";
import DrawingConvertPdf from "./DrawingConvertPdf";
import DrawingConvertSvg from "./DrawingConvertSvg";
import DrawingConvertPng from "./DrawingConvertPng";
import DrawingExtractDxf from "./DrawingExtractDxf";

type Mode = "pdf" | "svg" | "png" | "dxf";

const MODES: ModeSpec<Mode>[] = [
  {
    id: "pdf",
    label: "Convert to PDF",
    blurb:
      "DWG, DXF, or SVG to vector PDF. Page size, orientation, color mode, layer visibility, and paper-space layout are all configurable per file.",
  },
  {
    id: "svg",
    label: "Convert to SVG",
    blurb:
      "DWG or DXF to SVG. Useful when you want a web-friendly vector you can embed, edit in Inkscape / Figma, or post-process yourself.",
  },
  {
    id: "png",
    label: "Convert to PNG",
    blurb:
      "DWG, DXF, or SVG to PNG raster. Three resolutions for screen, web Retina, or print. The PDF output is always preferable for archival CAD use.",
  },
  {
    id: "dxf",
    label: "Extract DXF",
    blurb:
      "Unwrap a DWG into the open DXF interchange format losslessly. No rendering, no fidelity loss — just unlocks the proprietary container.",
  },
];

export default function DrawingHub() {
  return (
    <Hub<Mode>
      modes={MODES}
      initial="pdf"
      ariaLabel="Choose a drawing operation"
      panels={{
        pdf: <DrawingConvertPdf />,
        svg: <DrawingConvertSvg />,
        png: <DrawingConvertPng />,
        dxf: <DrawingExtractDxf />,
      }}
    />
  );
}
