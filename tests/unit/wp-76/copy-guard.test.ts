import assert from 'node:assert/strict';
import test from 'node:test';
import * as claimsAudit from '../../../scripts/audit-claims.mjs';
import * as toolCopy from '../../../src/components/tools/copy.ts';
import { RESULT_IDS as CAP_RESULT_IDS } from '../../../src/components/islands/we-cap-table/spec.ts';
import { CHECK_IDS } from '../../../src/components/islands/we-pricing-checker/spec.ts';
import { RESULT_IDS } from '../../../src/components/islands/we-runway/spec.ts';
import { calculate as calculateCap, waitingText as capWaitingText } from '../../../src/scripts/cap-table.ts';
import type { RawInputs as CapInputs } from '../../../src/scripts/cap-table.ts';
import { check as checkPricing, waitingText as pricingWaitingText } from '../../../src/scripts/pricing-checker.ts';
import { calculate, waitingText } from '../../../src/scripts/runway.ts';
import type { RawInputs } from '../../../src/scripts/runway.ts';
import { MARKUP_FILES, read, surfaces } from './surfaces.ts';

/**
 * The truth policy for the founder tools, as tests. A tool computes from the visitor's own numbers: it quotes no statistic, prices
 * nothing, promises nothing, and states no figure about WE. Every sentence the package publishes, every error and every result the
 * runway calculator can write, and the markup text of each file runs through the claims denylist.
 */
interface Hit {
  readonly rule: string;
  readonly match: string;
}
const audit = claimsAudit as unknown as { scan(text: string, options?: { route?: string; plain?: boolean; flagValues?: object }): Hit[] };

const ROUTE = '/tools/runway-calculator/';
const hits = (text: string): string[] => audit.scan(text, { route: ROUTE, plain: true, flagValues: {} }).map((hit) => hit.rule);

/** Wording the tools never use, beyond the denylist: a price, an outcome, a benefit, a fee, a financing term. */
const BANNED: ReadonlyArray<readonly [string, RegExp]> = [
  ['a currency sign before a number', /[$€£]\s?\d/],
  ['free', /\bfree\b/i],
  ['success fee', /success[- ]fee/i],
  ['non-dilutive', /non-?dilutive/i],
  ['valuation cap', /valuation cap/i],
  ['pro rata', /pro[- ]rata/i],
  ['tranche', /\btranche/i],
  ['MFN', /\bMFN\b/],
  ['SAFE calculator', /\bSAFE calculator\b/i],
  ['Investor Introductions', /investor introductions/i],
  ['accelerator, cohort or mentor', /\b(?:accelerator|cohort|mentor)s?\b/i],
  ['a multiple promise', /\b\d+x\b/i],
  ['an outcome', /\b(?:guarantee[ds]?|fundable company|will raise|you will get funded)\b/i],
];

