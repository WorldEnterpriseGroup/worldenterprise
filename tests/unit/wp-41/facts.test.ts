import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import test from 'node:test';
import { parse } from 'yaml';
import { INTRODUCTIONS_DISCLAIMER, INTRODUCTIONS_FLAT_FEE } from '../../../src/components/blocks/introductions.ts';
import { CITATION_AUTHOR, citationText } from '../../../src/components/geo/cite.ts';
import { qaFromMarkdown } from '../../../src/components/geo/qa.ts';
import { read } from './content.ts';

interface SentenceRow {
  readonly sentence: string;
  readonly source_id: string;
  readonly file: string;
  readonly locator: string;
  readonly derivation: string;
}
interface SourcesFile {
  readonly wp: string;
  readonly sources: readonly { readonly source_id: string; readonly captured_by: string; readonly funding_conflicts: string }[];
  readonly sentences: readonly SentenceRow[];
}

const raw = read('src/content/pages/about/facts.mdx');
const frontmatter = parse(/^---\n([\s\S]*?)\n---/.exec(raw)?.[1] ?? '') as Record<string, unknown>;
const body = raw.replace(/^---\n[\s\S]*?\n---\n/, '');
// WP-55 (wave 9) owns the page copy since the package wording was retired, so the sentence map lives in its sources file.
const map = JSON.parse(read('.astro-magazine/sources/wp-55.json')) as SourcesFile;
const squash = (text: string): string => text.replace(/\s+/g, ' ').replace(/’/g, "'").trim();

/** The sentences of the body: one per line item or sentence, headings and the one-word "No." excluded. */
function sentencesOf(markdown: string): string[] {
  const out: string[] = [];
  for (const line of markdown.split('\n')) {
    const text = line.trim().replace(/^[-*]\s+/, '');
    if (text === '' || text.startsWith('## ')) continue;
    for (const part of text.split(/(?<=[.!?])\s+(?=[A-Z])/)) if (part.trim().split(/\s+/).length >= 2) out.push(part.trim());
  }
  return out;
}

test('the facts page frontmatter fits the layout limits and cites usable claims', () => {
  assert.equal(frontmatter['title'], 'Facts about WE');
  assert.ok(`${String(frontmatter['title'])} | World Enterprise Incubator`.length <= 60);
  const description = String(frontmatter['description']);
  assert.ok(description.length >= 50 && description.length <= 160, `description is ${description.length} characters`);
  assert.equal(new Date(String(frontmatter['updated'])).getTime() <= Date.now(), true, 'the date is not in the future');
});

test('every sentence of the facts page is mapped in sources/wp-55.json to a file that holds its locator', () => {
  assert.equal(map.wp, 'WP-55');
  const sourceIds = new Set(map.sources.map((s) => s.source_id));
  for (const source of map.sources) {
    assert.equal(source.captured_by, 'WP-55');
    assert.equal(source.funding_conflicts, 'none');
  }
  const mapped = new Map(map.sentences.map((row) => [squash(row.sentence), row] as const));
  for (const sentence of sentencesOf(body)) {
    const row = mapped.get(squash(sentence));
    assert.ok(row !== undefined, `not mapped: ${sentence}`);
    assert.ok(sourceIds.has(row.source_id), `${row.source_id} is not a source`);
    assert.ok(squash(read(row.file)).includes(squash(row.locator)), `${row.file} does not contain the locator "${row.locator}"`);
    if (row.derivation === 'verbatim') assert.equal(squash(row.locator), squash(sentence), 'a verbatim sentence is its own locator');
  }
  const present = new Set(sentencesOf(body).map(squash));
  for (const row of map.sentences) assert.ok(present.has(squash(row.sentence)), `mapped but not on the page: ${row.sentence}`);
});

test('the page names no package and no seat plan: the packages are retired site-wide (wave 9)', () => {
  assert.doesNotMatch(body, /\b(?:Spark|Accelerate|Studio)\b|\bLaunch, depth\b|\bpackages?\b|\bseat plan\b/i);
});

test('the seven service lines on the page are the service entries', () => {
  const dir = new URL('../../../src/content/services/', import.meta.url);
  const entries = readdirSync(dir)
    .filter((name) => name.endsWith('.mdx'))
    .map((name) => parse(/^---\n([\s\S]*?)\n---/.exec(read(`src/content/services/${name}`))?.[1] ?? '') as { line: string; title: string; doesNotCover: string[] })
    .sort((a, b) => a.line.localeCompare(b.line));
  assert.equal(entries.length, 7);
  const bullets = body.split('\n').filter((line) => /^- Line [A-G]: /.test(line));
  assert.deepEqual(bullets, entries.map((e) => `- Line ${e.line}: ${e.title}`));
  for (const entry of entries) assert.ok(entry.doesNotCover.length > 0, `${entry.title} states what it does not cover`);
});

