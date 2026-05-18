import { extractPages } from "./split";

export interface SplitRequest {
  id: number;
  buffer: ArrayBuffer;
  sourceName: string;
  pages: string;
}

export type SplitResponse =
  | {
      id: number;
      ok: true;
      bytes: Uint8Array;
      filename: string;
      pageCount: number;
      sourcePageCount: number;
    }
  | { id: number; ok: false; error: string };

self.onmessage = async (event: MessageEvent<SplitRequest>) => {
  const { id, buffer, sourceName, pages } = event.data;
  try {
    const result = await extractPages(buffer, sourceName, pages);
    const response: SplitResponse = {
      id,
      ok: true,
      bytes: result.bytes,
      filename: result.filename,
      pageCount: result.pageCount,
      sourcePageCount: result.sourcePageCount,
    };
    (self as unknown as Worker).postMessage(response, [result.bytes.buffer]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const response: SplitResponse = { id, ok: false, error: message };
    (self as unknown as Worker).postMessage(response);
  }
};
