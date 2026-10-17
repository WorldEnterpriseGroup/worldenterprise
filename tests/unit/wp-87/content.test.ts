import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';
import * as claimsAudit from '../../../scripts/audit-claims.mjs';
import { transformMdx } from '../../../src/components/geo/mdx-transform.ts';
import { routes } from '../../../src/data/routes.ts';
import { countWords, listCollectionFiles } from '../../../src/lib/content-files.ts';
import { lintMarkdown } from '../../../src/lib/markdown-twins.ts';

/**
 * WP-87: the guides and templates it wrote or deepened. The rubric is the one the plan sets for a guide (a title that fits the card, a
 * description of 50 to 160 characters with no duration, a body of 900 to 1,400 words, an "About the evidence" section, the exact label on a
 * worked example), the truth policy as wording the copy never uses, the claims audit over every touched file, and a link check that
 * resolves each internal link to a live route.
 */
interface Hit {
  readonly rule: string;
  readonly match: string;
}
const audit = claimsAudit as unknown as { scan(text: string, options?: { route?: string; plain?: boolean; flagValues?: object }): Hit[] };

const root = new URL('../../../', import.meta.url).pathname;

const NEW_GUIDES = ['term-sheet-checklist', 'security-questionnaire-answers', 'pricing-experiments', 'customer-interview-synthesis'] as const;
const DEEPENED_GUIDES = ['data-room', 'investor-readiness-checklist', 'investor-updates'] as const;
const ALL_GUIDES: readonly string[] = [...DEEPENED_GUIDES, ...NEW_GUIDES];
const NEW_TEMPLATES = [
  'landing-page-brief',
  'pricing-page-checklist',
  'job-description-template',
  'outreach-sequence-worksheet',
  'interview-synthesis-sheet',
  'decision-log',
] as const;
/** Templates that hold a worked example, which carries the label. */
const TEMPLATES_WITH_EXAMPLE: readonly string[] = ['interview-synthesis-sheet', 'decision-log'];
const EXAMPLE_LABEL = 'Illustrative example, not a real company';

interface Doc {
  readonly path: string;
  readonly data: Record<string, unknown>;
  readonly body: string;
}

