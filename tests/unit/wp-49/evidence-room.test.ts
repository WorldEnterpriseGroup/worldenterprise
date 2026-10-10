import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  EVIDENCE_GROUPS,
  EVIDENCE_ITEMS,
  GROUP_IDS,
  STAGE_FILTERS,
  STAGE_ORDER,
  isShownAt,
  itemByCode,
  itemsInGroup,
  stageName,
} from '../../../src/components/islands/we-evidence-room/items.ts';
import { readinessStatements } from '../../../src/components/islands/we-readiness-check/statements.ts';
import { EMPTY_STATE, isStateHash, normaliseDone, parseState, progress, progressText, serializeState, toMarkdown, visibleItems } from '../../../src/scripts/evidence-room.ts';
import type { RoomState } from '../../../src/scripts/evidence-room.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const GUIDE = readFileSync(join(root, 'src/content/guides/data-room.mdx'), 'utf8').toLowerCase();
const SCRIPT = readFileSync(join(root, 'src/scripts/evidence-room.ts'), 'utf8');

test('every item has a unique short code, a group that exists and a stage the filter offers', () => {
  const codes = EVIDENCE_ITEMS.map((item) => item.code);
  assert.equal(new Set(codes).size, codes.length, 'codes are unique');
  for (const item of EVIDENCE_ITEMS) {
    assert.match(item.code, /^[a-z0-9]{2,3}$/, item.code);
    assert.ok(GROUP_IDS.includes(item.group), item.code);
    assert.ok(STAGE_ORDER.includes(item.stage), item.code);
    assert.ok(item.label.length > 0 && item.label.length <= 80, item.code);
  }
  assert.deepEqual(EVIDENCE_GROUPS.map((group) => group.id), [...GROUP_IDS]);
  for (const group of EVIDENCE_GROUPS) assert.ok(itemsInGroup(group.id).length > 0, `${group.id} is empty`);
});

test('every folder item names a phrase that is in the data room guide', () => {
  for (const item of EVIDENCE_ITEMS.filter((i) => i.group !== 'readiness')) {
    assert.ok(GUIDE.includes(item.source.toLowerCase()), `${item.code}: "${item.source}" is not in the guide`);
  }
});

test('the folder groups are the nine folders of the guide, in order, with the guide sentence for what each shows', () => {
  const folders = EVIDENCE_GROUPS.filter((group) => group.origin === 'data-room');
  assert.equal(folders.length, 9);
  folders.forEach((group, index) => {
    assert.ok(group.title.startsWith(`${index + 1}. `), group.title);
    assert.ok(GUIDE.includes(`['${group.title.toLowerCase()}',`), `${group.title} is not a folder in the guide`);
    const shows = group.intro.replace(/^What it shows: /, '');
    assert.ok(GUIDE.includes(shows.toLowerCase()), `"${shows}" is not in the guide`);
  });
});

test('the readiness group is the twelve statements, with the artifact and the gap link each one names', () => {
  const items = itemsInGroup('readiness');
  assert.equal(items.length, readinessStatements.length);
  items.forEach((item, index) => {
    const statement = readinessStatements[index];
    assert.ok(statement);
    assert.equal(item.label, statement.artifact);
    assert.equal(item.backs, statement.statement);
    assert.equal(item.gapHref, statement.gapHref);
    assert.equal(item.gapTitle, statement.gapTitle);
  });
});

test('a stage shows its own items and every earlier stage, and all shows everything', () => {
  const counts = STAGE_FILTERS.map((stage) => visibleItems(stage).length);
  assert.equal(counts[0], EVIDENCE_ITEMS.length);
  assert.ok(counts[1] !== undefined && counts[2] !== undefined && counts[3] !== undefined);
  assert.ok(counts[1] < counts[2] && counts[2] < counts[3] && counts[3] === EVIDENCE_ITEMS.length, `counts: ${counts.join(', ')}`);
  const idea = itemByCode('1a');
  const late = itemByCode('9a');
  assert.ok(idea && late);
  assert.equal(isShownAt(idea, 'idea-or-prototype'), true);
  assert.equal(isShownAt(late, 'idea-or-prototype'), false);
  assert.equal(isShownAt(late, 'first-product'), false);
  assert.equal(isShownAt(late, 'early-customer-evidence'), true);
  assert.equal(stageName('all'), 'All items');
  assert.equal(stageName('first-product'), 'First product');
});

