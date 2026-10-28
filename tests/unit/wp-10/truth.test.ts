import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { isClaimUsable } from '../../../src/data/claims.ts';
import type { ClaimId } from '../../../src/data/claims.ts';
import { site } from '../../../src/data/site.ts';

const ROOT = new URL('../../../', import.meta.url).pathname;
const OWNED_DIRS = ['src/content/pages/about', 'src/content/pages/press', 'src/content/pages/legal', 'src/pages/about', 'src/pages/press', 'src/pages/legal', 'src/components/about'];
const CONTENT_DIRS = ['src/content/pages/about', 'src/content/pages/press', 'src/content/pages/legal'];

function walk(dir: string): string[] {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).flatMap((name) => {
    const rel = join(dir, name);
    return statSync(join(ROOT, rel)).isDirectory() ? walk(rel) : [rel];
  });
}

const ownedFiles = OWNED_DIRS.flatMap(walk);
const contentFiles = CONTENT_DIRS.flatMap(walk);

interface DenyRule {
  readonly id: string;
  readonly pattern: string;
  readonly flags: string;
}

function denylist(): DenyRule[] {
  const raw = readFileSync(join(ROOT, 'claims-denylist.json'), 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || !('rules' in parsed) || !Array.isArray(parsed.rules)) {
    throw new Error('claims-denylist.json has no rules array.');
  }
  return parsed.rules as DenyRule[];
}

const EXTRA_FORBIDDEN: readonly RegExp[] = [
  /20 years/i,
  /twenty years/i,
  /premier/i,
  /scientific approach/i,
  /market dominance/i,
  /galactic/i,
  /world enterprise framework/i,
  /\bcatherine\b/i,
  /\bsean\b/i,
  /industry leaders?/i,
  /guarantee/i,
  /certified/i,
];

test('there are owned files to check', () => {
  assert.ok(contentFiles.length >= 10, `expected at least 10 content files, found ${contentFiles.length}`);
  assert.ok(ownedFiles.length > contentFiles.length);
});

test('owned files match no claims-denylist rule', () => {
  for (const file of ownedFiles) {
    const text = readFileSync(join(ROOT, file), 'utf8');
    for (const rule of denylist()) {
      assert.equal(new RegExp(rule.pattern, rule.flags).test(text), false, `${file} matches ${rule.id}`);
    }
  }
});

test('owned files avoid the excluded superlatives, internal names and unframed frameworks', () => {
  for (const file of ownedFiles) {
    const text = readFileSync(join(ROOT, file), 'utf8');
    for (const re of EXTRA_FORBIDDEN) {
      assert.equal(re.test(text), false, `${file} matches ${re}`);
    }
  }
});

test('content frontmatter fits the layout limits and cites only usable claims', () => {
  for (const file of contentFiles) {
    const text = readFileSync(join(ROOT, file), 'utf8');
    const title = /^title: (.+)$/m.exec(text)?.[1];
    assert.ok(title !== undefined, `${file} has no title`);
    assert.ok(`${title} | ${site.titleSuffix}`.length <= 60, `${file} title too long for the suffix`);
    const description = /^description: "(.+)"$/m.exec(text)?.[1];
    assert.ok(description !== undefined && description.length >= 50 && description.length <= 160, `${file} description length`);
    const claims = /^claimsUsed: \[(.*)\]$/m.exec(text)?.[1];
    assert.ok(claims !== undefined, `${file} has no claimsUsed`);
    for (const id of claims.split(',').map((s) => s.trim()).filter(Boolean)) {
      assert.ok(isClaimUsable(id as ClaimId), `${file} cites unusable claim ${id}`);
    }
  }
});

test('markdown bodies carry no root-relative links (internal links go through href())', () => {
  for (const file of contentFiles) {
    assert.equal(/\]\(\//.test(readFileSync(join(ROOT, file), 'utf8')), false, `${file} has a root-relative link`);
  }
});

test('pages hold no commented-out code or placeholders', () => {
  for (const file of ownedFiles) {
    const text = readFileSync(join(ROOT, file), 'utf8');
    assert.equal(/lorem ipsum|TODO|FIXME|<!--/i.test(text), false, `${file} has a placeholder or comment`);
  }
});

test('the privacy notice names every field in the forms contract', () => {
  const privacy = readFileSync(join(ROOT, 'src/content/pages/legal/privacy.md'), 'utf8');
  const fields = ['form', 'name', 'email', 'company', 'stage', 'seats', 'topic', 'message', 'consent', 'website', 'startedAt', 'submittedAt', 'page'];
  for (const field of fields) {
    assert.ok(privacy.includes(`\`${field}\``), `privacy notice does not list field ${field}`);
  }
  const contractPath = join(ROOT, 'docs/forms-contract.md');
  if (existsSync(contractPath)) {
    const contract = readFileSync(contractPath, 'utf8');
    const rows = [...contract.matchAll(/^\| `([a-zA-Z]+)`(?:, `([a-zA-Z]+)`)? \|/gm)];
    const contractFields = new Set(rows.flatMap((m) => [m[1], m[2]]).filter((v): v is string => v !== undefined));
    for (const field of fields) {
      assert.ok(contractFields.has(field), `contract no longer lists ${field}; update the notice`);
    }
  }
});

test('the privacy notice states no retention period and no cookies or analytics', () => {
  const privacy = readFileSync(join(ROOT, 'src/content/pages/legal/privacy.md'), 'utf8');
  assert.equal(/\b\d+\s+(?:days|months|years)\b/i.test(privacy), false);
  assert.ok(/sets no cookies/i.test(privacy));
  assert.ok(/no analytics/i.test(privacy));
});

test('the page-part of the privacy and terms pages is not publishable before the flag', () => {
  const terms = readFileSync(join(ROOT, 'src/pages/legal/[terms].astro'), 'utf8');
  assert.ok(terms.includes('flags.legalTerms'));
});
