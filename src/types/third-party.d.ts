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
