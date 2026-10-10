import assert from 'node:assert/strict';
import test from 'node:test';
import { CHECKS, CHECK_IDS, PAGE, RESULT_IDS, isCheckId } from '../../../src/components/islands/we-pricing-checker/spec.ts';
import { check, waitingText } from '../../../src/scripts/pricing-checker.ts';
import { read } from './surfaces.ts';

const present = (ticked: readonly string[]) => check(ticked).results.find((r) => r.id === 'present');
const open = (ticked: readonly string[]) => check(ticked).results.find((r) => r.id === 'open');

test('the statements are the eight of the launch checklist, in the article order, with unique ids', () => {
  assert.equal(CHECKS.length, 8);
  assert.deepEqual(CHECKS.map((c) => c.id), [...CHECK_IDS]);
  assert.equal(new Set(CHECK_IDS).size, CHECK_IDS.length);
  const article = read('src/content/insights/grow/pricing-page-fundamentals-for-a-first-saas.md');
  const checklist = article.slice(article.indexOf('## A launch checklist for the page'));
  let cursor = 0;
  for (const item of CHECKS) {
    const at = checklist.indexOf(item.text, cursor);
    assert.ok(at >= 0, `not in the article's checklist, or out of order: ${item.text}`);
    cursor = at;
  }
  assert.match(PAGE.lead, /^Eight statements/);
});

test('nothing ticked is two waiting results and no count', () => {
  const outcome = check([]);
  assert.equal(outcome.marked, 0);
  assert.deepEqual(outcome.results.map((r) => [r.id, r.status, r.display, r.detail]), [
    ['present', 'waiting', 'Waiting', 'Tick a statement to see this.'],
    ['open', 'waiting', 'Waiting', 'Tick a statement to see this.'],
  ]);
  assert.deepEqual(waitingText(), { display: 'Waiting', detail: 'Tick a statement to see this.' });
});

test('the count is the number ticked out of the list, and the open numbers are the rest, in list order', () => {
  const some = check(['audience', 'edge', 'person']);
  assert.equal(some.marked, 3);
  assert.deepEqual(some.openNumbers, [2, 3, 5, 6, 8]);
  assert.equal(present(['audience', 'edge', 'person'])?.display, '3 of 8');
  assert.equal(present(['audience', 'edge', 'person'])?.detail, 'You marked 3 of the 8 statements true of your page. This is a count, not a score.');
  assert.equal(open(['audience', 'edge', 'person'])?.display, '5 of 8');
  assert.equal(open(['audience', 'edge', 'person'])?.detail, 'Not yet marked, by numbers in the list: 2, 3, 5, 6, 8.');
});

test('one statement left is described in the singular', () => {
  const nearly = CHECK_IDS.filter((id) => id !== 'unit');
  assert.equal(open(nearly)?.display, '1 of 8');
  assert.equal(open(nearly)?.detail, 'Not yet marked, by number in the list: 2.');
});

test('every statement ticked is stated plainly and is not a pass', () => {
  const all = check(CHECK_IDS);
  assert.equal(all.marked, 8);
  assert.deepEqual(all.openNumbers, []);
  assert.equal(present(CHECK_IDS)?.display, '8 of 8');
  assert.equal(open(CHECK_IDS)?.display, '0 of 8');
  assert.equal(open(CHECK_IDS)?.detail, 'Every statement is marked true. That says the page has each item, not that it works for your buyers.');
});

test('an unknown id is ignored and a repeated id counts once, so the count never passes the list', () => {
  assert.equal(check(['audience', 'audience', 'audience']).marked, 1);
  assert.equal(check(['nope', '', '__proto__', 'constructor']).marked, 0);
  assert.equal(check([...CHECK_IDS, ...CHECK_IDS, 'extra']).marked, 8);
  assert.equal(isCheckId('unit'), true);
  assert.equal(isCheckId('toString'), false);
});

test('the same ticks in any order give the same outcome', () => {
  assert.deepEqual(check(['person', 'audience', 'table']), check(['table', 'person', 'audience']));
});

test('no result is a score, a percent, a grade or a ranking, whatever is ticked', () => {
  for (let mask = 0; mask < 1 << CHECK_IDS.length; mask += 1) {
    const ticked = CHECK_IDS.filter((_, index) => (mask & (1 << index)) !== 0);
    const text = check(ticked).results.flatMap((r) => [r.display, r.detail]).join(' | ');
    assert.doesNotMatch(text, /%|percent|\bscore of\b|\bgrade\b|\brank|NaN|Infinity|undefined|null/i, text.replace(/ \| /g, ' / '));
    for (const r of check(ticked).results) assert.ok(RESULT_IDS.includes(r.id));
  }
});
