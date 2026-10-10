import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { routes } from '../../../src/data/routes.ts';
import { listCollectionFiles, listInsightFiles } from '../../../src/lib/content-files.ts';
import { checkArticle, internalLinks, LIMITS_HEADING, MAX_WORDS, MIN_WORDS } from './rubric.ts';
import type { DenyRule, RubricContext } from './rubric.ts';

/**
 * Every file in src/content/insights/** meets the article rules of docs/wave8-contracts.md, section 2. The rule list is in rubric.ts and is
 * proven here to fail on a fabricated article, one mutation per rule, so a rule cannot lapse into passing everything.
 */
const root = new URL('../../../', import.meta.url).pathname;

function loadDenylist(): readonly DenyRule[] {
  try {
    return (JSON.parse(readFileSync(join(root, 'claims-denylist.json'), 'utf8')) as { rules: DenyRule[] }).rules;
  } catch (error) {
    throw new Error(`Could not read claims-denylist.json: ${(error as Error).message}`);
  }
}

const slugs = (collection: string): Set<string> => new Set(listCollectionFiles(root, collection).map((f) => f.replace(/\.mdx?$/, '')));

const ctx: RubricContext = {
  ledgerPaths: new Set(routes.map((r) => r.path)),
  playbookSlugs: slugs('playbooks'),
  templateSlugs: slugs('library'),
  denylist: loadDenylist(),
};

/**
 * The 18 articles that existed before wave 8, pinned byte for byte, were written to the wave 6 rules: they carry related-rail links in the
 * layout rather than links in the body, the Grow and Fundable ones have no "cannot tell you" section, and five of them count between 1,050
 * and 1,200 words by `countWords` (they were measured by a plain whitespace split, which counts table rules and dashes as words). Those
 * three rules are waived for exactly these files and for nothing else; every other rule applies to them. A new article gets no waiver.
 */
const ORIGINALS = new Set(Object.keys(JSON.parse(readFileSync(new URL('fixtures/existing-articles.json', import.meta.url), 'utf8')) as Record<string, string>));
const WAIVED_FOR_ORIGINALS: readonly string[] = ['cannot-tell-you', 'internal-links', 'words'];

const files = listInsightFiles(root);

test('the repository holds articles, so the rubric cannot pass over an empty list', () => {
  assert.ok(files.length >= 18);
});

for (const f of files) {
  test(`${f.file} meets the article rubric`, () => {
    const waived = ORIGINALS.has(f.file) ? WAIVED_FOR_ORIGINALS : [];
    const problems = checkArticle(f.file, readFileSync(join(root, f.file), 'utf8'), ctx).filter((p) => !waived.includes(p.rule));
    assert.deepEqual(problems.map((p) => `${p.rule}: ${p.message}`), []);
  });
}

test('no article but an original is waived: a waiver is not a way for a new article to skip a rule', () => {
  for (const path of ORIGINALS) assert.ok(files.some((f) => f.file === path), `${path} is pinned but missing`);
  assert.equal(ORIGINALS.size, 18);
});

test('slugs are unique across every desk', () => {
  const seen = files.map((f) => f.slug);
  assert.deepEqual(seen.filter((s, i) => seen.indexOf(s) !== i), []);
});

// ---------------------------------------------------------------------------------------------------------------------------------
// The rubric has teeth
// ---------------------------------------------------------------------------------------------------------------------------------

const PATH = 'src/content/insights/funding/a-fabricated-article.mdx';
const sentence = 'A founder weighs the instrument, writes down the question and asks counsel what the document does. ';

function body(options: { readonly words?: number; readonly links?: readonly string[]; readonly limits?: boolean; readonly extra?: string } = {}): string {
  const links = options.links ?? ['/playbooks/validate-the-problem/', '/library/one-page-problem-brief/', '/glossary/'];
  const filler = sentence.repeat(Math.ceil(((options.words ?? 1300) - 40) / 17));
  return [
    filler,
    ...links.map((l) => `See [a linked page](${l}) for more.`),
    options.limits === false ? '' : `## ${LIMITS_HEADING}\n\nThe sources cover one jurisdiction and one date.`,
    options.extra ?? '',
  ].join('\n\n');
}

const FRONT = [
  'title: A fabricated article',
  'description: "How a founder reads a financing document and what to ask counsel about it before signing anything at all."',
  'topic: funding',
  'publishedDate: 2026-10-12',
  'sources:',
  '  - { id: a, title: A, publisher: P, url: "https://example.gov/a", accessed: 2026-10-12 }',
  '  - { id: b, title: B, publisher: P, url: "https://example.gov/b", accessed: 2026-10-12 }',
  'evidence: [a, b]',
  'relatedServices: [F]',
  'relatedPlaybook: validate-the-problem',
  'relatedTemplate: one-page-problem-brief',
];

