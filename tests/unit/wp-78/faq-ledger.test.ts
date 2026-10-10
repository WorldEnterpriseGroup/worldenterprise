import assert from 'node:assert/strict';
import test from 'node:test';
import * as claimsAudit from '../../../scripts/audit-claims.mjs';
import { repoViewAt } from '../wp-60/repo-view.ts';
import { checkSentences } from '../wp-60/sources.ts';
import type { SentenceRecord, SourcesFile } from '../wp-60/sources.ts';
import { newSentences, read, root } from './faq.ts';

/**
 * The sentence ledger of the FAQ entries WP-78 added (docs/wave8-contracts.md, section 9; the WP-60 pattern). The strings come from
 * `src/data/faq.yaml`. `.astro-magazine/sources/wp-78.json` maps each one to a claim, an existing page or a decision. A sentence with no
 * mapping fails here, a mapping whose sentence is gone fails here, and every sentence runs through the claims denylist.
 */
interface Hit {
  readonly rule: string;
  readonly match: string;
}
const audit = claimsAudit as unknown as { scan(text: string, options?: { route?: string; plain?: boolean; flagValues?: object }): Hit[] };

const FILE = 'src/data/faq.yaml';
const repo = repoViewAt(root);
const ledger = JSON.parse(read('.astro-magazine/sources/wp-78.json')) as SourcesFile;
const mapped: readonly SentenceRecord[] = ledger.documents?.find((d) => d.path === FILE)?.sentences ?? [];
const live = newSentences();

test('the WP-78 sources file is the WP-78 ledger, has no fetches and lists the FAQ data file alone', () => {
  assert.equal(ledger.wp, 'WP-78');
  assert.deepEqual(ledger.fetches, []);
  assert.deepEqual((ledger.documents ?? []).map((d) => d.path), [FILE]);
});

test('every sentence of every new FAQ entry is mapped (an unmapped sentence fails here)', () => {
  const have = new Set(mapped.map((s) => s.text));
  const missing = live.filter((text) => !have.has(text));
  assert.deepEqual(missing, [], `Unmapped in ${FILE}. Add each to .astro-magazine/sources/wp-78.json:\n${missing.map((m) => `  ${JSON.stringify(m)}`).join('\n')}`);
});

test('no mapping is stale: every mapped sentence is still in the FAQ data', () => {
  const present = new Set(live);
  const stale = mapped.map((s) => s.text).filter((text) => !present.has(text));
  assert.deepEqual(stale, [], 'Stale in the WP-78 ledger');
});

test('every mapping is well formed: one claim, page, decision or short label, and an existing page', () => {
  assert.deepEqual(checkSentences('WP-78', FILE, mapped, repo), []);
});

test('a label is a bare yes or no: it states no fact about WE', () => {
  // A sentence that says what WE does or does not do is a fact and needs a claim, a page or a decision, however short it is.
  for (const sentence of mapped) {
    if (sentence.label !== true) continue;
    assert.match(sentence.text, /^(Yes|No)\.$/, `"${sentence.text}" is not a bare yes or no`);
  }
});

test('no sentence the ledger holds trips the claims denylist', () => {
  for (const text of live) {
    const hits = audit.scan(text, { route: '/faq/', plain: true, flagValues: {} });
    assert.deepEqual(hits.map((h) => h.rule), [], `"${text}"`);
  }
});

test('the funding sentence is mapped to the claim C-05, and the founder-consent sentence to the decision W8-17', () => {
  assert.equal(mapped.find((s) => s.text === 'WE makes no promise of funding.')?.claim, 'C-05');
  assert.equal(mapped.find((s) => s.text === "WE lists a company only with its founder's written consent.")?.decision, 'W8-17');
});
