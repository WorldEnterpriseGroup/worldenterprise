import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { repoViewAt } from '../wp-60/repo-view.ts';
import { checkSentences } from '../wp-60/sources.ts';
import type { SentenceRecord, SourcesFile } from '../wp-60/sources.ts';
import { surfaces } from './surfaces.ts';

/**
 * The sentence ledger of WP-76's own copy (docs/wave8-contracts.md, section 9; the WP-43 and WP-60 pattern). The strings come from the
 * modules and content files that hold them (surfaces.ts). `.astro-magazine/sources/wp-76.json` maps each sentence to a claim, an existing
 * page or a decision, or marks a short control label. A sentence with no mapping fails here, and a mapping whose sentence is gone fails here.
 */
const root = new URL('../../../', import.meta.url).pathname;
const repo = repoViewAt(root);
const ledger = JSON.parse(readFileSync(join(root, '.astro-magazine/sources/wp-76.json'), 'utf8')) as SourcesFile;

const documentFor = (path: string): readonly SentenceRecord[] => ledger.documents?.find((d) => d.path === path)?.sentences ?? [];

test('the sources file is the WP-76 ledger and lists exactly the files that hold the copy', () => {
  assert.equal(ledger.wp, 'WP-76');
  assert.deepEqual((ledger.documents ?? []).map((d) => d.path).sort(), surfaces().map((s) => s.path).sort());
});

test('every sentence the package publishes is mapped (an unmapped sentence fails here)', () => {
  for (const surface of surfaces()) {
    const mapped = new Set(documentFor(surface.path).map((s) => s.text));
    const missing = surface.strings.filter((text) => !mapped.has(text));
    assert.deepEqual(missing, [], `Unmapped in ${surface.path}. Add each to .astro-magazine/sources/wp-76.json:\n${missing.map((m) => `  ${JSON.stringify(m)}`).join('\n')}`);
  }
});

test('no mapping is stale: every mapped sentence is still in its file', () => {
  for (const surface of surfaces()) {
    const live = new Set(surface.strings);
    const stale = documentFor(surface.path).map((s) => s.text).filter((text) => !live.has(text));
    assert.deepEqual(stale, [], `Stale in ${surface.path}`);
  }
});

test('every mapping is well formed: one claim, page, decision or label, and an existing page and heading', () => {
  for (const doc of ledger.documents ?? []) assert.deepEqual(checkSentences('WP-76', doc.path, doc.sentences ?? [], repo), []);
});

test('the funding sentence is the funding claim', () => {
  const entry = documentFor('src/content/pages/tools/runway-calculator.mdx').find((s) => s.text.includes('WE makes no promise of funding.'));
  assert.equal(entry?.claim, 'C-05');
});

test('no mapping points at the file it describes without naming a heading, so a sentence never vouches for itself', () => {
  for (const doc of ledger.documents ?? []) {
    for (const sentence of doc.sentences ?? []) {
      if (sentence.page === undefined) continue;
      assert.notEqual(sentence.page, doc.path, `${doc.path}: "${sentence.text}" maps to its own file with no heading`);
    }
  }
});
