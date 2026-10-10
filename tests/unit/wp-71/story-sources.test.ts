import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import * as claimsAudit from '../../../scripts/audit-claims.mjs';
import { claimRegistry } from '../../../src/data/claims.ts';
import type { ClaimId } from '../../../src/data/claims.ts';
import { interfaceStrings, mdx, sentencesOf, surfaces } from './story-sentences.ts';

// WP-71: /about/brand-story/ and the brand kit restate what the site already says. .astro-magazine/sources/wp-71.json maps every string to an
// existing page and line, a token line or a claim id. This test fails on a string with no mapping, on a mapping with no string, on a quote
// that is no longer in its file, and on any string the claims denylist or the wave 7 truth policy rejects.

interface QuoteSource {
  file: string;
  line: number;
  quote: string;
}
interface ClaimSource {
  claims: string[];
}
interface Entry {
  text: string;
  ui_label?: boolean;
  page_frame?: boolean;
  paraphrase?: boolean;
  note?: string;
  sources?: (QuoteSource | ClaimSource)[];
}
interface SourcesFile {
  package: string;
  sources: Record<string, unknown>[];
  sentences: Entry[];
}
interface Hit {
  rule: string;
  match: string;
}
const audit = claimsAudit as unknown as { scan(text: string, options?: { route?: string; plain?: boolean; flagValues?: object }): Hit[] };

/** The most page_frame and paraphrase entries the file may carry; a new one is a decision, not a default. */
const MAX_FRAMES = 14;
const MAX_PARAPHRASES = 10;

const root = new URL('../../../', import.meta.url);
const sources = JSON.parse(readFileSync(new URL('.astro-magazine/sources/wp-71.json', root), 'utf8')) as SourcesFile;
const collected = surfaces().flatMap((surface) => surface.strings.map((text) => ({ where: surface.where, text })));
const texts = [...new Set(collected.map((c) => c.text))];
const isQuote = (source: QuoteSource | ClaimSource): source is QuoteSource => 'quote' in source;
const squash = (value: string): string => value.replace(/\s+/g, ' ');
const entryFor = (text: string): Entry | undefined => sources.sentences.find((s) => s.text === text);

test('the sources file is WP-71 and carries complete source records', () => {
  assert.equal(sources.package, 'WP-71');
  assert.ok(sources.sources.length >= 1);
  const required = ['schema_version', 'source_id', 'publisher_or_author', 'title', 'source_tier', 'exact_url_or_locator', 'retrieved_at', 'claims_supported', 'claims_not_supported', 'captured_by'];
  for (const record of sources.sources) for (const key of required) assert.ok(key in record, `a source record has no ${key}`);
});

test('the sentence splitter keeps the motto whole and does not split on a colon', () => {
  assert.deepEqual(sentencesOf('The motto is WE Dream. WE Build. WE Grow. It stays.'), ['The motto is WE Dream. WE Build. WE Grow.', 'It stays.']);
  assert.deepEqual(sentencesOf('One rule: keep it short. Next one.'), ['One rule: keep it short.', 'Next one.']);
});

test('every string on the new pages is mapped (an unmapped sentence fails here)', () => {
  const mapped = new Set(sources.sentences.map((s) => s.text));
  const missing = texts.filter((text) => !mapped.has(text));
  assert.deepEqual(missing, [], `Unmapped strings. Add each to .astro-magazine/sources/wp-71.json:\n${missing.map((m) => `  ${JSON.stringify(m)}`).join('\n')}`);
});

test('no mapping is stale: every mapped string is still on the site', () => {
  const live = new Set(texts);
  const stale = sources.sentences.map((s) => s.text).filter((text) => !live.has(text));
  assert.deepEqual(stale, []);
  assert.equal(new Set(sources.sentences.map((s) => s.text)).size, sources.sentences.length, 'a string is mapped twice');
});

test('every mapping is exactly one of: a control label, a page frame, or a sourced sentence', () => {
  for (const entry of sources.sentences) {
    const kinds = [entry.ui_label === true, entry.page_frame === true, entry.sources !== undefined].filter(Boolean).length;
    assert.equal(kinds, 1, `${entry.text}: needs exactly one of ui_label, page_frame or sources`);
    if (entry.ui_label === true) assert.ok(entry.text.split(/\s+/).length <= 7, `${entry.text}: too long for a label`);
    if (entry.sources !== undefined) assert.ok(Array.isArray(entry.sources) && entry.sources.length > 0, `${entry.text}: no source`);
    if (entry.paraphrase === true) {
      assert.ok(typeof entry.note === 'string' && entry.note.length > 0, `${entry.text}: a paraphrase names what changed in "note"`);
      assert.ok((entry.sources ?? []).some(isQuote), `${entry.text}: a paraphrase quotes the line it restates`);
    }
  }
});

test('page frames and paraphrases stay few, and a frame states no fact about WE', () => {
  const frames = sources.sentences.filter((s) => s.page_frame === true);
  const paraphrases = sources.sentences.filter((s) => s.paraphrase === true);
  assert.ok(frames.length <= MAX_FRAMES, `${frames.length} page frames; more than ${MAX_FRAMES} means copy that needs a real source`);
  assert.ok(paraphrases.length <= MAX_PARAPHRASES, `${paraphrases.length} paraphrases; more than ${MAX_PARAPHRASES} means the story is drifting from the existing pages`);
  for (const frame of frames) {
    assert.doesNotMatch(frame.text, /\d/, `${frame.text}: a digit`);
    assert.doesNotMatch(frame.text, /^WE\b/, `${frame.text}: a frame describes the page, it does not state a fact about WE`);
  }
});

