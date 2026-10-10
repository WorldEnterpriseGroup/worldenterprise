import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as geoAudit from '../../../scripts/audit-geo.mjs';
import { deskGroups, familyGroups, fullTiers, FAMILY_LABELS } from '../../../src/components/geo/llms-plan.ts';
import { DESK_DEFINITIONS, deskPath } from '../../../src/data/desks.ts';
import { FAMILIES } from '../../../src/data/families.ts';
import { packages } from '../../../src/data/packages.ts';
import { routes } from '../../../src/data/routes.ts';
import { site } from '../../../src/data/site.ts';
import {
  buildLlmsFullTxt,
  buildLlmsTxt,
  LLMS_FULL_MAX_BYTES,
  LlmsFullTooLargeError,
  llmsFullBudget,
  planLlmsFull,
} from '../../../src/lib/llms.ts';
import type { LlmsInput } from '../../../src/lib/llms.ts';
import { buildTwin } from '../../../src/lib/markdown-twins.ts';
import type { RenderedTwin, TwinSource } from '../../../src/lib/markdown-twins.ts';
import { assembleReal, ROOT } from '../wp-41/content.ts';

const geo = geoAudit as unknown as { auditLlmsStructure(name: string, text: string): string[] };

const allLive = (): boolean => true;
const bytes = (text: string): number => new TextEncoder().encode(text).length;

function input(overrides: Partial<LlmsInput> = {}): LlmsInput {
  return {
    site: { name: site.name, legalName: site.legalName, tagline: site.tagline, description: site.description, origin: site.origin },
    packages: packages.map((p) => ({ name: p.name, stageFit: p.stageFit, depth: p.depth })),
    serviceLines: [{ line: 'A', title: 'Line A', route: '/services/line-a/', summary: 'Summary of line A.' }],
    keyPages: [{ route: '/about/facts/', title: 'Facts about WE' }],
    optionalPages: [],
    howWeDecide: null,
    twinRoutes: new Set<string>(),
    contactRoute: '/contact/',
    applyRoute: '/apply/',
    addOnStatement: 'The paid add-on is separate from the packages.',
    calendarStatement: 'WE does not describe an intake calendar.',
    ...overrides,
  };
}

/** A twin of about `size` bytes of plain prose, the way an article body reads. */
function twin(route: string, size: number): RenderedTwin {
  const sentence = 'Founders weigh the options against the evidence they hold and write the decision down. ';
  const source: TwinSource = { route, title: `Page ${route}`, lead: 'A lead.', updated: new Date('2026-10-01'), body: `## Body\n\n${sentence.repeat(Math.ceil(size / sentence.length))}` };
  return buildTwin(source);
}

/** The shape of the real site at launch scale: 120 articles, every desk, every family entry, the curated company pages. About 350 routes. */
function fabricatedSite(): { readonly twins: Map<string, RenderedTwin>; readonly curated: readonly string[] } {
  const twins = new Map<string, RenderedTwin>();
  const put = (route: string, size: number): void => void twins.set(route, twin(route, size));
  const curated = ['/about/facts/', '/about/manifesto/', '/about/editorial-policy/', '/faq/', '/glossary/', '/research/early-stage-saas-metrics-definitions/'];
  for (const route of curated) put(route, 9_000);
  for (let i = 0; i < 7; i += 1) {
    put(`/services/line-${i}/`, 5_000);
    curated.push(`/services/line-${i}/`);
  }
  for (let i = 0; i < 5; i += 1) {
    put(`/playbooks/book-${i}/`, 6_000);
    curated.push(`/playbooks/book-${i}/`);
  }
  for (const desk of DESK_DEFINITIONS) put(deskPath(desk.id), 4_000);
  for (const family of FAMILIES) {
    if (family.hub !== undefined) put(family.hub.path, 5_000);
    for (const entry of family.entries) put(entry.path, 7_000);
  }
  for (let i = 0; i < 120; i += 1) put(`/insights/article-${i}/`, 12_000);
  for (let i = 0; i < 40; i += 1) put(`/research/brief-${i}/`, 12_000);
  return { twins, curated };
}

