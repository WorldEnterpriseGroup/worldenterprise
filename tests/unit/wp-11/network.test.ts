import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { SEAT_ROLES } from '../../../src/components/network/roles.ts';
import { claimRegistry } from '../../../src/data/claims.ts';
import type { ClaimId } from '../../../src/data/claims.ts';
import { routes } from '../../../src/data/routes.ts';
import { site } from '../../../src/data/site.ts';

const root = new URL('../../../', import.meta.url).pathname;

/** Team Composer role list from SAGE-PLAN 6.8 (WP-03 builds the island from the same list). */
const COMPOSER_ROLES = [
  'Product design',
  'Front end',
  'Back end',
  'QA',
  'DevOps and security',
  'Brand',
  'Growth and support',
  'Operations',
  'Delivery lead',
] as const;

const contentFiles = [
  'src/content/pages/network/index.mdx',
  'src/content/pages/network/operators.mdx',
  'src/content/pages/founders/index.mdx',
  'src/content/pages/investors/index.mdx',
] as const;

const pageFiles = [
  'src/pages/network/index.astro',
  'src/pages/network/operators/index.astro',
  'src/pages/founders/index.astro',
  'src/pages/investors/index.astro',
  'src/components/network/NetworkIntro.astro',
  'src/components/network/roles.ts',
] as const;

const read = (file: string): string => readFileSync(join(root, file), 'utf8');

function scalar(text: string, key: string): string {
  const match = new RegExp(`^${key}: (.+)$`, 'm').exec(text);
  if (match?.[1] === undefined) throw new Error(`Missing frontmatter key ${key}.`);
  const value = match[1].trim();
  return value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
}

test('operator roles equal the Team Composer role list', () => {
  assert.deepEqual(SEAT_ROLES.map((r) => r.title), [...COMPOSER_ROLES]);
  const composer = join(root, 'src/scripts/team-composer.ts');
  if (existsSync(composer)) {
    const source = readFileSync(composer, 'utf8').toLowerCase();
    for (const title of COMPOSER_ROLES) assert.ok(source.includes(title.toLowerCase()), `Team Composer source lacks "${title}"`);
  }
});

test('roles are functions: unique ids, a limit statement each, no individual named', () => {
  assert.equal(new Set(SEAT_ROLES.map((r) => r.id)).size, SEAT_ROLES.length);
  for (const role of SEAT_ROLES) {
    assert.ok(role.summary.length >= 30, `${role.id} summary`);
    assert.match(role.doesNot, /^Does not /, `${role.id} limit`);
    assert.ok(role.lines.length >= 1, `${role.id} lines`);
  }
});

test('the four launched routes are owned by WP-11 and the L2 routes stay off', () => {
  const owned = routes.filter((r) => r.owner === 'WP-11');
  const launched = owned.filter((r) => r.launch).map((r) => r.path).sort();
  assert.deepEqual(launched, ['/founders/', '/investors/', '/network/', '/network/operators/']);
  for (const row of owned.filter((r) => !launched.includes(r.path))) assert.equal(row.launch, false, row.path);
});

test('meta: titles fit 60 characters with the suffix, descriptions are 50 to 160 characters', () => {
  const descriptions = new Set<string>();
  for (const file of contentFiles) {
    const text = read(file);
    const title = scalar(text, 'title');
    const description = scalar(text, 'description');
    assert.ok(`${title} | ${site.titleSuffix}`.length <= 60, `${file} title length`);
    assert.ok(description.length >= 50 && description.length <= 160, `${file} description is ${description.length}`);
    assert.ok(!descriptions.has(description), `${file} duplicates a description`);
    descriptions.add(description);
  }
});

test('claims cited exist, are usable, and never include an excluded id', () => {
  for (const file of contentFiles) {
    const block = /claimsUsed:\n((?:\s+- C-\d+\n)+)/.exec(read(file));
    assert.ok(block?.[1] !== undefined, `${file} cites claims`);
    for (const id of block[1].match(/C-\d+/g) ?? []) {
      const claim = claimRegistry[id as ClaimId];
      assert.ok(claim !== undefined, `${file}: unknown ${id}`);
      assert.equal(claim.enabled, true, `${file} cites unusable claim ${id}`);
      assert.notEqual(claim.status, 'excluded', `${file} cites excluded ${id}`);
    }
  }
});

test('copy passes the claims denylist and the social-proof wording check', () => {
  const denylist = JSON.parse(read('claims-denylist.json')) as { rules: { id: string; pattern: string; flags: string }[] };
  const extras = [/\bguarantee/i, /\bcertified\b/i, /\bfunded\b/i, /\bcase stud/i, /\bcohort/i, /\bdemo day/i, /\bclients?\b/i, /\bportfolio\b/i, /\bmentors?\b/i, /\balumni\b/i, /!/];
  for (const file of [...contentFiles, ...pageFiles]) {
    const text = read(file);
    for (const rule of denylist.rules) assert.doesNotMatch(text, new RegExp(rule.pattern, rule.flags), `${file} hits ${rule.id}`);
    for (const re of extras) {
      // Pages may state that there is no client list or portfolio. Those negations are the only allowed uses.
      const stripped = text.replace(/\b(?:client list|(?:a|no) portfolio)\b/gi, '');
      assert.doesNotMatch(stripped, re, `${file} matches ${String(re)}`);
    }
  }
});

test('no raw internal links in MDX bodies and no raw hex or px colours in components', () => {
  for (const file of contentFiles) {
    const text = read(file);
    assert.doesNotMatch(text, /\]\(\//, `${file} has a raw internal link`);
    assert.doesNotMatch(text, /href="\//, `${file} has a raw internal href`);
  }
  assert.doesNotMatch(read('src/components/network/NetworkIntro.astro'), /#[0-9a-fA-F]{3,8}\b/);
});

test('investors page carries the no-funding disclaimer and the not-an-offer statement', () => {
  const page = read('src/pages/investors/index.astro');
  assert.match(page, /<NoFundingDisclaimer\s*\/>/);
  assert.match(page, /Not an offer of securities/);
  assert.match(page, /does not offer securities|offer to sell, or a solicitation/);
  assert.match(page, /does not arrange meetings with investors/i);
});

test('every page uses one h1 through its layout and no page renders a raw h1', () => {
  for (const file of pageFiles.filter((f) => f.endsWith('.astro'))) assert.doesNotMatch(read(file), /<h1[\s>]/, file);
});
