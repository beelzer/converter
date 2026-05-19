// Minimal TAR (ustar) reader/writer. Pure JS, no deps.
//
// The TAR format is a sequence of 512-byte header blocks each followed by the
// file contents padded up to the next 512-byte boundary. EOF is two empty
// blocks. We implement only the ustar variant which is what every modern tar
// implementation emits — and we ignore the unused fields (uid/gid, devmajor,
// devminor, etc.) since web users don't care about file ownership.

export interface TarEntry {
  name: string;
  bytes: Uint8Array;
  mtime?: number; // unix seconds; defaults to "now"
}

const BLOCK = 512;
const USTAR_MAGIC = "ustar\0";
const USTAR_VERSION = "00";

function writeString(buf: Uint8Array, offset: number, value: string, length: number) {
  for (let i = 0; i < length; i++) {
    buf[offset + i] = i < value.length ? value.charCodeAt(i) : 0;
  }
}

function writeOctal(buf: Uint8Array, offset: number, value: number, length: number) {
  // ustar uses zero-padded octal followed by a NUL or space. We use NUL.
  const oct = value.toString(8);
  const padded = oct.padStart(length - 1, "0");
  for (let i = 0; i < length - 1; i++) {
    buf[offset + i] = padded.charCodeAt(i);
  }
  buf[offset + length - 1] = 0;
}

function buildHeader(name: string, size: number, mtime: number, type: string): Uint8Array {
  const header = new Uint8Array(BLOCK);
  if (name.length > 100) {
    throw new Error(`TAR file name too long (>100 chars): ${name}`);
  }
  writeString(header, 0, name, 100);
  writeOctal(header, 100, 0o644, 8); // mode
  writeOctal(header, 108, 0, 8); // uid
  writeOctal(header, 116, 0, 8); // gid
  writeOctal(header, 124, size, 12); // size
  writeOctal(header, 136, mtime, 12); // mtime
  // Checksum field starts at 148 (8 bytes). Fill with spaces for sum calc.
  for (let i = 148; i < 156; i++) header[i] = 0x20;
  header[156] = type.charCodeAt(0); // typeflag
  writeString(header, 257, USTAR_MAGIC, 6); // magic
  writeString(header, 263, USTAR_VERSION, 2); // version

  // Compute checksum: sum of all bytes treating checksum field as spaces.
  let sum = 0;
  for (let i = 0; i < BLOCK; i++) sum += header[i];
  // Write checksum: 6-digit octal + NUL + space at offset 148.
  const cs = sum.toString(8).padStart(6, "0");
  for (let i = 0; i < 6; i++) header[148 + i] = cs.charCodeAt(i);
  header[154] = 0;
  header[155] = 0x20;
  return header;
}

export function writeTar(entries: TarEntry[]): Uint8Array {
  const now = Math.floor(Date.now() / 1000);
  const parts: Uint8Array[] = [];
  let total = 0;

  for (const entry of entries) {
    const header = buildHeader(entry.name, entry.bytes.byteLength, entry.mtime ?? now, "0");
    parts.push(header);
    total += BLOCK;

    parts.push(entry.bytes);
    total += entry.bytes.byteLength;

    // Pad content to next 512-byte boundary.
    const rem = entry.bytes.byteLength % BLOCK;
    if (rem !== 0) {
      const pad = new Uint8Array(BLOCK - rem);
      parts.push(pad);
      total += pad.byteLength;
    }
  }

  // Two empty trailing blocks.
  parts.push(new Uint8Array(BLOCK * 2));
  total += BLOCK * 2;

  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.byteLength;
  }
  return out;
}

function readString(buf: Uint8Array, offset: number, length: number): string {
  let end = offset;
  while (end < offset + length && buf[end] !== 0) end++;
  return new TextDecoder("utf-8", { fatal: false }).decode(buf.subarray(offset, end));
}

function readOctal(buf: Uint8Array, offset: number, length: number): number {
  const str = readString(buf, offset, length).trim();
  if (!str) return 0;
  return parseInt(str, 8) || 0;
}

export function readTar(buf: Uint8Array): TarEntry[] {
  const entries: TarEntry[] = [];
  let offset = 0;
  while (offset + BLOCK <= buf.byteLength) {
    // Stop on an empty block.
    let isEmpty = true;
    for (let i = 0; i < BLOCK; i++) {
      if (buf[offset + i] !== 0) {
        isEmpty = false;
        break;
      }
    }
    if (isEmpty) break;

    const name = readString(buf, offset, 100);
    const size = readOctal(buf, offset + 124, 12);
    const type = String.fromCharCode(buf[offset + 156] || 0x30);
    const prefix = readString(buf, offset + 345, 155);
    const fullName = prefix ? `${prefix}/${name}` : name;

    offset += BLOCK;

    // Skip directories and other special entries; only collect regular files.
    if ((type === "0" || type === "\0") && name) {
      const bytes = buf.slice(offset, offset + size);
      entries.push({ name: fullName, bytes });
    }

    // Advance to next block boundary.
    offset += Math.ceil(size / BLOCK) * BLOCK;
  }
  return entries;
}
