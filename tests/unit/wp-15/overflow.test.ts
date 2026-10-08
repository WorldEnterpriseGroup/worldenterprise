import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const ROOT = new URL('../../../', import.meta.url).pathname;

function rule(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `${selector} rule not found`);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') depth -= 1;
    if (depth === 0) return css.slice(open + 1, i);
  }
  throw new Error(`${selector} rule is not closed`);
}

test('.table-wrap is the containing block for .visually-hidden spans in cells (the /trust/ 390px overflow)', () => {
  const css = readFileSync(`${ROOT}src/styles/components.css`, 'utf8');
  const body = rule(css, '.table-wrap');
  assert.match(body, /position:\s*relative/, 'an absolutely positioned child of a cell must not escape the scroll container');
  assert.match(body, /overflow-x:\s*auto/);
});

test('.visually-hidden stays absolutely positioned, so its containing block decides where it lands', () => {
  const css = readFileSync(`${ROOT}src/styles/utilities.css`, 'utf8');
  assert.match(rule(css, '.visually-hidden'), /position:\s*absolute/);
});
