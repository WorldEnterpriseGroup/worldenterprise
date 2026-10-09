import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { collect, isRelevant, jsonStrings, render, sentencesOf } from '../../../scripts/ci/counsel-extract.mjs';

// The counsel extract reads the built pages, so counsel reviews what renders (WP-30, RELEASE.md section 5).

const SCRIPT = new URL('../../../scripts/ci/counsel-extract.mjs', import.meta.url).pathname;
const DISCLAIMER =
  'Introductions are a flat-fee service. WE is not a broker-dealer or investment adviser, takes no fee or stake tied to any investment, and cannot promise a meeting or funding.';

function page(route: string, main: string, head = ''): { route: string; file: string; html: string } {
  return { route, file: `${route}index.html`, html: `<!doctype html><html><head>${head}</head><body><header>Investor nav</header><main id="main">${main}</main></body></html>` };
}

test('sentences split at a capital and keep abbreviations inside a sentence', () => {
  assert.deepEqual(sentencesOf('One thing. Another thing! A third? and e.g. lower case stays.'), ['One thing.', 'Another thing!', 'A third? and e.g. lower case stays.']);
});

test('relevance covers the add-on, investors, securities and fee wording, and ignores the rest', () => {
  for (const s of [DISCLAIMER, 'The fee does not depend on whether any investment closes.', 'No success fee applies.', 'WE makes no promise of funding.']) assert.ok(isRelevant(s), s);
  assert.ok(!isRelevant('The cohort starts with a readiness check.'));
});

test('JSON-LD strings are walked through nested arrays and objects', () => {
  assert.deepEqual(jsonStrings({ a: 'x', b: [{ c: 'y' }, 'z'], d: 3, e: null }), ['x', 'y', 'z']);
});

test('only <main>, the descriptions and JSON-LD are read, never the navigation, and one sentence lists every page that carries it', () => {
  const into = new Map<string, { route: string; source: string }[]>();
  const head = `<meta name="description" content="Investor Introductions are a paid add-on."><script type="application/ld+json">{"@type":"FAQPage","text":"Does WE introduce founders to investors? Yes, as a paid add-on."}</script>`;
  collect(page('/investors/', `<p>${DISCLAIMER}</p><p>Plain sentence.</p>`, head), into);
  collect(page('/pricing/', `<aside>${DISCLAIMER}</aside>`), into);
  const rows = into.get('Introductions are a flat-fee service.');
  assert.ok(rows, 'the first sentence of the disclaimer was found');
  assert.ok(into.has(DISCLAIMER.slice('Introductions are a flat-fee service. '.length)), 'and the second');
  assert.deepEqual(rows.map((r) => `${r.route}:${r.source}`).sort(), ['/investors/:main', '/pricing/:main']);
  assert.ok(into.has('Investor Introductions are a paid add-on.'), 'meta description');
  assert.ok(into.get('Does WE introduce founders to investors?')?.some((r) => r.source === 'json-ld'), 'json-ld sentences are split');
  assert.ok([...into.keys()].every((s) => !s.includes('Investor nav')), 'the header is not part of <main>');
  assert.ok(!into.has('Plain sentence.'));
  const text = render(into, 2);
  assert.match(text, /> Introductions are a flat-fee service\./);
  assert.match(text, /\/investors\/ \(main\), \/pricing\/ \(main\)/);
});

test('the command writes the report and skips the development routes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wp30-extract-'));
  try {
    const dist = join(dir, 'dist');
    mkdirSync(join(dist, 'investors'), { recursive: true });
    mkdirSync(join(dist, 'styleguide'), { recursive: true });
    writeFileSync(join(dist, 'investors', 'index.html'), page('/investors/', `<p>${DISCLAIMER}</p>`).html);
    writeFileSync(join(dist, 'styleguide', 'index.html'), page('/styleguide/', '<p>Investor sample text only on the styleguide.</p>').html);
    const out = join(dir, 'reports', 'counsel-review.md');
    const result = spawnSync('node', [SCRIPT, '--dist', dist, '--out', out], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const report = readFileSync(out, 'utf8');
    assert.match(report, /Introductions are a flat-fee service\./);
    assert.doesNotMatch(report, /styleguide/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the command fails, naming the directory, when dist is missing', () => {
  const result = spawnSync('node', [SCRIPT, '--dist', join(tmpdir(), 'wp30-no-such-dist'), '--out', join(tmpdir(), 'wp30-unused.md')], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /dist directory not found/);
});
