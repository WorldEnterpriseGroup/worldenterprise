import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { BRIEFS } from '../../../src/data/families.ts';
import { pageTitle } from '../../../src/data/site.ts';
import { TITLE_MAX } from '../../../src/lib/seo.ts';
import type { ClaimRecord, SourcesFile } from '../wp-60/sources.ts';
import { checkBrief, MAX_ABSTRACT_WORDS, MAX_BRIEF_WORDS, MIN_BRIEF_WORDS } from './brief-rules.ts';
import type { BriefFacts } from './brief-rules.ts';

/**
 * The rules over every gated brief that exists (infra/intake/briefs/) and over fabricated briefs that break each rule. A brief that is in
 * the registry but not written yet is not checked here (a later package writes it); a file that is not in the registry is a failure.
 */
const root = new URL('../../../', import.meta.url).pathname;
const BRIEFS_DIR = join(root, 'infra/intake/briefs');
const ABSTRACTS_DIR = join(root, 'src/content/briefs');
const SOURCES_DIR = join(root, '.astro-magazine/sources');

const read = (path: string): string => readFileSync(path, 'utf8');
const written = (): string[] => (existsSync(BRIEFS_DIR) ? readdirSync(BRIEFS_DIR).filter((n) => n.endsWith('.md')).map((n) => n.replace(/\.md$/, '')).sort() : []);

/**
 * The sources ledger of the package that owns a brief: owner 'WP-79' reads wp-79.json. A package that has no ledger yet gets an empty one,
 * so its brief still fails, and fails for the right reason (every source it names has no fetch record).
 */
function ledgerFor(owner: string, dir: string = SOURCES_DIR): SourcesFile {
  const file = join(dir, `${owner.toLowerCase()}.json`);
  if (!existsSync(file)) return { wp: owner, fetches: [] };
  return JSON.parse(read(file)) as SourcesFile;
}

function claimsFor(ledger: SourcesFile, id: string): readonly ClaimRecord[] {
  return ledger.documents?.find((d) => d.path === `infra/intake/briefs/${id}.md`)?.claims ?? [];
}