test('the page says no funding is promised and carries the add-on disclaimer and flat-fee sentence verbatim', () => {
  const text = squash(body);
  assert.ok(text.includes('WE makes no promise of funding.'));
  assert.ok(text.includes(squash(INTRODUCTIONS_DISCLAIMER)));
  assert.ok(text.includes(squash(INTRODUCTIONS_FLAT_FEE)));
});

test('the page keeps the truth policy: no amount, no seat count, no cohort or peer wording, no fee denial', () => {
  assert.doesNotMatch(body, /[$€£]|\bUSD\b|\bper (?:month|seat)\b/i);
  assert.doesNotMatch(body, /\b(?:\d+|two|three|four|five|six|seven|eight|nine|ten)\s+(?:dedicated\s+)?seats?\b/i);
  assert.doesNotMatch(body, /\b(?:cohort|accelerator|mentor|alumni|peer sessions?)\b/i);
  // The verbatim add-on disclaimer says "takes no fee or stake tied to any investment"; that is its approved wording, not a denial.
  const withoutDisclaimer = squash(body).replace(squash(INTRODUCTIONS_DISCLAIMER), '');
  assert.doesNotMatch(withoutDisclaimer, /\bno fees?\b|\bno equity\b|\bequity-free\b|\bfree of charge\b|\bno stake\b/i);
  assert.doesNotMatch(body, /\bwithin \d|\b\d+\s*(?:hours?|business days?)\b/i);
  assert.doesNotMatch(body, /\]\(/, 'no Markdown link: internal links go through href() in the page file');
});

test('the questions are H2 headings and each has an answer', () => {
  const pairs = qaFromMarkdown(body);
  assert.deepEqual(
    pairs.map((p) => p.question),
    ['What is World Enterprise Incubator?', 'What is WE not?', 'What does WE offer?', 'How does an engagement work?', 'Is Investor Introductions part of the engagement?', 'How do I reach WE?'],
  );
  for (const pair of pairs) assert.ok(pair.answer.length > 20, pair.question);
});

test('qaFromMarkdown strips syntax, ignores fenced code and text before the first heading', () => {
  const pairs = qaFromMarkdown('Intro text.\n\n## One?\n\nA **bold** [link](/x/) answer.\n\n- item one\n- item two\n\n```\n## not a heading\n```\n\n## Two?\n\nSecond.\n');
  assert.equal(pairs.length, 2);
  assert.equal(pairs[0]?.answer.startsWith('A bold link answer. item one item two'), true);
  assert.ok(pairs[0]?.answer.includes('## not a heading'));
  assert.equal(pairs[1]?.answer, 'Second.');
  assert.deepEqual(qaFromMarkdown('## Empty?\n\n## Next?\n\nAnswer.'), [{ question: 'Next?', answer: 'Answer.' }]);
});

test('the suggested citation names the editorial author, the title, the updated date and the production URL', () => {
  const text = citationText({ title: 'A title.', path: '/insights/x/', date: new Date('2026-10-09T00:00:00Z') });
  assert.equal(text, 'World Enterprise Editorial. “A title.” World Enterprise Incubator, updated October 9, 2026. https://worldenterprise.org/insights/x/');
  assert.equal(CITATION_AUTHOR, 'World Enterprise Editorial');
  assert.equal(citationText({ title: 'T', path: '/p/' }), 'World Enterprise Editorial. “T.” World Enterprise Incubator. https://worldenterprise.org/p/');
  assert.equal(citationText({ title: 'T', path: '/p/', date: new Date('nope') }), 'World Enterprise Editorial. “T.” World Enterprise Incubator. https://worldenterprise.org/p/');
});

test('CiteThis reuses the we-copy island and adds no script or third-party request', () => {
  const block = read('src/components/geo/CiteThis.astro');
  assert.match(block, /<we-copy target=\{`#\$\{textId\}`\} label="Copy citation">/);
  assert.match(block, /import '\.\.\/\.\.\/scripts\/copy\.ts';/);
  assert.doesNotMatch(block, /https?:\/\/(?!worldenterprise)/);
  assert.doesNotMatch(block, /fetch\(|XMLHttpRequest|localStorage|document\.cookie/);
});

test('the four layouts show the citation block', () => {
  for (const layout of ['ArticleLayout', 'BriefLayout', 'PlaybookLayout', 'GuideLayout']) {
    const source = read(`src/layouts/${layout}.astro`);
    assert.match(source, /import CiteThis from '\.\.\/components\/geo\/CiteThis\.astro';/, layout);
    assert.match(source, /<CiteThis\b/, layout);
  }
  assert.match(read('src/layouts/BriefLayout.astro'), /citation: briefCitations\(sources\)/);
});
