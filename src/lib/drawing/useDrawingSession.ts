// Preact hook owning one worker + one loaded drawing + optional plot-style.
// Components subscribe to `analysis` for layer / layout / extent / plot-style
// state and call `load`, `convert`, `extractDxf`, `attachPlotStyle`, or
// `clearPlotStyle` to drive the worker.

import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { LayerInfo, LayoutInfo } from "./analyze";
import type { ConvertOptions, LoadResult } from "./convert";
import type { DrawingFormat } from "./formats";
import type { WorkerRequest, WorkerResponse } from "./convert.worker";

export interface DrawingAnalysis {
  layers: LayerInfo[];
  layouts: LayoutInfo[];
  extent: { width: number; height: number };
  hasPlotStyle: boolean;
}

export interface ConversionOutput {
  bytes: Uint8Array;
  mime: string;
  ext: string;
}

export function useDrawingSession() {
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const [analysis, setAnalysis] = useState<DrawingAnalysis | null>(null);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const ensureWorker = useCallback((): Worker => {
    if (workerRef.current) return workerRef.current;
    const worker = new Worker(
      new URL("./convert.worker.ts", import.meta.url),
      { type: "module" }
    );
    workerRef.current = worker;
    return worker;
  }, []);

  const dispatch = useCallback(
    <T extends WorkerResponse>(req: WorkerRequest, transfers: Transferable[] = []) =>
      new Promise<T>((resolve, reject) => {
        const worker = ensureWorker();
        const handler = (event: MessageEvent<WorkerResponse>) => {
          if (event.data.id !== req.id) return;
          worker.removeEventListener("message", handler);
          if (event.data.ok) resolve(event.data as T);
          else reject(new Error(event.data.error));
        };
        worker.addEventListener("message", handler);
        worker.postMessage(req, transfers);
      }),
    [ensureWorker]
  );

  const load = useCallback(
    async (bytes: ArrayBuffer, format: DrawingFormat): Promise<DrawingAnalysis> => {
      const id = ++requestIdRef.current;
      const response = await dispatch<Extract<WorkerResponse, { type: "loaded" }>>(
        { id, type: "load", bytes, format },
        [bytes]
      );
      const result: DrawingAnalysis = {
        layers: response.result.layers,
        layouts: response.result.layouts,
        extent: response.result.extent,
        hasPlotStyle: response.result.hasPlotStyle,
      };
      setAnalysis(result);
      return result;
    },
    [dispatch]
  );

  const attachPlotStyle = useCallback(
    async (bytes: ArrayBuffer): Promise<boolean> => {
      const id = ++requestIdRef.current;
      const response = await dispatch<Extract<WorkerResponse, { type: "plotStyleAttached" }>>(
        { id, type: "attachPlotStyle", bytes },
        [bytes]
      );
      setAnalysis((current) =>
        current ? { ...current, hasPlotStyle: response.matched } : current
      );
      return response.matched;
    },
    [dispatch]
  );

  const clearPlotStyle = useCallback(async (): Promise<void> => {
    const id = ++requestIdRef.current;
    await dispatch<Extract<WorkerResponse, { type: "plotStyleCleared" }>>(
      { id, type: "clearPlotStyle" }
    );
    setAnalysis((current) => (current ? { ...current, hasPlotStyle: false } : current));
  }, [dispatch]);

  const convert = useCallback(
    async (options: ConvertOptions): Promise<ConversionOutput> => {
      const id = ++requestIdRef.current;
      const response = await dispatch<
        | Extract<WorkerResponse, { type: "converted" }>
        | Extract<WorkerResponse, { type: "svgForPdf" }>
      >({ id, type: "convert", options });

      if (response.type === "converted") {
        return { bytes: response.bytes, mime: response.mime, ext: response.ext };
      }

      // PDF: the worker handed back an SVG string + page params. Run svg2pdf
      // here on the main thread, where DOMParser is reliably available.
      const { svgToPdf } = await import("./to-pdf");
      const bytes = await svgToPdf(response.svg, {
        pageSize: response.pageSize,
        orientation: response.orientation,
        drawingWidth: response.drawingWidth,
        drawingHeight: response.drawingHeight,
      });
      return { bytes, mime: "application/pdf", ext: "pdf" };
    },
    [dispatch]
  );

  const extractDxf = useCallback(async (): Promise<ConversionOutput> => {
    const id = ++requestIdRef.current;
    const response = await dispatch<Extract<WorkerResponse, { type: "converted" }>>(
      { id, type: "extractDxf" }
    );
    return { bytes: response.bytes, mime: response.mime, ext: response.ext };
  }, [dispatch]);

  const reset = useCallback(() => {
    setAnalysis(null);
    workerRef.current?.postMessage({ id: ++requestIdRef.current, type: "unload" });
  }, []);

  // Reference unused identifier so TS doesn't strip the export-only import.
  void ({} as LoadResult);

  return { analysis, load, convert, extractDxf, attachPlotStyle, clearPlotStyle, reset };
}