test('the fabricated launch-scale set has about 350 routes and far more text than the cap', () => {
  const { twins } = fabricatedSite();
  assert.ok(twins.size >= 200, `only ${twins.size} routes`);
  const total = [...twins.values()].reduce((sum, t) => sum + bytes(t.markdown), 0);
  assert.ok(total > LLMS_FULL_MAX_BYTES * 5, 'the fixture should dwarf the cap, so the selection is what keeps the file small');
});

test('llms-full.txt for the launch-scale set stays under the cap minus 10 percent, with articles linked and never inlined (W8-26)', () => {
  const { twins, curated } = fabricatedSite();
  const base = input();
  const plan = planLlmsFull(base, fullTiers({ twins, curated, isLive: allLive }));
  const text = buildLlmsFullTxt(base, plan.pages);
  assert.ok(bytes(text) <= LLMS_FULL_MAX_BYTES * 0.9, `${bytes(text)} bytes is over 90 percent of the cap`);
  assert.equal(bytes(text), plan.bytes, 'the plan counts the bytes of the file it describes');
  assert.ok(!plan.pages.some((p) => p.route.startsWith('/insights/article-') || p.route.startsWith('/research/brief-')), 'no article is inlined');
  assert.ok(plan.pages.some((p) => p.route === deskPath('dream')), 'a desk page is');
  for (const family of FAMILIES) {
    const wanted = [...(family.hub === undefined ? [] : [family.hub.path]), ...family.entries.map((e) => e.path)][0];
    assert.ok(plan.pages.some((p) => p.route === wanted), `${family.id} has one page`);
  }
  assert.deepEqual(plan.dropped, []);
});

test('the plan holds the budget when a tier is far too large, drops the rest in order, and the build never reaches the cap', () => {
  const huge = Array.from({ length: 60 }, (_, i) => twin(`/about/huge-${i}/`, 14_000));
  const base = input();
  const plan = planLlmsFull(base, [huge]);
  const text = buildLlmsFullTxt(base, plan.pages);
  assert.ok(bytes(text) <= llmsFullBudget());
  assert.ok(plan.dropped.length > 0);
  assert.equal(plan.pages.length + plan.dropped.length, huge.length);
  assert.deepEqual(plan.pages.map((p) => p.route), huge.slice(0, plan.pages.length).map((p) => p.route), 'earlier pages win');
});

test('a twin with lint problems is dropped by the plan instead of failing the build, and a route in two tiers is taken once', () => {
  const good = twin('/about/facts/', 1_000);
  const broken: RenderedTwin = { route: '/about/broken/', markdown: '<Callout>x</Callout>', problems: ['a tag remains'] };
  const plan = planLlmsFull(input(), [[good, broken], [good]]);
  assert.deepEqual(plan.pages.map((p) => p.route), ['/about/facts/']);
  assert.deepEqual(plan.dropped.map((d) => d.route), ['/about/broken/']);
});

test('an oversized fixture still throws, so the cap stays a hard limit behind the plan', () => {
  const pages = Array.from({ length: 30 }, (_, i) => twin(`/about/big-${i}/`, 12_000));
  assert.throws(() => buildLlmsFullTxt(input(), pages), (error: unknown) => error instanceof LlmsFullTooLargeError && error.bytes > LLMS_FULL_MAX_BYTES && error.cap === LLMS_FULL_MAX_BYTES);
  assert.throws(() => buildLlmsFullTxt(input(), [twin('/about/a/', 2_000)], 500), LlmsFullTooLargeError);
});

test('the real content plans into llms-full.txt under the budget with nothing dropped', () => {
  const real = assembleReal();
  const twins = new Map(real.twins.map((t) => [t.route, buildTwin(t)]));
  const curated = ['/about/facts/', '/about/manifesto/', '/about/editorial-policy/', '/faq/', '/glossary/', '/research/early-stage-saas-metrics-definitions/'];
  const plan = planLlmsFull(input(), fullTiers({ twins, curated, isLive: allLive }));
  assert.ok(plan.bytes <= llmsFullBudget(), `${plan.bytes} bytes is over the ${llmsFullBudget()} budget`);
  assert.ok(plan.pages.length > 0);
});

