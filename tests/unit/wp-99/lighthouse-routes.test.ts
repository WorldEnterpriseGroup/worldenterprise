import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { routeContextFromDisk } from '../../../src/data/cta/live.ts';
import { DESKS } from '../../../src/data/desks.ts';
import { BRIEFS, COMPARISONS, FAMILIES, INDUSTRIES, JOURNEY, SEGMENTS } from '../../../src/data/families.ts';
import { computeRouteState } from '../../../src/lib/route-core.ts';
import { listInsightFiles } from '../../../src/lib/content-files.ts';

// #49 item 2: lighthouserc.json measures the shipped routes: a representative article per desk, every squeeze page, each family, each tool.

const repo = new URL('../../../', import.meta.url).pathname;
const config = JSON.parse(readFileSync(new URL('../../../lighthouserc.json', import.meta.url), 'utf8')) as { candidates: string[]; maxRoutes: number };
const live = computeRouteState(routeContextFromDisk(repo)).live;
const candidates = new Set(config.candidates);

test('every candidate is a live route, none is listed twice, and the cap leaves none out', () => {
  assert.equal(candidates.size, config.candidates.length);
  assert.equal(config.maxRoutes, config.candidates.length, 'maxRoutes equals the candidate count, so a route can neither overflow nor be left unmeasured');
  for (const route of config.candidates) assert.ok(live.has(route), `${route} is a candidate but not a live route, so the job would skip it`);
});

test('a representative article of every one of the 14 desks is measured', () => {
  const files = listInsightFiles(repo);
  for (const desk of DESKS) {
    const slugs = files.filter((f) => f.desk === desk).map((f) => `/insights/${f.slug}/`);
    assert.ok(slugs.length > 0, `desk ${desk} has articles`);
    assert.ok(slugs.some((s) => candidates.has(s)), `no article of the ${desk} desk is a Lighthouse candidate`);
  }
});

test('every squeeze page and the briefs hub are measured', () => {
  assert.ok(candidates.has('/briefs/'));
  for (const brief of BRIEFS.entries.filter((b) => b.launch)) assert.ok(candidates.has(brief.path), `${brief.path} is measured`);
});

test('each page family has its hub and at least one page measured', () => {
  const hubs: [string, readonly { path: string }[]][] = [
    ['/founders/', SEGMENTS.entries],
    ['/industries/', INDUSTRIES.entries],
    ['/compare/', COMPARISONS.entries],
    ['/journey/', JOURNEY.entries],
  ];
  for (const [hub, entries] of hubs) {
    assert.ok(candidates.has(hub), `${hub} is measured`);
    assert.ok(entries.some((e) => candidates.has(e.path)), `no page under ${hub} is measured`);
  }
  assert.equal(FAMILIES.length, 5, 'the five families are all accounted for (segments, industries, comparisons, journey, briefs)');
});

test('every tool page, a playbook, the FAQ, the investor hub and the partner hub are measured', () => {
  const tools = readdirSync(new URL('../../../src/pages/tools', import.meta.url)).map((f) => f.replace(/\.astro$/, '')).map((n) => (n === 'index' ? '/tools/' : `/tools/${n}/`));
  assert.ok(tools.length >= 7);
  for (const route of tools) assert.ok(candidates.has(route), `${route} is measured`);
  for (const route of ['/playbooks/', '/faq/', '/investors/', '/network/partners/']) assert.ok(candidates.has(route), `${route} is measured`);
  assert.ok(config.candidates.some((c) => /^\/playbooks\/[a-z0-9-]+\/$/.test(c)), 'a playbook page is measured');
});
