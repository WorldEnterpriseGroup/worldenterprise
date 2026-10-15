import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DESKS } from '../../../src/data/desks.ts';
import { AUDIENCE_LABELS } from '../../../src/data/families.ts';
import { applyButton, footerNav, primaryNav, resolveFooter, resolveNav, utilityNav } from '../../../src/data/nav.ts';
import type { NavSection } from '../../../src/data/nav.ts';
import { L2_RESERVED, MACHINE_ROUTES, routes } from '../../../src/data/routes.ts';

interface SnapshotLink {
  readonly label?: string;
  readonly href: string;
  readonly l2?: boolean;
}
interface SnapshotSection {
  readonly id: string;
  readonly href: string;
  readonly direct?: boolean;
  readonly lead?: string;
  readonly leadLink?: string;
  readonly columns?: readonly { readonly heading: string; readonly links: readonly SnapshotLink[] }[];
  readonly strip?: readonly SnapshotLink[];
}
interface Snapshot {
  readonly wave8: {
    readonly sections: readonly string[];
    readonly columns: Readonly<Record<string, readonly string[]>>;
    readonly links: Readonly<Record<string, readonly string[]>>;
    readonly changed: Readonly<Record<string, { readonly label: string; readonly l2: boolean }>>;
    readonly footerLinks: readonly string[];
  };
  readonly sections: readonly SnapshotSection[];
  readonly utility: readonly string[];
  readonly apply: string;
}

const snapshot = JSON.parse(readFileSync(new URL('./fixtures/nav-snapshot.json', import.meta.url), 'utf8')) as Snapshot;

/**
 * Wave 8 may add to the navigation and may never remove or reorder what the plan fixed (contracts 1.4). The snapshot sections are the
 * plan; `snapshot.wave8` lists every addition and the one change. `without` drops the additions, and what is left must equal the plan.
 */
const wave8 = snapshot.wave8;
const addedSections = new Set(wave8.sections);

test('the top level order matches SAGE-PLAN 5.2, with the audience lens after Network and nothing else added', () => {
  const kept = primaryNav.filter((i) => !addedSections.has(i.id));
  assert.deepEqual(kept.map((i) => [i.id, i.href]), snapshot.sections.map((s) => [s.id, s.href]));
  const ids = primaryNav.map((i) => i.id);
  assert.equal(ids[ids.indexOf('network') + 1], 'audiences', 'the lens follows Network');
  assert.equal(primaryNav.find((i) => i.id === 'audiences')?.label, 'For you');
  assert.equal(applyButton.href, snapshot.apply);
});

test('every mega panel matches the snapshot: lead, columns, links, L2 flags and strip', () => {
  for (const expected of snapshot.sections) {
    const actual = primaryNav.find((i) => i.id === expected.id);
    assert.ok(actual, expected.id);
    if (expected.direct === true) {
      assert.equal(actual.kind, 'direct', expected.id);
      continue;
    }
    assert.equal(actual.kind, 'mega', expected.id);
    const section = actual as NavSection;
    assert.equal(section.lead, expected.lead, `${expected.id} lead`);
    assert.equal(section.leadLink, expected.leadLink, `${expected.id} leadLink`);
    const addedColumns = new Set(wave8.columns[expected.id] ?? []);
    const columns = section.columns.filter((c) => !addedColumns.has(c.heading));
    assert.deepEqual(
      columns.map((c) => c.heading),
      (expected.columns ?? []).map((c) => c.heading),
      `${expected.id} column headings`,
    );
    const addedLinks = new Set(wave8.links[expected.id] ?? []);
    for (const [ci, col] of (expected.columns ?? []).entries()) {
      const got = (columns[ci]?.links ?? []).filter((l) => !addedLinks.has(l.href));
      assert.deepEqual(
        got.map((l) => [l.href, wave8.changed[l.href]?.l2 ?? l.l2 === true]),
        col.links.map((l) => [l.href, wave8.changed[l.href]?.l2 ?? l.l2 === true]),
        `${expected.id} / ${col.heading} links`,
      );
      for (const [li, link] of col.links.entries()) {
        const label = wave8.changed[link.href]?.label ?? link.label;
        if (label !== undefined) assert.equal(got[li]?.label, label, `${expected.id} / ${col.heading} label ${link.href}`);
      }
    }
    assert.deepEqual(section.strip.map((l) => l.href), (expected.strip ?? []).map((l) => l.href), `${expected.id} strip`);
  }
});

test('the utility bar lists the four launch links in order, with Careers held as L2', () => {
  const launch = utilityNav.links.filter((l) => l.l2 !== true).map((l) => l.href);
  assert.deepEqual(launch, snapshot.utility);
  assert.equal(utilityNav.links.find((l) => l.href === '/careers/')?.l2, true);
});

