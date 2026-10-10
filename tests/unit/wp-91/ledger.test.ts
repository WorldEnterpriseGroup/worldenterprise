import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { FAMILY_LABELS } from '../../../src/components/geo/llms-plan.ts';
import { repoViewAt } from '../wp-60/repo-view.ts';
import { checkSentences } from '../wp-60/sources.ts';
import type { SourcesFile } from '../wp-60/sources.ts';

/**
 * The sentence ledger of WP-91's own copy (docs/wave8-contracts.md, section 9). The package adds labels of the machine files and no
 * prose: the twins take every sentence from the page they copy (the family twins from copy.ts, which WP-71 ledgers).
 */
const root = new URL('../../../', import.meta.url).pathname;
const ledger = JSON.parse(readFileSync(join(root, '.astro-magazine/sources/wp-91.json'), 'utf8')) as SourcesFile;

test('every sentence of the ledger passes the sentence rules and is still in the file it names', () => {
  const repo = repoViewAt(root);
  for (const doc of ledger.documents ?? []) {
    assert.deepEqual(checkSentences('wp-91', doc.path, doc.sentences ?? [], repo), []);
    const text = readFileSync(join(root, doc.path), 'utf8');
    for (const sentence of doc.sentences ?? []) assert.ok(text.includes(sentence.text), `${doc.path} no longer holds "${sentence.text}"`);
  }
});

test('every family label of the llms file is in the ledger, so a new family label fails until it is mapped', () => {
  const mapped = new Set((ledger.documents ?? []).find((doc) => doc.path === 'src/components/geo/llms-plan.ts')?.sentences?.map((s) => s.text));
  for (const label of Object.values(FAMILY_LABELS)) assert.ok(mapped.has(label), `"${label}" is not in .astro-magazine/sources/wp-91.json`);
});
