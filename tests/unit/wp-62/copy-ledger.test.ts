import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import * as claimsAudit from '../../../scripts/audit-claims.mjs';
import { HUB_HEADINGS } from '../../../src/data/cta/hubs.ts';
import { repoViewAt } from '../wp-60/repo-view.ts';
import { checkSentences } from '../wp-60/sources.ts';
import type { SentenceRecord, SourcesFile } from '../wp-60/sources.ts';

/**
 * The sentence ledger of WP-62's own copy (docs/wave8-contracts.md, section 9; the WP-60 pattern): the home page's "Who WE works with"
 * section, the two hub headings of src/data/cta/hubs.ts and the desk paragraphs of the insights hub. The
 * sentences are read from the files that hold them. A sentence with no mapping fails here, a mapping whose sentence is gone fails here, and
 * every sentence runs through the claims denylist.
 */
interface Hit {
  readonly rule: string;
}
const audit = claimsAudit as unknown as { scan(text: string, options?: { route?: string; plain?: boolean; flagValues?: object }): Hit[] };

const root = new URL('../../../', import.meta.url).pathname;
const read = (rel: string): string => readFileSync(join(root, rel), 'utf8');
const repo = repoViewAt(root);
const ledger = JSON.parse(read('.astro-magazine/sources/wp-62.json')) as SourcesFile;

const HOME = 'src/content/pages/home/index.mdx';
const HUBS = 'src/data/cta/hubs.ts';
const INSIGHTS = 'src/content/pages/insights/index.mdx';

const sentencesOf = (text: string): string[] => text.split(/(?<=[.!?])\s+(?=[A-Z])/).map((s) => s.trim()).filter((s) => s !== '');

/** The body of a content file: everything after the frontmatter. */
const bodyOf = (rel: string): string => read(rel).replace(/^---\n[\s\S]*?\n---\n/, '');

/** The paragraphs of a body (plain paragraphs only; a heading line is not a paragraph). */
const paragraphsOf = (body: string): string[] => body.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p !== '' && !p.startsWith('#'));

/** The paragraphs under one H2 of a content file, up to the next H2. */
function underHeading(rel: string, heading: string): string[] {
  const body = bodyOf(rel);
  const start = body.indexOf(`## ${heading}`);
  assert.ok(start !== -1, `${rel} has no "## ${heading}"`);
  const rest = body.slice(start + `## ${heading}`.length);
  const next = rest.search(/\n## /);
  return paragraphsOf(next === -1 ? rest : rest.slice(0, next));
}

const surfaces: ReadonlyArray<{ path: string; strings: string[] }> = [
  { path: HOME, strings: underHeading(HOME, 'Who WE works with').flatMap(sentencesOf) },
  { path: HUBS, strings: Object.values(HUB_HEADINGS) },
  // The first paragraph of the insights hub is the byline paragraph WP-60 left as it was; the desk paragraphs after it are WP-62's.
  { path: INSIGHTS, strings: paragraphsOf(bodyOf(INSIGHTS)).slice(1).flatMap(sentencesOf) },
];

const documentFor = (path: string): readonly SentenceRecord[] => ledger.documents?.find((d) => d.path === path)?.sentences ?? [];

test('the WP-62 sources file is the WP-62 ledger and lists exactly the three copy files', () => {
  assert.equal(ledger.wp, 'WP-62');
  assert.deepEqual(ledger.fetches, []);
  assert.deepEqual((ledger.documents ?? []).map((d) => d.path).sort(), surfaces.map((s) => s.path).sort());
});

test('every sentence the files hold is mapped (an unmapped sentence fails here)', () => {
  for (const surface of surfaces) {
    assert.ok(surface.strings.length > 0, `${surface.path} yields no sentence`);
    const mapped = new Set(documentFor(surface.path).map((s) => s.text));
    const missing = surface.strings.filter((text) => !mapped.has(text));
    assert.deepEqual(missing, [], `Unmapped in ${surface.path}. Add each to .astro-magazine/sources/wp-62.json:\n${missing.map((m) => `  ${JSON.stringify(m)}`).join('\n')}`);
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
  for (const doc of ledger.documents ?? []) assert.deepEqual(checkSentences('WP-62', doc.path, doc.sentences ?? [], repo), []);
});

test('no sentence the ledger holds trips the claims denylist', () => {
  for (const surface of surfaces) {
    for (const text of surface.strings) {
      assert.deepEqual(audit.scan(text, { route: '/', plain: true, flagValues: {} }).map((h) => h.rule), [], `${surface.path}: "${text}"`);
    }
  }
});

test('the home sentences that state a fact about investors and partners carry the claims that allow them', () => {
  const byText = new Map(documentFor(HOME).map((s) => [s.text, s.claim]));
  assert.equal([...byText.entries()].find(([text]) => text.startsWith('Investors may ask'))?.[1], 'C-25');
  assert.equal([...byText.entries()].find(([text]) => text.startsWith('An organization that helps'))?.[1], 'C-26');
  assert.match(read(HOME), /claimsUsed:.*C-25.*C-26/);
});
