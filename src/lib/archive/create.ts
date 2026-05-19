import { zipSync, gzipSync, type Zippable } from "fflate";
import { writeTar, type TarEntry } from "./tar";
import type { CreateFormat } from "./formats";

export interface InputFile {
  name: string;
  bytes: Uint8Array;
}

export interface CreateResult {
  bytes: Uint8Array;
  filename: string;
  mime: string;
}

export function createArchive(
  files: InputFile[],
  format: CreateFormat,
  archiveName = "archive"
): CreateResult {
  if (files.length === 0) throw new Error("No files to archive.");

  switch (format) {
    case "zip": {
      const obj: Zippable = {};
      for (const f of files) {
        obj[uniqueName(obj, f.name)] = [f.bytes, { level: 6 }];
      }
      return {
        bytes: zipSync(obj),
        filename: `${archiveName}.zip`,
        mime: "application/zip",
      };
    }

    case "tar": {
      const entries: TarEntry[] = files.map((f) => ({ name: f.name, bytes: f.bytes }));
      return {
        bytes: writeTar(entries),
        filename: `${archiveName}.tar`,
        mime: "application/x-tar",
      };
    }

    case "tar.gz": {
      const entries: TarEntry[] = files.map((f) => ({ name: f.name, bytes: f.bytes }));
      const tarBytes = writeTar(entries);
      return {
        bytes: gzipSync(tarBytes, { level: 6 }),
        filename: `${archiveName}.tar.gz`,
        mime: "application/gzip",
      };
    }

    case "gzip": {
      if (files.length > 1) {
        throw new Error(
          "GZIP wraps a single file. To compress many files together, use TAR.GZ."
        );
      }
      const only = files[0];
      return {
        bytes: gzipSync(only.bytes, { level: 6 }),
        filename: `${only.name}.gz`,
        mime: "application/gzip",
      };
    }
  }
}

function uniqueName(obj: Zippable, name: string): string {
  if (!(name in obj)) return name;
  const dotIdx = name.lastIndexOf(".");
  const base = dotIdx > 0 ? name.slice(0, dotIdx) : name;
  const ext = dotIdx > 0 ? name.slice(dotIdx) : "";
  let i = 2;
  while (`${base} (${i})${ext}` in obj) i++;
  return `${base} (${i})${ext}`;
}
