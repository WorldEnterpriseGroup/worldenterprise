import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { THANKS_COPY } from '../../../src/components/briefs/copy.ts';
import { getRoute } from '../../../src/data/routes.ts';

// WP-25: /briefs/thanks/ links only to launched routes, filters every list through the live route state (a launched page that has not
// been written is skipped, so no link is dead), carries no call-to-action band (D-24), puts outside programs only inside the ecosystem
// context with the no-affiliation wording (D-W10-1) and holds no banned copy.

const ROOT = new URL('../../../', import.meta.url);
const page = readFileSync(new URL('src/pages/briefs/thanks.astro', ROOT), 'utf8');
const content = readFileSync(new URL('src/content/pages/briefs/thanks.md', ROOT), 'utf8');
const [, frontmatter = '', template = ''] = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(page) ?? [];

const PATHS = [...frontmatter.matchAll(/path: '([^']+)'/g)].map((match) => match[1] as string);
const ECOSYSTEM_PATHS = ['/ecosystem/', '/sbir-sttr/'];

test('the page links to known, launched routes only', () => {
  assert.ok(PATHS.length >= 6, `found ${PATHS.length} link paths`);
  for (const path of PATHS) {
    const row = getRoute(path);
    assert.ok(row, `${path} has no row in src/data/routes.ts`);
    assert.equal(row.launch, true, `${path} is not launched`);
  }
});

test('every link list goes through the live route filter and every href through href()', () => {
  assert.match(frontmatter, /const live = .*state\.isLive\(link\.path\)/);
  for (const name of ['READ_LINKS', 'ECOSYSTEM_LINKS', 'ASIDE_LINKS']) {
    assert.match(frontmatter, new RegExp(`const ${name} = live(<OnwardLink>)?\\(\\[`), `${name} must be filtered by live()`);
  }
  const hrefs = [...template.matchAll(/href=\{([^}]+)\}/g)].map((match) => match[1]);
  assert.ok(hrefs.length > 0);
  assert.ok(hrefs.every((value) => value === 'href(link.path)'), hrefs.join(' '));
  assert.doesNotMatch(template, /href="\//, 'no hard-coded site link');
});

test('there is no call-to-action band and no form on the page (D-24)', () => {
  assert.doesNotMatch(page, /Cta(Band|End|Aside|Row|Ladder)|SafeCtaBand|MidCta|data-cta/);
  assert.doesNotMatch(template, /<form\b|Form\b(?!Layout)/);
});

test('outside programs appear only inside the ecosystem context, with the no-affiliation wording', () => {
  const ecosystem = /<div class="thanks-ecosystem stack" data-context="ecosystem">([\s\S]*?)<\/div>\s*\)\}/.exec(template)?.[1] ?? '';
  assert.ok(ecosystem.length > 0, 'ecosystem block missing');
  assert.match(ecosystem, /no affiliation implied/);
  assert.match(ecosystem, /Join them\. WE works alongside, for the long run\./);
  const ecosystemList = /const ECOSYSTEM_LINKS = [\s\S]*?\]\);/.exec(frontmatter)?.[0] ?? '';
  for (const path of ECOSYSTEM_PATHS) assert.ok(ecosystemList.includes(`'${path}'`), `${path} belongs in ECOSYSTEM_LINKS`);
  const readList = /const READ_LINKS = [\s\S]*?\]\);/.exec(frontmatter)?.[0] ?? '';
  for (const path of ECOSYSTEM_PATHS) assert.ok(!readList.includes(`'${path}'`), `${path} must not sit outside the ecosystem block`);
});

/** Copy rules for every visitor-facing string on the page (the brief, D-W10-1 and docs/BRAND_NAMING.md). */
const BANNED: readonly [RegExp, string][] = [
  [/\bfree\b/i, 'never "free"'],
  [/[$€£]\s?\d|\b\d+\s?(usd|dollars)\b/i, 'no prices'],
  [/\bseats?\b|employer of record|\bEoR\b/i, 'no seat or employer-of-record framing'],
  [/World Enterprise Incubator/i, 'retired name'],
  [/\bGroup\b(?! Incorporated)/, '"Group" is always followed by "Incorporated"'],
  [/\bWE (is|are|acts as) (an? )?(investor|accelerator|fund|incubator)\b/i, 'WE is never an investor or accelerator'],
  [/\b(accelerator|cohort|demo day|investor network)\b/i, 'ecosystem terms only inside the ecosystem block'],
];

test('the page and its content entry hold no banned copy', () => {
  const visible = [template, content, ...Object.values(THANKS_COPY), ...[...frontmatter.matchAll(/(?:title|line|body|label): '([^']+)'/g)].map((m) => m[1])].join('\n');
  for (const [pattern, rule] of BANNED) assert.doesNotMatch(visible, pattern, rule);
});
