import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { HUB_MOMENTS, MOMENT_KINDS, TOOL_SCHEMATIC_PAGES, mediaId, momentKind } from '../../../src/components/hubs/moments.ts';
import { HUB_FIGURES, HUB_STATS, JOURNEY_CLOCK, statSourceOf, tile } from '../../../src/components/hubs/stats.ts';
import { STATS } from '../../../src/data/sales/stats.ts';
import type { StatId } from '../../../src/data/sales/stats.ts';
import { SALES_SOURCES } from '../../../src/data/sales/sources.ts';
import * as FIGURES from '../../../src/data/datasets/figures.ts';
import { SCHEMATICS, ROAD } from '../../../src/components/tools/schematics.ts';
import { TOOLS } from '../../../src/components/tools/registry.ts';

// WP-24 (#90): every hub is media-rich. These tests read the source files: each hub shows the moments its inventory lists, the first
// two early in the page; every authored figure carries a title, caption, credit, intrinsic size and text alternative; every number is
// one of the register's, listed in the WP-24 sources ledger.

const root = new URL('../../../', import.meta.url);
const read = (rel: string): string => readFileSync(new URL(rel, root), 'utf8');

/** The attributes of every `<Tag ...>` opening tag in an .astro source, braces balanced so arrow functions inside props do not end it. */
function openTags(source: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}\\b`, 'g');
  for (const m of source.matchAll(re)) {
    let depth = 0;
    let quote: string | null = null;
    for (let i = (m.index ?? 0) + m[0].length; i < source.length; i += 1) {
      const c = source[i];
      if (quote !== null) {
        if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === '`' || (c === "'" && depth > 0)) quote = c;
      else if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      else if (c === '>' && depth === 0) {
        out.push(source.slice(m.index ?? 0, i + 1));
        break;
      }
    }
  }
  return out;
}

test('the inventory covers every hub the brief names, with at least two moments each and ids unique across the site', () => {
  const required = ['/insights/', '/tools/', '/library/', '/resources/', '/industries/', '/compare/', '/journey/', '/founders/', '/investors/', '/faq/'];
  for (const route of required) assert.ok(HUB_MOMENTS[route] !== undefined, `${route} is missing from HUB_MOMENTS`);
  const seen = new Set<string>();
  for (const [route, inv] of Object.entries(HUB_MOMENTS)) {
    assert.ok(inv.moments.length >= 2, `${route}: ${inv.moments.length} moments, need at least 2`);
    assert.ok(inv.interaction.length > 10, `${route}: name the early interaction`);
    for (const id of inv.moments) {
      assert.equal(mediaId(id), id);
      assert.ok(!seen.has(id), `${id} is listed twice`);
      seen.add(id);
    }
  }
});

test('every listed moment is rendered by the route files, in the listed order for the first two', () => {
  for (const [route, inv] of Object.entries(HUB_MOMENTS)) {
    const source = inv.files.map(read).join('\n');
    for (const id of inv.moments) assert.match(source, new RegExp(`id="${id}"`), `${route}: ${id} is not in ${inv.files.join(', ')}`);
    const [first, second] = inv.moments;
    if (first !== undefined && second !== undefined && inv.files.length === 1) {
      assert.ok(source.indexOf(`id="${first}"`) < source.indexOf(`id="${second}"`), `${route}: ${first} should come before ${second}`);
    }
  }
});

test('every tool page draws its schematic above the tool, and every registered tool has one', () => {
  for (const rel of TOOL_SCHEMATIC_PAGES) {
    const source = read(rel);
    assert.match(source, /<ToolSchematic\b/, `${rel}: no ToolSchematic`);
  }
  for (const tool of TOOLS) assert.ok(SCHEMATICS.some((s) => s.href === tool.href), `${tool.href} has no schematic`);
  for (const s of SCHEMATICS) {
    assert.ok(s.stage >= 0 && s.stage < ROAD.length, `${s.href}: stage ${s.stage} is off the road`);
    assert.ok(s.inputs.length >= 1 && s.outputs.length >= 1, `${s.href}: the schematic needs inputs and outputs`);
    assert.ok(s.alt.length > 20, `${s.href}: alt text`);
  }
});

