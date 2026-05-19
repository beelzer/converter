import { hslToRgb, rgbToHsl, type Rgb } from "./convert";

export type HarmonyKind =
  | "complementary"
  | "analogous"
  | "triadic"
  | "tetradic"
  | "split-complementary"
  | "monochromatic";

export const HARMONIES: HarmonyKind[] = [
  "complementary",
  "analogous",
  "triadic",
  "tetradic",
  "split-complementary",
  "monochromatic",
];

export const HARMONY_LABEL: Record<HarmonyKind, string> = {
  complementary: "Complementary",
  analogous: "Analogous",
  triadic: "Triadic",
  tetradic: "Tetradic",
  "split-complementary": "Split-complementary",
  monochromatic: "Monochromatic",
};

export function harmony(base: Rgb, kind: HarmonyKind): Rgb[] {
  const hsl = rgbToHsl(base);
  const wrap = (h: number) => ((h % 360) + 360) % 360;
  const make = (h: number, sDelta = 0, lDelta = 0): Rgb =>
    hslToRgb({
      h: wrap(h),
      s: Math.max(0, Math.min(100, hsl.s + sDelta)),
      l: Math.max(0, Math.min(100, hsl.l + lDelta)),
      a: 1,
    });
  switch (kind) {
    case "complementary":
      return [base, make(hsl.h + 180)];
    case "analogous":
      return [make(hsl.h - 30), base, make(hsl.h + 30)];
    case "triadic":
      return [base, make(hsl.h + 120), make(hsl.h + 240)];
    case "tetradic":
      return [base, make(hsl.h + 90), make(hsl.h + 180), make(hsl.h + 270)];
    case "split-complementary":
      return [base, make(hsl.h + 150), make(hsl.h + 210)];
    case "monochromatic":
      return [
        make(hsl.h, 0, -30),
        make(hsl.h, 0, -15),
        base,
        make(hsl.h, 0, 15),
        make(hsl.h, 0, 30),
      ];
  }
}
