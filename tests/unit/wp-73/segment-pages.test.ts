import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';
import * as claimsAudit from '../../../scripts/audit-claims.mjs';
import { BRIEF_IDS, SEGMENTS } from '../../../src/data/families.ts';
import { pagesSchema } from '../../../src/lib/content-schemas.ts';
import { repoViewAt } from '../wp-60/repo-view.ts';
import { checkSentences } from '../wp-60/sources.ts';
import type { SentenceRecord, SourcesFile } from '../wp-60/sources.ts';

/**
 * WP-73: the eight founder segment pages (docs/wave8-contracts.md, sections 0, 8.2 and 8.3). The pages are short, so the rules are
 * tested over every sentence they carry: each sentence maps to exactly one claim, existing page or decision, the claims denylist
 * finds nothing, and the copy states no number, no duration, no requirement for applying beyond `/program/who-its-for/` and no discount
 * or preference for a segment (OP-SEGMENTS).
 */
interface Hit {
  readonly rule: string;
  readonly match: string;
}
const audit = claimsAudit as unknown as { scan(text: string, options?: { route?: string; plain?: boolean; flagValues?: object }): Hit[] };

const root = new URL('../../../', import.meta.url).pathname;
const repo = repoViewAt(root);
const ledger = JSON.parse(readFileSync(join(root, '.astro-magazine/sources/wp-73.json'), 'utf8')) as SourcesFile;

const WHO_ITS_FOR = 'src/pages/program/who-its-for.astro';
const WHO_LINK = '<MaybeLink path="/program/who-its-for/">';
/** The research brief the non-technical page cites (it is not an article, so it carries no `segments` field). */
const TEAM_BRIEF = 'src/content/research/dedicated-team-agency-or-freelancers.md';

/** A string split into its sentences, so the ledger maps sentences and not paragraphs. */
const sentencesOf = (text: string): string[] => text.split(/(?<=[.!?])\s+(?=[A-Z])/).map((s) => s.trim()).filter((s) => s !== '');

interface Challenge {
  readonly title: string;
  readonly text: string;
}
interface Page {
  readonly slug: string;
  readonly path: string;
  readonly raw: string;
  readonly data: {
    readonly title: string;
    readonly description: string;
    readonly cta?: { readonly variant: string; readonly briefId?: string };
    readonly claimsUsed?: readonly string[];
    readonly family: { readonly id: string; readonly slug: string; readonly whoFor: string; readonly challenges: readonly Challenge[]; readonly sources?: readonly unknown[] };
  };
  /** The MDX body without the import line, with each `<MaybeLink>` reduced to its text. */
  readonly body: string;
}

function readPage(slug: string): Page {
  const path = `src/content/pages/founders/${slug}.mdx`;
  const raw = readFileSync(join(root, path), 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw);
  assert.ok(match?.[1] !== undefined && match[2] !== undefined, `${path} has a frontmatter block`);
  const body = match[2]
    .split('\n')
    .filter((line) => !line.startsWith('import '))
    .join('\n')
    .replace(/<MaybeLink path="[^"]*">([^<]*)<\/MaybeLink>/g, '$1')
    .trim();
  return { slug, path, raw, data: parse(match[1]) as Page['data'], body };
}

const pages = SEGMENTS.entries.map((entry) => readPage(entry.slug));

/** Every sentence a page carries, as the ledger lists them: the title as a label, then the sentences of each field. */
function copyOf(page: Page): { labels: string[]; sentences: string[] } {
  const labels = [page.data.title, ...page.data.family.challenges.map((c) => c.title)];
  const sentences = [
    ...sentencesOf(page.data.description),
    ...sentencesOf(page.data.family.whoFor),
    ...page.data.family.challenges.flatMap((c) => sentencesOf(c.text)),
    ...page.body.split(/\n\s*\n/).flatMap((paragraph) => sentencesOf(paragraph.replace(/\s+/g, ' '))),
  ];
  return { labels, sentences };
}

const documentFor = (path: string): readonly SentenceRecord[] => ledger.documents?.find((d) => d.path === path)?.sentences ?? [];

test('there is one page per registry segment, in the segments folder, and no other file there', () => {
  assert.equal(pages.length, 8);
  for (const entry of SEGMENTS.entries) {
    assert.equal(entry.path, `/founders/${entry.slug}/`);
    assert.ok(existsSync(join(root, `src/content/pages/founders/${entry.slug}.mdx`)), `${entry.slug}.mdx exists`);
  }
});

test('every page parses under the pages schema and its family names its own slug', () => {
  for (const page of pages) {
    const parsed = pagesSchema.safeParse(page.data);
    assert.ok(parsed.success, `${page.path}: ${parsed.success ? '' : parsed.error.message}`);
    assert.equal(page.data.family.id, 'segments');
    assert.equal(page.data.family.slug, page.slug);
  }
});

