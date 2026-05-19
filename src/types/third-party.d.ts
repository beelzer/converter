// Minimal type shims for older JS libraries that don't ship d.ts files.

declare module "libheif-js" {
  interface LibheifImage {
    get_width(): number;
    get_height(): number;
    display(
      target: { data: Uint8ClampedArray; width: number; height: number },
      cb: (result: { data: Uint8ClampedArray } | null) => void
    ): void;
  }
  interface LibheifModule {
    HeifDecoder: new () => {
      decode(buffer: ArrayBuffer): LibheifImage[];
    };
  }
  const libheif: LibheifModule | (() => Promise<LibheifModule> | LibheifModule);
  export default libheif;
}

declare module "piexifjs" {
  interface Piexif {
    remove(jpegBinary: string): string;
    load(jpegBinary: string): Record<string, unknown>;
    dump(exifObj: Record<string, unknown>): string;
    insert(exifStr: string, jpegBinary: string): string;
  }
  const piexif: Piexif;
  export default piexif;
}

declare module "gifenc" {
  export interface GifEncoder {
    writeFrame(
      index: Uint8Array | number[],
      width: number,
      height: number,
      opts?: {
        palette?: number[][];
        delay?: number;
        repeat?: number;
        transparent?: boolean;
        transparentIndex?: number;
        dispose?: number;
        first?: boolean;
      }
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    reset(): void;
  }
  export function GIFEncoder(opts?: { auto?: boolean }): GifEncoder;
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    opts?: {
      format?: "rgb565" | "rgb444" | "rgba4444";
      oneBitAlpha?: boolean | number;
      clearAlpha?: boolean;
      clearAlphaThreshold?: number;
      clearAlphaColor?: number;
    }
  ): number[][];
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: "rgb565" | "rgb444" | "rgba4444"
  ): Uint8Array;
  export function nearestColorIndex(
    palette: number[][],
    pixel: [number, number, number] | [number, number, number, number]
  ): number;
}
