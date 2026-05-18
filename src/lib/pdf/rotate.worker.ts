import { rotatePdf, type RotationAngle } from "./rotate";

export interface RotateRequest {
  id: number;
  buffer: ArrayBuffer;
  sourceName: string;
  angle: RotationAngle;
  pages: string;
}

export type RotateResponse =
  | {
      id: number;
      ok: true;
      bytes: Uint8Array;
      filename: string;
      rotatedPageCount: number;
      totalPageCount: number;
    }
  | { id: number; ok: false; error: string };

self.onmessage = async (event: MessageEvent<RotateRequest>) => {
  const { id, buffer, sourceName, angle, pages } = event.data;
  try {
    const result = await rotatePdf(buffer, sourceName, angle, pages);
    const response: RotateResponse = {
      id,
      ok: true,
      bytes: result.bytes,
      filename: result.filename,
      rotatedPageCount: result.rotatedPageCount,
      totalPageCount: result.totalPageCount,
    };
    (self as unknown as Worker).postMessage(response, [result.bytes.buffer]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const response: RotateResponse = { id, ok: false, error: message };
    (self as unknown as Worker).postMessage(response);
  }
};