test('moment kinds are a closed set', () => {
  for (const k of MOMENT_KINDS) assert.equal(momentKind(k), k);
  assert.throws(() => momentKind('photo'), RangeError);
  assert.throws(() => mediaId('insights-sky'), RangeError);
  assert.throws(() => mediaId('hub-Bad'), RangeError);
});

const FIGURE_FILES = [
  ...readdirSync(new URL('src/components/hubs/', root)).filter((f) => f.endsWith('.astro')).map((f) => `src/components/hubs/${f}`),
  'src/components/tools/ToolMap.astro',
  'src/components/tools/ToolSchematic.astro',
  'src/components/library/ShelfDiagram.astro',
  'src/components/library/DocAnatomy.astro',
];

test('every authored figure has a title, caption, credit and either an HTML drawing or an SVG with width, height and alt text', () => {
  let count = 0;
  for (const rel of FIGURE_FILES) {
    if (rel.endsWith('/HubFigure.astro')) continue;
    for (const tag of openTags(read(rel), 'HubFigure')) {
      count += 1;
      for (const prop of ['id', 'kind', 'title', 'caption', 'credit']) assert.match(tag, new RegExp(`\\s${prop}=`), `${rel}: HubFigure without ${prop}`);
      if (!/drawing="html"/.test(tag)) {
        for (const prop of ['width', 'height', 'alt']) assert.match(tag, new RegExp(`\\s${prop}=`), `${rel}: SVG HubFigure without ${prop}`);
      }
    }
  }
  assert.ok(count >= 9, `found only ${count} HubFigure uses`);
  const shell = read('src/components/hubs/HubFigure.astro');
  assert.match(shell, /width=\{width\} height=\{height\} role="img"/, 'the SVG carries its intrinsic size (no layout shift)');
  assert.match(shell, /<title id=/);
  assert.match(shell, /<desc id=/);
  assert.match(shell, /data-media-id=\{id\}/);
  assert.match(shell, /<DataTable/, 'figures with numbers offer their data as a table');
});

