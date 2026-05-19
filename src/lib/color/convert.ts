// Color space conversions. All input/output in conventional units:
// - RGB:  r,g,b   in [0..255]; alpha in [0..1]
// - HSL:  h in [0..360), s,l in [0..100]
// - CMYK: c,m,y,k in [0..100]
// - OKLCH: L in [0..1], C in [0..0.5+], h in [0..360)
//
// OKLCH math follows Björn Ottosson's published constants
// (https://bottosson.github.io/posts/oklab/). The matrix passes through linear
// sRGB → LMS (cone responses) → Oklab → polar.

export interface Rgb {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
  a: number;
}

export interface Cmyk {
  c: number;
  m: number;
  y: number;
  k: number;
}

export interface Oklch {
  l: number;
  c: number;
  h: number;
  a: number;
}

// ---------- HEX <-> RGB ----------

export function parseHex(hex: string): Rgb | null {
  const cleaned = hex.trim().replace(/^#/, "");
  if (!/^([0-9a-f]{3,4}|[0-9a-f]{6,8})$/i.test(cleaned)) return null;
  let r: number, g: number, b: number, a = 1;
  if (cleaned.length === 3 || cleaned.length === 4) {
    r = parseInt(cleaned[0] + cleaned[0], 16);
    g = parseInt(cleaned[1] + cleaned[1], 16);
    b = parseInt(cleaned[2] + cleaned[2], 16);
    if (cleaned.length === 4) a = parseInt(cleaned[3] + cleaned[3], 16) / 255;
  } else {
    r = parseInt(cleaned.slice(0, 2), 16);
    g = parseInt(cleaned.slice(2, 4), 16);
    b = parseInt(cleaned.slice(4, 6), 16);
    if (cleaned.length === 8) a = parseInt(cleaned.slice(6, 8), 16) / 255;
  }
  return { r, g, b, a };
}

export function rgbToHex({ r, g, b, a }: Rgb, withAlpha = false): string {
  const toHex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  let hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  if (withAlpha || a < 1) hex += toHex(a * 255);
  return hex;
}

// ---------- RGB <-> HSL ----------

export function rgbToHsl({ r, g, b, a }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
        break;
      case gn:
        h = ((bn - rn) / d + 2) * 60;
        break;
      default:
        h = ((rn - gn) / d + 4) * 60;
    }
  }
  return { h, s: s * 100, l: l * 100, a };
}

export function hslToRgb({ h, s, l, a }: Hsl): Rgb {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hh = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 1) [r, g, b] = [c, x, 0];
  else if (hh < 2) [r, g, b] = [x, c, 0];
  else if (hh < 3) [r, g, b] = [0, c, x];
  else if (hh < 4) [r, g, b] = [0, x, c];
  else if (hh < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = ln - c / 2;
  return {
    r: (r + m) * 255,
    g: (g + m) * 255,
    b: (b + m) * 255,
    a,
  };
}

// ---------- RGB <-> CMYK ----------

export function rgbToCmyk({ r, g, b }: Rgb): Cmyk {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const k = 1 - Math.max(rn, gn, bn);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
  const c = (1 - rn - k) / (1 - k);
  const m = (1 - gn - k) / (1 - k);
  const y = (1 - bn - k) / (1 - k);
  return { c: c * 100, m: m * 100, y: y * 100, k: k * 100 };
}

export function cmykToRgb({ c, m, y, k }: Cmyk): Rgb {
  const cn = c / 100;
  const mn = m / 100;
  const yn = y / 100;
  const kn = k / 100;
  return {
    r: 255 * (1 - cn) * (1 - kn),
    g: 255 * (1 - mn) * (1 - kn),
    b: 255 * (1 - yn) * (1 - kn),
    a: 1,
  };
}

// ---------- sRGB <-> OKLCH ----------

function srgbToLinear(c: number): number {
  const n = c / 255;
  return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return v * 255;
}

export function rgbToOklch({ r, g, b, a }: Rgb): Oklch {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const lcube = Math.cbrt(l);
  const mcube = Math.cbrt(m);
  const scube = Math.cbrt(s);
  const L = 0.2104542553 * lcube + 0.7936177850 * mcube - 0.0040720468 * scube;
  const A = 1.9779984951 * lcube - 2.4285922050 * mcube + 0.4505937099 * scube;
  const B = 0.0259040371 * lcube + 0.7827717662 * mcube - 0.8086757660 * scube;
  const C = Math.sqrt(A * A + B * B);
  let h = (Math.atan2(B, A) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c: C, h, a };
}

