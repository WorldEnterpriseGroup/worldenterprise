import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

// WP-24 (#90): the copy rules on every file the hub media touched. Program words (accelerator, cohort, incubator, mentor, alumni,
// demo day, investor network) appear only inside the element marked data-context="ecosystem"; no file says "free", quotes a price or
// calls WE an investor; the retired name never appears; the new hub components describe people per role, not seats.

const root = new URL('../../../', import.meta.url);
const read = (rel: string): string => readFileSync(new URL(rel, root), 'utf8');
const astroIn = (dir: string): string[] => readdirSync(new URL(dir, root)).filter((f) => f.endsWith('.astro')).map((f) => `${dir}${f}`);

const COMPONENTS = [
  ...astroIn('src/components/hubs/'),
  'src/components/hubs/geometry.ts',
  'src/components/hubs/filter.ts',
  'src/components/hubs/stats.ts',
  'src/components/hubs/moments.ts',
  'src/components/hubs/journey.ts',
  'src/components/tools/ToolMap.astro',
  'src/components/tools/ToolSchematic.astro',
  'src/components/tools/ToolCard.astro',
  'src/components/tools/ToolGlyph.astro',
  'src/components/tools/schematics.ts',
  'src/components/library/ShelfDiagram.astro',
  'src/components/library/DocAnatomy.astro',
];
const PAGES = [
  'src/pages/insights/index.astro',
  'src/pages/insights/topic/[topic].astro',
  'src/pages/tools/index.astro',
  'src/pages/library/index.astro',
  'src/pages/resources/index.astro',
  'src/pages/industries/[...hub].astro',
  'src/pages/compare/[...hub].astro',
  'src/pages/journey/[...hub].astro',
  'src/pages/founders/index.astro',
  'src/pages/investors/index.astro',
  'src/pages/faq/index.astro',
];

/** The source with every element marked data-context="ecosystem" removed (the one place program words may appear). */
function outsideEcosystem(source: string): string {
  return source.replace(/<(aside|section|div|p|li)\b[^>]*data-context="ecosystem"[^>]*>[\s\S]*?<\/\1>/g, '');
}

const PROGRAM_WORDS = /\baccelerators?\b|\bcohorts?\b|\bincubators?\b|\bmentors?(?:ing|ship)?\b|\balumni\b|\bdemo day\b|\binvestor network/i;

test('program words appear only inside the ecosystem element', () => {
  for (const rel of [...COMPONENTS, ...PAGES]) {
    const hit = outsideEcosystem(read(rel)).match(PROGRAM_WORDS);
    assert.equal(hit, null, `${rel}: "${hit?.[0]}" outside data-context="ecosystem"`);
  }
});

test('the ecosystem aside writes its program words in the markup, links only live routes and implies no affiliation', () => {
  const source = read('src/components/hubs/HubEcosystem.astro');
  const front = source.match(/^---([\s\S]*?)\n---\n/)?.[1] ?? '';
  assert.equal(front.match(PROGRAM_WORDS), null, 'program words are not in the frontmatter');
  assert.match(source, /<aside class="hub-eco" data-context="ecosystem"/);
  const aside = source.match(/<aside[\s\S]*?<\/aside>/)?.[0] ?? '';
  assert.match(aside, PROGRAM_WORDS, 'the words sit literally inside the marked element');
  assert.match(aside, /no affiliation is implied/i);
  for (const path of ['/ecosystem/', '/sbir-sttr/', '/data/']) assert.match(front, new RegExp(`isLive\\('${path.replaceAll('/', '\\/')}'\\)`), `${path} is gated on isLive`);
  for (const rel of PAGES) assert.match(read(rel), /<HubEcosystem\b/, `${rel}: no ecosystem aside`);
});

test('no file says "free", quotes a price, calls WE an investor or uses the retired name', () => {
  for (const rel of [...COMPONENTS, ...PAGES]) {
    const source = read(rel);
    assert.ok(!/\bfree\b/i.test(source.replace(/focusable="false"/g, '')), `${rel}: "free"`);
    assert.ok(!/(?:\$|USD\s?|€|£)\s?\d/.test(source.replace(/\$\{/g, '')), `${rel}: a price`);
    assert.ok(!/\bWE (?:invests|is an investor|funds companies)\b/.test(source), `${rel}: WE as an investor`);
    assert.ok(!/World Enterprise Incubator/.test(source), `${rel}: retired name`);
    assert.ok(!/World Enterprise Group(?! Incorporated)/.test(source), `${rel}: the formal name is World Enterprise Group Incorporated`);
  }
});

test('the new hub components speak of people per role, never seats or employer-of-record terms', () => {
  for (const rel of COMPONENTS) {
    const source = read(rel);
    assert.ok(!/\bseats?\b/i.test(source), `${rel}: seat framing`);
    assert.ok(!/employer of record|\bEoR\b/i.test(source), `${rel}: EoR framing`);
  }
});

test('the funding hubs keep the no-promise line beside the funding figures', () => {
  assert.match(read('src/pages/investors/index.astro'), /hub-investors-figures[\s\S]*?WE makes no promise of funding\./);
});
