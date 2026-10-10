/**
 * A small, deterministic ZIP writer (deflate, no ZIP64) so the Function package needs no archiver on the CI image and the
 * same inputs always produce the same bytes. Entries are sorted, timestamps are fixed at the DOS epoch and permissions are
 * fixed, so the archive's SHA-256 identifies its contents.
 */

import { crc32, deflateRawSync } from 'node:zlib';

export interface ZipEntry {
  /** Forward-slash path inside the archive, no leading slash. */
  readonly name: string;
  readonly data: Buffer;
}

const DOS_TIME = 0;
const DOS_DATE = (1 << 5) | 1; // 1980-01-01
const VERSION = 20;
const UTF8_FLAG = 0x0800;
const FILE_MODE = (0o100644 << 16) >>> 0;
const MAX_32 = 0xffffffff;

export function createZip(entries: readonly ZipEntry[]): Buffer {
  const sorted = [...entries].sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const entry of sorted) {
    if (entry.name.startsWith('/') || entry.name.includes('..') || entry.name.includes('\\')) throw new Error('zip_entry_name_invalid');
    const name = Buffer.from(entry.name, 'utf8');
    const compressed = deflateRawSync(entry.data, { level: 9 });
    const checksum = crc32(entry.data);
    if (compressed.length > MAX_32 || entry.data.length > MAX_32 || offset > MAX_32) throw new Error('zip_too_large');

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(VERSION, 4);
    local.writeUInt16LE(UTF8_FLAG, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, compressed);

    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE((3 << 8) | VERSION, 4);
    header.writeUInt16LE(VERSION, 6);
    header.writeUInt16LE(UTF8_FLAG, 8);
    header.writeUInt16LE(8, 10);
    header.writeUInt16LE(DOS_TIME, 12);
    header.writeUInt16LE(DOS_DATE, 14);
    header.writeUInt32LE(checksum, 16);
    header.writeUInt32LE(compressed.length, 20);
    header.writeUInt32LE(entry.data.length, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt32LE(FILE_MODE, 38);
    header.writeUInt32LE(offset, 42);
    central.push(header, name);

    offset += local.length + name.length + compressed.length;
  }

  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(sorted.length, 8);
  end.writeUInt16LE(sorted.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
