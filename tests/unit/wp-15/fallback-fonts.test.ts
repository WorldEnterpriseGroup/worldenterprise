import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const ROOT = new URL('../../../', import.meta.url).pathname;
const css = readFileSync(`${ROOT}src/styles/fallback-fonts.css`, 'utf8');
const config = readFileSync(`${ROOT}astro.config.mjs`, 'utf8');

interface Face {
  readonly family: string;
  readonly from: number;
  readonly to: number;
  readonly sources: readonly string[];
  readonly descriptors: Readonly<Record<string, string>>;
}

function faces(): Face[] {
  const out: Face[] = [];
  for (const match of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const body = match[1] ?? '';
    const descriptors: Record<string, string> = {};
    for (const line of body.split(';')) {
      const colon = line.indexOf(':');
      if (colon > -1) descriptors[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
    }
    const weight = /^(\d+) (\d+)$/.exec(descriptors['font-weight'] ?? '');
    assert.ok(weight?.[1] !== undefined && weight[2] !== undefined, `a weight range in ${descriptors['font-family']}`);
    out.push({
      family: (descriptors['font-family'] ?? '').replace(/'/g, ''),
      from: Number(weight[1]),
      to: Number(weight[2]),
      sources: [...(descriptors.src ?? '').matchAll(/local\('([^']+)'\)/g)].map((m) => m[1] ?? ''),
      descriptors,
    });
  }
  return out;
}

const FAMILIES: readonly { readonly name: string; readonly variable: string; readonly regular: string; readonly bold: string }[] = [
  { name: 'WE Sans Fallback', variable: '--font-sans', regular: 'Liberation Sans', bold: 'Liberation Sans Bold' },
  { name: 'WE Serif Fallback', variable: '--font-serif', regular: 'Liberation Serif', bold: 'Liberation Serif Bold' },
  { name: 'WE Display Fallback', variable: '--font-display', regular: 'Liberation Sans', bold: 'Liberation Sans Bold' },
];

test('each fallback family has a regular and a bold face that do not overlap and cover 400 to 900', () => {
  const all = faces();
  for (const family of FAMILIES) {
    const own = all.filter((f) => f.family === family.name).sort((a, b) => a.from - b.from);
    assert.equal(own.length, 2, `${family.name} faces`);
    assert.equal(own[0]?.from, 400, `${family.name} regular starts at 400`);
    assert.equal(own[1]?.to, 900, `${family.name} bold ends at 900`);
    assert.equal((own[0]?.to ?? 0) + 1, own[1]?.from, `${family.name} faces meet without a gap or overlap`);
  }
});

test('every face is scaled and re-spaced, and names the Linux and Android metric-compatible fonts as well as Windows and macOS', () => {
  for (const face of faces()) {
    for (const key of ['size-adjust', 'ascent-override', 'descent-override', 'line-gap-override']) {
      assert.ok(face.descriptors[key] !== undefined, `${face.family} ${face.from} has ${key}`);
    }
    const size = Number.parseFloat(face.descriptors['size-adjust'] ?? '');
    assert.ok(size > 80 && size < 125, `${face.family} ${face.from} size-adjust ${size} is plausible`);
  }
  for (const family of FAMILIES) {
    const own = faces().filter((f) => f.family === family.name).sort((a, b) => a.from - b.from);
    assert.ok(own[0]?.sources.includes(family.regular), `${family.name} regular names ${family.regular}`);
    assert.ok(own[1]?.sources.includes(family.bold), `${family.name} bold names ${family.bold}`);
    assert.ok((own[0]?.sources.length ?? 0) >= 4, `${family.name} regular names a font per platform`);
  }
});

test('astro.config.mjs lists each fallback family in the stack of the web font it stands in for, and BaseLayout loads the stylesheet', () => {
  for (const family of FAMILIES) {
    const block = new RegExp(`cssVariable: '${family.variable}',\\s*fallbacks: \\[([^\\]]*)\\]`).exec(config);
    assert.ok(block?.[1] !== undefined, `${family.variable} has fallbacks`);
    assert.ok(block[1].startsWith(`'${family.name}'`), `${family.variable} lists ${family.name} first`);
  }
  assert.match(readFileSync(`${ROOT}src/layouts/BaseLayout.astro`, 'utf8'), /import '\.\.\/styles\/fallback-fonts\.css';/);
});
