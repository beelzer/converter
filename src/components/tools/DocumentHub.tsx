import { Hub, type ModeSpec } from "../shared/Hub";
import DocMarkdown from "./DocMarkdown";
import DocHtml from "./DocHtml";
import DocDocx from "./DocDocx";
import DocPdfText from "./DocPdfText";

type Mode = "markdown" | "html" | "docx" | "pdf";

const MODES: ModeSpec<Mode>[] = [
  {
    id: "markdown",
    label: "Markdown",
    blurb:
      "Edit Markdown with a live HTML preview. Download as .md, .html, or hand off to the browser print dialog to save as PDF.",
  },
  {
    id: "html",
    label: "HTML",
    blurb:
      "Paste HTML to convert it to clean Markdown via turndown, or print it to PDF using the browser's native engine.",
  },
  {
    id: "docx",
    label: "DOCX",
    blurb:
      "Drop a .docx file to convert it to HTML, Markdown, or plain text via mammoth. Powerpoint and old .doc files not supported.",
  },
  {
    id: "pdf",
    label: "PDF → text",
    blurb:
      "Extract the text layer from a PDF. Works on text-based PDFs; scanned image-only PDFs need OCR (not in this tool).",
  },
];

export default function DocumentHub() {
  return (
    <Hub<Mode>
      modes={MODES}
      initial="markdown"
      ariaLabel="Choose a document operation"
      panels={{
        markdown: <DocMarkdown />,
        html: <DocHtml />,
        docx: <DocDocx />,
        pdf: <DocPdfText />,
      }}
    />
  );
}