export function oklchToRgb({ l: L, c: C, h, a }: Oklch): Rgb {
  const rad = (h * Math.PI) / 180;
  const A = C * Math.cos(rad);
  const B = C * Math.sin(rad);
  const lcube = L + 0.3963377774 * A + 0.2158037573 * B;
  const mcube = L - 0.1055613458 * A - 0.0638541728 * B;
  const scube = L - 0.0894841775 * A - 1.2914855480 * B;
  const lin_l = lcube ** 3;
  const lin_m = mcube ** 3;
  const lin_s = scube ** 3;
  const lr = +4.0767416621 * lin_l - 3.3077115913 * lin_m + 0.2309699292 * lin_s;
  const lg = -1.2684380046 * lin_l + 2.6097574011 * lin_m - 0.3413193965 * lin_s;
  const lb = -0.0041960863 * lin_l - 0.7034186147 * lin_m + 1.7076147010 * lin_s;
  return {
    r: clamp(linearToSrgb(lr), 0, 255),
    g: clamp(linearToSrgb(lg), 0, 255),
    b: clamp(linearToSrgb(lb), 0, 255),
    a,
  };
}

// ---------- Formatters ----------

export function formatHex(rgb: Rgb): string {
  return rgbToHex(rgb, false);
}

export function formatRgb({ r, g, b, a }: Rgb): string {
  const ri = clamp(Math.round(r), 0, 255);
  const gi = clamp(Math.round(g), 0, 255);
  const bi = clamp(Math.round(b), 0, 255);
  if (a < 1) return `rgb(${ri} ${gi} ${bi} / ${round(a, 3)})`;
  return `rgb(${ri} ${gi} ${bi})`;
}

export function formatHsl({ h, s, l, a }: Hsl): string {
  const hh = round(h, 1);
  const ss = round(s, 1);
  const ll = round(l, 1);
  if (a < 1) return `hsl(${hh} ${ss}% ${ll}% / ${round(a, 3)})`;
  return `hsl(${hh} ${ss}% ${ll}%)`;
}

export function formatCmyk({ c, m, y, k }: Cmyk): string {
  return `cmyk(${round(c, 1)}% ${round(m, 1)}% ${round(y, 1)}% ${round(k, 1)}%)`;
}

export function formatOklch({ l, c, h, a }: Oklch): string {
  const lp = round(l * 100, 2);
  const cc = round(c, 4);
  const hh = round(h, 2);
  if (a < 1) return `oklch(${lp}% ${cc} ${hh} / ${round(a, 3)})`;
  return `oklch(${lp}% ${cc} ${hh})`;
}

// ---------- Parsers ----------

const NUMBER = /-?\d+(?:\.\d+)?%?/g;

export function parseAny(input: string): Rgb | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("#") || /^[0-9a-f]{3,8}$/i.test(trimmed)) {
    return parseHex(trimmed);
  }
  if (/^rgba?\b/i.test(trimmed)) {
    const nums = parseTriplet(trimmed);
    if (!nums) return null;
    const [r, g, b, a = 1] = nums;
    return { r, g, b, a };
  }
  if (/^hsla?\b/i.test(trimmed)) {
    const nums = parseTriplet(trimmed);
    if (!nums) return null;
    const [h, s, l, a = 1] = nums;
    return hslToRgb({ h, s, l, a });
  }
  if (/^cmyk\b/i.test(trimmed)) {
    const nums = parseTriplet(trimmed);
    if (!nums) return null;
    const [c, m, y, k = 0] = nums;
    return cmykToRgb({ c, m, y, k });
  }
  if (/^oklch\b/i.test(trimmed)) {
    const nums = parseTriplet(trimmed);
    if (!nums) return null;
    const [lRaw, c, h, a = 1] = nums;
    // CSS oklch lightness is 0..100% but the L axis itself is 0..1.
    const l = trimmed.includes("%") ? lRaw / 100 : lRaw > 1 ? lRaw / 100 : lRaw;
    return oklchToRgb({ l, c, h, a });
  }
  return null;
}

function parseTriplet(input: string): number[] | null {
  const nums: number[] = [];
  let match: RegExpExecArray | null;
  NUMBER.lastIndex = 0;
  while ((match = NUMBER.exec(input))) {
    const raw = match[0];
    let n = parseFloat(raw);
    if (raw.endsWith("%")) {
      // For alpha, percent means /100. For RGB, percent means × 2.55.
      // We can't disambiguate without the position; callers normalize later.
      n = n / 100;
    }
    nums.push(n);
  }
  if (nums.length < 3) return null;
  // Heuristic: if the first three look like RGB-percentages (< 1.001) and the
  // input was rgb(...), bump them back to 0..255 range.
  if (/^rgba?\b/i.test(input) && nums[0] <= 1 && nums[1] <= 1 && nums[2] <= 1 && input.includes("%")) {
    nums[0] *= 255;
    nums[1] *= 255;
    nums[2] *= 255;
  } else if (/^hsla?\b/i.test(input)) {
    // s, l were % → already /100 in parser. Restore to 0..100 expected by hslToRgb.
    nums[0] *= input.match(/^hsla?\([^,)\s]+%/i) ? 100 : 1;
    nums[1] *= 100;
    nums[2] *= 100;
  } else if (/^cmyk\b/i.test(input)) {
    nums[0] *= 100;
    nums[1] *= 100;
    nums[2] *= 100;
    if (nums[3] !== undefined) nums[3] *= 100;
  }
  return nums;
}

// ---------- Helpers ----------

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}
