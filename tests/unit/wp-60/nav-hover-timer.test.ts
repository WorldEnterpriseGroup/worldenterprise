import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// src/scripts/nav.ts arms a hover-intent timer on pointerenter. A panel the user opens or closes while it is pending must cancel it, or the
// timer reopens the panel that Escape had just closed. The behaviour is checked in tests/e2e/wave8/wp-60/nav-hover-escape.spec.ts with a fake
// clock; these tests keep the cancel calls in the three places that need them.

const source = readFileSync(new URL('../../../src/scripts/nav.ts', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

/** The text of the handler registered as `<target>.addEventListener('<event>', ...)`, up to the first line that closes it at the same indent. */
function handler(target: string, event: string): string {
  const open = new RegExp(`^( *)${target}\\.addEventListener\\('${event}', \\(e?\\) => \\{\\n`, 'm').exec(source);
  assert.ok(open, `${target} has a ${event} handler`);
  const indent = open[1] ?? '';
  const from = open.index + open[0].length;
  const end = source.indexOf(`\n${indent}});`, from);
  assert.ok(end > from, `the ${event} handler of ${target} ends`);
  return source.slice(from, end);
}

const CANCEL = /window\.clearTimeout\(hoverTimer\)/;

test('every open and close of a panel cancels the pending hover timer', () => {
  assert.match(handler('panel', 'beforetoggle'), CANCEL, 'beforetoggle runs synchronously with the change, before a timer due in between can fire');
});

test('a click on the trigger cancels the pending hover timer', () => {
  assert.match(handler('t', 'click'), CANCEL);
});

test('Escape cancels the pending hover timer even when no panel was open', () => {
  const body = handler('document', 'keydown');
  assert.match(body, /e\.key === 'Escape'/);
  assert.match(body, CANCEL);
});

test('only pointerenter arms the hover timer', () => {
  const arms = [...source.matchAll(/hoverTimer = window\.setTimeout/g)];
  assert.equal(arms.length, 1, 'one place arms it');
  assert.match(handler('t', 'pointerenter'), /hoverTimer = window\.setTimeout/);
});
