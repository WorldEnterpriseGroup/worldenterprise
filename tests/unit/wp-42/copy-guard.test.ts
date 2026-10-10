import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { packages } from '../../../src/data/packages.ts';
import { stageLabel } from '../../../src/components/pricing/stages.ts';
import { CUSTOM_PLAN_BANNER, packageBanner } from '../../../src/scripts/team-composer.ts';

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

const COMPONENTS = ['PackageCards', 'SeatExplainer', 'NotPublished', 'PackagePicker'].map((name) => `src/components/pricing/${name}.astro`);

function hits(text: string): string[] {
  return RULES.filter(({ re }) => re.test(text)).map(({ id }) => id);
}

for (const rel of COMPONENTS) {
  test(`${rel}: the copy trips no denylist rule`, () => {
    assert.deepEqual(hits(visibleText(read(rel))), []);
  });
}

test('the pricing and Composer page copy trips no denylist rule', () => {
  for (const rel of ['src/content/pages/pricing/pricing.mdx', 'src/content/pages/tools/team-composer.mdx']) {
    const text = visibleText(read(rel));
    const found = hits(text);
    assert.deepEqual(found, [], `${rel}: ${found.join(', ')}`);
  }
});

test('the package data copy trips no rule, and no package sits near a seat count', () => {
  const text = packages.map((p) => `${p.name} ${p.stageFit} ${p.depth} ${stageLabel(p)}`).join(' . ');
  assert.deepEqual(hits(text), []);
});

test('the Composer select, its hint and the banner copy trip no rule when the tags are stripped', () => {
  const html = read('src/components/islands/we-team-composer/TeamComposer.astro');
  const hint = /<p class="field__hint" id="composer-package-hint">\s*([^<]+?)\s*<\/p>/.exec(html);
  assert.ok(hint, 'the select carries a hint paragraph');
  const options = packages.map((p) => `<option value="${p.id}">${stageLabel(p)} (${p.name})</option>`).join('');
  const rendered = `<label>Company stage (optional)</label><select><option value="">No stage chosen: a custom seat plan</option>${options}</select><p>${hint[1]}</p><p>${CUSTOM_PLAN_BANNER.title}</p><p>${CUSTOM_PLAN_BANNER.detail}</p>`;
  assert.deepEqual(hits(rendered.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')), []);
});

test('every banner a package can produce trips no rule', () => {
  for (const pkg of packages) {
    const banner = packageBanner(pkg.id);
    assert.deepEqual(hits(`${banner.title}. ${banner.detail}`), [], pkg.id);
  }
});

test('the hint after the select ends its sentence, so a package name cannot run into the seat wording that follows', () => {
  const html = read('src/components/islands/we-team-composer/TeamComposer.astro');
  const hint = /<p class="field__hint" id="composer-package-hint">\s*([^<]+?)\s*<\/p>/.exec(html);
  assert.ok(hint);
  assert.match(hint[1] ?? '', /\.$/);
});

test('the guard itself catches the wording it exists for', () => {
  assert.ok(hits('Launch includes 3 seats for your team.').includes('W7-package-seat-count'));
  assert.ok(hits('Choose 2 seats in Studio.').includes('W7-package-seat-count'));
  assert.ok(hits('There is no fee for the add-on.').includes('W7-C09-no-fee'));
  assert.ok(hits('We reply within 2 days.').includes('W7-response-time'));
});
