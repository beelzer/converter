import { mergePdfs } from "./merge";

export interface MergeRequest {
  id: number;
  buffers: ArrayBuffer[];
}

export type MergeResponse =
  | { id: number; ok: true; bytes: Uint8Array; pageCount: number }
  | { id: number; ok: false; error: string };

self.onmessage = async (event: MessageEvent<MergeRequest>) => {
  const { id, buffers } = event.data;
  try {
    const { bytes, pageCount } = await mergePdfs(buffers);
    const response: MergeResponse = { id, ok: true, bytes, pageCount };
    (self as unknown as Worker).postMessage(response, [bytes.buffer]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const response: MergeResponse = { id, ok: false, error: message };
    (self as unknown as Worker).postMessage(response);
  }
};