test('the state round trips through the hash, in checklist order and without duplicates', () => {
  const state: RoomState = { stage: 'first-product', done: ['r3', '1b', '1a', '1a'] };
  const hash = serializeState(state);
  assert.equal(hash, '#stage=first-product&done=1a.1b.r3');
  assert.deepEqual(parseState(hash), { stage: 'first-product', done: ['1a', '1b', 'r3'] });
  assert.equal(serializeState(EMPTY_STATE), '');
  assert.equal(serializeState({ stage: 'all', done: [] }), '');
  assert.equal(serializeState({ stage: 'idea-or-prototype', done: [] }), '#stage=idea-or-prototype');
  assert.equal(serializeState({ stage: 'all', done: ['2a'] }), '#done=2a');
  const every: RoomState = { stage: 'all', done: EVIDENCE_ITEMS.map((item) => item.code) };
  assert.deepEqual(parseState(serializeState(every)), every);
  assert.ok(serializeState(every).length < 400, 'every item ticked still gives a short address');
});

test('a hash that is not valid is read as far as it can be and never throws', () => {
  assert.deepEqual(parseState(''), EMPTY_STATE);
  assert.deepEqual(parseState('#main'), EMPTY_STATE);
  assert.deepEqual(parseState('#stage=nonsense&done=1a'), { stage: 'all', done: ['1a'] });
  assert.deepEqual(parseState('#done=1a.zz.9z..1B.%E0%A4%A'), EMPTY_STATE);
  assert.deepEqual(parseState('#done=1a.zz.9z..1B&stage=FIRST-PRODUCT'), { stage: 'first-product', done: ['1a', '1b'] });
  assert.deepEqual(parseState('#&&=&stage&done'), EMPTY_STATE);
  assert.deepEqual(parseState(`#done=${'1a.'.repeat(5000)}`), { stage: 'all', done: ['1a'] });
  assert.deepEqual(parseState('#done=__proto__.constructor.1a'), { stage: 'all', done: ['1a'] });
});

test('only a hash this page wrote counts as state, so an in-page anchor does not clear the ticks', () => {
  assert.equal(isStateHash('#stage=first-product'), true);
  assert.equal(isStateHash('#done=1a'), true);
  assert.equal(isStateHash('#stage=first-product&done=1a'), true);
  assert.equal(isStateHash('#main'), false);
  assert.equal(isStateHash(''), false);
  assert.equal(isStateHash('#xdone=1a'), false);
});

test('normaliseDone drops unknown codes', () => {
  assert.deepEqual(normaliseDone(['nope', '2a', '1a', '']), ['1a', '2a']);
});

test('progress counts only what the stage shows, and keeps ticks on hidden items', () => {
  const state: RoomState = { stage: 'idea-or-prototype', done: ['1a', '9a'] };
  const { checked, total } = progress(state);
  assert.equal(checked, 1);
  assert.equal(total, visibleItems('idea-or-prototype').length);
  assert.equal(progressText({ checked: 1, total: 1 }), '1 of 1 item checked.');
  assert.equal(progressText({ checked: 0, total: 12 }), '0 of 12 items checked.');
  assert.deepEqual(parseState(serializeState(state)).done, ['1a', '9a']);
});

test('the Markdown copy lists the shown items as task lists with the ticks, and says WE promises no funding', () => {
  const md = toMarkdown({ stage: 'idea-or-prototype', done: ['1a', '9a'] });
  assert.match(md, /^# Evidence room checklist\n/);
  assert.match(md, /Showing: Idea or prototype and earlier stages\./);
  assert.match(md, /- \[x\] Formation documents\n/);
  assert.match(md, /- \[ \] Founder agreements\n/);
  assert.doesNotMatch(md, /Your dated investor updates/, 'items the stage hides are left out');
  assert.doesNotMatch(md, /## 9\. Updates/, 'a folder with nothing shown is left out');
  assert.match(md, /WE makes no promise of funding\.\n$/);
  const all = toMarkdown(EMPTY_STATE);
  assert.match(all, /Showing: All items\./);
  assert.equal((all.match(/^- \[[ x]\] /gm) ?? []).length, EVIDENCE_ITEMS.length);
});

test('the script keeps state in the address only: no storage, no cookie, no request', () => {
  const code = SCRIPT.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const banned of [/localStorage/, /sessionStorage/, /indexedDB/, /document\.cookie/, /\bfetch\(/, /XMLHttpRequest/, /sendBeacon/, /WebSocket/, /EventSource/]) {
    assert.doesNotMatch(code, banned);
  }
});
