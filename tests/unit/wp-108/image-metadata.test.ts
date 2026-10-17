import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import * as imageAudit from '../../../scripts/audit-images.mjs';
import * as metadata from '../../../scripts/lib/image-metadata.mjs';

// WP-108 (#108): audit:images fails on embedded EXIF, GPS, XMP, IPTC, C2PA, comment and author metadata in AVIF, PNG, JPEG, MP4 and WebM,
// and on SVG <metadata>, dc:creator and absolute home paths. A file it cannot parse is a finding, not a pass.

const api = metadata as unknown as {
  findMetadata(buffer: Buffer, ext: string): string[];
  metadataFindings(where: string, buffer: Buffer, ext: string): { level: string; where: string; message: string }[];
  exifHasGps(payload: Buffer): boolean;
  selfTest(auditMetadata: (dist: string) => unknown[]): { label: string; ok: boolean }[];
  METADATA_TYPES: Record<string, string>;
};
const audit = imageAudit as unknown as { auditMetadata(dist: string): { where: string; message: string }[] };

const root = new URL('../../../', import.meta.url);
const ROOT_PATH = root.pathname;

test('the audit proves itself: every check of its self-test passes', () => {
  const results = api.selfTest(audit.auditMetadata);
  assert.ok(results.length >= 20, `the self-test has ${results.length} checks`);
  for (const r of results) assert.equal(r.ok, true, r.label);
});

test('the formats the issue names are all read', () => {
  assert.deepEqual(Object.keys(api.METADATA_TYPES).sort(), ['.avif', '.jpeg', '.jpg', '.mp4', '.png', '.svg', '.webm']);
});

/** A minimal little-endian TIFF payload with a single IFD0 entry of the given tag. */
function tiff(tag: number): Buffer {
  const out = Buffer.alloc(26);
  out.write('II', 0);
  out.writeUInt16LE(42, 2);
  out.writeUInt32LE(8, 4);
  out.writeUInt16LE(1, 8);
  out.writeUInt16LE(tag, 10);
  return out;
}

test('GPS is read out of an EXIF payload, and a short or lying payload reads as none', () => {
  assert.equal(api.exifHasGps(tiff(0x8825)), true);
  assert.equal(api.exifHasGps(tiff(0x010f)), false);
  assert.equal(api.exifHasGps(Buffer.from('II')), false);
  const lying = tiff(0x8825);
  lying.writeUInt32LE(4000, 4);
  assert.equal(api.exifHasGps(lying), false);
});

test('a file that is not the container its extension says is reported, never skipped', () => {
  for (const ext of ['.avif', '.mp4', '.png', '.jpg', '.webm']) {
    const found = api.metadataFindings(`x${ext}`, Buffer.from('this is not an image at all'), ext);
    assert.equal(found.length, 1, ext);
    assert.match(found[0]?.message ?? '', /could not be checked/, ext);
  }
});

test('a finding names the kind and the file, and never the value', () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])]);
  const chunk = (type: string, data: Buffer): Buffer => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, 'latin1');
    return Buffer.concat([head, data, Buffer.alloc(4)]);
  };
  const file = Buffer.concat([png, chunk('IHDR', Buffer.alloc(13)), chunk('tEXt', Buffer.from('Author\0sentinel-client')), chunk('IEND', Buffer.alloc(0))]);
  const [finding] = api.metadataFindings('_astro/a.png', file, '.png');
  assert.equal(finding?.where, '_astro/a.png');
  assert.equal(finding?.message, 'embedded metadata: text chunk "Author"');
});

test('auditMetadata walks dist, reads only the covered types and names the dist-relative path', () => {
  const dist = mkdtempSync(join(tmpdir(), 'we-meta-'));
  mkdirSync(join(dist, '_astro'), { recursive: true });
  writeFileSync(join(dist, '_astro', 'logo.svg'), '<svg><metadata>x</metadata></svg>');
  writeFileSync(join(dist, '_astro', 'ok.svg'), '<svg><path d="M0 0"/></svg>');
  writeFileSync(join(dist, '_astro', 'notes.txt'), 'metadata');
  const found = audit.auditMetadata(dist);
  assert.deepEqual(found.map((f) => f.where), ['_astro/logo.svg']);
  assert.match(found[0]?.message ?? '', /SVG <metadata> element/);
});

test('cli: --self-test passes, and the npm script and the verify:static job run it', () => {
  const result = spawnSync(process.execPath, [join(ROOT_PATH, 'scripts/audit-images.mjs'), '--self-test'], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /self-test FAIL/);
  const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8')) as { scripts: Record<string, string> };
  assert.equal(pkg.scripts['audit:images:selftest'], 'node scripts/audit-images.mjs --self-test');
  assert.equal(pkg.scripts['audit:images'], 'node scripts/audit-images.mjs --dist dist');
  const ci = readFileSync(new URL('.gitlab-ci.yml', root), 'utf8');
  const verify = /^verify:static:\n[\s\S]*?(?=^\S)/m.exec(ci)?.[0] ?? '';
  assert.match(verify, /npm run audit:images:selftest\n/);
  assert.match(ci, /^audit:images:\n {2}extends: \[\.audit\]\n {2}script:\n {4}- npm run audit:images\n/m);
});
