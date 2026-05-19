import { Hub, type ModeSpec } from "../shared/Hub";
import ColorConverter from "./ColorConverter";
import ColorPalette from "./ColorPalette";
import ColorContrast from "./ColorContrast";

type Mode = "convert" | "palette" | "contrast";

const MODES: ModeSpec<Mode>[] = [
  {
    id: "convert",
    label: "Convert",
    blurb: "Type any CSS color (HEX, rgb(), hsl(), oklch(), cmyk()) — see it in every other format.",
  },
  {
    id: "palette",
    label: "Palette",
    blurb:
      "Generate a harmony from a base color: complementary, analogous, triadic, tetradic, split-complementary, or monochromatic.",
  },
  {
    id: "contrast",
    label: "Contrast",
    blurb:
      "WCAG contrast checker. Type a foreground and background, see the ratio and AA/AAA pass status.",
  },
];

export default function ColorHub() {
  return (
    <Hub<Mode>
      modes={MODES}
      initial="convert"
      ariaLabel="Choose a color operation"
      panels={{
        convert: <ColorConverter />,
        palette: <ColorPalette />,
        contrast: <ColorContrast />,
      }}
    />
  );
}
