import { imagesToPdf, type ImageInput } from "./imagesToPdf";

export interface ImagesToPdfRequest {
  id: number;
  images: ImageInput[];
}

export type ImagesToPdfResponse =
  | {
      id: number;
      ok: true;
      bytes: Uint8Array;
      filename: string;
      pageCount: number;
    }
  | { id: number; ok: false; error: string };

self.onmessage = async (event: MessageEvent<ImagesToPdfRequest>) => {
  const { id, images } = event.data;
  try {
    const result = await imagesToPdf(images);
    const response: ImagesToPdfResponse = {
      id,
      ok: true,
      bytes: result.bytes,
      filename: result.filename,
      pageCount: result.pageCount,
    };
    (self as unknown as Worker).postMessage(response, [result.bytes.buffer]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const response: ImagesToPdfResponse = { id, ok: false, error: message };
    (self as unknown as Worker).postMessage(response);
  }
};