test('every nav and footer href resolves to a ledger row, an L2 row or a machine route', () => {
  const known = new Set<string>([...routes.map((r) => r.path), ...L2_RESERVED.map((r) => r.path), ...MACHINE_ROUTES.map((m) => m.path)]);
  const hrefs: string[] = [applyButton.href];
  for (const link of utilityNav.links) hrefs.push(link.href);
  for (const item of primaryNav) {
    hrefs.push(item.href);
    if (item.kind === 'mega') {
      for (const col of item.columns) for (const l of col.links) hrefs.push(l.href);
      for (const l of item.strip) hrefs.push(l.href);
      hrefs.push(item.featured.cta.href);
    }
  }
  for (const col of footerNav) for (const l of col.links) hrefs.push(l.href);
  for (const href of hrefs) assert.ok(known.has(href), `unknown nav target ${href}`);
});

test('L2 links never ship: every l2 link points at a non-launch route', () => {
  const launched = new Set(routes.filter((r) => r.launch).map((r) => r.path));
  for (const item of primaryNav) {
    if (item.kind !== 'mega') continue;
    for (const col of item.columns) for (const l of col.links) if (l.l2 === true) assert.equal(launched.has(l.href), false, l.href);
  }
});

test('resolveNav hides L2 links and routes that are not live', () => {
  const live = new Set(['/program/', '/program/how-it-works/', '/program/cohorts/', '/pricing/']);
  const nav = resolveNav((href) => live.has(href));
  assert.deepEqual(nav.map((i) => i.id), ['program']);
  const program = nav[0];
  assert.ok(program !== undefined && program.kind === 'mega');
  assert.deepEqual(program.columns.flatMap((c) => c.links.map((l) => l.href)), ['/program/how-it-works/']);
});

test('activeSectionId maps paths to their primary section', async () => {
  const { activeSectionId } = await import('../../../src/data/nav.ts');
  assert.equal(activeSectionId('/'), null);
  assert.equal(activeSectionId('/program/dream/'), 'program');
  assert.equal(activeSectionId('/services/digital-incubation/'), 'services');
  assert.equal(activeSectionId('/fundability/data-room/'), 'playbooks');
  assert.equal(activeSectionId('/insights/some-article/'), 'resources');
  assert.equal(activeSectionId('/research/saas-security-baseline-year-one/'), 'playbooks');
  assert.equal(activeSectionId('/investors/'), 'network');
  assert.equal(activeSectionId('/pricing/'), null);
  assert.equal(activeSectionId('/legal/privacy/'), null);
  assert.equal(activeSectionId('/briefs/funding-paths/'), 'audiences');
  assert.equal(activeSectionId('/network/partners/enquire/'), 'network');
  assert.equal(activeSectionId('/journey/after-you-apply/'), 'program');
  assert.equal(activeSectionId('/compare/build-vs-buy/'), 'resources');
});

test('the audience lens has one column per audience, headed with the audience label', () => {
  const lens = primaryNav.find((i) => i.id === 'audiences');
  assert.ok(lens !== undefined && lens.kind === 'mega');
  assert.deepEqual(lens.columns.map((c) => c.heading), Object.values(AUDIENCE_LABELS));
  const hrefs = lens.columns.flatMap((c) => c.links.map((l) => l.href));
  for (const href of ['/apply/', '/founders/', '/investors/', '/investors/interest/', '/network/partners/', '/network/partners/enquire/', '/founders/corporate-innovators/', '/contact/']) {
    assert.ok(hrefs.includes(href), href);
  }
});

test('the Topics column lists every desk once, in desk order, and the label Partners replaces the old one', () => {
  const resources = primaryNav.find((i) => i.id === 'resources');
  assert.ok(resources !== undefined && resources.kind === 'mega');
  const topics = resources.columns.find((c) => c.heading === 'Topics');
  assert.deepEqual(topics?.links.map((l) => l.href), DESKS.map((id) => `/insights/topic/${id}/`));
  const everyLabel = [...primaryNav.flatMap((i) => (i.kind === 'mega' ? [...i.columns.flatMap((c) => c.links), ...i.strip] : [])), ...footerNav.flatMap((c) => c.links)].map((l) => l.label);
  assert.equal(everyLabel.some((l) => /perk/i.test(l)), false, 'no navigation label says perks');
});

test('every wave 8 addition is hidden until its route is live', () => {
  const live = new Set(['/', '/program/', '/program/how-it-works/', '/pricing/', '/network/', '/apply/', '/founders/', '/contact/']);
  const nav = resolveNav((href) => live.has(href));
  assert.equal(nav.some((i) => i.id === 'audiences'), false, 'the lens needs its hub');
  const program = nav.find((i) => i.id === 'program');
  assert.ok(program !== undefined && program.kind === 'mega');
  assert.equal(program.columns.flatMap((c) => c.links).some((l) => l.href.startsWith('/journey/')), false);
  const footer = resolveFooter((href) => live.has(href));
  for (const added of snapshot.wave8.footerLinks) assert.equal(footer.flatMap((c) => c.links).some((l) => l.href === added), false, added);
});

test('the footer carries every wave 8 addition', () => {
  const hrefs = footerNav.flatMap((c) => c.links.map((l) => l.href));
  for (const added of snapshot.wave8.footerLinks) assert.ok(hrefs.includes(added), added);
});
