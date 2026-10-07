import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { BRIEF_META, readingMinutes } from '../../../src/components/research/briefs.ts';
import { RESEARCH_SLUGS } from '../../../src/data/routes.ts';

const DIR = new URL('../../../src/content/research/', import.meta.url);

interface Brief {
  readonly slug: string;
  readonly front: string;
  readonly body: string;
  readonly sourceIds: readonly string[];
}

function load(slug: string): Brief {
  const raw = readFileSync(new URL(`${slug}.md`, DIR), 'utf8');
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
  if (match?.[1] === undefined || match[2] === undefined) throw new Error(`${slug}.md has no frontmatter`);
  const sourceIds = Array.from(match[1].matchAll(/^\s+- \{ id: ([a-z0-9-]+),/gm)).map((m) => m[1] ?? '');
  return { slug, front: match[1], body: match[2], sourceIds };
}

const briefs = RESEARCH_SLUGS.map(load);

test('the four ledger slugs each have a brief file and metadata, and no extras exist', () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')).sort();
  assert.deepEqual(files, [...RESEARCH_SLUGS].sort());
  assert.deepEqual(Object.keys(BRIEF_META).sort(), [...RESEARCH_SLUGS].sort());
});

test('every brief has five or more uniquely identified sources and is not a draft', () => {
  for (const b of briefs) {
    assert.ok(b.sourceIds.length >= 5, `${b.slug} has ${b.sourceIds.length} sources`);
    assert.equal(new Set(b.sourceIds).size, b.sourceIds.length, `${b.slug} has duplicate source ids`);
    assert.match(b.front, /^draft: false$/m, `${b.slug} must not be a draft`);
    assert.match(b.front, /^version: "1\.0"$/m);
    assert.match(b.front, /^appendix: /m);
  }
});

test('every in-text citation resolves to a declared source and every source is cited', () => {
  for (const b of briefs) {
    const cited = new Set(Array.from(b.body.matchAll(/\]\(#source-([a-z0-9-]+)\)/g)).map((m) => m[1] ?? ''));
    for (const id of cited) assert.ok(b.sourceIds.includes(id), `${b.slug} cites undeclared source ${id}`);
    for (const id of b.sourceIds) assert.ok(cited.has(id), `${b.slug} never cites declared source ${id}`);
  }
});

test('every brief has Methodology, Limitations and an Appendix heading', () => {
  for (const b of briefs) {
    for (const heading of ['## Methodology', '## Limitations']) assert.ok(b.body.includes(heading), `${b.slug} lacks ${heading}`);
    assert.match(b.body, /^## Appendix/m, `${b.slug} lacks an appendix`);
  }
});

test('briefs stay clear of excluded claim classes and never publish benchmarks or statistics', () => {
  const banned = [/\bguarantee/i, /\bpremier\b/i, /\bcertified\b/i, /\bSOC\s?2\s+(?:compliant|type)/i, /\btrusted by\b/i, /\btestimonial/i, /\bsuccess[- ]fee/i, /\bdiscount rate\b/i, /\bpro[- ]rata\b/i, /\bbenchmark of\b/i];
  for (const b of briefs) {
    for (const re of banned) assert.doesNotMatch(b.body, re, `${b.slug} matches ${re}`);
    assert.doesNotMatch(b.body, /\d\s?%/, `${b.slug} contains a percentage figure`);
    assert.doesNotMatch(b.body, /[$€£]\s?\d/, `${b.slug} contains a currency figure`);
  }
});

test('the staffing brief is labelled analysis and the accessibility brief flags unverified rule dates', () => {
  const staffing = briefs.find((b) => b.slug === 'dedicated-team-agency-or-freelancers');
  const access = briefs.find((b) => b.slug === 'accessibility-as-a-launch-requirement');
  assert.ok(staffing?.body.includes('is **analysis**'));
  assert.ok(access?.body.includes('Verify current rule'));
});

test('the metrics brief carries formulas and every formula row cites a source', () => {
  const metrics = briefs.find((b) => b.slug === 'early-stage-saas-metrics-definitions');
  assert.ok(metrics !== undefined);
  const rows = metrics.body.split('## Appendix')[1]?.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Metric') && !l.startsWith('|---')) ?? [];
  assert.ok(rows.length >= 7);
  for (const row of rows) assert.match(row, /\(#source-/);
});

test('readingMinutes never returns less than one', () => {
  assert.equal(readingMinutes(undefined), 1);
  assert.equal(readingMinutes('word '.repeat(2200)), 10);
});
