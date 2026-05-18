// EXIF read + strip for JPEG. PNG and WebP metadata stripping is a different
// shape and is not in v1 scope — for those formats, a canvas re-encode is the
// only way and we trade off a tiny quality hit. JPEG can be stripped losslessly
// because EXIF lives in an APP1 segment that piexifjs can remove without
// re-encoding the image data.

import type piexifType from "piexifjs";

let piexifPromise: Promise<typeof piexifType> | null = null;

async function loadPiexif(): Promise<typeof piexifType> {
  if (!piexifPromise) {
    piexifPromise = import("piexifjs").then(
      (m) => (m.default ?? m) as typeof piexifType
    );
  }
  return piexifPromise;
}

async function blobToBinaryString(blob: Blob): Promise<string> {
  // piexifjs operates on JPEG bytes as a binary-encoded string.
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let s = "";
  // Build via chunks to avoid call-stack overflow on huge files.
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, Math.min(i + chunk, bytes.length));
    s += String.fromCharCode.apply(null, Array.from(slice) as unknown as number[]);
  }
  return s;
}

function binaryStringToUint8(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

export async function stripExifFromJpeg(file: File): Promise<Blob> {
  if (
    file.type !== "image/jpeg" &&
    !/\.jpe?g$/i.test(file.name)
  ) {
    throw new Error(
      "EXIF stripping only supports JPEG in this version. Convert your file to JPG first."
    );
  }
  const piexif = await loadPiexif();
  const binary = await blobToBinaryString(file);
  const stripped = piexif.remove(binary);
  const bytes = binaryStringToUint8(stripped);
  return new Blob([bytes as BlobPart], { type: "image/jpeg" });
}

export type ExifSummary = Record<string, string | number>;

// Read a small, human-friendly subset of EXIF using exifr.
export async function readExifSummary(file: File): Promise<ExifSummary | null> {
  const exifrMod = (await import("exifr")) as unknown as {
    parse: (input: File, options?: object) => Promise<Record<string, unknown> | undefined>;
    default?: {
      parse: (input: File, options?: object) => Promise<Record<string, unknown> | undefined>;
    };
  };
  const parser = (exifrMod.parse ?? exifrMod.default?.parse) as
    | ((input: File, options?: object) => Promise<Record<string, unknown> | undefined>)
    | undefined;
  if (!parser) return null;
  const raw = await parser(file, { reviveValues: true });
  if (!raw) return null;
  const summary: ExifSummary = {};
  const want: Array<[keyof typeof raw | string, string]> = [
    ["Make", "Camera make"],
    ["Model", "Camera model"],
    ["LensModel", "Lens"],
    ["DateTimeOriginal", "Taken"],
    ["ISO", "ISO"],
    ["FNumber", "Aperture (f-stop)"],
    ["ExposureTime", "Shutter speed"],
    ["FocalLength", "Focal length"],
    ["latitude", "GPS latitude"],
    ["longitude", "GPS longitude"],
    ["GPSAltitude", "GPS altitude"],
    ["Software", "Software"],
    ["Orientation", "Orientation"],
  ];
  for (const [key, label] of want) {
    const v = raw[key as string];
    if (v === undefined || v === null) continue;
    summary[label] =
      v instanceof Date
        ? v.toISOString()
        : typeof v === "object"
        ? JSON.stringify(v)
        : (v as string | number);
  }
  return Object.keys(summary).length > 0 ? summary : null;
}
