import { unzipSync, gunzipSync } from "fflate";
import { readTar } from "./tar";
import { detectFormat, type ExtractFormat } from "./formats";

export interface ExtractedEntry {
  name: string;
  bytes: Uint8Array;
}

export interface ExtractResult {
  format: ExtractFormat;
  entries: ExtractedEntry[];
}

export async function extractArchive(file: File): Promise<ExtractResult> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const format = detectFormat(bytes, file.name);
  if (!format) {
    throw new Error("Unrecognised archive format. Expected ZIP, TAR, TAR.GZ, GZIP or RAR.");
  }

  switch (format) {
    case "zip": {
      const obj = unzipSync(bytes);
      const entries: ExtractedEntry[] = Object.entries(obj)
        // Drop directory entries (those that fflate emits with empty payloads
        // for the directory itself).
        .filter(([name]) => !name.endsWith("/"))
        .map(([name, data]) => ({ name, bytes: data }));
      return { format, entries };
    }

    case "tar": {
      return { format, entries: readTar(bytes) };
    }

    case "tar.gz": {
      const tar = gunzipSync(bytes);
      return { format, entries: readTar(tar) };
    }

    case "gzip": {
      const decompressed = gunzipSync(bytes);
      // The original filename is sometimes stored in the gzip FNAME extra field;
      // for now just strip .gz from the input name.
      const name = file.name.replace(/\.(gz|gzip)$/i, "") || "output";
      return { format, entries: [{ name, bytes: decompressed }] };
    }

    case "rar": {
      const { createExtractorFromData } = await import("node-unrar-js");
      const extractor = await createExtractorFromData({ data: buffer });
      const list = extractor.extract();
      const entries: ExtractedEntry[] = [];
      for (const f of list.files) {
        if (f.fileHeader.flags.directory) continue;
        if (!f.extraction) continue;
        entries.push({ name: f.fileHeader.name, bytes: f.extraction });
      }
      return { format, entries };
    }
  }
}
