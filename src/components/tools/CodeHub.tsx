import { Hub, type ModeSpec } from "../shared/Hub";
import CodeBeautifier from "./CodeBeautifier";
import CodeMinifier from "./CodeMinifier";

type Mode = "beautify" | "minify";

const MODES: ModeSpec<Mode>[] = [
  {
    id: "beautify",
    label: "Beautify",
    blurb:
      "Format code with consistent whitespace and quotes. Powered by prettier (JS/TS/CSS/HTML/Markdown/YAML/GraphQL/Vue) and sql-formatter (SQL).",
  },
  {
    id: "minify",
    label: "Minify",
    blurb:
      "Shrink output for production. JavaScript/TypeScript via terser, CSS via csso, JSON via native stringify, HTML via whitespace collapse.",
  },
];

export default function CodeHub() {
  return (
    <Hub<Mode>
      modes={MODES}
      initial="beautify"
      ariaLabel="Choose a code operation"
      panels={{
        beautify: <CodeBeautifier />,
        minify: <CodeMinifier />,
      }}
    />
  );
}
