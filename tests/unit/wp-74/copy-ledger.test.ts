import assert from 'node:assert/strict';
import test from 'node:test';
import * as claimsAudit from '../../../scripts/audit-claims.mjs';
import { SCOPE_HEADING, SCOPE_ITEMS } from '../../../src/components/industries/scope-copy.ts';
import { repoViewAt } from '../wp-60/repo-view.ts';
import { checkSentences } from '../wp-60/sources.ts';
import type { SentenceRecord } from '../wp-60/sources.ts';
import { allPagePaths, HUB_PATH, industrySlugs, ledger, pagePath, pageSentences, root, SCOPE_PATH } from './pages.ts';

/**
 * The sentence ledger of WP-74's copy (docs/wave8-contracts.md, section 9; the WP-60 pattern). The sentences are read from the files that hold
 * them: a sentence with no mapping fails here, a mapping whose sentence is gone fails here, every mapping is one honest reference, and every
 * sentence runs through the claims denylist on the route it renders on.
 */
interface Hit {
  readonly rule: string;
}
const audit = claimsAudit as unknown as { scan(text: string, options?: { route?: string; plain?: boolean; flagValues?: object }): Hit[] };

const repo = repoViewAt(root);
const file = ledger();
const documentFor = (path: string): readonly SentenceRecord[] => file.documents?.find((d) => d.path === path)?.sentences ?? [];

const surfaces: ReadonlyArray<{ path: string; route: string; strings: string[] }> = [
  ...industrySlugs.map((slug) => ({ path: pagePath(slug), route: `/industries/${slug}/`, strings: pageSentences(pagePath(slug)) })),
  { path: HUB_PATH, route: '/industries/', strings: pageSentences(HUB_PATH) },
  { path: SCOPE_PATH, route: '/industries/', strings: [SCOPE_HEADING, ...SCOPE_ITEMS.map((i) => i.text)] },
];

test('the WP-74 sources file lists exactly the eight content files and the scope copy', () => {
  assert.equal(file.wp, 'WP-74');
  assert.deepEqual((file.documents ?? []).map((d) => d.path).sort(), [...allPagePaths, SCOPE_PATH].sort());
  assert.equal(file.markers, undefined, 'no page needs a marker');
});

test('every sentence the files hold is mapped (an unmapped sentence fails here)', () => {
  for (const surface of surfaces) {
    assert.ok(surface.strings.length > 0, `${surface.path} yields no sentence`);
    const mapped = new Set(documentFor(surface.path).map((s) => s.text));
    const missing = surface.strings.filter((text) => !mapped.has(text));
    assert.deepEqual(missing, [], `Unmapped in ${surface.path}. Add each to .astro-magazine/sources/wp-74.json:\n${missing.map((m) => `  ${JSON.stringify(m)}`).join('\n')}`);
  }
});

test('no mapping is stale: every mapped sentence is still in its file', () => {
  for (const surface of surfaces) {
    const present = new Set(surface.strings);
    const stale = documentFor(surface.path).map((s) => s.text).filter((text) => !present.has(text));
    assert.deepEqual(stale, [], `Stale in ${surface.path}`);
  }
});

test('every mapping is well formed: one claim, page, decision or label, and an existing page', () => {
  for (const doc of file.documents ?? []) assert.deepEqual(checkSentences('WP-74', doc.path, doc.sentences ?? [], repo), []);
});

test('a perimeter sentence restates a source (W8-9); every other sentence of an industry page is a consideration (W8-24) or the title label', () => {
  const claimed = new Set((file.perimeterClaims ?? []).map((c) => c.sentence));
  for (const slug of industrySlugs) {
    for (const record of documentFor(pagePath(slug))) {
      if (record.label === true) continue;
      const expected = claimed.has(record.text) ? 'W8-9' : 'W8-24';
      assert.equal(record.decision, expected, `${slug}: "${record.text}" is mapped to ${record.decision ?? 'something else'}, want ${expected}`);
    }
  }
});

test('the scope sentences map to claim C-29 or to the two services pages that state the limits', () => {
  const allowed = new Set(['src/content/services/product-and-it-development.mdx', 'src/content/services/professional-services-coordination.mdx']);
  for (const record of documentFor(SCOPE_PATH)) {
    if (record.label === true) continue;
    assert.ok(record.claim === 'C-29' || (record.page !== undefined && allowed.has(record.page)), `${record.text} maps to ${record.claim ?? record.page ?? record.decision}`);
  }
});

test('no sentence the ledger holds trips the claims denylist', () => {
  for (const surface of surfaces) {
    for (const text of surface.strings) {
      assert.deepEqual(audit.scan(text, { route: surface.route, plain: true, flagValues: {} }).map((h) => h.rule), [], `${surface.path}: "${text}"`);
    }
  }
});

test('the denylist is live: a certification claim and a fee claim are caught by the same scan', () => {
  const hits = audit.scan('WE is SOC 2 certified and charges no fee.', { route: '/industries/fintech/', plain: true, flagValues: {} }).map((h) => h.rule);
  assert.ok(hits.length > 0, 'the scan must catch these, or the test above proves nothing');
});