const doc = (front: readonly string[] = FRONT, text: string = body()): string => `---\n${front.join('\n')}\n---\n\n${text}\n`;
const rules = (raw: string, path: string = PATH): string[] => checkArticle(path, raw, ctx).map((p) => p.rule);
const without = (key: string): string[] => FRONT.filter((line) => !line.startsWith(`${key}:`));
const withLine = (line: string): string[] => [...FRONT, line];

test('a well-formed article passes', () => {
  assert.deepEqual(checkArticle(PATH, doc(), ctx), []);
});

test('the fabricated body sits inside the word window, so the word mutations below are the only cause', () => {
  const parts = checkArticle(PATH, doc(), ctx);
  assert.ok(!parts.some((p) => p.rule === 'words'));
  assert.ok(MIN_WORDS < MAX_WORDS);
});

test('a short or a long body fails the word window', () => {
  assert.ok(rules(doc(FRONT, body({ words: 800 }))).includes('words'));
  assert.ok(rules(doc(FRONT, body({ words: 2200 }))).includes('words'));
});

test('a missing limits section fails', () => {
  assert.ok(rules(doc(FRONT, body({ limits: false }))).includes('cannot-tell-you'));
});

test('fewer than three internal links to ledger routes fail, and a link to a route not in the ledger does not count', () => {
  assert.ok(rules(doc(FRONT, body({ links: ['/glossary/', '/faq/'] }))).includes('internal-links'));
  assert.ok(rules(doc(FRONT, body({ links: ['/glossary/', '/faq/', '/no-such-page/'] }))).includes('internal-links'));
  assert.ok(!rules(doc(FRONT, body({ links: ['/glossary/', '/faq/', '/pricing/'] }))).includes('internal-links'));
});

test('internalLinks reads Markdown and href links, drops the fragment and query and adds the slash', () => {
  assert.deepEqual(internalLinks('[a](/faq/#x) <a href="/glossary?q=1">b</a> [c](https://example.com/)'), ['/faq/', '/glossary/']);
});

test('the desk folder must equal the topic', () => {
  assert.ok(rules(doc(), 'src/content/insights/legal/a-fabricated-article.mdx').includes('desk-folder'));
  assert.ok(rules(doc(), 'src/content/insights/a-fabricated-article.mdx').includes('path'));
});

test('a cover, a draft flag and a one-source article fail', () => {
  assert.ok(rules(doc(withLine('cover: hero.avif'))).includes('cover'));
  assert.ok(rules(doc(withLine('draft: true'))).includes('draft'));
  const oneSource = FRONT.filter((l) => !l.includes('"https://example.gov/b"') && !l.startsWith('evidence:'));
  assert.ok(rules(doc(oneSource)).includes('sources'));
  assert.ok(!rules(doc([...oneSource, 'noStatistics: true'])).includes('sources'));
});

test('an unknown desk, key, playbook or template fails', () => {
  assert.ok(rules(doc(FRONT.map((l) => (l === 'topic: funding' ? 'topic: finance' : l)))).includes('schema'));
  assert.ok(rules(doc(withLine('mood: upbeat'))).includes('schema'));
  assert.ok(rules(doc(FRONT.map((l) => (l.startsWith('relatedPlaybook') ? 'relatedPlaybook: nope' : l)))).includes('related'));
  assert.ok(rules(doc(FRONT.map((l) => (l.startsWith('relatedTemplate') ? 'relatedTemplate: nope' : l)))).includes('related'));
  assert.ok(rules(doc(without('relatedServices'))).includes('related'));
});

test('evidence must name a listed source and a source needs an https URL', () => {
  assert.ok(rules(doc(FRONT.map((l) => (l.startsWith('evidence') ? 'evidence: [a, zzz]' : l)))).includes('sources'));
  assert.ok(rules(doc(FRONT.map((l) => l.replace('https://example.gov/b', 'http://example.gov/b')))).includes('sources'));
});

test('a claim the denylist blocks fails, and so do emoji, an exclamation mark and advice on a legal or funding desk', () => {
  assert.ok(rules(doc(FRONT, body({ extra: 'WE guarantees funding for every founder.' }))).includes('denylist'));
  assert.ok(rules(doc(FRONT, body({ extra: 'A pleasant note \u{1F680}.' }))).includes('style'));
  assert.ok(rules(doc(FRONT, body({ extra: 'This is great! Read on.' }))).includes('style'));
  assert.ok(rules(doc(FRONT, body({ extra: 'You should sign the note before the round closes.' }))).includes('advice'));
  const dream = FRONT.map((l) => (l === 'topic: funding' ? 'topic: dream' : l));
  assert.ok(!rules(doc(dream, body({ extra: 'You should sign up for the interview slot.' })), 'src/content/insights/dream/a-fabricated-article.mdx').includes('advice'));
});

test('a file with no frontmatter or broken YAML fails', () => {
  assert.ok(rules('just text').includes('frontmatter'));
  assert.ok(rules('---\ntitle: [unclosed\n---\ntext').includes('frontmatter'));
});
