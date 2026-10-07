import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { applyButton, footerNav, primaryNav, resolveNav, utilityNav } from '../../../src/data/nav.ts';
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
  readonly sections: readonly SnapshotSection[];
  readonly utility: readonly string[];
  readonly apply: string;
}

const snapshot = JSON.parse(readFileSync(new URL('./fixtures/nav-snapshot.json', import.meta.url), 'utf8')) as Snapshot;

test('the top level order matches SAGE-PLAN 5.2', () => {
  assert.deepEqual(primaryNav.map((i) => [i.id, i.href]), snapshot.sections.map((s) => [s.id, s.href]));
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
    assert.deepEqual(
      section.columns.map((c) => c.heading),
      (expected.columns ?? []).map((c) => c.heading),
      `${expected.id} column headings`,
    );
    for (const [ci, col] of (expected.columns ?? []).entries()) {
      const got = section.columns[ci]?.links ?? [];
      assert.deepEqual(
        got.map((l) => [l.href, l.l2 === true]),
        col.links.map((l) => [l.href, l.l2 === true]),
        `${expected.id} / ${col.heading} links`,
      );
      for (const [li, link] of col.links.entries()) {
        if (link.label !== undefined) assert.equal(got[li]?.label, link.label, `${expected.id} / ${col.heading} label ${link.href}`);
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
  assert.deepEqual(nav.map((i) => i.id), ['program', 'pricing']);
  const program = nav[0];
  assert.ok(program !== undefined && program.kind === 'mega');
  assert.deepEqual(program.columns.flatMap((c) => c.links.map((l) => l.href)), ['/program/how-it-works/']);
});