test('the brand story page is drawn only from existing pages: every body sentence is a verbatim quote', () => {
  const { frontmatter, blocks } = mdx('src/content/pages/about/brand-story.mdx');
  assert.equal(frontmatter.length, 3, 'title, description and eyebrow');
  for (const block of blocks) {
    for (const sentence of sentencesOf(block)) {
      const entry = entryFor(sentence);
      assert.ok(entry !== undefined, `${sentence}: not mapped`);
      if (entry.ui_label === true) continue;
      assert.notEqual(entry.page_frame, true, `${sentence}: the story body cannot be a page frame`);
      assert.notEqual(entry.paraphrase, true, `${sentence}: the story body quotes, it does not paraphrase`);
      assert.ok((entry.sources ?? []).some(isQuote), `${sentence}: the story body cites a line`);
    }
  }
});

test('every quote is in its file, and a moved line is reported', (t) => {
  for (const entry of sources.sentences) {
    for (const source of entry.sources ?? []) {
      if (!isQuote(source)) continue;
      assert.ok(!source.file.startsWith('/') && !source.file.includes('..'), `${source.file}: not a repository path`);
      const url = new URL(source.file, root);
      assert.ok(existsSync(url), `${source.file} does not exist (for: ${entry.text})`);
      const lines = readFileSync(url, 'utf8').split('\n');
      assert.ok(source.line >= 1 && source.line <= lines.length, `${source.file}:${source.line} is outside the file`);
      const quote = squash(source.quote);
      assert.ok(squash(lines.join(' ')).includes(quote), `${source.file} no longer contains: ${source.quote} (for: ${entry.text})`);
      if (!squash(lines[source.line - 1] ?? '').includes(quote)) t.diagnostic(`${source.file}:${source.line} has moved; the quote is still in the file (for: ${entry.text})`);
    }
  }
});

test('a claim source names a published, enabled claim', () => {
  for (const entry of sources.sentences) {
    for (const source of entry.sources ?? []) {
      if (isQuote(source)) continue;
      for (const id of source.claims) {
        const claim = claimRegistry[id as ClaimId];
        assert.ok(claim !== undefined, `${id} is not a claim`);
        assert.equal(claim.status, 'publish', `${id} is not a published claim (for: ${entry.text})`);
        assert.equal(claim.enabled, true, `${id} is not enabled (for: ${entry.text})`);
      }
    }
  }
});

test('the claims denylist finds nothing in any string, interface text included', () => {
  for (const { where, text } of collected) {
    const route = where.includes('brand-story') ? '/about/brand-story/' : '/press/brand-kit/';
    assert.deepEqual(audit.scan(text, { route, plain: true, flagValues: {} }), [], `${where}: ${text}`);
  }
  for (const text of interfaceStrings()) {
    assert.deepEqual(audit.scan(text, { route: '/press/brand-kit/', plain: true, flagValues: {} }), [], text);
  }
});

test('the copy states no amount, count, time, fee or program wording and keeps US spelling (wave 7 truth policy)', () => {
  for (const text of [...texts, ...interfaceStrings()]) {
    assert.doesNotMatch(text, /\d/, `${text}: a digit`);
    assert.doesNotMatch(text, /[$€£%]/, `${text}: a currency sign or a percentage`);
    assert.doesNotMatch(text, /!/, `${text}: an exclamation mark`);
    assert.doesNotMatch(text, /\b(within|hours?|days?|weeks?|months?|minutes?|instantly|immediately|guarantee[sd]?)\b/i, text);
    assert.doesNotMatch(text, /\b(free|free of charge|no fee|no equity|no cost|for free|success fees?)\b/i, text);
    assert.doesNotMatch(text, /\b(accelerators?|cohorts?|mentors?|perks?|alumni)\b/i, text);
    assert.doesNotMatch(text, /\b(colour|colours|recolour|favour|honour|organis|recognis|centre|programme)\w*/i, `${text}: British spelling`);
    assert.doesNotMatch(text, /\b(analytics|tracking|cookies?)\b/i, text);
  }
});

test('the story and the kit say WE in capitals, use sentence-case headings and keep Investor Introductions off the page', () => {
  const page = texts.join('\n');
  assert.doesNotMatch(page, /\bwe (are|do|will|can)\b/, 'a lowercase "we" for the company');
  assert.doesNotMatch(page, /Investor Introductions|investor network|Demo Day/i);
  const headings = [
    ...['src/content/pages/about/brand-story.mdx', 'src/content/pages/press/brand-kit.mdx'].flatMap((file) =>
      [...readFileSync(new URL(file, root), 'utf8').matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => m[1] ?? ''),
    ),
    ...['src/pages/about/brand-story/index.astro', 'src/pages/press/[kit].astro'].flatMap((file) =>
      [...readFileSync(new URL(file, root), 'utf8').matchAll(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/g)].map((m) => m[1] ?? ''),
    ),
  ];
  assert.ok(headings.length >= 10, `expected the page headings, found ${headings.length}`);
  for (const heading of headings) {
    for (const word of heading.trim().split(/\s+/).slice(1)) assert.doesNotMatch(word, /^[A-Z][a-z]+$/, `${heading}: heading is not sentence case`);
  }
});