test('whoFor is the reader\'s situation and every page has three to five challenges', () => {
  for (const page of pages) {
    const { whoFor, challenges } = page.data.family;
    assert.ok(whoFor.length >= 80 && whoFor.length <= 400, `${page.slug}: whoFor is ${whoFor.length} characters`);
    assert.ok(challenges.length >= 3 && challenges.length <= 5, `${page.slug}: ${challenges.length} challenges`);
    assert.equal(new Set(challenges.map((c) => c.title)).size, challenges.length, `${page.slug}: challenge titles are distinct`);
  }
});

test('each page has its own title, description and secondary action, and the secondary action is a brief of the registry', () => {
  assert.equal(new Set(pages.map((p) => p.data.title)).size, pages.length, 'titles are distinct');
  assert.equal(new Set(pages.map((p) => p.data.description)).size, pages.length, 'descriptions are distinct');
  for (const page of pages) {
    assert.equal(page.data.cta?.variant, 'brief', `${page.slug}: the secondary action is a brief`);
    assert.ok(BRIEF_IDS.includes(page.data.cta?.briefId ?? ''), `${page.slug}: briefId is in the registry`);
  }
  // Contracts 6.2: the corporate page points at its own brief.
  assert.equal(pages.find((p) => p.slug === 'corporate-innovators')?.data.cta?.briefId, 'corporate-spinouts');
});

test('the sources file lists exactly the eight pages and quotes no outside source', () => {
  assert.equal(ledger.wp, 'WP-73');
  assert.deepEqual(ledger.fetches, []);
  assert.deepEqual((ledger.documents ?? []).map((d) => d.path).sort(), pages.map((p) => p.path).sort());
});

test('every sentence a page carries is mapped (an unmapped sentence fails here)', () => {
  for (const page of pages) {
    const mapped = new Set(documentFor(page.path).map((s) => s.text));
    const { labels, sentences } = copyOf(page);
    const missing = [...labels, ...sentences].filter((text) => !mapped.has(text));
    assert.deepEqual(missing, [], `Unmapped in ${page.path}. Add each to .astro-magazine/sources/wp-73.json:\n${missing.map((m) => `  ${JSON.stringify(m)}`).join('\n')}`);
  }
});

test('no mapping is stale: every mapped sentence is still on its page', () => {
  for (const page of pages) {
    const { labels, sentences } = copyOf(page);
    const live = new Set([...labels, ...sentences]);
    assert.deepEqual(documentFor(page.path).map((s) => s.text).filter((text) => !live.has(text)), [], `Stale in ${page.path}`);
  }
});

test('every mapping is well formed: one claim, page, decision or label, and an existing page', () => {
  for (const doc of ledger.documents ?? []) assert.deepEqual(checkSentences('WP-73', doc.path, doc.sentences ?? [], repo), []);
});

test('a label is a title and nothing else', () => {
  for (const page of pages) {
    const { labels } = copyOf(page);
    const asLabel = documentFor(page.path).filter((s) => s.label === true).map((s) => s.text);
    assert.deepEqual([...asLabel].sort(), [...labels].sort(), `${page.slug}: the labels are the page title and the challenge titles`);
  }
});

test('no sentence trips the claims denylist', () => {
  for (const page of pages) {
    const { labels, sentences } = copyOf(page);
    for (const text of [...labels, ...sentences, page.data.family.whoFor]) {
      const hits = audit.scan(text, { route: `/founders/${page.slug}/`, plain: true, flagValues: {} });
      assert.deepEqual(hits.map((h) => `${h.rule}: ${h.match}`), [], `${page.path}: "${text}"`);
    }
  }
});

test('a challenge is taken from an article that names the segment, or from the cited research brief', () => {
  for (const page of pages) {
    const mappings = documentFor(page.path).filter((s) => page.data.family.challenges.some((c) => c.text === s.text));
    assert.equal(mappings.length, page.data.family.challenges.length, `${page.slug}: each challenge text is one sentence with one mapping`);
    for (const mapping of mappings) {
      const target = (mapping.page ?? '').split('#')[0] ?? '';
      if (target === TEAM_BRIEF) {
        assert.equal(page.slug, 'non-technical-founders', 'only the non-technical page cites the research brief');
        continue;
      }
      assert.ok(target.startsWith('src/content/insights/'), `${page.slug}: "${mapping.text}" maps to an article, not to ${target}`);
      const article = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(join(root, target), 'utf8'))?.[1] ?? '';
      const segments = (parse(article) as { segments?: string[] }).segments ?? [];
      assert.ok(segments.includes(page.slug), `${page.slug}: ${target} does not list the segment in its segments field`);
    }
  }
});

