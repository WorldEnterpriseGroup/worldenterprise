import assert from 'node:assert/strict';
import test from 'node:test';
import * as claimsAudit from '../../../scripts/audit-claims.mjs';
import { repoViewAt } from '../wp-60/repo-view.ts';
import { checkSentences } from '../wp-60/sources.ts';
import type { SentenceRecord, SourcesFile } from '../wp-60/sources.ts';
import { read, root, surfaces } from './surfaces.ts';

/**
 * The sentence ledger of the partner journey (docs/wave8-contracts.md, section 9; the WP-60 pattern). The strings come from the copy
 * module and the content files. `.astro-magazine/sources/wp-65.json` maps each one to a claim, an existing page or a decision. A
 * sentence with no mapping fails here, a mapping whose sentence is gone fails here, and every sentence runs through the claims denylist.
 */
interface Hit {
  readonly rule: string;
  readonly match: string;
}
const audit = claimsAudit as unknown as { scan(text: string, options?: { route?: string; plain?: boolean; flagValues?: object }): Hit[] };

const repo = repoViewAt(root);
const ledger = JSON.parse(read('.astro-magazine/sources/wp-65.json')) as SourcesFile;
const live = surfaces();

const documentFor = (path: string): readonly SentenceRecord[] => ledger.documents?.find((d) => d.path === path)?.sentences ?? [];

test('the WP-65 sources file is the WP-65 ledger, has no fetches and lists exactly the surfaces', () => {
  assert.equal(ledger.wp, 'WP-65');
  assert.deepEqual(ledger.fetches, []);
  assert.deepEqual((ledger.documents ?? []).map((d) => d.path).sort(), live.map((s) => s.path).sort());
});

test('every sentence the partner pages hold is mapped (an unmapped sentence fails here)', () => {
  for (const surface of live) {
    const mapped = new Set(documentFor(surface.path).map((s) => s.text));
    const missing = surface.strings.filter((text) => !mapped.has(text));
    assert.deepEqual(missing, [], `Unmapped in ${surface.path}. Add each to .astro-magazine/sources/wp-65.json:\n${missing.map((m) => `  ${JSON.stringify(m)}`).join('\n')}`);
  }
});

test('no mapping is stale: every mapped sentence is still in its file', () => {
  for (const surface of live) {
    const present = new Set(surface.strings);
    const stale = documentFor(surface.path).map((s) => s.text).filter((text) => !present.has(text));
    assert.deepEqual(stale, [], `Stale in ${surface.path}`);
  }
});

test('every mapping is well formed: one claim, page, decision or short label, and an existing page', () => {
  for (const doc of ledger.documents ?? []) assert.deepEqual(checkSentences('WP-65', doc.path, doc.sentences ?? [], repo), []);
});

test('a label is a control or a heading: it states no fact about WE', () => {
  // A sentence that says what WE does or does not do is a fact and needs a claim, a page or a decision, however short it is.
  for (const doc of ledger.documents ?? []) {
    for (const sentence of doc.sentences ?? []) {
      if (sentence.label !== true) continue;
      assert.doesNotMatch(sentence.text, /^WE\s/, `"${sentence.text}" is a fact, not a label`);
    }
  }
});

test('no sentence the ledger holds trips the claims denylist', () => {
  for (const surface of live) {
    for (const text of surface.strings) {
      const hits = audit.scan(text, { route: '/network/partners/', plain: true, flagValues: {} });
      assert.deepEqual(hits.map((h) => h.rule), [], `${surface.path}: "${text}"`);
    }
  }
});

test('the no-partnership sentence is mapped to the claim C-26', () => {
  const entry = documentFor('src/components/partners/copy.ts').find((s) => s.text === 'An enquiry creates no partnership, no referral arrangement and no commitment on either side.');
  assert.equal(entry?.claim, 'C-26');
});