function factsFor(id: string): BriefFacts {
  const row = BRIEFS.entries.find((e) => e.slug === id);
  assert.ok(row !== undefined, `infra/intake/briefs/${id}.md is not in the brief registry (src/data/families.ts)`);
  const ledger = ledgerFor(row.owner);
  const abstract = join(ABSTRACTS_DIR, `${id}.md`);
  return {
    id,
    briefText: read(join(BRIEFS_DIR, `${id}.md`)),
    abstractText: existsSync(abstract) ? read(abstract) : undefined,
    audience: row.audience,
    desks: row.desks,
    fetches: ledger.fetches,
    claims: claimsFor(ledger, id),
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The real briefs
// ---------------------------------------------------------------------------------------------------------------------------------

test('the package writes the three briefs it owns', () => {
  const owned = BRIEFS.entries.filter((e) => e.owner === 'WP-63').map((e) => e.slug).sort();
  assert.deepEqual(owned, ['ai-native-build', 'company-setup', 'funding-paths']);
});

for (const id of written()) {
  test(`brief ${id} holds every brief rule`, () => {
    assert.deepEqual(checkBrief(factsFor(id)), []);
  });
}

test('every brief that is written has an open abstract, and no abstract exists without its brief', () => {
  const abstracts = existsSync(ABSTRACTS_DIR) ? readdirSync(ABSTRACTS_DIR).filter((n) => n.endsWith('.md')).map((n) => n.replace(/\.md$/, '')).sort() : [];
  // Another package's brief may be absent from this branch while its abstract is not, so the check is one way for the owned briefs.
  for (const id of written()) assert.ok(abstracts.includes(id), `${id} has no abstract`);
  for (const id of abstracts.filter((n) => BRIEFS.entries.find((e) => e.slug === n)?.owner === 'WP-63')) {
    assert.ok(written().includes(id), `src/content/briefs/${id}.md has no brief under infra/intake/briefs/`);
  }
});

test('every abstract title, with the site suffix, fits the 60-character title limit of the SEO audit', () => {
  const abstracts = existsSync(ABSTRACTS_DIR) ? readdirSync(ABSTRACTS_DIR).filter((n) => n.endsWith('.md')) : [];
  for (const name of abstracts) {
    const title = /^title: (.+)$/m.exec(read(join(ABSTRACTS_DIR, name)))?.[1]?.replace(/^"(.*)"$/, '$1');
    assert.ok(title !== undefined, `${name} has no title`);
    const full = pageTitle(title);
    assert.ok(full.length <= TITLE_MAX, `${name}: "${full}" is ${full.length} characters, over ${TITLE_MAX}`);
  }
});

test('every claim of the ledger belongs to a brief that exists', () => {
  for (const doc of ledgerFor('WP-63').documents ?? []) {
    if (!doc.path.startsWith('infra/intake/briefs/')) continue;
    assert.ok(existsSync(join(root, doc.path)), `${doc.path} is in the ledger but missing`);
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------
// The rules have teeth
// ---------------------------------------------------------------------------------------------------------------------------------

const ID = 'funding-paths';
const SENTINEL = 'A fixture sentinel sentence is long enough to be found again by the audit, and it must never be repeated in the open abstract.';

/** A filler sentence that is unique by construction, so no two fixture sentences share a ten-word run. */
const filler = (n: number): string => `Fixture sentence ${n} talks about topic${n} and matter${n} while detail${n} follows clause${n} beside note${n} and point${n}.`;
const paragraph = (from: number, count: number): string => Array.from({ length: count }, (_, i) => filler(from + i)).join(' ');

const url = (n: number): string => `https://www.sec.gov/fixture-${n}`;
const fetchesFor = (count: number): SourcesFile['fetches'] =>
  Array.from({ length: count }, (_, i) => ({ id: `s${i + 1}`, url: url(i + 1), title: `S${i + 1}`, publisher: 'SEC', fetchedAt: '2026-10-10T11:00:00Z', status: 200, tool: 'WebFetch' }));

interface Make {
  readonly sources?: number;
  readonly paragraphs?: number;
  readonly audience?: string;
  readonly image?: boolean;
  readonly skipSection?: string;
  readonly sentinel?: boolean;
}

function fixtureBrief(over: Make = {}): string {
  const count = over.sources ?? 6;
  const sources = Array.from({ length: count }, (_, i) => `  - { id: s${i + 1}, title: "S${i + 1}", publisher: "SEC", url: "${url(i + 1)}", accessed: 2026-10-10 }`).join('\n');
  const sections = ['The question this brief answers', 'About the evidence', 'What this brief cannot tell you', 'Sources'].filter((h) => h !== over.skipSection);
  const per = over.paragraphs ?? 55;
  const body = sections
    .map((heading, i) => {
      if (heading === 'Sources') return `## Sources\n\n${Array.from({ length: count }, (_, k) => `- SEC, "S${k + 1}," ${url(k + 1)}`).join('\n')}`;
      const extra = i === 0 && over.sentinel !== false ? `${SENTINEL} ` : '';
      const img = i === 0 && over.image === true ? '\n\n![A chart](chart.avif)' : '';
      return `## ${heading}\n\n${extra}${paragraph(i * 1000, per)}${img}`;
    })
    .join('\n\n');
  return [
    '---',
    `id: ${ID}`,
    'title: "A fixture brief"',
    'version: "1.0"',
    'updated: 2026-10-10',
    `audience: [${over.audience ?? 'startup'}]`,
    `sentinel: "${SENTINEL}"`,
    'sources:',
    sources,
    '---',
    '',
    body,
    '',
  ].join('\n');
}

function fixtureAbstract(over: { body?: string; audience?: string; outline?: readonly string[] } = {}): string {
  const outline = (over.outline ?? ['The question this brief answers', 'About the evidence', 'What this brief cannot tell you', 'Sources']).map((t) => `  - ${t}`).join('\n');
  return ['---', 'title: "A fixture"', 'subtitle: "A fixture subtitle"', 'description: "A fixture description that is long enough to pass the schema, and nothing more than that."', 'topics: [funding]', `audience: [${over.audience ?? 'startup'}]`, 'outline:', outline, 'updated: 2026-10-10', 'draft: false', '---', '', over.body ?? 'A short open abstract that says what the brief is about and nothing that the brief says in its own words.', ''].join('\n');
}

const facts = (over: { make?: Make; abstract?: string } = {}): BriefFacts => ({
  id: ID,
  briefText: fixtureBrief(over.make),
  abstractText: over.abstract ?? fixtureAbstract(),
  audience: ['startup'],
  desks: ['funding'],
  fetches: fetchesFor(over.make?.sources ?? 6),
  claims: [],
});

const wordsIn = (text: string): number => text.split(/\s+/).filter(Boolean).length;

test('the fixture brief itself passes, so each failure below is the one rule it breaks', () => {
  const brief = fixtureBrief();
  const words = wordsIn(brief.split('\n---\n')[1] ?? '');
  assert.ok(words >= MIN_BRIEF_WORDS && words <= MAX_BRIEF_WORDS, `the fixture has ${words} words`);
  assert.deepEqual(checkBrief(facts()), []);
});

test('an abstract over 300 words fails', () => {
  const long = Array.from({ length: MAX_ABSTRACT_WORDS + 20 }, (_, i) => `abstractword${i}`).join(' ');
  const problems = checkBrief(facts({ abstract: fixtureAbstract({ body: long }) }));
  assert.ok(problems.some((p) => /the abstract has \d+ words; at most 300/.test(p)), problems.join('\n'));
});

test('an abstract of exactly 300 words passes the length rule', () => {
  const edge = Array.from({ length: MAX_ABSTRACT_WORDS }, (_, i) => `abstractword${i}`).join(' ');
  assert.deepEqual(checkBrief(facts({ abstract: fixtureAbstract({ body: edge }) })), []);
});

test('an abstract that shares a ten-word run with the body fails', () => {
  const brief = fixtureBrief();
  const run = (brief.split('\n---\n')[1] ?? '').split('## About the evidence')[1]?.split(/\s+/).filter(Boolean).slice(20, 32).join(' ') ?? '';
  const problems = checkBrief(facts({ abstract: fixtureAbstract({ body: `An introduction of its own. ${run} A closing of its own.` }) }));
  assert.ok(problems.some((p) => /shares a 10-word run/.test(p)), problems.join('\n'));
});

test('an abstract that repeats the sentinel fails', () => {
  const problems = checkBrief(facts({ abstract: fixtureAbstract({ body: `It says: ${SENTINEL}` }) }));
  assert.ok(problems.some((p) => /repeats the sentinel|shares a 10-word run/.test(p)), problems.join('\n'));
});

test('a brief under 2,500 words fails', () => {
  const problems = checkBrief(facts({ make: { paragraphs: 5 } }));
  assert.ok(problems.some((p) => /the brief has \d+ words; it must have 2500 to 4000/.test(p)), problems.join('\n'));
});

test('a brief over 4,000 words fails', () => {
  const problems = checkBrief(facts({ make: { paragraphs: 90 } }));
  assert.ok(problems.some((p) => /the brief has \d+ words; it must have 2500 to 4000/.test(p)), problems.join('\n'));
});

test('an audience outside the enum fails, in the brief and in the abstract', () => {
  const problems = checkBrief(facts({ make: { audience: 'unicorn' }, abstract: fixtureAbstract({ audience: 'unicorn' }) }));
  assert.ok(problems.some((p) => /audience "unicorn" is not one of/.test(p)), problems.join('\n'));
  assert.ok(problems.some((p) => /the abstract audience "unicorn" is not one of/.test(p)), problems.join('\n'));
});

test('an audience that differs from the registry fails even when it is in the enum', () => {
  const problems = checkBrief(facts({ make: { audience: 'investor' } }));
  assert.ok(problems.some((p) => /differs from the registry/.test(p)), problems.join('\n'));
});

test('a brief without its two required sections fails', () => {
  assert.ok(checkBrief(facts({ make: { skipSection: 'About the evidence' } })).some((p) => /no "## About the evidence" section/.test(p)));
  assert.ok(checkBrief(facts({ make: { skipSection: 'What this brief cannot tell you' } })).some((p) => /no "## What this brief cannot tell you" section/.test(p)));
});

test('a brief with an image fails', () => {
  assert.ok(checkBrief(facts({ make: { image: true } })).some((p) => /carries an image/.test(p)));
});

test('a brief with fewer than six distinct sources fails, and so does a source with no fetch record', () => {
  assert.ok(checkBrief({ ...facts({ make: { sources: 5 } }), fetches: fetchesFor(5) }).some((p) => /5 distinct sources; at least 6/.test(p)));
  assert.ok(checkBrief({ ...facts(), fetches: fetchesFor(5) }).some((p) => /has no fetch record/.test(p)));
});

test('a source accessed on a day it was not fetched fails', () => {
  const late = fetchesFor(6).map((f) => ({ ...f, fetchedAt: '2026-10-11T08:00:00Z' }));
  assert.ok(checkBrief({ ...facts(), fetches: late }).some((p) => /the ledger says 2026-10-11/.test(p)));
});

test('a brief whose sentinel is missing from the body fails', () => {
  assert.ok(checkBrief(facts({ make: { sentinel: false } })).some((p) => /the sentinel does not appear verbatim/.test(p)));
});

test('a claim whose sentence is not in the brief fails', () => {
  const claim: ClaimRecord = { id: 'X-1', sentence: 'A sentence that the brief never says.', kind: 'paraphrase', sourceId: 's1', locator: 'nowhere' };
  assert.ok(checkBrief({ ...facts(), claims: [claim] }).some((p) => /claim X-1 names a sentence that is not in the brief/.test(p)));
});

test('an abstract whose outline names a section the brief lacks fails', () => {
  const problems = checkBrief(facts({ abstract: fixtureAbstract({ outline: ['The question this brief answers', 'A section that does not exist'] }) }));
  assert.ok(problems.some((p) => /outline title "A section that does not exist"/.test(p)), problems.join('\n'));
});

test('a brief with no abstract fails', () => {
  assert.ok(checkBrief({ ...facts(), abstractText: undefined }).some((p) => /no open abstract/.test(p)));
});

test('a brief of another package is checked against its owner ledger, never against wp-63.json', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wp63-ledgers-'));
  try {
    const own: SourcesFile = { wp: 'WP-99', fetches: fetchesFor(6) };
    writeFileSync(join(dir, 'wp-99.json'), JSON.stringify(own));
    // The owner's ledger knows the six fixture sources, so the fixture brief passes against it.
    assert.deepEqual(checkBrief({ ...facts(), fetches: ledgerFor('WP-99', dir).fetches }), []);
    // The ledger of WP-63 does not know them, so the same brief fails there: fetch records are not borrowed across packages.
    assert.ok(checkBrief({ ...facts(), fetches: ledgerFor('WP-63').fetches }).some((p) => /has no fetch record/.test(p)));
    // A package with no ledger gets an empty one, and the brief fails for that reason.
    const none = ledgerFor('WP-98', dir);
    assert.deepEqual(none.fetches, []);
    assert.ok(checkBrief({ ...facts(), fetches: none.fetches }).some((p) => /has no fetch record/.test(p)));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
