import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

// perf P1-2: the web fonts ship as WOFF2. A file with a .woff2 name that is really zlib WOFF would be accepted by every browser
// and silently cost 20 percent more bytes, so the signature is checked, not the name.

const root = new URL('../../../', import.meta.url);
const fontsDir = new URL('src/assets/fonts/', root);
const files = readdirSync(fontsDir);
const fontFiles = files.filter((name) => /\.(woff2?|ttf|otf|eot)$/i.test(name));

test('every font file in the repository is a real WOFF2 file', () => {
  assert.ok(fontFiles.length >= 12, `expected the family set, found ${fontFiles.length}`);
  for (const name of fontFiles) {
    assert.ok(name.endsWith('.woff2'), `${name} is not WOFF2`);
    const signature = readFileSync(new URL(name, fontsDir)).subarray(0, 4).toString('latin1');
    assert.equal(signature, 'wOF2', `${name} does not start with the WOFF2 signature`);
  }
});

test('every font source named in astro.config.mjs exists and is WOFF2', () => {
  const config = readFileSync(new URL('astro.config.mjs', root), 'utf8');
  const sources = [...config.matchAll(/src:\s*\['\.\/(src\/assets\/fonts\/[^']+)'\]/g)].map((m) => m[1] as string);
  assert.equal(sources.length, 12, 'the four families declare twelve faces');
  for (const source of sources) {
    assert.ok(source.endsWith('.woff2'), `${source} is not WOFF2`);
    assert.ok(existsSync(new URL(source, root)), `${source} does not exist`);
  }
});

test('the licence text for each family still ships beside the files', () => {
  for (const family of ['source-code-pro', 'source-sans-3', 'source-serif-4', 'titillium-web']) {
    assert.ok(files.includes(`LICENSE-${family}.txt`), `LICENSE-${family}.txt is missing`);
  }
});
