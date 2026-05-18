import { zipSync, type Zippable } from "fflate";

export interface ZipEntry {
  name: string;
  bytes: Uint8Array;
}

// Pack the given entries into a deterministic ZIP buffer. Uses STORE (no
// compression) for already-compressed payloads like JPG/PNG so the CPU cost
// of deflate is wasted; that's also the default for any binary input here.
export function zipEntries(entries: ZipEntry[]): Uint8Array {
  const obj: Zippable = {};
  for (const entry of entries) {
    obj[entry.name] = [entry.bytes, { level: 0 }];
  }
  return zipSync(obj);
}
