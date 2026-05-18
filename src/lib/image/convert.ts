import { decodeImage, type DecodedImage } from "./decode";
import { encodeImage } from "./encode";
import {
  basenameWithoutExt,
  extensionFor,
  type SupportedOutputFormat,
} from "./formats";

export interface ConvertedFile {
  blob: Blob;
  name: string;
  width: number;
  height: number;
}

export async function convertImage(
  file: File,
  format: SupportedOutputFormat,
  quality?: number
): Promise<ConvertedFile> {
  const decoded = await decodeImage(file);
  try {
    const blob = await encodeImage(decoded, { format, quality });
    const base = basenameWithoutExt(file.name) || "image";
    return {
      blob,
      name: `${base}.${extensionFor(format)}`,
      width: decoded.width,
      height: decoded.height,
    };
  } finally {
    closeDecoded(decoded);
  }
}

export function closeDecoded(decoded: DecodedImage): void {
  if (decoded.source instanceof ImageBitmap) {
    decoded.source.close?.();
  }
}
