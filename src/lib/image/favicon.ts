import { decodeImage } from "./decode";
import type { ZipEntry } from "../util/zip";

const SIZES_PNG = [16, 32, 48, 64, 96, 128, 180, 192, 256, 384, 512] as const;
const ICO_SIZES = [16, 32, 48] as const;

interface RenderedSize {
  size: number;
  blob: Blob;
}

async function renderAtSize(
  source: ImageBitmap | ImageData,
  sourceWidth: number,
  sourceHeight: number,
  size: number
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't open a 2D drawing context.");
  // Fit-contain on a transparent background. Phones expect a square icon
  // — if the user drops a rectangular logo, we centre it.
  ctx.clearRect(0, 0, size, size);
  const scale = Math.min(size / sourceWidth, size / sourceHeight);
  const drawW = Math.max(1, Math.round(sourceWidth * scale));
  const drawH = Math.max(1, Math.round(sourceHeight * scale));
  const dx = Math.round((size - drawW) / 2);
  const dy = Math.round((size - drawH) / 2);
  if (source instanceof ImageBitmap) {
    ctx.drawImage(source, dx, dy, drawW, drawH);
  } else {
    const stage = document.createElement("canvas");
    stage.width = sourceWidth;
    stage.height = sourceHeight;
    const stageCtx = stage.getContext("2d");
    if (!stageCtx) throw new Error("Couldn't open a 2D drawing context.");
    stageCtx.putImageData(source, 0, 0);
    ctx.drawImage(stage, dx, dy, drawW, drawH);
  }
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("Couldn't encode PNG."));
    }, "image/png");
  });
}

// Pack multiple PNGs into an ICO container. ICO spec: a 6-byte ICONDIR
// header, then one 16-byte ICONDIRENTRY per image, then the image payloads
// concatenated. PNG-in-ICO is supported in Vista+ and all modern browsers.
function buildIco(entries: { size: number; png: Uint8Array }[]): Uint8Array {
  const headerSize = 6 + entries.length * 16;
  let totalSize = headerSize;
  for (const e of entries) totalSize += e.png.length;

  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);

  // ICONDIR
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true); // ICO
  view.setUint16(4, entries.length, true);

  let offset = headerSize;
  let dirOffset = 6;
  for (const e of entries) {
    // Width/height: 0 means 256 in the spec.
    view.setUint8(dirOffset + 0, e.size === 256 ? 0 : e.size);
    view.setUint8(dirOffset + 1, e.size === 256 ? 0 : e.size);
    view.setUint8(dirOffset + 2, 0); // color count (0 for >= 256 colors)
    view.setUint8(dirOffset + 3, 0); // reserved
    view.setUint16(dirOffset + 4, 1, true); // color planes
    view.setUint16(dirOffset + 6, 32, true); // bits per pixel
    view.setUint32(dirOffset + 8, e.png.length, true);
    view.setUint32(dirOffset + 12, offset, true);
    out.set(e.png, offset);
    offset += e.png.length;
    dirOffset += 16;
  }
  return out;
}

export interface FaviconBundleResult {
  entries: ZipEntry[];
}

const MANIFEST = (siteName: string): string =>
  JSON.stringify(
    {
      name: siteName,
      short_name: siteName,
      icons: [
        {
          src: "/android-chrome-192x192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/android-chrome-512x512.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
      theme_color: "#ffffff",
      background_color: "#ffffff",
      display: "standalone",
    },
    null,
    2
  );

export async function generateFaviconBundle(
  file: File,
  siteName = "My Site"
): Promise<FaviconBundleResult> {
  const decoded = await decodeImage(file);
  try {
    const renders: RenderedSize[] = [];
    for (const size of SIZES_PNG) {
      const blob = await renderAtSize(
        decoded.source,
        decoded.width,
        decoded.height,
        size
      );
      renders.push({ size, blob });
    }
    const byteEntries: { size: number; png: Uint8Array }[] = [];
    for (const r of renders) {
      if (
        (ICO_SIZES as readonly number[]).includes(r.size as 16 | 32 | 48)
      ) {
        byteEntries.push({
          size: r.size,
          png: new Uint8Array(await r.blob.arrayBuffer()),
        });
      }
    }
    const ico = buildIco(byteEntries);

    const zipEntries: ZipEntry[] = [];
    for (const r of renders) {
      const buf = new Uint8Array(await r.blob.arrayBuffer());
      zipEntries.push({
        name:
          r.size === 180
            ? "apple-touch-icon.png"
            : r.size === 192 || r.size === 512
            ? `android-chrome-${r.size}x${r.size}.png`
            : `favicon-${r.size}x${r.size}.png`,
        bytes: buf,
      });
    }
    zipEntries.push({ name: "favicon.ico", bytes: ico });
    zipEntries.push({
      name: "site.webmanifest",
      bytes: new TextEncoder().encode(MANIFEST(siteName)),
    });
    return { entries: zipEntries };
  } finally {
    if (decoded.source instanceof ImageBitmap) decoded.source.close?.();
  }
}
