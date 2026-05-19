import { Hub, type ModeSpec } from "../shared/Hub";
import DataConverter from "./DataConverter";
import DataFormatter from "./DataFormatter";
import DataValidator from "./DataValidator";
import DataTypeGenerator from "./DataTypeGenerator";

type Mode = "convert" | "format" | "validate" | "types";

const MODES: ModeSpec<Mode>[] = [
  {
    id: "convert",
    label: "Convert",
    blurb:
      "Convert between JSON, YAML, XML, TOML, CSV and TSV. Input format is auto-detected from drop or paste.",
  },
  {
    id: "format",
    label: "Format / Minify",
    blurb: "Pretty-print or minify any of the supported formats. Pick indent size for pretty mode.",
  },
  {
    id: "validate",
    label: "Validate",
    blurb:
      "Check the syntax of your input. Errors include line and column when the parser provides them.",
  },
  {
    id: "types",
    label: "TS Types",
    blurb:
      "Generate TypeScript interfaces from a sample JSON or YAML document. Inference is structural — more representative samples produce better types.",
  },
];

export default function DataHub() {
  return (
    <Hub<Mode>
      modes={MODES}
      initial="convert"
      ariaLabel="Choose a data operation"
      panels={{
        convert: <DataConverter />,
        format: <DataFormatter />,
        validate: <DataValidator />,
        types: <DataTypeGenerator />,
      }}
    />
  );
}
