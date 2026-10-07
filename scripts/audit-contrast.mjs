#!/usr/bin/env node
// Fails when any `@pair` annotation in src/styles/tokens.css misses its required contrast ratio.
// Text pairs need 4.5:1, UI components and graphical objects 3:1 (WCAG 2.2 AA).
import { readFileSync } from 'node:fs';
import { readPairs } from '../src/lib/contrast.ts';

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
let pairs;
try {
  pairs = readPairs(css);
} catch (error) {
  console.error(`audit-contrast: cannot read pairs: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}
if (pairs.length === 0) {
  console.error('audit-contrast: no @pair annotations found in tokens.css');
  process.exit(2);
}
let failed = 0;
for (const p of pairs) {
  const line = `${p.foreground} on ${p.background}: ${p.ratio.toFixed(2)}:1 (needs ${p.required}:1)`;
  if (p.pass) console.log(`ok    ${line}`);
  else {
    failed += 1;
    console.error(`FAIL  ${line}`);
  }
}
console.log(`audit-contrast: ${pairs.length} pairs, ${failed} failing`);
process.exit(failed === 0 ? 0 : 1);
