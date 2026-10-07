import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { CLAIM_IDS, isClaimUsable } from '../../../src/data/claims.ts';
import type { ClaimId } from '../../../src/data/claims.ts';

interface Row {
  id: string;
  group: string;
  draft?: boolean;
  claimsUsed?: string[];
  related?: string[];
  question?: string;
  answer?: string;
  term?: string;
  definition?: string;
}

/** Minimal reader for the flat YAML lists in src/data (no dependency needed). */
function parse(file: string): Row[] {
  const rows: Row[] = [];
  let current: Record<string, unknown> | null = null;
  for (const line of readFileSync(new URL(`../../../src/data/${file}`, import.meta.url), 'utf8').split('\n')) {
    if (line.startsWith('#') || line.trim() === '') continue;
    const start = /^- (\w+):\s*(.*)$/.exec(line);
    const field = /^ {2}(\w+):\s*(.*)$/.exec(line);
    const match = start ?? field;
    if (match === null) throw new Error(`Unrecognised YAML line in ${file}: ${line}`);
    if (start !== null) {
      current = {};
      rows.push(current as unknown as Row);
    }
    if (current === null) throw new Error('Field before first row');
    const key = match[1] ?? '';
    const raw = (match[2] ?? '').trim();
    if (raw.startsWith('[')) current[key] = raw.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
    else if (raw === 'true') current[key] = true;
    else if (raw.startsWith('"')) current[key] = JSON.parse(raw) as string;
    else current[key] = raw;
  }
  return rows;
}

const faq = parse('faq.yaml').filter((r) => r.draft !== true);
const glossary = parse('glossary.yaml').filter((r) => r.draft !== true);

test('FAQ has the 16 seeded entries with unique ids', () => {
  assert.equal(faq.length, 16);
  assert.equal(new Set(faq.map((r) => r.id)).size, 16);
});

test('glossary has 40 terms with unique ids', () => {
  assert.equal(glossary.length, 40);
  assert.equal(new Set(glossary.map((r) => r.id)).size, 40);
});

test('every cited claim exists and is usable', () => {
  for (const row of [...faq, ...glossary]) {
    for (const id of row.claimsUsed ?? []) {
      assert.ok((CLAIM_IDS as readonly string[]).includes(id), `${row.id} cites unknown claim ${id}`);
      assert.ok(isClaimUsable(id as ClaimId), `${row.id} cites unusable claim ${id}`);
    }
  }
});

test('related ids resolve inside their own list', () => {
  for (const list of [faq, glossary]) {
    const ids = new Set(list.map((r) => r.id));
    for (const row of list) for (const rel of row.related ?? []) assert.ok(ids.has(rel), `${row.id} relates to missing ${rel}`);
  }
});

test('copy never matches the claims denylist', () => {
  const deny = JSON.parse(readFileSync(new URL('../../../claims-denylist.json', import.meta.url), 'utf8')) as {
    rules: { id: string; pattern: string; flags?: string }[];
  };
  for (const row of [...faq, ...glossary]) {
    const text = [row.question, row.answer, row.term, row.definition].filter(Boolean).join(' ');
    for (const rule of deny.rules) assert.equal(new RegExp(rule.pattern, rule.flags ?? '').test(text), false, `${row.id} matches ${rule.id}`);
  }
});

test('FAQ answers do not promise funding or name controls', () => {
  const funding = faq.find((r) => r.id === 'promise-funding');
  assert.match(funding?.answer ?? '', /no promise of funding/i);
  for (const row of faq) assert.doesNotMatch(row.answer ?? '', /guarantee|certified|premier/i);
});
