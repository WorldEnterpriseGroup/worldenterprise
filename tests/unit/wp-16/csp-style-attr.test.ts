import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import { buildCsp } from '../../../src/lib/csp.ts';
import { STAGES } from '../../../src/components/program/stages.ts';

// WP-16, EX-CSP-STYLE-ATTR. The policy no longer allows style attributes (style-src-attr 'unsafe-inline' is gone), so a style attribute in
// markup is silently dropped by the browser and the layout it carried breaks. These tests keep the markup free of them and keep the
// modifier classes that replaced them in step with the components that emit them.

const ROOT = new URL('../../../', import.meta.url).pathname;
const read = (path: string): string => readFileSync(`${ROOT}${path}`, 'utf8');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(`${ROOT}${dir}`)) {
    const path = `${dir}/${name}`;
    if (statSync(`${ROOT}${path}`).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

const sources = walk('src').filter((path) => /\.(astro|ts|md|mdx)$/.test(path));

/** Source with the contents of <style> blocks removed: a stylesheet may mention the word, markup may not. */
const withoutStyleBlocks = (text: string): string => text.replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, '');

test('the policy has no unsafe-inline for styles, so style attributes are blocked', () => {
  const csp = buildCsp([]);
  assert.ok(!JSON.stringify(csp).includes('unsafe-inline'));
  assert.deepEqual(csp.styleDirective?.resources, [{ resource: "'self'", kind: 'element' }]);
});

test('no source writes a style attribute: not in markup, not through setAttribute, not as cssText', () => {
  const failures: string[] = [];
  for (const path of sources) {
    const text = withoutStyleBlocks(read(path));
    if (/\sstyle=["'{\\]/.test(text)) failures.push(`${path}: style attribute in markup or a string`);
    if (/setAttribute\(\s*['"]style['"]/.test(text)) failures.push(`${path}: setAttribute('style')`);
    if (/\.style\.cssText\b/.test(text)) failures.push(`${path}: style.cssText`);
  }
  assert.deepEqual(failures, []);
});

test('script-set styles use the CSSOM, which style-src-attr does not govern', () => {
  const nav = read('src/scripts/nav.ts');
  assert.match(nav, /style\.setProperty\('--panel-top'/);
});

test('Grid maps each min value to a class, every class has a rule, and every call site uses a mapped value', () => {
  const component = read('src/components/ui/Grid.astro');
  const mapped = [...component.matchAll(/'(\d+)rem':\s*'grid--min-(\d+)'/g)].map((m) => ({ rem: m[1], cls: m[2] }));
  assert.ok(mapped.length >= 6, 'the map lists the values in use');
  for (const { rem, cls } of mapped) assert.equal(rem, cls, `'${rem}rem' maps to grid--min-${rem}`);

  const css = read('src/styles/layout.css');
  const ruled = [...css.matchAll(/\.grid--min-(\d+)\s*\{\s*--grid-min:\s*(\d+)rem;\s*\}/g)].map((m) => ({ cls: m[1], rem: m[2] }));
  for (const { cls, rem } of ruled) assert.equal(cls, rem, `.grid--min-${cls} sets ${cls}rem`);
  assert.deepEqual(ruled.map((r) => r.cls).sort(), mapped.map((m) => m.cls).sort(), 'Grid.astro and layout.css list the same values');

  const known = new Set(mapped.map((m) => `${m.rem}rem`));
  const failures: string[] = [];
  for (const path of sources.filter((p) => p.endsWith('.astro'))) {
    const text = withoutStyleBlocks(read(path));
    for (const call of text.matchAll(/<Grid\b[^>]*>/g)) {
      const min = /\smin="([^"]+)"/.exec(call[0])?.[1];
      if (min !== undefined && !known.has(min)) failures.push(`${path}: <Grid min="${min}"> has no class`);
      if (/\sgap=/.test(call[0])) failures.push(`${path}: <Grid gap> is gone, set the gap in CSS`);
    }
    for (const match of text.matchAll(/\bgrid--min-(\d+)\b/g)) {
      if (!ruled.some((r) => r.cls === match[1])) failures.push(`${path}: grid--min-${match[1]} has no rule`);
    }
  }
  assert.deepEqual(failures, []);
});

test('the stack, hex and altitude modifier classes exist where their components expect them', () => {
  const layout = read('src/styles/layout.css');
  assert.match(layout, /\.stack--tight\s*\{\s*--stack-gap:\s*var\(--sp-2\);\s*\}/);
  assert.match(layout, /\.stack--loose\s*\{\s*--stack-gap:\s*var\(--sp-7\);\s*\}/);
  assert.match(read('src/components/ui/Stack.astro'), /gap\?: 'tight' \| 'loose'/);

  const components = read('src/styles/components.css');
  assert.match(components, /\.hex--sm\s*\{\s*--hex-size:\s*2\.5rem;\s*\}/);
  assert.match(components, /\.hex--lg\s*\{\s*--hex-size:\s*5rem;\s*\}/);
  assert.match(read('src/components/ui/Hex.astro'), /size\?: 'sm' \| 'md' \| 'lg'/);
});

test('every stage of the altitude diagram has a rise class', () => {
  const diagram = read('src/components/program/AltitudeDiagram.astro');
  const rises = [...diagram.matchAll(/\.altitude__step--rise-(\d+)\s*\{\s*--rise:\s*(\d+);\s*\}/g)].map((m) => ({ cls: Number(m[1]), value: Number(m[2]) }));
  for (const rise of rises) assert.equal(rise.cls, rise.value, `rise-${rise.cls} sets --rise: ${rise.cls}`);
  for (let index = 0; index < STAGES.length; index += 1) {
    assert.ok(rises.some((rise) => rise.cls === index), `stage ${index + 1} of ${STAGES.length} has .altitude__step--rise-${index}`);
  }
});

test('the styleguide swatches colour themselves with an SVG fill, a presentation attribute that the policy allows', () => {
  const page = read('src/pages/styleguide.astro');
  assert.match(page, /<rect[^>]*fill=\{s\.hex\}/);
  assert.doesNotMatch(read('src/styles/components.css'), /var\(--swatch\)/);
});
