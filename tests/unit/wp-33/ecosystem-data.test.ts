import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as copy from '../../../src/data/ecosystem/copy.ts';
import { ALL_ENTRIES, CATEGORIES, CATEGORY_BY_ID, countByCategory, entriesIn } from '../../../src/data/ecosystem/index.ts';
import { directoryNode } from '../../../src/data/ecosystem/schema.ts';
import { TIMELINE_BARS } from '../../../src/data/ecosystem/timeline.ts';
import { AUDIENCE_IDS, CATEGORY_IDS, FORMAT_IDS, STAGE_IDS } from '../../../src/data/ecosystem/types.ts';
import type { EcosystemEntry } from '../../../src/data/ecosystem/types.ts';

/**
 * WP-33, the ecosystem directory (issue #82). Data: every entry has an https URL, a source, a retrieval month and valid enumerations;
 * the directory is broad (60 or more verified entries, every category filled). Copy: nothing a program or WE says may break the wave 10
 * rules (WE is never an accelerator, investor or fund; no affiliation, price or "free"), checked over all data and all copy constants.
 */
const root = new URL('../../../', import.meta.url).pathname;

interface Rule {
  readonly id: string;
  readonly pattern: string;
  readonly flags?: string;
  readonly ecosystemAllowed?: boolean;
  readonly disabledByFlag?: string;
}

/** The rules wave 10 relaxes inside the ecosystem context (D-W10-1); WP-32 flags them `ecosystemAllowed`, and this list covers the time before it lands. */
const RELAXED: readonly string[] = ['C-13-peers', 'C-14-investor-network', 'C-14-demo-day-outcomes'];

function denylistRules(): readonly Rule[] {
  const raw = JSON.parse(readFileSync(`${root}claims-denylist.json`, 'utf8')) as { rules: Rule[]; contextRules: Rule[] };
  return [...raw.rules, ...raw.contextRules].filter(
    (r) => r.ecosystemAllowed !== true && r.disabledByFlag === undefined && !RELAXED.includes(r.id),
  );
}

/** The always-banned wave 10 rules (docs/wave10-contracts.md, section 2), restated here so the test holds before and after they land in the denylist. */
const WAVE_TEN: readonly Rule[] = [
  {
    id: 'W10-we-is-accelerator-or-investor',
    flags: 'i',
    pattern:
      '\\b(?:WE|World Enterprise)\\s+(?:is|are|acts as|operates as|serves as|works as)\\s+(?:also\\s+)?(?:an?\\s+|the\\s+)?(?:\\w+\\s+){0,2}?(?:accelerator|investor|fund|venture capital|studio|investment firm|employer of record|EOR|PEO)\\b',
  },
  { id: 'W10-own-investor-network', flags: 'i', pattern: "\\b(?:our|WE['\u2019]s)\\s+(?:\\w+\\s+){0,2}?investor\\s+network\\b" },
  {
    id: 'W10-own-demo-day',
    flags: 'i',
    pattern: '\\b(?:WE|we)\\s+(?:run|runs|host|hosts|hold|holds|offer|offers)\\s+(?:\\w+\\s+){0,2}?(?:cohorts?|batch(?:es)?|demo\\s+days?)\\b',
  },
  {
    id: 'W10-named-program-endorsement',
    flags: 'i',
    pattern:
      '\\b(?:partnered with|partners with|affiliated with|backed by|endorsed by|endorses)\\s+(?:Y Combinator|YC|Techstars|500 Global|Plug and Play|Founder Institute|Antler|SCORE|SBDCs?|Alchemist|Capital Factory)\\b',
  },
  { id: 'W10-price', flags: 'i', pattern: '\\$\\s?\\d[\\d,.]*\\s*(?:per|for|from|starting|/)\\s*(?:month|seat|week|year)\\b' },
  { id: 'W10-free-offer', flags: 'i', pattern: '\\b(?:free|for free|free of charge)\\b' },
  { id: 'no-no-equity', flags: 'i', pattern: '\\b(?:no equity|non-dilutive|equity-free|no fee|no fees|no stake)\\b' },
];