test('the copy states no number, price, duration or outcome', () => {
  for (const page of pages) {
    const { labels, sentences } = copyOf(page);
    for (const text of [...labels, ...sentences, page.data.family.whoFor]) {
      assert.doesNotMatch(text, /\d/, `${page.slug}: a digit in "${text}"`);
      assert.doesNotMatch(text, /[$€£%]/, `${page.slug}: a currency or percent sign in "${text}"`);
      assert.doesNotMatch(text, /\b(days?|weeks?|months?|years?|quarters?|monthly|weekly|daily|annual\w*|overnight|instantly)\b/i, `${page.slug}: a duration in "${text}"`);
      assert.doesNotMatch(text, /\b(guarantee\w*|results?|outcomes?|acceptance|accepted|admitted|applicants?|applications|placement|placed)\b/i, `${page.slug}: an outcome word in "${text}"`);
    }
  }
});

test('the copy never uses the words the truth policy keeps off pages about WE', () => {
  for (const page of pages) {
    const { labels, sentences } = copyOf(page);
    for (const text of [...labels, ...sentences]) {
      assert.doesNotMatch(text, /\b(cohorts?|mentors?|accelerators?|perks?|alumni|peers?|free|portfolio|our)\b/i, `${page.slug}: "${text}"`);
      assert.doesNotMatch(text, /\b(programme|organisation|behaviour|colour)\b/i, `${page.slug}: British spelling in "${text}"`);
      assert.doesNotMatch(text, /!/, `${page.slug}: an exclamation mark in "${text}"`);
    }
  }
});

test('no page names a requirement for applying, a discount or a preference for a segment (OP-SEGMENTS)', () => {
  const banned =
    /\b(eligible|eligibility|qualif\w*|requirements?|required|requires?|must|only if|priority|prioriti\w*|prefer\w*|discount\w*|reserved|waive\w*|reduced|admit\w*|admission|selected|selects?|exclusive|welcome\w*|encourage\w*|ideal|best suited|designed for|open to)\b/i;
  for (const page of pages) {
    const { labels, sentences } = copyOf(page);
    for (const text of [...labels, ...sentences, page.data.family.whoFor]) {
      assert.doesNotMatch(text, banned, `${page.slug}: "${text}"`);
    }
  }
});

test('the only statement about WE is a claim of the registry, and the only statement about fit is the pointer to /program/who-its-for/', () => {
  const allowedClaims = new Set(['C-01', 'C-02', 'C-03', 'C-05', 'C-29']);
  for (const page of pages) {
    const entries = documentFor(page.path);
    for (const entry of entries) {
      if (/\bWE\b/.test(entry.text)) {
        assert.ok(entry.claim !== undefined && allowedClaims.has(entry.claim), `${page.slug}: "${entry.text}" is about WE and maps to ${entry.claim ?? 'no claim'}`);
      }
      if (entry.label !== true && /\bgood fit\b/i.test(entry.text)) {
        assert.equal(entry.page, WHO_ITS_FOR, `${page.slug}: "${entry.text}" talks about fit and must restate /program/who-its-for/ only by pointing to it`);
        assert.match(entry.text, /^If [^,]+, the program's own description of a good fit is on the page about who the program is for\.$/, `${page.slug}: the pointer keeps its fixed form`);
      }
    }
    assert.ok(page.raw.includes(WHO_LINK), `${page.slug}: the body links /program/who-its-for/ through MaybeLink`);
  }
});

test('the claims a page cites in its frontmatter are the claims its sentences map to', () => {
  for (const page of pages) {
    const mapped = [...new Set(documentFor(page.path).flatMap((s) => (s.claim === undefined ? [] : [s.claim])))].sort();
    assert.deepEqual([...(page.data.claimsUsed ?? [])].sort(), mapped, `${page.slug}: claimsUsed`);
  }
});

test('the pages that touch OP-SEGMENTS add a way to ask, and no page makes a promise about applying', () => {
  for (const slug of ['corporate-innovators', 'student-founders', 'global-remote-founders']) {
    const page = pages.find((p) => p.slug === slug);
    assert.ok(page?.raw.includes('<MaybeLink path="/contact/">contact page</MaybeLink>'), `${slug}: points to the contact page for a question the program page does not answer`);
  }
  for (const page of pages) {
    assert.doesNotMatch(page.body, /\b(will|guarantee\w*)\b/i, `${page.slug}: a promise in the body`);
    assert.doesNotMatch(page.body.replace('WE makes no promise of funding.', ''), /\bpromise\w*\b/i, `${page.slug}: only the funding disclaimer may use the word promise`);
  }
});

test('the frontmatter names no sources and no photography, and every page is published', () => {
  for (const page of pages) {
    assert.ok((page.data.family.sources ?? []).length === 0, `${page.slug}: sources belong to an outside fact, and these pages state none`);
    assert.doesNotMatch(page.raw, /\.(avif|png|jpe?g|webp)\b/i, `${page.slug}: no image`);
    assert.doesNotMatch(page.raw, /^draft:\s*true/m, `${page.slug}: not a draft`);
  }
});
