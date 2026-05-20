// Worker entrypoint. Statefully holds one DrawingSession per worker instance.
//
// All heavy work (parse, render, PNG raster, DXF write, plot-style parse)
// happens here. PDF emission is the one operation that runs on the main
// thread instead — svg2pdf walks the SVG DOM via DOMParser, which isn't
// reliably exposed to Worker scope.

import { DrawingSession, type ConvertOptions, type LoadResult } from "./convert";
import type { DrawingFormat } from "./formats";
import type { Orientation, PageSize } from "./formats";

export type WorkerRequest =
  | { id: number; type: "load"; bytes: ArrayBuffer; format: DrawingFormat }
  | { id: number; type: "attachPlotStyle"; bytes: ArrayBuffer }
  | { id: number; type: "clearPlotStyle" }
  | { id: number; type: "convert"; options: ConvertOptions }
  | { id: number; type: "extractDxf" }
  | { id: number; type: "unload" };

export type WorkerResponse =
  | { id: number; ok: true; type: "loaded"; result: LoadResult }
  | { id: number; ok: true; type: "plotStyleAttached"; matched: boolean }
  | { id: number; ok: true; type: "plotStyleCleared" }
  | { id: number; ok: true; type: "converted"; bytes: Uint8Array; mime: string; ext: string }
  | {
      id: number;
      ok: true;
      type: "svgForPdf";
      svg: string;
      pageSize: PageSize;
      orientation: Orientation;
      drawingWidth: number;
      drawingHeight: number;
    }
  | { id: number; ok: true; type: "unloaded" }
  | { id: number; ok: false; error: string };

const session = new DrawingSession();

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  try {
    switch (msg.type) {
      case "load": {
        const result = await session.load(msg.bytes, msg.format);
        post({ id: msg.id, ok: true, type: "loaded", result });
        return;
      }
      case "attachPlotStyle": {
        const matched = await session.attachPlotStyle(msg.bytes);
        post({ id: msg.id, ok: true, type: "plotStyleAttached", matched });
        return;
      }
      case "clearPlotStyle": {
        session.clearPlotStyle();
        post({ id: msg.id, ok: true, type: "plotStyleCleared" });
        return;
      }
      case "convert": {
        const result = await session.convert(msg.options);
        if (result.kind === "bytes") {
          post(
            { id: msg.id, ok: true, type: "converted", bytes: result.bytes, mime: result.mime, ext: result.ext },
            [result.bytes.buffer]
          );
        } else {
          post({
            id: msg.id,
            ok: true,
            type: "svgForPdf",
            svg: result.svg,
            pageSize: result.pageSize,
            orientation: result.orientation,
            drawingWidth: result.drawingWidth,
            drawingHeight: result.drawingHeight,
          });
        }
        return;
      }
      case "extractDxf": {
        const result = await session.extractDxf();
        if (result.kind === "bytes") {
          post(
            { id: msg.id, ok: true, type: "converted", bytes: result.bytes, mime: result.mime, ext: result.ext },
            [result.bytes.buffer]
          );
        }
        return;
      }
      case "unload": {
        session.unload();
        post({ id: msg.id, ok: true, type: "unloaded" });
        return;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    post({ id: msg.id, ok: false, error: message });
  }
};

function post(response: WorkerResponse, transfers?: Transferable[]): void {
  (self as unknown as Worker).postMessage(response, transfers ?? []);
}
