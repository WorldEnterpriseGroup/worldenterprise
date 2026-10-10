import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import * as claimsAudit from '../../../scripts/audit-claims.mjs';
import { ARTICLE_DESKS, FAMILY_SURFACES, findSurface, resolveCta, resolveMidCta, targetFor, withCtaItem } from '../../../src/data/cta/index.ts';
import type { CtaModel, FamilyKey } from '../../../src/data/cta/index.ts';
import { DESKS } from '../../../src/data/desks.ts';
import { FAMILIES, familyPaths } from '../../../src/data/families.ts';

/**
 * The default call to action of every page family (docs/wave8-contracts.md, section 6.2; W8-25). `FAMILY_SURFACES` is the table of what
 * each family is meant to carry; `map.ts` is what decides it. The tests hold the two together and hold the table to the registry, so a
 * family that is added without a row, a desk that is added without an article row, or a surface that loses its band fails here.
 */
const root = new URL('../../../', import.meta.url).pathname;
const read = (rel: string): string => readFileSync(join(root, rel), 'utf8');

const live = (): boolean => true;
const only =
  (...paths: string[]) =>
  (path: string): boolean =>
    paths.includes(path);
const none = (): boolean => false;

/** The families that exist as collections and sections, not registry entries. A new one is listed in `LegacyFamily` and here. */
const LEGACY_FAMILIES: readonly FamilyKey[] = [
  'home', 'program', 'pricing', 'services', 'founders-hub', 'articles', 'playbooks', 'guides', 'library', 'tools', 'research', 'hubs',
  'investors', 'network', 'partners', 'about', 'form-and-machine',
];

const hrefOf = (key: string | undefined): string | undefined => (key === undefined ? undefined : targetFor(key as Parameters<typeof targetFor>[0])?.href);

test('every family of the registry and every legacy family has at least one row', () => {
  const covered = new Set(FAMILY_SURFACES.map((row) => row.family));
  for (const family of FAMILIES) assert.ok(covered.has(family.id), `the page family "${family.id}" has no entry in src/data/cta/families.ts`);
  for (const family of LEGACY_FAMILIES) assert.ok(covered.has(family), `the family "${family}" has no entry in src/data/cta/families.ts`);
});

