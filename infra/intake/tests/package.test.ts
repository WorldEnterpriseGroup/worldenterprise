import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { crc32, inflateRawSync } from 'node:zlib';

import { createZip } from '../iac/zip.ts';

/** A minimal reader, independent of the writer, that walks the central directory and verifies every entry's CRC. */
function readZip(archive: Buffer): Map<string, string> {
  const end = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(end >= 0, 'end of central directory record');
  const count = archive.readUInt16LE(end + 10);
  let cursor = archive.readUInt32LE(end + 16);
  const files = new Map<string, string>();
  for (let index = 0; index < count; index += 1) {
    assert.equal(archive.readUInt32LE(cursor), 0x02014b50);
    const checksum = archive.readUInt32LE(cursor + 16);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const localOffset = archive.readUInt32LE(cursor + 42);
    const name = archive.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    assert.equal(archive.readUInt32LE(localOffset), 0x04034b50);
    const start = localOffset + 30 + archive.readUInt16LE(localOffset + 26) + archive.readUInt16LE(localOffset + 28);
    const data = inflateRawSync(archive.subarray(start, start + compressedSize));
    assert.equal(crc32(data), checksum, `crc of ${name}`);
    files.set(name, data.toString('utf8'));
    cursor += 46 + nameLength;
  }
  return files;
}

describe('function package', () => {
  test('the zip round-trips, in sorted order, with nested paths', () => {
    const archive = createZip([
      { name: 'dist/functions.js', data: Buffer.from('export {};\n'.repeat(50)) },
      { name: 'host.json', data: Buffer.from('{"version":"2.0"}') },
      { name: 'node_modules/@azure/functions/package.json', data: Buffer.from('{}') },
    ]);
    const files = readZip(archive);
    assert.deepEqual([...files.keys()], ['dist/functions.js', 'host.json', 'node_modules/@azure/functions/package.json']);
    assert.equal(files.get('host.json'), '{"version":"2.0"}');
    assert.equal(files.get('dist/functions.js')?.length, 'export {};\n'.length * 50);
  });

  test('the same inputs in any order give identical bytes', () => {
    const a = { name: 'a.txt', data: Buffer.from('a') };
    const b = { name: 'b.txt', data: Buffer.from('b') };
    assert.ok(createZip([a, b]).equals(createZip([b, a])));
  });

  test('names that could escape the extraction folder are refused', () => {
    for (const name of ['/etc/passwd', '../x', 'a/../../x', 'a\\b']) assert.throws(() => createZip([{ name, data: Buffer.from('x') }]), /zip_entry_name_invalid/, name);
  });

  test('host.json serves under /api and is valid JSON', () => {
    const host = JSON.parse(readFileSync(new URL('../src/host.json', import.meta.url), 'utf8')) as { version: string; extensions: { http: { routePrefix: string } } };
    assert.equal(host.version, '2.0');
    assert.equal(host.extensions.http.routePrefix, 'api');
  });

  test('the entry point registers every route and timer the contract names', () => {
    const source = readFileSync(new URL('../src/functions.ts', import.meta.url), 'utf8');
    for (const route of ["route: 'intake'", "route: 'newsletter'", "route: 'unsubscribe'", "route: 'health'"]) assert.ok(source.includes(route), route);
    assert.ok(source.includes("timer('retrySweep'") && source.includes("timer('nurtureSweep'"));
  });
});
