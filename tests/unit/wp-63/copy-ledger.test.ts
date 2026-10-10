import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';
import * as claimsAudit from '../../../scripts/audit-claims.mjs';
import * as copy from '../../../src/components/briefs/copy.ts';
import { depthLine } from '../../../src/components/briefs/copy.ts';
import { BRIEFS } from '../../../src/data/families.ts';
import { repoViewAt } from '../wp-60/repo-view.ts';
import { checkSentences } from '../wp-60/sources.ts';
import type { SentenceRecord, SourcesFile } from '../wp-60/sources.ts';

/**
 * The sentence ledger of WP-63's own copy (docs/wave8-contracts.md, section 9; the WP-60 pattern). The strings come from the files that
 * hold them: the squeeze, hub and thanks copy module, the two page files and the open abstracts. `.astro-magazine/sources/wp-63.json`
 * maps each sentence to a claim, an existing page or a decision. A sentence with no mapping fails here, a mapping whose sentence is gone
 * fails here, and every sentence runs through the claims denylist. The full text of a brief is not page copy and is audited by
 * audit-claims over infra/intake/briefs.
 */
interface Hit {
  readonly rule: string;
  readonly match: string;
}
const audit = claimsAudit as unknown as { scan(text: string, options?: { route?: string; plain?: boolean; flagValues?: object }): Hit[] };

const root = new URL('../../../', import.meta.url).pathname;
const repo = repoViewAt(root);
const ledger = JSON.parse(readFileSync(join(root, '.astro-magazine/sources/wp-63.json'), 'utf8')) as SourcesFile;

const COPY = 'src/components/briefs/copy.ts';
const PAGES = ['src/content/pages/briefs/index.md', 'src/content/pages/briefs/thanks.md'];
const OWNED = BRIEFS.entries.filter((e) => e.owner === 'WP-63').map((e) => e.slug);
const ABSTRACTS = OWNED.map((id) => `src/content/briefs/${id}.md`).filter((path) => existsSync(join(root, path)));

/** A string split into its sentences, so the ledger maps sentences and not paragraphs. */
const sentencesOf = (text: string): string[] => text.split(/(?<=[.!?])\s+(?=[A-Z])/).map((s) => s.trim()).filter((s) => s !== '');

function moduleStrings(): string[] {
  const strings: string[] = [];
  const visit = (value: unknown): void => {
    if (typeof value === 'string') strings.push(...sentencesOf(value));
    else if (Array.isArray(value)) value.forEach(visit);
    else if (typeof value === 'object' && value !== null) Object.values(value).forEach(visit);
  };
  // Only the data objects: the depth line is a function and is checked on its own below.
  for (const [name, value] of Object.entries(copy)) if (name.endsWith('_COPY')) visit(value);
  return strings;
}

/** The sentences of a content file: the description and the subtitle of the front matter, then the body paragraphs. */
function fileStrings(path: string): string[] {
  const raw = readFileSync(join(root, path), 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  assert.ok(match !== null, `${path} has no front matter`);
  const front = (parse(match[1] ?? '') ?? {}) as Record<string, unknown>;
  const strings: string[] = [];
  if (typeof front.subtitle === 'string') strings.push(...sentencesOf(front.subtitle));
  if (typeof front.description === 'string') strings.push(...sentencesOf(front.description));
  for (const paragraph of (match[2] ?? '').split(/\n\s*\n/)) {
    const text = paragraph.replace(/\s+/g, ' ').trim();
    if (text !== '') strings.push(...sentencesOf(text));
  }
  return strings;
}

const surfaces: ReadonlyArray<{ path: string; strings: string[] }> = [
  { path: COPY, strings: [...new Set(moduleStrings())] },
  ...[...PAGES, ...ABSTRACTS].map((path) => ({ path, strings: [...new Set(fileStrings(path))] })),
];

const documentFor = (path: string): readonly SentenceRecord[] => ledger.documents?.find((d) => d.path === path)?.sentences ?? [];

test('the WP-63 sources file is the WP-63 ledger and lists the copy module, the page files, the abstracts and the briefs', () => {
  assert.equal(ledger.wp, 'WP-63');
  const expected = [...surfaces.map((s) => s.path), ...OWNED.map((id) => `infra/intake/briefs/${id}.md`).filter((p) => existsSync(join(root, p)))].sort();
  assert.deepEqual((ledger.documents ?? []).map((d) => d.path).sort(), expected);
});

test('every sentence the files hold is mapped (an unmapped sentence fails here)', () => {
  for (const surface of surfaces) {
    const mapped = new Set(documentFor(surface.path).map((s) => s.text));
    const missing = surface.strings.filter((text) => !mapped.has(text));
    assert.deepEqual(missing, [], `Unmapped in ${surface.path}. Add each to .astro-magazine/sources/wp-63.json:\n${missing.map((m) => `  ${JSON.stringify(m)}`).join('\n')}`);
  }
});

test('no mapping is stale: every mapped sentence is still in its file', () => {
  for (const surface of surfaces) {
    const live = new Set(surface.strings);
    const stale = documentFor(surface.path).map((s) => s.text).filter((text) => !live.has(text));
    assert.deepEqual(stale, [], `Stale in ${surface.path}`);
  }
});

test('every mapping is well formed: one claim, page, decision or label, and an existing page', () => {
  for (const doc of ledger.documents ?? []) assert.deepEqual(checkSentences('WP-63', doc.path, doc.sentences ?? [], repo), []);
});

test('no sentence the ledger holds trips the claims denylist', () => {
  for (const surface of surfaces) {
    for (const text of surface.strings) {
      const hits = audit.scan(text, { route: '/', plain: true, flagValues: {} });
      assert.deepEqual(hits.map((h) => h.rule), [], `${surface.path}: "${text}"`);
    }
  }
});

test('the depth line states a date and a count and never a reading time or a delivery time', () => {
  for (const count of [0, 1, 2, 15]) {
    const line = depthLine(new Date('2026-10-10T00:00:00Z'), count);
    assert.match(line, /^Updated October 10, 2026\. \d+ sections?\.$/);
    assert.deepEqual(audit.scan(line, { route: '/', plain: true, flagValues: {} }).map((h) => h.rule), []);
    assert.doesNotMatch(line, /min|minute|hour|day|delivery|instant|immediate/i);
  }
  assert.match(depthLine(new Date('2026-10-10T00:00:00Z'), 1), /1 section\.$/);
});

test('no copy calls a brief free, exclusive, instant or a download, or promises when it arrives', () => {
  const banned = /\b(free|exclusive|download now|instant|instantly|immediately|within \d+|in \d+ (?:minutes|hours|days)|guarantee[ds]?)\b/i;
  for (const surface of surfaces) {
    for (const text of surface.strings) assert.doesNotMatch(text, banned, `${surface.path}: "${text}"`);
  }
});

test('the copy never offers a mailto and never names a delivery channel other than email', () => {
  for (const surface of surfaces) {
    for (const text of surface.strings) assert.doesNotMatch(text, /mailto:|@/, `${surface.path}: "${text}"`);
  }
});
