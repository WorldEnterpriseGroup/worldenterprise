import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// WP-25: the header wordmark tells the browser how wide it renders, so the 100vw default never applies. The `sizes` list in Header.astro
// models the `.site-header__logo` rules in src/styles/components.css; this test evaluates both at every viewport width from 320 to 3840
// and fails if they part, so a change to the CSS without a matching change to `sizes` (or the reverse) cannot land.

const ROOT = new URL('../../../', import.meta.url);
const header = readFileSync(new URL('src/components/layout/Header.astro', ROOT), 'utf8');
const css = readFileSync(new URL('src/styles/components.css', ROOT), 'utf8');
const tokens = readFileSync(new URL('src/styles/tokens.css', ROOT), 'utf8');

const sizesMatch = /const LOGO_SIZES =\s*'([^']+)';/.exec(header);
const LOGO_SIZES = sizesMatch?.[1] ?? '';

/** Splits a `sizes` value on its top-level commas (a comma inside calc() would be nested). */
function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of value) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else current += char;
  }
  parts.push(current.trim());
  return parts;
}

/** Evaluates a length made of px, rem, vw, +, -, * and parentheses, with `rem` px to the rem and `vw` px to 1vw. */
function length(expression: string, rem: number, vw: number): number {
  const source = expression.replace(/^calc/, '');
  assert.match(source, /^[\d.\s()+*\-a-z]+$/, `unexpected length ${expression}`);
  const numeric = source
    .replace(/([\d.]+)rem/g, `($1*${rem})`)
    .replace(/([\d.]+)vw/g, `($1*${vw / 100})`)
    .replace(/([\d.]+)px/g, '($1)');
  assert.match(numeric, /^[\d.\s()+*-]+$/, `could not reduce ${expression}`);
  return Number(new Function(`return (${numeric});`)());
}

/** The slot width the browser picks from `sizes` at a viewport width. Media queries and rem in `sizes` use the initial 16px. */
function sizesWidth(viewport: number): number {
  for (const entry of splitTopLevel(LOGO_SIZES)) {
    const media = /^\(min-width:\s*(\d+)px\)\s+(.+)$/.exec(entry);
    if (media === null) return length(entry, 16, viewport);
    if (viewport >= Number(media[1])) return length(media[2] as string, 16, viewport);
  }
  throw new Error('sizes has no default entry');
}

const clamp = (min: number, value: number, max: number): number => Math.min(Math.max(value, min), max);

/** The rendered width from the CSS: the root size is max(16px, 100vw / 120), and rem in the stylesheet follows it. */
function cssWidth(viewport: number): number {
  const rem = Math.max(16, viewport / 120);
  if (viewport >= 1100) return clamp(10 * rem, 10 * rem + (viewport - 1100) * 0.536, 16 * rem);
  return clamp(11 * rem, viewport * 0.3, 16 * rem);
}

test('the header logo carries a width-descriptor srcset and the LOGO_SIZES list', () => {
  assert.ok(LOGO_SIZES.length > 0, 'LOGO_SIZES constant missing from Header.astro');
  assert.match(header, /srcset=\{`\$\{wordmark\.src\} \$\{wordmark\.width\}w`\}/);
  assert.match(header, /sizes=\{LOGO_SIZES\}/);
  assert.match(header, /width=\{wordmark\.width\}/);
  assert.match(header, /height=\{wordmark\.height\}/);
});

test('the CSS the sizes list models is unchanged (update LOGO_SIZES with it)', () => {
  assert.match(css, /\.site-header__logo \{[^}]*inline-size: clamp\(11rem, 30vw, 16rem\);/);
  assert.match(css, /@media \(min-width: 1100px\) \{\s*\.site-header__logo \{[^}]*inline-size: clamp\(10rem, calc\(10rem \+ \(100vw - 1100px\) \* 0\.536\), 16rem\);/);
  assert.match(css, /\.site-header__logo img \{[^}]*inline-size: 100%;/);
  assert.match(tokens, /--root-size:\s*max\(100%,\s*100vw\s*\/\s*120\)/);
});

test('sizes equals the rendered logo width at every viewport from 320 to 3840 px', () => {
  const off: string[] = [];
  for (let viewport = 320; viewport <= 3840; viewport += 1) {
    const difference = Math.abs(sizesWidth(viewport) - cssWidth(viewport));
    if (difference > 0.5) off.push(`${viewport}px: sizes ${sizesWidth(viewport).toFixed(1)} vs css ${cssWidth(viewport).toFixed(1)}`);
  }
  assert.deepEqual(off.slice(0, 10), []);
});
