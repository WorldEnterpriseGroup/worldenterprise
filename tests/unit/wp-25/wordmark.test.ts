import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// WP-25: the press folder holds one wordmark and the repository two copies of it, each with a job. public/press/ is the stable,
// unhashed URL that structured data names as the organisation logo and the press pages offer for download; src/assets/brand/ is the
// bundled copy the header, footer, lockup and social-card script import (hashed, cached for a year). Removing either breaks a caller,
// so the dedupe keeps both, identical (tests/unit/wp-19/wordmark.test.ts), and forbids any third copy or a second press logo.

const ROOT = new URL('../../../', import.meta.url);
const read = (path: string): string => readFileSync(new URL(path, ROOT), 'utf8');
const ROOT_DIR = fileURLToPath(ROOT);
/** Every file under the folders that can ship an image (source, public files, scripts and docs), as repository-relative paths. */
const tracked = ['src', 'public', 'scripts', 'docs', 'documents'].flatMap((dir) =>
  readdirSync(join(ROOT_DIR, dir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(ROOT_DIR, join(entry.parentPath, entry.name))),
);
const bundled = read('src/assets/brand/we-logo-wordmark.svg');

test('public/press holds exactly one file, the wordmark, byte for byte the bundled copy', () => {
  assert.deepEqual(readdirSync(new URL('public/press/', ROOT)), ['we-logo-wordmark.svg']);
  assert.equal(read('public/press/we-logo-wordmark.svg'), bundled);
});

test('no tracked image is a further copy of the wordmark under another name', () => {
  const images = tracked.filter((path) => /\.(svg|png|jpe?g|webp|avif|gif|ico)$/i.test(path));
  const copies = images.filter((path) => path.endsWith('.svg') && readFileSync(new URL(path, ROOT), 'utf8') === bundled);
  assert.deepEqual(copies.sort(), ['public/press/we-logo-wordmark.svg', 'src/assets/brand/we-logo-wordmark.svg']);
  const named = images.filter((path) => /wordmark|we-logo/i.test(path));
  assert.deepEqual(named.sort(), ['public/press/we-logo-wordmark.svg', 'src/assets/brand/we-logo-wordmark.svg']);
});

test('both copies are in use: the press URL by the schema and press pages, the bundled one by the header', () => {
  assert.match(read('src/lib/schema.ts'), /LOGO_PATH = '\/press\/we-logo-wordmark\.svg'/);
  assert.match(read('src/pages/press/index.astro'), /\/press\/we-logo-wordmark\.svg/);
  assert.match(read('src/components/layout/Header.astro'), /import wordmark from '\.\.\/\.\.\/assets\/brand\/we-logo-wordmark\.svg'/);
});

test('the header renders the wordmark once, not a second logo beside it', () => {
  const header = read('src/components/layout/Header.astro');
  assert.equal(header.match(/<img\b/g)?.length, 1);
  assert.equal(header.match(/wordmark\.src/g)?.length, 2, 'src and srcset only');
});
