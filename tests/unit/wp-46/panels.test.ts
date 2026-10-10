import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { NavSection } from '../../../src/data/nav.ts';
import { primaryNav } from '../../../src/data/nav.ts';
import { featuredTile, panelModel } from '../../../src/components/nav/panels.ts';

const sections = primaryNav.flatMap((item) => (item.kind === 'mega' ? [item] : []));
const live = (section: NavSection): NavSection => ({
  ...section,
  columns: section.columns.map((column) => ({ ...column, links: column.links.filter((link) => link.l2 !== true) })),
  strip: section.strip.filter((link) => link.l2 !== true),
});
const section = (id: string): NavSection => {
  const found = sections.find((item) => item.id === id);
  assert.ok(found, `section ${id}`);
  return live(found);
};

test('every panel lists each page once: the hub, the tile, the columns and the strip share no address', () => {
  for (const item of sections) {
    const panel = panelModel(live(item));
    const hrefs = [item.href, panel.featured.cta.href, ...panel.columns.flatMap((column) => column.links.map((link) => link.href)), ...panel.strip.map((link) => link.href)];
    // The hub and the tile may name the same page; every other repeat must be gone.
    const rest = hrefs.slice(item.href === panel.featured.cta.href ? 1 : 0);
    assert.equal(new Set(rest).size, rest.length, `${item.id}: ${hrefs.join(' ')}`);
    assert.ok(!panel.columns.flatMap((column) => column.links.map((link) => link.href)).includes(item.href), `${item.id}: the hub is not repeated in a column`);
  }
});

test('the page a tile points at is not repeated as a column link', () => {
  // Program: the tile is "Apply to the program"; nothing else in the panel is /apply/. Network: the tile is Apply and so is a column link.
  const network = panelModel(section('network'));
  assert.equal(network.featured.cta.href, '/apply/');
  assert.ok(!network.columns.flatMap((column) => column.links.map((link) => link.href)).includes('/apply/'));
  const manifesto = panelModel(section('about'));
  assert.ok(!manifesto.columns.flatMap((column) => column.links.map((link) => link.href)).includes('/about/manifesto/'));
});

test('a strip link that a column already names is dropped, and the strip that remains keeps its own links', () => {
  const base = section('program');
  const duplicated: NavSection = { ...base, strip: [...base.strip, { label: 'Dream again', href: '/program/dream/' }] };
  assert.deepEqual(panelModel(duplicated).strip.map((link) => link.href), ['/pricing/', '/faq/']);
  const playbooks = panelModel(section('playbooks'));
  // Templates and Glossary are strip links of Playbooks and appear in no Playbooks column, so they stay.
  assert.deepEqual(playbooks.strip.map((link) => link.href), ['/library/', '/glossary/']);
});

test('pages are not removed across panels: Pricing is still in the Services and Network panels', () => {
  assert.ok(panelModel(section('services')).strip.some((link) => link.href === '/pricing/'));
  assert.ok(panelModel(section('network')).strip.some((link) => link.href === '/pricing/'));
});

test('a column shows descriptions only when every one of its links has one', () => {
  const program = panelModel(section('program'));
  assert.deepEqual(program.columns.map((column) => column.described), [true, true]);
  const trust = panelModel(section('playbooks')).columns.find((column) => column.heading === 'Trust');
  assert.equal(trust?.described, false, 'one described link among three plain ones is a compact column');
  const stage = panelModel(section('playbooks')).columns.find((column) => column.heading === 'Stage playbooks');
  assert.equal(stage?.described, false);
});

test('every panel keeps at least four links, and the panel the menu tests open first has described links', () => {
  for (const item of sections) assert.ok(panelModel(live(item)).linkCount >= 4, item.id);
  const first = panelModel(section('program'));
  assert.ok(first.columns.some((column) => column.described && column.links.length >= 2));
});

test('an emptied column is dropped, not rendered as a bare heading', () => {
  const trimmed: NavSection = {
    ...section('program'),
    columns: [{ heading: 'Only the hub', links: [{ label: 'Hub again', href: '/program/' }] }, ...section('program').columns],
  };
  const panel = panelModel(trimmed);
  assert.ok(!panel.columns.some((column) => column.heading === 'Only the hub'));
});

test('the Resources tile names the newest research brief and links to it; without one it keeps the data text', () => {
  const resources = section('resources');
  assert.equal(resources.featured.newestResearch, true);
  const newest = { title: 'A brief title', href: '/research/a-brief/' };
  const tile = panelModel(resources, newest).featured;
  assert.equal(tile.title, 'A brief title');
  assert.equal(tile.cta.href, '/research/a-brief/');
  assert.equal(tile.cta.label, resources.featured.cta.label);
  assert.equal(panelModel(resources, null).featured, resources.featured);
  assert.equal(panelModel(resources).featured.title, 'Research briefs');
});

test('only a tile that asks for the newest brief is filled', () => {
  const program = section('program');
  assert.equal(featuredTile(program.featured, { title: 'X', href: '/research/x/' }), program.featured);
});

test('the tile carries no date and no count (the truth policy)', () => {
  const tile = panelModel(section('resources'), { title: 'A brief title', href: '/research/a-brief/' }).featured;
  assert.doesNotMatch(JSON.stringify(tile), /\d{4}|\bcount\b|\d+ (briefs|articles)/);
});

test('deriving a panel never changes the navigation data (DP-3)', () => {
  const before = JSON.stringify(primaryNav);
  for (const item of sections) panelModel(item, { title: 'T', href: '/research/t/' });
  assert.equal(JSON.stringify(primaryNav), before);
});