test('a family or desk appears in llms.txt only when its route is live, and a new live entry appears with no other change', () => {
  const entryPath = FAMILIES[2]?.entries[1]?.path;
  assert.ok(entryPath !== undefined);
  const without = new Set<string>(['/founders/first-time-founders/']);
  const withEntry = new Set<string>([...without, entryPath]);
  const flat = (live: ReadonlySet<string>): string[] => familyGroups((route) => live.has(route)).flatMap((g) => g.pages.map((p) => p.route));
  assert.deepEqual(flat(without), ['/founders/first-time-founders/']);
  assert.deepEqual(flat(withEntry).sort(), [entryPath, '/founders/first-time-founders/'].sort());
  assert.deepEqual(familyGroups(() => false), []);
  assert.deepEqual(deskGroups(() => false), []);
  assert.deepEqual(deskGroups((route) => route === deskPath('ai')).map((g) => g.label), ['AI-native building']);
});

test('the llms.txt of the live set has the Insight desks and Page families sections in contract order', () => {
  const live = (route: string): boolean => routes.some((r) => r.path === route && r.launch);
  const text = buildLlmsTxt(input({ desks: deskGroups(live), families: familyGroups(live) }));
  const headings = [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
  assert.ok(headings.indexOf('Insight desks') > headings.indexOf('Key pages') || !headings.includes('Key pages'));
  assert.ok(headings.indexOf('Page families') > headings.indexOf('Insight desks'));
  assert.ok(headings.indexOf('Page families') < headings.indexOf('Contact'));
  assert.deepEqual(geo.auditLlmsStructure('llms.txt', text).filter((e) => !/required sentence/.test(e)), []);
  for (const family of FAMILIES) assert.ok(text.includes(`### ${FAMILY_LABELS[family.id]}`), family.id);
});

test('a generated list names the blocked-word comparison by its label alone, and no label or list line holds a word the denylist blocks', () => {
  const denylist = JSON.parse(readFileSync(`${ROOT}claims-denylist.json`, 'utf8')) as { contextRules: { id: string; pattern: string; flags: string }[] };
  const peers = denylist.contextRules.find((r) => r.id === 'C-13-peers');
  assert.ok(peers !== undefined);
  const pattern = new RegExp(peers.pattern, peers.flags);
  const blocked = FAMILIES.flatMap((f) => f.entries).filter((e) => e.blockedWord !== undefined);
  assert.ok(blocked.length >= 1, 'the registry still has an entry that carries a blocked word');
  for (const entry of blocked) {
    assert.ok(!pattern.test(entry.label), `${entry.slug}: the label carries the blocked word`);
    assert.ok(!pattern.test(entry.path), `${entry.slug}: the URL carries the blocked word`);
  }
  const groups = familyGroups(allLive);
  const listed = groups.flatMap((g) => [g.label, ...(g.hub === undefined ? [] : [g.hub.title]), ...g.pages.map((p) => p.title)]);
  assert.ok(listed.includes(blocked[0]?.label ?? ''), 'the entry is listed by its label');
  for (const line of listed) assert.ok(!pattern.test(line), line);
  assert.ok(groups.every((g) => g.pages.every((p) => p.description === undefined)), 'a family entry is listed with no page text');
  const text = buildLlmsTxt(input({ families: groups, desks: deskGroups(allLive) }));
  const familySection = text.slice(text.indexOf('## Page families'), text.indexOf('## Contact'));
  assert.ok(!pattern.test(familySection));
});

test('a thank-you page, a noindex route and a draft route are in no generated list, even when every route is live', () => {
  const quiet = routes.filter((r) => !r.indexable).map((r) => r.path);
  assert.ok(quiet.some((p) => p.endsWith('/thanks/')), 'the ledger has thank-you pages');
  const groups = [...familyGroups(allLive), ...deskGroups(allLive)];
  const listed = groups.flatMap((g) => [...(g.hub === undefined ? [] : [g.hub.route]), ...g.pages.map((p) => p.route)]);
  for (const path of quiet) assert.ok(!listed.includes(path), path);
  const { twins, curated } = fabricatedSite();
  for (const path of quiet) assert.ok(!fullTiers({ twins, curated, isLive: allLive }).flat().some((t) => t.route === path), path);
});
