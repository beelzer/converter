import { Hub, type ModeSpec } from "../shared/Hub";
import PdfMerger from "./PdfMerger";
import PdfSplitter from "./PdfSplitter";
import PdfRotator from "./PdfRotator";
import PdfOrganizer from "./PdfOrganizer";
import ImagesToPdf from "./ImagesToPdf";
import PdfToImages from "./PdfToImages";

type Mode = "merge" | "split" | "rotate" | "organize" | "images-to-pdf" | "to-images";

const MODES: ModeSpec<Mode>[] = [
  { id: "merge", label: "Merge", blurb: "Combine multiple PDFs into one. Drag to reorder, then download." },
  { id: "split", label: "Split", blurb: "Extract pages or ranges into a new PDF in the order you list them." },
  { id: "rotate", label: "Rotate", blurb: "Rotate every page, or just specific pages, by 90°, 180° or 270°." },
  { id: "organize", label: "Organize", blurb: "Reorder or delete pages using thumbnail previews. Drag to move, × to delete." },
  { id: "images-to-pdf", label: "Images → PDF", blurb: "Drop JPG, PNG, WebP, GIF or BMP images and combine them into a single PDF." },
  { id: "to-images", label: "PDF → Images", blurb: "Render each page of a PDF as a JPG or PNG. Multiple pages download as a ZIP." },
];

export default function PdfHub() {
  return (
    <Hub<Mode>
      modes={MODES}
      initial="merge"
      ariaLabel="Choose a PDF operation"
      panels={{
        merge: <PdfMerger />,
        split: <PdfSplitter />,
        rotate: <PdfRotator />,
        organize: <PdfOrganizer />,
        "images-to-pdf": <ImagesToPdf />,
        "to-images": <PdfToImages />,
      }}
    />
  );
}
