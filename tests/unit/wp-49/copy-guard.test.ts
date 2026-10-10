import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { EVIDENCE_GROUPS, EVIDENCE_ITEMS } from '../../../src/components/islands/we-evidence-room/items.ts';
import { INPUTS, METRICS, PANELS, SOURCE_LABELS, SOURCE_TAGS } from '../../../src/components/islands/we-calc/formulas.ts';
import { calculate, waitingText } from '../../../src/scripts/metrics-calc.ts';
import { toMarkdown } from '../../../src/scripts/evidence-room.ts';
import type { RawInputs } from '../../../src/scripts/metrics-calc.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

interface DenyRule {
  id: string;
  pattern: string;
  flags?: string;
}

interface Denylist {
  rules: DenyRule[];
  contextRules: DenyRule[];
}

const denylist = JSON.parse(readFileSync(join(root, 'claims-denylist.json'), 'utf8')) as Denylist;

/** Every rule the built-output audit applies, compiled the way the audit compiles them (flags as written). */
const RULES = [...denylist.rules, ...denylist.contextRules].map((rule) => ({ id: rule.id, re: new RegExp(rule.pattern, rule.flags ?? '') }));

function hits(text: string): string[] {
  return RULES.filter(({ re }) => re.test(text)).map(({ id }) => id);
}

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

/** The audit replaces tags with spaces before it matches, and so does this. Attribute strings are read separately (see `literals`). */
function visibleText(source: string): string {
  return source
    .replace(/^---[\s\S]*?\n---\n/, ' ')
    .replace(/<(style|script)\b[\s\S]*?<\/\1>/g, ' ')
    .replace(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ');
}

/** Quoted strings long enough to be copy, from a page or component's markup and frontmatter. */
function literals(source: string): string {
  return [...source.matchAll(/(["'`])((?:(?!\1)[^\\\n]|\\.){24,})\1/g)].map((match) => match[2]).join(' . ');
}

const PAGES = [
  'src/pages/tools/index.astro',
  'src/pages/tools/metrics-calculator.astro',
  'src/pages/tools/evidence-room.astro',
  'src/components/islands/we-calc/MetricsCalculator.astro',
  'src/components/islands/we-evidence-room/EvidenceRoom.astro',
  'src/components/tools/FormulaTable.astro',
];

const CONTENT = ['src/content/pages/tools/index.mdx', 'src/content/pages/tools/metrics-calculator.mdx', 'src/content/pages/tools/evidence-room.mdx'];

for (const rel of PAGES) {
  test(`${rel}: the copy trips no denylist rule`, () => {
    const source = read(rel);
    assert.deepEqual(hits(visibleText(source)), [], 'markup text');
    assert.deepEqual(hits(literals(source)), [], 'quoted strings');
  });
}

for (const rel of CONTENT) {
  test(`${rel}: the copy trips no denylist rule`, () => {
    const found = hits(visibleText(read(rel)));
    assert.deepEqual(found, [], `${rel}: ${found.join(', ')}`);
  });
}

test('the formula registry copy trips no rule', () => {
  const text = [
    ...INPUTS.flatMap((input) => [input.label, input.hint]),
    ...PANELS.flatMap((panel) => [panel.title, panel.intro]),
    ...METRICS.flatMap((metric) => [metric.name, metric.formula, ...metric.assumptions]),
    ...Object.values(SOURCE_LABELS),
    ...Object.values(SOURCE_TAGS),
  ].join(' . ');
  assert.deepEqual(hits(text), []);
});

test('every result and error the calculator can write trips no rule', () => {
  const samples: RawInputs[] = [
    {},
    { cash: '5000' },
    { startingMrr: 'abc', newMrr: '-1', newCustomers: '2.5', grossMarginPct: '120', cash: '1e13', monthlyBurn: '$5' },
    { startingMrr: '0', newMrr: '0', expansionMrr: '0', contractionMrr: '0', churnedMrr: '0', acquisitionSpend: '0', newCustomers: '0', grossMarginPct: '0', cash: '0', monthlyBurn: '0' },
    { startingMrr: '400', churnedMrr: '300', contractionMrr: '200' },
    { startingMrr: '10,000', newMrr: '1500', expansionMrr: '500', contractionMrr: '200', churnedMrr: '300', acquisitionSpend: '6000', newCustomers: '10', grossMarginPct: '80', cash: '120000', monthlyBurn: '15000' },
  ];
  const lines: string[] = [];
  for (const sample of samples) {
    const outcome = calculate(sample);
    for (const issue of outcome.issues) lines.push(issue.message);
    for (const result of outcome.results) lines.push(result.display, result.detail);
  }
  for (const metric of METRICS) {
    const waiting = waitingText(metric.id);
    lines.push(waiting.display, waiting.detail);
  }
  assert.deepEqual(hits(lines.join(' . ')), []);
});

test('every evidence-room label, intro and the Markdown copy trip no rule', () => {
  const text = [
    ...EVIDENCE_GROUPS.flatMap((group) => [group.title, group.intro]),
    ...EVIDENCE_ITEMS.flatMap((item) => [item.label, item.backs ?? '', item.gapTitle ?? '']),
    toMarkdown({ stage: 'all', done: [] }),
  ].join(' . ');
  assert.deepEqual(hits(text), []);
});

test('no copy names a price, a currency sign or the Investor Introductions add-on', () => {
  const everything = [...PAGES, ...CONTENT, 'src/components/islands/we-calc/formulas.ts', 'src/scripts/metrics-calc.ts', 'src/components/islands/we-evidence-room/items.ts']
    .map((rel) => read(rel))
    .join('\n');
  assert.doesNotMatch(everything, /[$€£]\s?\d/, 'a currency sign before a number');
  assert.doesNotMatch(everything, /investor introductions/i);
  assert.doesNotMatch(everything, /\bSAFE calculator\b/i);
});

test('the guard itself catches the wording it exists for', () => {
  assert.ok(hits('Launch includes 3 seats for your team.').includes('W7-package-seat-count'));
  assert.ok(hits('We reply within 2 days.').includes('W7-response-time'));
});
