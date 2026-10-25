import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { SNAPSHOT, shippedHrefs, shippedNav } from '../../../scripts/lib/wave8/nav-final.mjs';
import { DESKS, deskPath } from '../../../src/data/desks.ts';
import { activeSectionId, footerNav, primaryNav, utilityNav } from '../../../src/data/nav.ts';
import { routeContextFromDisk } from '../../../src/data/cta/live.ts';
import { computeRouteState } from '../../../src/lib/route-core.ts';
import { routes } from '../../../src/data/routes.ts';

// #49 item 2: the nav snapshot records the navigation as it ships against the real route set, and every link resolves.
// Regenerate with: node scripts/lib/wave8/nav-final.mjs --write

interface Shipped {
  readonly note: string;
  readonly apply: string;
  readonly utility: readonly string[];
  readonly sections: readonly { readonly id: string; readonly kind: string; readonly href: string; readonly columns: readonly { readonly heading: string; readonly links: readonly string[] }[]; readonly strip: readonly string[] }[];
  readonly footer: readonly { readonly heading: string; readonly links: readonly string[] }[];
}
const compute = shippedNav as (root?: string) => Shipped;
const hrefsOf = shippedHrefs as (nav: Shipped) => string[];

const repo = new URL('../../../', import.meta.url).pathname;
const snapshot = JSON.parse(readFileSync(new URL(`../../../${SNAPSHOT as string}`, import.meta.url), 'utf8')) as { shipped?: Shipped };
const live = computeRouteState(routeContextFromDisk(repo)).live;
const nav = compute(repo);

test('the snapshot holds the shipped navigation, and it equals what the tree resolves to now', () => {
  assert.ok(snapshot.shipped, 'nav-snapshot.json has a `shipped` block: run node scripts/lib/wave8/nav-final.mjs --write');
  assert.deepEqual(snapshot.shipped, nav, 'the shipped block is stale: run node scripts/lib/wave8/nav-final.mjs --write');
});

test('every link the shipped navigation renders is a live route', () => {
  const hrefs = hrefsOf(nav);
  assert.ok(hrefs.length > 80, `${hrefs.length} distinct links`);
  for (const href of hrefs) assert.ok(live.has(href), `${href} is in the navigation but is not a live route`);
});

test('no link is silently dropped: a non-L2 link either ships or is held by a ledger row that says why, and every L2 link stays out', () => {
  const shipped = new Set(hrefsOf(nav));
  const declared: { readonly href: string; readonly l2: boolean; readonly where: string }[] = [];
  for (const item of primaryNav) {
    declared.push({ href: item.href, l2: false, where: item.id });
    if (item.kind !== 'mega') continue;
    for (const col of item.columns) for (const l of col.links) declared.push({ href: l.href, l2: l.l2 === true, where: `${item.id} / ${col.heading}` });
    for (const l of item.strip) declared.push({ href: l.href, l2: l.l2 === true, where: `${item.id} strip` });
  }
  for (const col of footerNav) for (const l of col.links) declared.push({ href: l.href, l2: l.l2 === true, where: `footer / ${col.heading}` });
  for (const l of utilityNav.links) declared.push({ href: l.href, l2: l.l2 === true, where: 'utility' });
  const held = new Set<string>();
  for (const d of declared) {
    if (d.l2) {
      assert.equal(live.has(d.href), false, `${d.where}: L2 link ${d.href} is live, so it should ship and lose its l2 flag`);
      continue;
    }
    if (live.has(d.href)) {
      assert.ok(shipped.has(d.href), `${d.where}: ${d.href} is live but does not ship`);
      continue;
    }
    const row = routes.find((r) => r.path === d.href);
    assert.ok(row, `${d.where}: ${d.href} is in the navigation and has no ledger row`);
    assert.equal(row.launch, false, `${d.where}: ${d.href} is launched but not live, so it is silently dropped`);
    assert.ok((row.reason ?? '').length > 0, `${d.where}: ${d.href} is held without a reason`);
    held.add(d.href);
  }
  // The routes the navigation holds back on purpose, each with its condition in the ledger (newsletter endpoint, counsel sign-off on terms).
  assert.deepEqual([...held].sort(), ['/legal/terms/', '/newsletter/']);
});

test('the navigation reaches the whole wave 8 surface: 7 sections, the lens, the 14 desks, briefs, industries, comparisons, journey, investors, partners', () => {
  assert.deepEqual(nav.sections.map((s) => s.id), ['program', 'services', 'playbooks', 'resources', 'network', 'audiences', 'about']);
  const all = new Set(hrefsOf(nav));
  for (const desk of DESKS) assert.ok(all.has(deskPath(desk)), `the Topics column lists the ${desk} desk`);
  for (const href of ['/briefs/', '/industries/', '/compare/', '/journey/', '/investors/', '/network/partners/', '/faq/', '/founders/', '/how-we-work/', '/apply/']) assert.ok(all.has(href), `${href} is in the navigation`);
  assert.equal(nav.apply, '/apply/');
  assert.deepEqual(nav.utility, ['/investors/', '/press/', '/contact/', '/search/']);
  const lens = nav.sections.find((s) => s.id === 'audiences');
  assert.deepEqual(lens?.columns.map((c) => c.heading), ['For startups', 'For investors', 'For partners', 'For corporate teams']);
});

test('aria-current: every link of a panel marks its own section, with the declared exceptions and nothing else', () => {
  // Pages a panel lists although they belong to no section (SECTIONLESS_PREFIXES in src/data/nav.ts) and the audience lens, which cuts
  // across the other panels by design: its links mark the section that owns the page. /briefs/ is both the lens hub and a Resources link.
  const declared = new Map<string, string | null>([
    ['playbooks|/trust/', null],
    ['resources|/briefs/', 'audiences'],
    ['network|/apply/', null],
    ['about|/contact/', null],
  ]);
  const seen = new Set<string>();
  for (const section of nav.sections) {
    const links = [section.href, ...section.columns.flatMap((c) => c.links)];
    for (const href of links) {
      const current = activeSectionId(href);
      if (section.id === 'audiences') {
        assert.ok(current === null || nav.sections.some((s) => s.id === current), `lens link ${href} marks an unknown section ${String(current)}`);
        continue;
      }
      const key = `${section.id}|${href}`;
      if (declared.has(key)) {
        seen.add(key);
        assert.equal(current, declared.get(key), `${key}`);
      } else assert.equal(current, section.id, `${href} in ${section.id} marks ${String(current)} as current`);
    }
  }
  assert.deepEqual([...seen].sort(), [...declared.keys()].sort(), 'every declared exception still occurs, so the list cannot go stale');
});

test('every live ledger page is reachable: a launched, indexable page-family or hub route is in the navigation', () => {
  // The nav is not the only door: articles, playbooks and library entries are reached through their hubs and the desk pages. What the nav
  // must reach itself is each hub and family hub.
  const all = new Set(hrefsOf(nav));
  for (const hub of ['/insights/', '/playbooks/', '/library/', '/research/', '/glossary/', '/briefs/', '/industries/', '/compare/', '/journey/', '/founders/', '/tools/', '/services/', '/program/', '/about/', '/network/', '/investors/', '/trust/', '/press/', '/how-we-work/']) {
    assert.ok(routes.some((r) => r.path === hub && r.launch), `${hub} is a launched row`);
    assert.ok(all.has(hub), `${hub} is in the navigation or the footer`);
  }
});