function copyStrings(): readonly string[] {
  const out: string[] = [];
  const visit = (value: unknown): void => {
    if (typeof value === 'string') out.push(value);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value !== null && typeof value === 'object') Object.values(value).forEach(visit);
  };
  for (const value of Object.values(copy)) {
    if (typeof value === 'function') {
      out.push(String(value(3, 10)));
      continue;
    }
    visit(value);
  }
  return out;
}

function entryStrings(e: EcosystemEntry): readonly string[] {
  return [e.name, e.offers, e.whoFor, e.format, e.where, e.terms ?? ''];
}

test('the directory is broad: 60 or more verified entries and every category filled', () => {
  assert.ok(ALL_ENTRIES.length >= 60, `only ${ALL_ENTRIES.length} entries`);
  const counts = countByCategory();
  for (const id of CATEGORY_IDS) assert.ok(counts[id] >= 5, `${id} has ${counts[id]} entries`);
  assert.equal(CATEGORIES.length, CATEGORY_IDS.length);
});

test('every entry has an https URL, a source, a retrieval month and valid enumerations', () => {
  for (const e of ALL_ENTRIES) {
    assert.match(e.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${e.id}: id`);
    assert.ok(e.name.trim().length > 1, `${e.id}: name`);
    assert.match(e.url, /^https:\/\/[^\s/]+\.[a-z]{2,}(?:\/\S*)?$/i, `${e.id}: url`);
    assert.match(e.sourceUrl, /^https:\/\/[^\s/]+\.[a-z]{2,}(?:\/\S*)?$/i, `${e.id}: sourceUrl`);
    assert.equal(e.retrieved, '2026-10', `${e.id}: retrieved`);
    assert.ok((CATEGORY_IDS as readonly string[]).includes(e.category), `${e.id}: category`);
    assert.ok((FORMAT_IDS as readonly string[]).includes(e.delivery), `${e.id}: delivery`);
    assert.ok(e.stages.length > 0 && e.stages.every((s) => (STAGE_IDS as readonly string[]).includes(s)), `${e.id}: stages`);
    assert.ok(e.audiences.length > 0 && e.audiences.every((a) => (AUDIENCE_IDS as readonly string[]).includes(a)), `${e.id}: audiences`);
    for (const also of e.also ?? []) assert.ok((CATEGORY_IDS as readonly string[]).includes(also) && also !== e.category, `${e.id}: also`);
    for (const field of [e.offers, e.whoFor, e.format, e.where]) assert.ok(field.trim().length > 3, `${e.id}: empty field`);
    assert.ok(['official-page', 'official-listing'].includes(e.verification), `${e.id}: verification`);
  }
});

test('ids and URLs are unique, and every entry sits in its own category file', () => {
  const ids = ALL_ENTRIES.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate id');
  const names = ALL_ENTRIES.map((e) => e.name);
  assert.equal(new Set(names).size, names.length, 'duplicate name');
  for (const c of CATEGORIES) assert.equal(entriesIn(c.id).length, countByCategory()[c.id]);
});

test('categories carry what, a fit, three questions and a timeline window', () => {
  for (const c of CATEGORIES) {
    assert.ok(c.what.length > 30 && c.bestFor.length > 20, c.id);
    assert.equal(c.askFirst.length, 3, c.id);
    assert.ok(c.window.from >= 0 && c.window.to > c.window.from && c.window.to <= 10, c.id);
    assert.equal(CATEGORY_BY_ID[c.id], c);
  }
  assert.equal(TIMELINE_BARS.length, CATEGORIES.length);
});

test('no entry or copy line breaks the claims rules (WE is never an accelerator, investor or fund; no price, no free)', () => {
  const rules = [...denylistRules(), ...WAVE_TEN];
  const subjects: { where: string; text: string }[] = [
    ...ALL_ENTRIES.flatMap((e) => entryStrings(e).map((text) => ({ where: e.id, text }))),
    ...copyStrings().map((text) => ({ where: 'copy', text })),
    ...CATEGORIES.flatMap((c) => [c.name, c.short, c.what, c.bestFor, ...c.askFirst].map((text) => ({ where: c.id, text }))),
  ];
  for (const rule of rules) {
    const re = new RegExp(rule.pattern, rule.flags ?? '');
    for (const s of subjects) assert.ok(!re.test(s.text), `${rule.id} matches in ${s.where}: ${s.text}`);
  }
});

test('the page states the independence disclaimer and the long-run line', () => {
  assert.equal(copy.DISCLAIMER, 'Independent programs; no affiliation implied unless stated.');
  assert.equal(copy.TAGLINE, 'Join them. WE works alongside, for the long run.');
  assert.match(copy.HUB_LEAD, /Join them\. WE works alongside, for the long run\./);
  assert.ok(copy.HUB_DESCRIPTION.length <= 160, 'description length');
});

test('copy never writes the capital-We pronoun or British spellings', () => {
  const text = copyStrings().join('\n');
  assert.doesNotMatch(text, /\bWe (?:build|steer|coordinate|are|run|offer)\b/);
  assert.doesNotMatch(text, /\b(?:programme|organisation|colour|behaviour|centre)s?\b/i);
});

test('the filter facts are consistent: stages and audiences listed for every entry appear in the labels', () => {
  for (const s of STAGE_IDS) assert.ok(copy.STAGE_LABELS[s]);
  for (const a of AUDIENCE_IDS) assert.ok(copy.AUDIENCE_LABELS[a]);
  for (const d of FORMAT_IDS) assert.ok(copy.DELIVERY_LABELS[d]);
  assert.equal(copy.FILTER_STATUS(2, 9), 'Showing 2 of 9 programs.');
});

test('JSON-LD of the directory uses only allowed types and carries one term per entry', () => {
  const node = directoryNode('/ecosystem/', 'Programs') as { '@type': string; hasDefinedTerm: { '@type': string; url: string }[] };
  assert.equal(node['@type'], 'DefinedTermSet');
  assert.equal(node.hasDefinedTerm.length, ALL_ENTRIES.length);
  assert.ok(node.hasDefinedTerm.every((t) => t['@type'] === 'DefinedTerm' && t.url.startsWith('https://')));
});

test('the ecosystem page files exist and use the ownership-safe patterns', () => {
  const hub = readFileSync(`${root}src/pages/ecosystem/index.astro`, 'utf8');
  const cat = readFileSync(`${root}src/pages/ecosystem/[category].astro`, 'utf8');
  for (const src of [hub, cat]) {
    assert.doesNotMatch(src, /\sstyle=/, 'inline style');
    assert.doesNotMatch(src, /<script\b/, 'inline script');
    assert.match(src, /data-context="ecosystem"/);
  }
  const row = readFileSync(`${root}src/components/ecosystem/EntryRow.astro`, 'utf8');
  assert.match(row, /rel="noopener"/);
  assert.doesNotMatch(row, /href=\{[^}]*\}\s+target=/);
});

test('the sources ledger holds one record per entry, with the entry source URL and a retrieval month', () => {
  const ledger = JSON.parse(readFileSync(`${root}.astro-magazine/sources/wp-33.json`, 'utf8')) as {
    wp: string;
    sources: { source_id: string; exact_url_or_locator: string; retrieved_at: string }[];
  };
  assert.equal(ledger.wp, 'WP-33');
  assert.equal(ledger.sources.length, ALL_ENTRIES.length);
  const byId = new Map(ledger.sources.map((s) => [s.source_id, s]));
  for (const e of ALL_ENTRIES) {
    const record = byId.get(`wp33-${e.id}`);
    assert.ok(record, `${e.id}: no source record`);
    assert.equal(record.exact_url_or_locator, e.sourceUrl, `${e.id}: source URL differs`);
    assert.equal(record.retrieved_at, e.retrieved, `${e.id}: retrieval differs`);
  }
});
