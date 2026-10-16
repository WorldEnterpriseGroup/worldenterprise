import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';

const ROOT = new URL('../../../', import.meta.url).pathname;
const poster = readFileSync(join(ROOT, 'src/components/visuals/poster.ts'), 'utf8');
const KEYS = [...(/POSTER_KEYS = \[([^\]]+)\]/.exec(poster)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1] as string);

test('the poster srcset reaches 1440p and 4K', () => {
  assert.match(poster, /WIDTHS = \[640, 1024, 1440, 1920, 2560, 3840\] as const/);
  assert.match(poster, /POSTER_DISPLAY_WIDTH = 1024/, 'the img src stays at the audit:images raster cap');
});

test('every poster key has a 3840-wide AVIF master, so 2560 and 3840 are real candidates (not upscales)', async () => {
  assert.ok(KEYS.length >= 10, `keys: ${KEYS.join(', ')}`);
  for (const key of KEYS) {
    const meta = await sharp(join(ROOT, `src/assets/visuals/posters/${key}.avif`)).metadata();
    assert.equal(meta.format, 'heif', key);
    assert.equal(meta.width, 3840, `${key} master width`);
    assert.ok((meta.height ?? 0) >= 1280, `${key} master height`);
  }
});

test('every master stays small enough that its derived candidates fit the audit:images budgets', () => {
  for (const key of KEYS) {
    const bytes = readFileSync(join(ROOT, `src/assets/visuals/posters/${key}.avif`)).byteLength;
    assert.ok(bytes < 400 * 1024, `${key}.avif is ${(bytes / 1024).toFixed(0)} KB`);
  }
});

test('the poster tool renders through WebGPURenderer at pixel ratio 2 and knows every key', () => {
  const tool = readFileSync(join(ROOT, 'src/assets/visuals/tools/render-posters.mjs'), 'utf8');
  assert.match(tool, /WebGPURenderer/);
  assert.match(tool, /const RATIO = 2/);
  for (const key of KEYS) assert.match(tool, new RegExp(`key: '${key}'`), key);
});
