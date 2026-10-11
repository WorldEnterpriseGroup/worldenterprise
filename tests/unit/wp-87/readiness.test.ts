import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { collectGaps, parseAlsoRead } from '../../../src/components/islands/we-readiness-check/logic.ts';
import { ALSO_READ, readinessStatements } from '../../../src/components/islands/we-readiness-check/statements.ts';
import { routes } from '../../../src/data/routes.ts';

/**
 * The readiness check grows by links only (decision W8-28): the twelve statements keep their ids and their wording, the gap shape is the
 * one WP-04 pinned, and the extra reading is a separate map keyed by statement id whose every target is a route that is live.
 */
const fixture = JSON.parse(readFileSync(new URL('./fixtures/readiness-statements.json', import.meta.url), 'utf8')) as typeof readinessStatements;
const live = new Set(routes.filter((row) => row.launch).map((row) => row.path));

test('the twelve statements are exactly what they were before WP-87, in the same order', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(readinessStatements)), fixture);
  assert.equal(readinessStatements.length, 12);
});

test('every key of ALSO_READ is a statement id, and no entry repeats the first place to start', () => {
  const ids = new Map(readinessStatements.map((s) => [s.id, s]));
  for (const [id, links] of Object.entries(ALSO_READ)) {
    const statement = ids.get(id);
    assert.ok(statement !== undefined, `${id} is not a statement`);
    assert.ok(links.length >= 1 && links.length <= 3, `${id} has ${links.length} links`);
    const hrefs = links.map((l) => l.href);
    assert.equal(new Set(hrefs).size, hrefs.length, `${id} repeats a link`);
    assert.ok(!hrefs.includes(statement.gapHref), `${id} repeats its first place to start`);
  }
});

test('every ALSO_READ target is a live route, so no gap shows a dead link, and titles are plain words', () => {
  for (const [id, links] of Object.entries(ALSO_READ)) {
    for (const link of links) {
      assert.ok(live.has(link.href), `${id} links to ${link.href}, which is not live`);
      assert.ok(link.title.length > 0 && !/[!%$]|\d/.test(link.title), `${id}: title "${link.title}" has a figure or a mark`);
    }
  }
});

test('the new guides and templates are reachable from the readiness check', () => {
  const targets = new Set(Object.values(ALSO_READ).flatMap((links) => links.map((l) => l.href)));
  for (const path of [
    '/fundability/customer-interview-synthesis/',
    '/fundability/pricing-experiments/',
    '/fundability/security-questionnaire-answers/',
    '/fundability/term-sheet-checklist/',
    '/library/interview-synthesis-sheet/',
    '/library/outreach-sequence-worksheet/',
  ]) {
    assert.ok(targets.has(path), `${path} is not linked from the readiness check`);
  }
});

test('the gap shape is unchanged: id, title and href only', () => {
  const sources = readinessStatements.map((s) => ({ id: s.id, title: s.gapTitle, href: s.gapHref }));
  const gaps = collectGaps(sources, new Set(['problem-stated']));
  assert.equal(gaps.length, 11);
  assert.deepEqual(Object.keys(gaps[0] ?? {}).sort(), ['href', 'id', 'title']);
});

test('parseAlsoRead reads a well-formed attribute', () => {
  const raw = JSON.stringify([{ title: 'Guide: one', href: '/fundability/data-room/' }, { title: 'Tool: two', href: '/tools/evidence-room/' }]);
  assert.deepEqual(parseAlsoRead(raw), [
    { title: 'Guide: one', href: '/fundability/data-room/' },
    { title: 'Tool: two', href: '/tools/evidence-room/' },
  ]);
});

test('parseAlsoRead returns nothing for a missing or empty attribute, and never throws on a malformed one', () => {
  assert.deepEqual(parseAlsoRead(undefined), []);
  assert.deepEqual(parseAlsoRead(''), []);
  assert.deepEqual(parseAlsoRead('{"title":"x"}'), []);
  assert.deepEqual(parseAlsoRead('null'), []);
  const originalError = console.error;
  const logged: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    logged.push(args);
  };
  try {
    assert.deepEqual(parseAlsoRead('{not json'), []);
  } finally {
    console.error = originalError;
  }
  assert.equal(logged.length, 1, 'invalid JSON is reported once, not swallowed');
});

test('parseAlsoRead drops an item that is not a title and a site path, and keeps the rest', () => {
  const raw = JSON.stringify([
    { title: 'Kept', href: '/library/decision-log/' },
    { title: '', href: '/library/decision-log/' },
    { title: 'External', href: 'https://example.com/' },
    { title: 'No href' },
    { href: '/library/decision-log/' },
    'text',
    null,
    { title: 3, href: '/x/' },
  ]);
  assert.deepEqual(parseAlsoRead(raw), [{ title: 'Kept', href: '/library/decision-log/' }]);
});