test('figures that draw numbers offer a table, and site counts are credited to WE', () => {
  for (const rel of ['src/components/hubs/DeskConstellation.astro', 'src/components/tools/ToolMap.astro', 'src/components/library/ShelfDiagram.astro', 'src/components/hubs/QuestionMap.astro', 'src/components/hubs/HorizonCompare.astro']) {
    const tag = openTags(read(rel), 'HubFigure')[0] ?? '';
    assert.match(tag, /\stable=/, `${rel}: no data table`);
  }
  // Figures whose credit is written where they are used: the component's own credit, or the page's.
  const credits: Record<string, string> = {
    'src/components/hubs/DeskConstellation.astro': 'HubFigure',
    'src/components/tools/ToolMap.astro': 'HubFigure',
    'src/components/library/ShelfDiagram.astro': 'HubFigure',
    'src/components/hubs/HorizonCompare.astro': 'HubFigure',
    'src/pages/faq/index.astro': 'QuestionMap',
    'src/pages/resources/index.astro': 'CountMatrix',
    'src/pages/insights/index.astro': 'DotStrip',
  };
  for (const [rel, tagName] of Object.entries(credits)) {
    const tags = openTags(read(rel), tagName);
    assert.ok(tags.length > 0, `${rel}: no ${tagName}`);
    for (const tag of tags) assert.match(tag, /credit=[{"`][^]*?World Enterprise Group Incorporated/, `${rel}: the ${tagName} credit names WE by its formal name`);
  }
});

test('no hub component ships a style attribute, an inline script, an inline handler or an eager image', () => {
  for (const rel of [...FIGURE_FILES, 'src/components/tools/ToolCard.astro', 'src/components/tools/ToolGlyph.astro']) {
    const source = read(rel);
    const markup = source.replace(/^---[\s\S]*?\n---\n/, '').replace(/<style\b[\s\S]*?<\/style>/g, '');
    assert.ok(!/\sstyle=/.test(markup), `${rel}: style attribute`);
    assert.ok(!/<script\b/.test(markup), `${rel}: script`);
    assert.ok(!/\son[a-z]+=/.test(markup), `${rel}: inline handler`);
    assert.ok(!/fetchpriority|loading="eager"/.test(source), `${rel}: eager media outside a hero`);
    assert.ok(!/data:|blob:/.test(markup), `${rel}: data or blob URL`);
  }
});

test('every statistic a hub cites is in the register, and the hub files cite only the ids listed for them', () => {
  const files: Record<string, readonly string[]> = Object.fromEntries(Object.entries(HUB_MOMENTS).map(([r, inv]) => [r, inv.files]));
  for (const [route, ids] of Object.entries(HUB_STATS)) {
    for (const id of ids) {
      const entry = STATS[id as StatId];
      assert.ok(entry !== undefined, `${route}: ${id} is not in the register`);
      const t = tile(id as StatId);
      assert.equal(t.value, entry.value);
      assert.match(t.source.href ?? '', /^https:\/\//);
    }
    const source = (files[route] ?? []).map(read).join('\n');
    for (const m of source.matchAll(/tile\('(ST-\d+)'\)/g)) assert.ok((ids as readonly string[]).includes(m[1] ?? ''), `${route} cites ${m[1]} but HUB_STATS does not list it`);
  }
  for (const [route, names] of Object.entries(HUB_FIGURES)) {
    const source = (files[route] ?? []).map(read).join('\n');
    for (const name of names) {
      assert.ok(name in FIGURES, `${name} is not a WP-35 figure`);
      assert.match(source, new RegExp(`\\b${name}\\b`), `${route} does not use ${name}`);
    }
  }
});

test('the journey clock places each gate where its register entry says', () => {
  const at = JOURNEY_CLOCK.map((m) => m.at);
  assert.deepEqual(at, [...at].sort((a, b) => a - b), 'milestones in order');
  assert.ok(Math.abs((JOURNEY_CLOCK[0]?.at ?? 0) - 2.29 / 4) < 1e-9, 'ST-08: 2.29 quarters');
  assert.match(STATS['ST-08'].value, /^2\.29 quarters$/);
  assert.equal(JOURNEY_CLOCK[1]?.label, `${STATS['ST-01'].value} still operating`);
  assert.equal(JOURNEY_CLOCK[3]?.label, `${STATS['ST-02'].value} still operating`);
  assert.equal(JOURNEY_CLOCK[4]?.label, `${STATS['ST-03'].value} still operating`);
  assert.match(STATS['ST-05'].value, /^42 months$/);
  assert.equal(JOURNEY_CLOCK[2]?.at, 3.5);
});

interface LedgerSource {
  schema_version: string;
  source_id: string;
  publisher_or_author: string;
  title: string;
  source_tier: string;
  exact_url_or_locator: string;
  retrieved_at: string;
  claims_supported: string[];
  claims_not_supported: string[];
  captured_by: string;
}

test('the WP-24 sources ledger has the WP-56 shape and records every figure the hubs show', () => {
  const ledger = JSON.parse(read('.astro-magazine/sources/wp-24.json')) as { wp: string; note: string; sources: LedgerSource[]; fetches?: unknown };
  assert.equal(ledger.wp, 'WP-24');
  assert.ok(ledger.note.length > 40);
  assert.equal(ledger.fetches, undefined, 'no fetches key');
  const ids = new Set<string>();
  for (const s of ledger.sources) {
    assert.equal(s.schema_version, '1.0.0');
    assert.equal(s.captured_by, 'WP-24');
    assert.ok(!ids.has(s.source_id), `duplicate ${s.source_id}`);
    ids.add(s.source_id);
    assert.match(s.exact_url_or_locator, /^https:\/\//);
    assert.match(s.retrieved_at, /^2026-\d{2}-\d{2}$/);
    assert.ok(['primary', 'secondary'].includes(s.source_tier));
    assert.ok(s.claims_supported.length > 0 && Array.isArray(s.claims_not_supported));
  }
  const claims = ledger.sources.flatMap((s) => s.claims_supported).join('\n');
  for (const id of new Set(Object.values(HUB_STATS).flat())) {
    const entry = STATS[id as StatId];
    assert.ok(claims.includes(`${id}: ${entry.value}`), `the ledger does not record ${id} (${entry.value})`);
    for (const sid of entry.sources) {
      const src = SALES_SOURCES.find((x) => x.id === sid);
      assert.ok(src !== undefined && ledger.sources.some((s) => s.exact_url_or_locator === src.url), `${id}: ${sid} is not in the ledger`);
    }
    assert.equal(statSourceOf(id as StatId).period, entry.period);
  }
  for (const name of new Set(Object.values(HUB_FIGURES).flat())) assert.ok(claims.includes(`${name} (`), `the ledger does not record ${name}`);
});