test('every desk has an article row, and the rows have unique ids', () => {
  const rows = FAMILY_SURFACES.filter((row) => row.family === 'articles');
  assert.deepEqual(ARTICLE_DESKS, DESKS);
  assert.deepEqual(rows.map((row) => row.input.topic).sort(), [...DESKS].sort());
  const ids = FAMILY_SURFACES.map((row) => row.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every row is decided by a row of the map of its own, never by the layout default', () => {
  for (const row of FAMILY_SURFACES) assert.equal(findSurface(row.input).fallback, false, `${row.id} falls to the layout default`);
});

test('every path a registry family registers is held by a row of the map, and its entries carry a band unless they are form pages', () => {
  for (const family of FAMILIES) {
    for (const path of familyPaths(family)) {
      const input = { path, collection: family.collection === 'briefs' ? ('briefs' as const) : ('pages' as const) };
      assert.equal(findSurface(input).fallback, false, `${path} falls to the layout default`);
      const model = resolveCta(input, live);
      if (family.id === 'briefs' && path !== '/briefs/') assert.equal(model, null, `${path} is a form page and carries no band`);
      else assert.ok(model !== null, `${path} carries no band`);
    }
  }
});

test('with every target live, each row resolves to the primary and the secondary the contract names', () => {
  for (const row of FAMILY_SURFACES) {
    const model = resolveCta(row.input, live);
    if (row.expect === null) {
      assert.equal(model, null, `${row.id} carries a band`);
      assert.equal(resolveMidCta(row.input, live), null, `${row.id} carries a mid-body band`);
      continue;
    }
    assert.ok(model !== null, `${row.id} carries no band`);
    assert.equal(model.primary.href, hrefOf(row.expect.primary), `${row.id}: primary`);
    assert.equal(model.secondary?.href, hrefOf(row.expect.secondary), `${row.id}: secondary`);
    const mid = resolveMidCta(row.input, live);
    assert.equal(mid?.primary.href, hrefOf(row.expect.mid), `${row.id}: mid-body band`);
  }
});

test('every band has one primary and at most one secondary, and the two are never the same page', () => {
  for (const row of FAMILY_SURFACES) {
    const model = resolveCta(row.input, live);
    if (model === null) continue;
    assert.ok(model.primary.label !== '' && model.primary.href.startsWith('/'), `${row.id}: primary`);
    if (model.secondary !== undefined) assert.notEqual(model.secondary.href, model.primary.href, `${row.id}: the secondary repeats the primary`);
  }
});

test('on a ledger with no live brief, an article band falls back to the Apply action', () => {
  const ledger = only('/apply/', '/briefs/', '/tools/', '/industries/');
  for (const row of FAMILY_SURFACES.filter((r) => r.family === 'articles')) {
    const model = resolveCta(row.input, ledger);
    assert.ok(model !== null, row.id);
    const brief = row.expect?.primary.startsWith('brief:') === true;
    if (brief) assert.equal(model.primary.href, '/apply/', `${row.id}: the brief is not live, so the band offers Apply`);
    assert.notEqual(model.primary.href, model.secondary?.href, row.id);
  }
});

test('a secondary that points at a page that is not live is dropped, and a band with no live primary renders nothing', () => {
  const industry = FAMILY_SURFACES.find((row) => row.id === 'industries:hub');
  const home = FAMILY_SURFACES.find((row) => row.id === 'home');
  assert.ok(industry !== undefined && home !== undefined);
  assert.equal(resolveCta(industry.input, only('/apply/', '/insights/topic/sectors/'))?.secondary?.href, '/insights/topic/sectors/');
  assert.equal(resolveCta(industry.input, only('/apply/', '/briefs/'))?.secondary?.href, '/briefs/');
  assert.equal(resolveCta(industry.input, only('/apply/'))?.secondary, undefined);
  assert.equal(resolveCta(home.input, only('/apply/'))?.secondary, undefined);
  assert.equal(resolveCta(home.input, none), null);
  for (const row of FAMILY_SURFACES) assert.equal(resolveCta(row.input, none), null, `${row.id}: no live target, so no band`);
});

test('the family default of an investor page and a partner page is its own variant, and each band keeps the funding sentence honest', () => {
  const investors = resolveCta({ path: '/investors/', collection: 'pages' }, live);
  const partners = resolveCta({ path: '/network/partners/', collection: 'pages' }, live);
  assert.equal(investors?.variant, 'investor-interest');
  assert.equal(investors?.audience, 'investor');
  assert.equal(partners?.variant, 'partner-enquiry');
  assert.equal(partners?.audience, 'partner');
  const funding = resolveCta({ path: '/insights/sample-funding/', collection: 'insights', topic: 'funding' }, live);
  assert.equal(funding?.note, 'WE makes no promise of funding.');
});

// ---------------------------------------------------------------------------------------------------------------------------------
// The "Next" list
// ---------------------------------------------------------------------------------------------------------------------------------

const MODEL: CtaModel = {
  id: 'apply',
  audience: 'startup',
  variant: 'apply',
  heading: 'Tell WE about your company',
  body: 'The application form asks about your company, your team and what you are building.',
  primary: { label: 'Tell WE about your company', href: '/apply/' },
};

test('the Next list ends with the primary action of the page, once, and only when there is one', () => {
  const items = [{ title: 'Read the program', href: '/program/how-it-works/' }];
  assert.deepEqual(withCtaItem(items, MODEL).map((i) => i.href), ['/program/how-it-works/', '/apply/']);
  assert.equal(withCtaItem(items, MODEL)[1]?.description, MODEL.body);
  assert.deepEqual(withCtaItem([...items, { title: 'Apply', href: '/apply/' }], MODEL).map((i) => i.href), ['/program/how-it-works/', '/apply/']);
  assert.equal(withCtaItem(items, null), items);
  assert.deepEqual(withCtaItem([], MODEL).map((i) => i.href), ['/apply/']);
});

test('ContextualNext keeps its props and resolves through resolveCta only when it is given the place of the page', () => {
  const source = read('src/components/blocks/ContextualNext.astro');
  assert.match(source, /items: readonly NextItem\[\];\s*title\?: string;/);
  assert.match(source, /resolveCta\(/);
  assert.match(source, /state\.isLive/);
  assert.match(source, /cta === undefined/);
});

// ---------------------------------------------------------------------------------------------------------------------------------
// The surfaces keep to the policy
// ---------------------------------------------------------------------------------------------------------------------------------

test('the end band renders no tracking attribute beyond data-cta, no script, no autofocus and nothing that moves', () => {
  for (const file of ['src/components/cta/CtaBand.astro', 'src/components/cta/CtaAside.astro', 'src/components/cta/CtaEnd.astro', 'src/components/cta/AudienceStrip.astro']) {
    const text = read(file).replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(text, /data-cta-|data-track|data-analytics|data-gtm|<script|autofocus|onclick|ping=/i, file);
  }
  const css = read('src/components/cta/cta.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(css, /position:\s*(?:sticky|fixed)|@keyframes|animation|transform|(?:margin|inset|top|left)[^;]*transition/, 'the band never moves or sticks');
  assert.match(read('src/components/cta/CtaBand.astro'), /data-cta=\{placement\}/);
});

test('every model of the table passes the claims denylist', () => {
  const audit = claimsAudit as unknown as { scan(text: string, options?: { route?: string; plain?: boolean; flagValues?: object }): { rule: string }[] };
  for (const row of FAMILY_SURFACES) {
    for (const model of [resolveCta(row.input, live), resolveMidCta(row.input, live)]) {
      if (model === null) continue;
      for (const text of [model.heading, model.body, model.note, model.primary.label, model.secondary?.label]) {
        if (text === undefined) continue;
        assert.deepEqual(audit.scan(text, { route: row.input.path, plain: true, flagValues: {} }), [], `${row.id}: "${text}"`);
      }
    }
  }
});
