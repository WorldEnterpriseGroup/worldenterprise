import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import sharp from 'sharp';
import { DECADE_CHAPTERS, DECADE_DURATION } from '../../../src/components/media/decade.ts';

// WP-22 (#88): the encoded film, poster and stills that ship. The brief: AV1 WebM and H.264 MP4, each at most 4 MB, 1920x1080,
// 30 to 60 seconds, plus a 3840-wide poster. Parsed from the container headers, so no ffprobe is needed in CI.

const root = new URL('../../../', import.meta.url);
const file = (rel: string): Buffer => readFileSync(new URL(rel, root));
const MAX_VIDEO_BYTES = 4 * 1024 * 1024;

/** Finds an ISO BMFF box by type and returns the offset of its payload (after size and type). */
function boxPayload(buf: Buffer, type: string, from = 0): number {
  const at = buf.indexOf(Buffer.from(type, 'latin1'), from);
  assert.ok(at >= 4, `${type} box present`);
  return at + 4;
}

test('both encodings stay at or under 4 MB', () => {
  for (const rel of ['src/assets/video/decade.webm', 'src/assets/video/decade.mp4']) {
    const size = statSync(new URL(rel, root)).size;
    assert.ok(size > 100_000 && size <= MAX_VIDEO_BYTES, `${rel}: ${size} bytes`);
  }
});

test('the MP4 is H.264, 1920x1080, and runs the storyboard duration', () => {
  const mp4 = file('src/assets/video/decade.mp4');
  assert.equal(mp4.subarray(4, 8).toString('latin1'), 'ftyp');
  assert.ok(mp4.includes(Buffer.from('avc1', 'latin1')), 'H.264 sample entry');
  assert.ok(mp4.indexOf(Buffer.from('moov', 'latin1')) < mp4.indexOf(Buffer.from('mdat', 'latin1')), 'faststart: moov before mdat');
  const mvhd = boxPayload(mp4, 'mvhd');
  assert.equal(mp4[mvhd], 0, 'mvhd version 0');
  const timescale = mp4.readUInt32BE(mvhd + 12);
  const duration = mp4.readUInt32BE(mvhd + 16) / timescale;
  assert.ok(Math.abs(duration - DECADE_DURATION) < 0.1, `duration ${duration}`);
  const tkhd = boxPayload(mp4, 'tkhd');
  assert.equal(mp4[tkhd], 0, 'tkhd version 0');
  // version/flags 4, times 8, track id 4, reserved 4, duration 4, reserved 8, layer/group/volume/reserved 8, matrix 36.
  const dims = tkhd + 4 + 8 + 4 + 4 + 4 + 8 + 8 + 36;
  assert.equal(mp4.readUInt32BE(dims) / 65536, 1920);
  assert.equal(mp4.readUInt32BE(dims + 4) / 65536, 1080);
  assert.ok(!mp4.includes(Buffer.from('soun', 'latin1')), 'no audio track: the film is silent');
});

test('the WebM is AV1 and runs the storyboard duration', () => {
  const webm = file('src/assets/video/decade.webm');
  assert.deepEqual([...webm.subarray(0, 4)], [0x1a, 0x45, 0xdf, 0xa3], 'EBML header');
  assert.ok(webm.subarray(0, 64).includes(Buffer.from('webm', 'latin1')), 'DocType webm');
  assert.ok(webm.includes(Buffer.from('V_AV1', 'latin1')), 'AV1 codec id');
  assert.ok(!webm.includes(Buffer.from('A_OPUS', 'latin1')) && !webm.includes(Buffer.from('A_VORBIS', 'latin1')), 'no audio track');
  let scale = 1_000_000;
  const tcs = webm.indexOf(Buffer.from([0x2a, 0xd7, 0xb1]));
  if (tcs !== -1) {
    const len = (webm[tcs + 3] ?? 0) & 0x7f;
    scale = webm.readUIntBE(tcs + 4, len);
  }
  const at = webm.indexOf(Buffer.from([0x44, 0x89]));
  assert.ok(at > 0, 'Duration element');
  const size = (webm[at + 2] ?? 0) & 0x7f;
  const raw = size === 8 ? webm.readDoubleBE(at + 3) : webm.readFloatBE(at + 3);
  const seconds = (raw * scale) / 1e9;
  assert.ok(Math.abs(seconds - DECADE_DURATION) < 0.1, `duration ${seconds}`);
});

test('the poster master is a 3840x2160 AVIF', async () => {
  const meta = await sharp(file('src/assets/video/decade-poster.avif')).metadata();
  assert.equal(meta.format, 'heif');
  assert.equal(meta.width, 3840);
  assert.equal(meta.height, 2160);
});

test('one 2560x1440 AVIF still per milestone chapter, and nothing else in the folder', async () => {
  const expected = DECADE_CHAPTERS.filter((c) => c.still !== undefined).map((c) => `${c.id}.avif`).sort();
  const present = readdirSync(new URL('src/assets/media/decade/', root)).sort();
  assert.deepEqual(present, expected);
  for (const name of present) {
    const meta = await sharp(file(`src/assets/media/decade/${name}`)).metadata();
    assert.equal(meta.width, 2560, name);
    assert.equal(meta.height, 1440, name);
    assert.ok(statSync(new URL(`src/assets/media/decade/${name}`, root)).size < 120 * 1024, `${name} master stays small`);
  }
});
