import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// The copy guard of the pricing and Composer pages, run on the source so a breach fails before a build. Wave 9 (W9-13, WP-54) retired
// the package components: /pricing/ is a short noindex pointer to /how-we-work/, and the Composer carries roles only.

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

interface DenyRule {
  id: string;
  pattern: string;
  flags?: string;
  disabledByFlag?: string;
  allowPaths?: string[];
}

interface Denylist {
  rules: DenyRule[];
  contextRules: DenyRule[];
}

const denylist = JSON.parse(readFileSync(join(root, 'claims-denylist.json'), 'utf8')) as Denylist;

/** Every rule the built-output audit applies, compiled the way the audit compiles them (flags as written). */
const RULES = [...denylist.rules, ...denylist.contextRules].map((rule) => ({ id: rule.id, re: new RegExp(rule.pattern, rule.flags ?? '') }));

/** The audit replaces tags with spaces before it matches, and so does this. */
function visibleText(source: string): string {
  return source
    .replace(/^---[\s\S]*?\n---\n/, ' ')
    .replace(/<(style|script)\b[\s\S]*?<\/\1>/g, ' ')
    .replace(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ');
}

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

function hits(text: string): string[] {
  return RULES.filter(({ re }) => re.test(text)).map(({ id }) => id);
}

const PAGES = [
  'src/content/pages/pricing/pricing.mdx',
  'src/pages/pricing/index.astro',
  'src/content/pages/tools/team-composer.mdx',
  'src/pages/tools/team-composer.astro',
  'src/components/islands/we-team-composer/TeamComposer.astro',
];

for (const rel of PAGES) {
  test(`${rel}: the copy trips no denylist rule`, () => {
    const found = hits(visibleText(read(rel)));
    assert.deepEqual(found, [], `${rel}: ${found.join(', ')}`);
  });
}

test('the retired pricing page names no package and no price', () => {
  const text = visibleText(read('src/content/pages/pricing/pricing.mdx')) + visibleText(read('src/pages/pricing/index.astro'));
  assert.doesNotMatch(text, /\b(Spark|Accelerate|Studio)\b|\$\s?\d|\bper seat\b/);
  assert.match(read('src/pages/pricing/index.astro'), /href: '\/how-we-work\/'/);
});

test('the guard itself catches the wording it exists for', () => {
  assert.ok(hits('Launch includes 3 seats for your team.').includes('W7-package-seat-count'));
  assert.ok(hits('Choose 2 seats in Studio.').includes('W7-package-seat-count'));
  assert.ok(hits('There is no fee for the add-on.').includes('W7-C09-no-fee'));
  assert.ok(hits('We reply within 2 days.').includes('W7-response-time'));
});