function readDoc(path: string): Doc {
  const raw = readFileSync(join(root, path), 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  assert.ok(match !== null, `${path} has no frontmatter`);
  return { path, data: (parse(match[1] ?? '') ?? {}) as Record<string, unknown>, body: match[2] ?? '' };
}

const guidePath = (slug: string): string => `src/content/guides/${slug}.mdx`;
const templatePath = (slug: string): string => `src/content/library/${slug}.md`;
const h2s = (body: string): string[] => [...body.matchAll(/^##[ \t]+(.+?)[ \t]*$/gm)].map((m) => m[1] ?? '');

/** The text the claims audit reads: Markdown links reduced to their text, as a reader sees the sentence. */
const readable = (body: string): string => body.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/^import .*$/gm, ' ');

// ---------------------------------------------------------------------------------------------------------------------------------
// Guides
// ---------------------------------------------------------------------------------------------------------------------------------

test('every guide is a published fundability guide with the no-funding disclaimer, a date and an About the evidence section', () => {
  for (const slug of ALL_GUIDES) {
    const doc = readDoc(guidePath(slug));
    assert.equal(doc.data.section, 'fundability', slug);
    assert.notEqual(doc.data.draft, true, `${slug} is a draft`);
    assert.ok((doc.data.disclaimers as string[]).includes('no-funding'), `${slug} lacks the no-funding disclaimer`);
    assert.ok(/^\d{4}-\d{2}-\d{2}/.test(String(doc.data.updated instanceof Date ? doc.data.updated.toISOString() : doc.data.updated)), `${slug} has no updated date`);
    assert.ok(h2s(doc.body).includes('About the evidence'), `${slug} has no About the evidence section`);
  }
});

test('the title fits the card (31 characters at most) and the description is 50 to 160 characters with no duration', () => {
  for (const slug of ALL_GUIDES) {
    const { data } = readDoc(guidePath(slug));
    const title = String(data.title);
    const description = String(data.description);
    assert.ok(title.length <= 31, `${slug}: title is ${title.length} characters`);
    assert.ok(description.length >= 50 && description.length <= 160, `${slug}: description is ${description.length} characters`);
    assert.ok(!/\b\d+\s*(?:-|to)?\s*\d*\s*(?:minutes?|mins?|hours?|days?|weeks?)\b/i.test(description), `${slug}: description names a duration`);
  }
});

test('every guide body runs 900 to 1,400 words', () => {
  for (const slug of ALL_GUIDES) {
    const words = countWords(readDoc(guidePath(slug)).body);
    assert.ok(words >= 900 && words <= 1400, `${slug} is ${words} words`);
  }
});

test('a guide that carries a worked example labels it with the exact words, and an unlabeled example is not there', () => {
  for (const slug of ALL_GUIDES) {
    const { body } = readDoc(guidePath(slug));
    const hasExample = /worked example|example/i.test(h2s(body).join(' '));
    if (hasExample) assert.ok(body.includes(`${EXAMPLE_LABEL}.`), `${slug} has an example heading and no label`);
  }
  for (const slug of ['investor-updates', 'term-sheet-checklist', 'security-questionnaire-answers', 'pricing-experiments', 'customer-interview-synthesis']) {
    assert.ok(readDoc(guidePath(slug)).body.includes(`${EXAMPLE_LABEL}.`), `${slug} lost its labeled example`);
  }
});

test('the original wording of the deepened guides is kept: the data room folder table and its nine folders', () => {
  const { body } = readDoc(guidePath('data-room'));
  for (const folder of ['1. Company', '2. Product', '3. Customers', '4. Metrics and finance', '5. People and contracts', '6. Intellectual property', '7. Security and privacy', '8. Legal', '9. Updates']) {
    assert.ok(body.includes(`'${folder}'`), `the data room table lost ${folder}`);
  }
  assert.ok(body.includes('A data room is a shared, organized folder of the records someone needs to check a company'));
});

test('safe-explained is untouched: it keeps its generic-definition markers and its pre-wave sources date', () => {
  const raw = readFileSync(join(root, 'src/content/guides/safe-explained.mdx'), 'utf8');
  assert.ok(raw.includes('data-generic-definition'));
  assert.ok(raw.includes('2026-10-06'));
});

test('no guide or template uses SAFE terms, which live only inside the generic definition of the SAFE guide', () => {
  const banned = /valuation cap|discount rate|pro[- ]rata|\bMFN\b|most favored nation/i;
  for (const path of [...ALL_GUIDES.map(guidePath), ...NEW_TEMPLATES.map(templatePath)]) {
    const text = readDoc(path).body;
    assert.ok(!banned.test(text), `${path} uses a SAFE term`);
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------------------------------------------------------------

test('every new template is in the library collection with a kind, instructions, a description of 50 to 160 characters and a short title', () => {
  const files = new Set(listCollectionFiles(root, 'library'));
  for (const slug of NEW_TEMPLATES) {
    assert.ok(files.has(`${slug}.md`), `${slug}.md is not in the library collection`);
    const { data } = readDoc(templatePath(slug));
    assert.ok(['template', 'checklist', 'worksheet', 'guide'].includes(String(data.kind)), `${slug}: kind ${String(data.kind)}`);
    assert.ok(String(data.instructions).length >= 20, `${slug}: instructions are too short`);
    const description = String(data.description);
    assert.ok(description.length >= 50 && description.length <= 160, `${slug}: description is ${description.length} characters`);
    assert.ok(String(data.title).length <= 31, `${slug}: title is ${String(data.title).length} characters`);
    assert.ok(!('sources' in data), `${slug}: the library schema has no sources`);
  }
});

test('a template body is numbered sections, has no internal links, and labels its worked example', () => {
  for (const slug of NEW_TEMPLATES) {
    const { body } = readDoc(templatePath(slug));
    const headings = h2s(body);
    assert.ok(headings.length >= 4, `${slug} has ${headings.length} sections`);
    headings.forEach((heading, index) => assert.ok(heading.startsWith(`${index + 1}. `), `${slug}: "${heading}" is not numbered ${index + 1}`));
    assert.ok(!/\]\(\//.test(body), `${slug} links to an internal route from a body that is copied out of the site`);
    if (TEMPLATES_WITH_EXAMPLE.includes(slug)) assert.ok(body.includes(`${EXAMPLE_LABEL}.`), `${slug} lost the example label`);
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Truth policy and the claims audit
// ---------------------------------------------------------------------------------------------------------------------------------

/** Wording the package never uses, beyond the denylist: an amount, a promise, a fee statement, a peer word, an exclamation. */
const BANNED: ReadonlyArray<readonly [string, RegExp]> = [
  ['a currency sign before a number', /[$€£]\s?\d/],
  ['free', /\bfree\b/i],
  ['no fee, no equity, no stake or free of charge', /\bno (?:fee|equity|stake)\b|free of charge/i],
  ['success fee', /success[- ]fee/i],
  ['tranche', /\btranche/i],
  ['fundable company or to become fundable', /fundable company|to become fundable/i],
  ['accelerator, cohort, mentor or perks', /\b(?:accelerator|cohort|mentor|perks?)s?\b/i],
  ['alumni or investor network', /\balumni\b|investor network/i],
  ['an exclamation mark', /!/],
  ['an outcome promise', /\b(?:guarantee[ds]?|will raise|you will get funded)\b/i],
  ['non-US spelling', /\b(?:organis|colour|behaviour|favour|centre\b|licence\b|catalogue)/i],
];

test('no guide or template uses wording the truth policy bans', () => {
  for (const path of [...ALL_GUIDES.map(guidePath), ...NEW_TEMPLATES.map(templatePath)]) {
    const text = readable(readDoc(path).body);
    for (const [name, pattern] of BANNED) assert.ok(!pattern.test(text), `${path} uses ${name}: ${pattern.exec(text)?.[0] ?? ''}`);
  }
});

test('the claims audit finds nothing in any guide or template, and its banned-word traps still fire', () => {
  for (const slug of ALL_GUIDES) {
    const text = readable(readDoc(guidePath(slug)).body);
    assert.deepEqual(audit.scan(text, { route: `/fundability/${slug}/`, plain: true, flagValues: {} }).map((h) => `${h.rule}: ${h.match}`), [], slug);
  }
  for (const slug of NEW_TEMPLATES) {
    const text = readable(readDoc(templatePath(slug)).body);
    assert.deepEqual(audit.scan(text, { route: `/library/${slug}/`, plain: true, flagValues: {} }).map((h) => `${h.rule}: ${h.match}`), [], slug);
  }
  for (const trap of ['There is no fee to apply.', 'WE takes no equity.', 'The service is free of charge.', 'We reply within 2 business days.']) {
    assert.ok(audit.scan(trap, { route: '/fundability/data-room/', plain: true, flagValues: {} }).length > 0, `the audit no longer catches: ${trap}`);
  }
});

test('no guide or template states an amount, a price, a seat count or a promise about WE', () => {
  for (const path of [...ALL_GUIDES.map(guidePath), ...NEW_TEMPLATES.map(templatePath)]) {
    const text = readable(readDoc(path).body);
    for (const sentence of text.split(/(?<=[.?])\s+/)) {
      if (/\bWE\b/.test(sentence)) assert.ok(!/\d/.test(sentence.replace(/\bSOC 2\b|\b10b-5\b|\b17 U\.S\.C\.?|\b\d+(?:st|nd|rd|th)\b/g, '')), `${path}: a sentence about WE carries a figure: ${sentence}`);
    }
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Links and twins
// ---------------------------------------------------------------------------------------------------------------------------------

const live = new Set(routes.filter((row) => row.launch).map((row) => row.path));

function internalLinks(body: string): string[] {
  return [...body.matchAll(/\]\((\/[^)\s]*)\)/g)].map((m) => (m[1] ?? '').split('#')[0] ?? '');
}

test('every internal link in a guide points at a route that is live in the ledger', () => {
  for (const slug of ALL_GUIDES) {
    for (const target of internalLinks(readDoc(guidePath(slug)).body)) assert.ok(live.has(target), `${slug} links to ${target}, which is not a live route`);
  }
});

test('the four new guides and the six new templates are live routes derived from their files', () => {
  for (const slug of NEW_GUIDES) assert.ok(live.has(`/fundability/${slug}/`), `/fundability/${slug}/ is not live`);
  for (const slug of NEW_TEMPLATES) assert.ok(live.has(`/library/${slug}/`), `/library/${slug}/ is not live`);
});

/** The one guide that renders a component with no Markdown form: it has had no twin since before WP-87, and its refusal is stated, not silent. */
const NO_TWIN: Readonly<Record<string, string>> = { 'investor-readiness-checklist': '<ChecklistGroups> is a component this transform does not convert' };

test('every guide converts to Markdown that lints clean, except the one whose refusal is pinned', () => {
  for (const slug of ALL_GUIDES) {
    const result = transformMdx(readDoc(guidePath(slug)).body, { isLive: (path) => live.has(path.split('#')[0] ?? path) });
    const refusal = NO_TWIN[slug];
    if (refusal !== undefined) {
      assert.ok(!result.ok && result.reason === refusal, `${slug} should be refused with "${refusal}"`);
      continue;
    }
    assert.ok(result.ok, `${slug}: ${result.ok ? '' : result.reason}`);
    if (result.ok) assert.deepEqual(lintMarkdown(result.markdown), [], slug);
  }
});

test('the hubs list new files without a code change: the guides and templates are read from their collections and sorted legacy first, then by name', () => {
  const fundability = readFileSync(join(root, 'src/pages/fundability/index.astro'), 'utf8');
  assert.ok(/getPublished\(\s*'guides'/.test(fundability), 'the fundability hub no longer reads the guides collection');
  assert.ok(fundability.includes('localeCompare'));
  const library = readFileSync(join(root, 'src/pages/library/index.astro'), 'utf8');
  assert.ok(/getPublished\(\s*'library'/.test(library), 'the library hub no longer reads the library collection');
  assert.ok(library.includes('localeCompare'));
});

test('the fundability index names every guide topic in its copy and keeps a description of 50 to 160 characters', () => {
  const raw = readFileSync(join(root, 'src/content/pages/fundability/index.mdx'), 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  assert.ok(match !== null);
  const data = parse(match[1] ?? '') as { description?: string };
  const description = data.description ?? '';
  assert.ok(description.length >= 50 && description.length <= 160, `the fundability description is ${description.length} characters`);
  const body = (match[2] ?? '').toLowerCase();
  for (const topic of ['readiness checklist', 'data room', 'safe', 'term sheet checklist', 'security questionnaires', 'pricing experiments', 'customer interview synthesis', 'investor updates']) {
    assert.ok(body.includes(topic), `the fundability index does not mention ${topic}`);
  }
  assert.ok(body.includes('](/library/)'), 'the fundability index links the library');
});
