import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collectGaps } from '../../../src/components/islands/we-readiness-check/logic.ts';
import { READINESS_GROUPS, readinessStatements } from '../../../src/components/islands/we-readiness-check/statements.ts';
import { routes } from '../../../src/data/routes.ts';

const sources = readinessStatements.map((s) => ({ id: s.id, title: s.gapTitle, href: s.gapHref }));

test('there are exactly twelve statements with unique ids', () => {
  assert.equal(readinessStatements.length, 12);
  assert.equal(new Set(readinessStatements.map((s) => s.id)).size, 12);
});

test('every statement belongs to a declared group and every group is used', () => {
  const groups = Object.keys(READINESS_GROUPS);
  for (const s of readinessStatements) assert.ok(groups.includes(s.group), s.id);
  for (const g of groups) assert.ok(readinessStatements.some((s) => s.group === g), g);
});

test('every gap link is a route in the ledger', () => {
  const ledger = new Set(routes.map((r) => r.path));
  for (const s of readinessStatements) {
    const path = s.gapHref.split('#')[0] ?? s.gapHref;
    assert.ok(ledger.has(path), `${s.id} links to ${s.gapHref}, which is not in the route ledger`);
  }
});

test('statements are first-person, one sentence, and never promise an outcome', () => {
  for (const s of readinessStatements) {
    assert.match(s.statement, /^(I |A |Everyone |My |The )/, s.id);
    assert.doesNotMatch(s.statement, /guarantee|fund(ed|ing) is|will raise|score/i, s.id);
  }
});

test('collectGaps returns only unconfirmed statements, in order', () => {
  const confirmed = new Set(['problem-stated', 'update-habit']);
  const gaps = collectGaps(sources, confirmed);
  assert.equal(gaps.length, 10);
  assert.ok(gaps.every((g) => !confirmed.has(g.id)));
  assert.deepEqual(gaps.map((g) => g.id), sources.filter((s) => !confirmed.has(s.id)).map((s) => s.id));
});

test('collectGaps with everything confirmed returns no gaps, and with nothing confirmed returns all twelve', () => {
  assert.deepEqual(collectGaps(sources, new Set(sources.map((s) => s.id))), []);
  assert.equal(collectGaps(sources, new Set()).length, 12);
});

test('a gap carries only an id, a title and a link: no score, count or percentage', () => {
  for (const gap of collectGaps(sources, new Set())) {
    assert.deepEqual(Object.keys(gap).sort(), ['href', 'id', 'title']);
  }
});

test('unknown confirmed ids are ignored', () => {
  assert.equal(collectGaps(sources, new Set(['not-a-statement'])).length, 12);
});