/** The audit replaces tags with spaces before it matches. Script and style bodies are not copy. */
function visibleText(source: string): string {
  return source
    .replace(/^---[\s\S]*?\n---\n/, ' ')
    .replace(/<(style|script)\b[\s\S]*?<\/\1>/g, ' ')
    .replace(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ');
}

const RUNWAY_SAMPLES: readonly RawInputs[] = [
  {},
  { cash: '5000' },
  { cash: 'abc', burn: '-1', growth: '101' },
  { cash: '1e13', burn: '$5', growth: '5%' },
  { cash: '0', burn: '0', growth: '0' },
  { cash: '5000', burn: '0', growth: '10' },
  { cash: '100,000', burn: '10,000', growth: '0' },
  { cash: '100', burn: '10', growth: '100' },
  { cash: '1000000000000', burn: '1', growth: '1' },
  { cash: '1,000,000,000,001', burn: '1' },
];

test('every sentence the package publishes trips no denylist rule', () => {
  for (const surface of surfaces()) {
    for (const text of surface.strings) assert.deepEqual(hits(text), [], `${surface.path}: "${text}"`);
  }
});

test('every sentence the package publishes avoids the wording the tools never use', () => {
  for (const surface of surfaces()) {
    for (const text of surface.strings) {
      for (const [name, pattern] of BANNED) assert.doesNotMatch(text, pattern, `${surface.path}: "${text}" has ${name}`);
    }
  }
});

for (const rel of MARKUP_FILES) {
  test(`${rel}: the markup text trips no denylist rule and names no banned wording`, () => {
    const text = visibleText(read(rel));
    assert.deepEqual(hits(text), []);
    for (const [name, pattern] of BANNED) assert.doesNotMatch(text, pattern, name);
  });
}

test('every result and error the runway calculator can write trips no rule and names no banned wording', () => {
  const lines: string[] = [];
  for (const sample of RUNWAY_SAMPLES) {
    const outcome = calculate(sample);
    for (const issue of outcome.issues) lines.push(issue.message);
    for (const result of outcome.results) lines.push(result.display, result.detail);
  }
  for (const id of RESULT_IDS) {
    const waiting = waitingText(id);
    lines.push(waiting.display, waiting.detail);
  }
  for (const line of lines) {
    assert.deepEqual(hits(line), [], line);
    for (const [name, pattern] of BANNED) assert.doesNotMatch(line, pattern, `${line} has ${name}`);
  }
});

const CAP_SAMPLES: readonly CapInputs[] = [
  {},
  { yours: '1,000' },
  { yours: 'abc', others: '-1', issue: '1.5' },
  { yours: '1e13', others: '$5', issue: '5%' },
  { yours: '0', others: '0', issue: '0' },
  { yours: '0', others: '0', issue: '10' },
  { yours: '1000', others: '3000', issue: '1000' },
  { yours: '1', others: '2', issue: '3' },
  { yours: '999,999,999,999', others: '999,999,999,999', issue: '999,999,999,999' },
  { yours: '1,000,000,000,001', others: '1' },
];

test('every result and error the cap table explainer can write trips no rule and names no banned wording', () => {
  const lines: string[] = [];
  for (const sample of CAP_SAMPLES) {
    const outcome = calculateCap(sample);
    for (const issue of outcome.issues) lines.push(issue.message);
    for (const result of outcome.results) lines.push(result.display, result.detail);
  }
  for (const id of CAP_RESULT_IDS) {
    const waiting = capWaitingText(id);
    lines.push(waiting.display, waiting.detail);
  }
  for (const line of lines) {
    assert.deepEqual(hits(line), [], line);
    for (const [name, pattern] of BANNED) assert.doesNotMatch(line, pattern, `${line} has ${name}`);
  }
});

test('every count the pricing page checker can write trips no rule and names no banned wording', () => {
  const lines: string[] = [];
  for (let mask = 0; mask < 1 << CHECK_IDS.length; mask += 1) {
    const outcome = checkPricing(CHECK_IDS.filter((_, index) => (mask & (1 << index)) !== 0));
    for (const result of outcome.results) lines.push(result.display, result.detail);
  }
  const waiting = pricingWaitingText();
  lines.push(waiting.display, waiting.detail);
  for (const line of lines) {
    assert.deepEqual(hits(line), [], line);
    for (const [name, pattern] of BANNED) assert.doesNotMatch(line, pattern, `${line} has ${name}`);
  }
});

test('the cap table explainer names no financing instrument, price or value, and no SAFE term', () => {
  const FINANCING: ReadonlyArray<readonly [string, RegExp]> = [
    ['SAFE', /\bSAFEs?\b/],
    ['convertible note', /convertible note/i],
    ['valuation', /\bvaluation/i],
    ['discount', /\bdiscount/i],
    ['a price', /\bprices?\b|\bpriced\b|\bworth\b/i],
  ];
  const texts = surfaces()
    .filter((surface) => /cap-table|we-cap-table/.test(surface.path))
    .flatMap((surface) => surface.strings);
  assert.ok(texts.length > 30);
  for (const text of texts) {
    for (const [name, pattern] of FINANCING) {
      assert.doesNotMatch(text, pattern, `"${text}" has ${name}`);
    }
  }
  const scriptText = [read('src/scripts/cap-table.ts'), read('src/components/islands/we-cap-table/CapTable.astro')].map(visibleText).join(' ');
  for (const [name, pattern] of FINANCING) assert.doesNotMatch(scriptText, pattern, name);
});

test('the illustration line is the exact sentence the brief requires, and every result block carries it', () => {
  assert.equal(toolCopy.ILLUSTRATION, 'An illustration from your inputs, not advice.');
  assert.match(read('src/components/tools/ToolResult.astro'), /<dd class="tool-result__tag">\{ILLUSTRATION\}<\/dd>/);
});

test('the tool scripts and components make no request, store nothing and touch no address bar', () => {
  const FORBIDDEN: ReadonlyArray<readonly [string, RegExp]> = [
    ['fetch', /\bfetch\s*\(/],
    ['XMLHttpRequest', /XMLHttpRequest/],
    ['sendBeacon', /sendBeacon/],
    ['WebSocket or EventSource', /\b(?:WebSocket|EventSource)\b/],
    ['localStorage', /localStorage/],
    ['sessionStorage', /sessionStorage/],
    ['indexedDB', /indexedDB/],
    ['cookie', /document\.cookie/],
    ['history change', /history\.(?:pushState|replaceState)/],
    ['location change', /location\.(?:hash|search|href|assign|replace)\s*=|location\.(?:assign|replace)\s*\(/],
    ['dynamic import', /\bimport\s*\(/],
    ['a script from elsewhere', /<script[^>]+src=/],
    ['an absolute URL', /https?:\/\//],
    ['a placeholder', /\bplaceholder\s*=/],
    ['a preset value', /\bvalue\s*=\s*["'{]/],
  ];
  for (const rel of [
    'src/scripts/runway.ts',
    'src/scripts/pricing-checker.ts',
    'src/scripts/cap-table.ts',
    'src/components/tools/enhance.ts',
    'src/components/tools/numeric.ts',
    'src/components/tools/copy.ts',
    'src/components/tools/ToolField.astro',
    'src/components/tools/ToolResult.astro',
    'src/components/islands/we-runway/RunwayCalculator.astro',
    'src/components/islands/we-runway/spec.ts',
    'src/components/islands/we-pricing-checker/PricingChecker.astro',
    'src/components/islands/we-pricing-checker/spec.ts',
    'src/components/islands/we-cap-table/CapTable.astro',
    'src/components/islands/we-cap-table/spec.ts',
  ]) {
    const source = read(rel);
    for (const [name, pattern] of FORBIDDEN) assert.doesNotMatch(source, pattern, `${rel} uses ${name}`);
  }
});

test('the results are one polite live region and the inputs start empty and disabled', () => {
  for (const rel of [
    'src/components/islands/we-runway/RunwayCalculator.astro',
    'src/components/islands/we-pricing-checker/PricingChecker.astro',
    'src/components/islands/we-cap-table/CapTable.astro',
  ]) {
    assert.match(read(rel), /role="status" aria-live="polite"/, rel);
  }
  assert.match(read('src/components/islands/we-pricing-checker/PricingChecker.astro'), /type="checkbox" name=\{item\.id\} disabled/);
  const field = read('src/components/tools/ToolField.astro');
  assert.match(field, /^\s+disabled$/m);
  assert.doesNotMatch(field, /\bvalue=/);
});

test('the guard itself catches the wording it exists for', () => {
  assert.ok(hits('Launch includes 3 seats for your team.').includes('W7-package-seat-count'));
  const bad = ['It costs $50 a month.', 'Free to use.', 'Pay no success fee.', 'A non-dilutive route.', 'Cap at a 10x return.', 'We guarantee a raise.'];
  for (const text of bad) assert.ok(BANNED.some(([, pattern]) => pattern.test(text)), text);
});

test('the runway page passes the no-script note to the layout and lists the formulas as static content', () => {
  const page = read('src/pages/tools/runway-calculator.astro');
  assert.match(page, /noscript=\{PAGE\.noscript\}/);
  assert.match(page, /<ToolFormulas\b/);
  assert.doesNotMatch(page, /client:/, 'the island is a custom element, not a framework island');
});
