import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import * as claimsAudit from '../../../scripts/audit-claims.mjs';
import { repoViewAt } from '../wp-60/repo-view.ts';
import { checkSentences } from '../wp-60/sources.ts';
import type { SentenceRecord, SourcesFile } from '../wp-60/sources.ts';
import { MDX_PAGES, surfaces } from './sentences.ts';

/**
 * The sentence ledger of the investor journey (docs/wave8-contracts.md, section 9; the WP-60 and WP-43 pattern). The strings come from the
 * copy module, the FAQ module, the two shared modules the criteria page renders, and the parsed content files.
 * `.astro-magazine/sources/wp-64.json` maps each sentence to a claim, an existing page or a decision. A sentence with no mapping fails here,
 * a mapping whose sentence is gone fails here, and every sentence runs through the claims denylist.
 */
interface Hit {
  readonly rule: string;
  readonly match: string;
}
const audit = claimsAudit as unknown as { scan(text: string, options?: { route?: string; plain?: boolean; flagValues?: object }): Hit[] };

const root = new URL('../../../', import.meta.url).pathname;
const repo = repoViewAt(root);
const ledger = JSON.parse(readFileSync(join(root, '.astro-magazine/sources/wp-64.json'), 'utf8')) as SourcesFile;
const all = surfaces();

const documentFor = (path: string): readonly SentenceRecord[] => ledger.documents?.find((d) => d.path === path)?.sentences ?? [];

test('the WP-64 sources file is the WP-64 ledger, makes no outside fetch and lists exactly the documents the copy lives in', () => {
  assert.equal(ledger.wp, 'WP-64');
  assert.deepEqual(ledger.fetches, [], 'no regulatory or outside fact is stated, so nothing is fetched');
  assert.deepEqual((ledger.documents ?? []).map((d) => d.path).sort(), all.map((s) => s.path).sort());
});

test('every sentence the modules and content files hold is mapped (an unmapped sentence fails here)', () => {
  for (const surface of all) {
    const mapped = new Set(documentFor(surface.path).map((s) => s.text));
    const missing = surface.strings.filter((text) => !mapped.has(text));
    assert.deepEqual(missing, [], `Unmapped in ${surface.path}. Add each to .astro-magazine/sources/wp-64.json:\n${missing.map((m) => `  ${JSON.stringify(m)}`).join('\n')}`);
  }
});

test('no mapping is stale: every mapped sentence is still on the site', () => {
  for (const surface of all) {
    const live = new Set(surface.strings);
    const stale = documentFor(surface.path).map((s) => s.text).filter((text) => !live.has(text));
    assert.deepEqual(stale, [], `Stale in ${surface.path}`);
  }
});

test('every mapping is well formed: one claim, page, decision or label, and an existing page', () => {
  for (const doc of ledger.documents ?? []) assert.deepEqual(checkSentences('WP-64', doc.path, doc.sentences ?? [], repo), []);
});

test('every claim the ledger cites is a published, enabled claim, and C-13 is never cited', async () => {
  const { claimRegistry } = await import('../../../src/data/claims.ts');
  const cited = new Set((ledger.documents ?? []).flatMap((d) => (d.sentences ?? []).map((s) => s.claim)).filter((c): c is string => c !== undefined));
  assert.ok(cited.size >= 4);
  for (const id of cited) {
    const claim = claimRegistry[id as keyof typeof claimRegistry];
    assert.ok(claim !== undefined, `${id} is not a claim`);
    assert.equal(claim.status, 'publish', `${id} is not published`);
    assert.equal(claim.enabled, true, `${id} is not enabled`);
  }
  assert.ok(!cited.has('C-13'), 'portfolio and social proof stay excluded');
});

test('no sentence the ledger holds trips the claims denylist', () => {
  const routeOf = new Map(MDX_PAGES.map((p) => [p.path, p.route]));
  for (const surface of all) {
    for (const text of surface.strings) {
      const hits = audit.scan(text, { route: routeOf.get(surface.path) ?? '/investors/', plain: true, flagValues: {} });
      assert.deepEqual(hits.map((h) => h.rule), [], `${surface.path}: "${text}"`);
    }
  }
});

test('the funding sentence is the claim sentence, and the ledger maps it to C-05', () => {
  const entry = documentFor('src/components/investors/copy.ts').find((s) => s.text === 'WE makes no promise of funding.');
  assert.equal(entry?.claim, 'C-05');
});
