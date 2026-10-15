import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { DESK_DEFINITIONS, DESKS } from '../../../src/data/desks.ts';
import { FAMILIES } from '../../../src/data/families.ts';
import { buildRoutes, finalizeRow, L2_RESERVED, MACHINE_ROUTES, routes } from '../../../src/data/routes.ts';
import type { LayoutName, RouteRow } from '../../../src/data/routes.ts';
import { listCollectionFiles, listInsightFiles } from '../../../src/lib/content-files.ts';

/**
 * Invariants, not counts (decision D-20, contracts section 1.3): the ledger grows with the files on disk and the two registries,
 * so no test pins how many rows or articles exist. What must hold is stated as a rule and checked for every row.
 */
const root = new URL('../../../', import.meta.url).pathname;

const LAYOUTS: readonly LayoutName[] = [
  'HomeLayout', 'MarketingLayout', 'HubLayout', 'StageLayout', 'ServiceLayout', 'PlaybookLayout', 'GuideLayout', 'ArticleHub', 'ArticleLayout',
  'BriefLayout', 'TemplateLayout', 'ToolLayout', 'FormLayout', 'ReferenceLayout', 'LegalLayout',
];

/** The routes that are not indexed. A route joins this list by an explicit edit here, never by accident. */
const NOINDEX = ['/404.html', '/apply/thanks/', '/briefs/thanks/', '/investors/interest/thanks/', '/network/partners/enquire/thanks/', '/pricing/', '/search/', '/sitemap/'];

test('every row path is unique', () => {
  const paths = routes.map((r) => r.path);
  assert.deepEqual(paths.filter((p, i) => paths.indexOf(p) !== i), []);
});

test('paths are site-relative with a trailing slash, except file routes', () => {
  for (const r of routes) {
    assert.match(r.path, /^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*\/|404\.html)?$/, r.path);
  }
});

test('every row has a known layout and a package owner', () => {
  for (const r of routes) {
    assert.ok(LAYOUTS.includes(r.layout), `${r.path}: unknown layout ${r.layout}`);
    assert.match(r.owner, /^WP-\d{2}$/, `${r.path}: owner`);
  }
});

test('indexable rows are all rows minus the declared noindex set', () => {
  const noindex = routes.filter((r) => !r.indexable).map((r) => r.path).sort();
  assert.deepEqual(noindex, [...NOINDEX].sort());
  assert.equal(routes.filter((r) => r.indexable).length, routes.length - NOINDEX.length);
});

test('a launched row never requires evidence it has no source for', () => {
  for (const r of [...routes, ...L2_RESERVED]) {
    if (r.requires !== undefined && r.requires.length > 0 && r.source === undefined) assert.equal(r.launch, false, r.path);
  }
});

test('every article file has exactly one row, owned by its desk owner', () => {
  const files = listInsightFiles(root);
  assert.ok(files.length > 0, 'the repository holds articles, so the check cannot pass over an empty list');
  const articleRows = routes.filter((r) => r.layout === 'ArticleLayout');
  assert.equal(articleRows.length, files.length);
  for (const f of files) {
    const rows = routes.filter((r) => r.path === `/insights/${f.slug}/`);
    assert.equal(rows.length, 1, f.file);
    assert.equal(rows[0]?.owner, DESK_DEFINITIONS.find((d) => d.id === f.desk)?.owner, f.file);
  }
});

test('every desk has one topic row, launched exactly when the desk holds an article', () => {
  const held = new Set(listInsightFiles(root).map((f) => f.desk));
  const deskRows = routes.filter((r) => r.path.startsWith('/insights/topic/'));
  assert.deepEqual(deskRows.map((r) => r.path), DESKS.map((d) => `/insights/topic/${d}/`));
  for (const d of DESK_DEFINITIONS) {
    const found = routes.find((r) => r.path === `/insights/topic/${d.id}/`);
    assert.equal(found?.launch, held.has(d.id), `${d.id}`);
    assert.equal(found?.owner, d.owner, `${d.id}`);
  }
});

test('every file of the flat collections has exactly one row', () => {
  const slugs = (collection: string): string[] => listCollectionFiles(root, collection).map((f) => f.replace(/\.mdx?$/, ''));
  for (const [collection, prefix] of [['playbooks', '/playbooks/'], ['guides', '/fundability/'], ['library', '/library/']] as const) {
    for (const slug of slugs(collection)) assert.equal(routes.filter((r) => r.path === `${prefix}${slug}/`).length, 1, `${collection}/${slug}`);
  }
});

test('every family registers its hub and one row per entry, with the registry launch flag', () => {
  for (const family of FAMILIES) {
    if (family.hub !== undefined) assert.ok(routes.some((r) => r.path === family.hub?.path), `${family.id} hub`);
    for (const e of family.entries) {
      const found = routes.find((r) => r.path === e.path);
      assert.ok(found !== undefined, `${family.id}/${e.slug} has a row`);
      assert.equal(found.launch, e.launch, `${family.id}/${e.slug} launch`);
      assert.equal(found.owner, e.owner, `${family.id}/${e.slug} owner`);
    }
  }
});

test('the routes of the earlier waves are still registered', () => {
  const paths = new Set(routes.map((r) => r.path));
  for (const p of ['/', '/program/how-it-works/', '/apply/', '/pricing/', '/insights/', '/insights/topic/dream/', '/research/', '/library/', '/faq/', '/glossary/', '/legal/privacy/', '/tools/', '/about/facts/']) {
    assert.ok(paths.has(p), p);
  }
});

test('a row with requires and no source is forced to launch:false', () => {
  const forced = finalizeRow({ path: '/x/', layout: 'HubLayout', owner: 'WP-01', requires: ['people'], launch: true });
  assert.equal(forced.launch, false);
  const sourced = finalizeRow({ path: '/x/', layout: 'HubLayout', owner: 'WP-01', requires: ['people'], source: 'consent form 2026-01-01' });
  assert.equal(sourced.launch, true);
});

test('every L2 row is unlaunched and absent from the launch ledger', () => {
  const ledgerPaths = new Set(routes.map((r) => r.path));
  for (const r of L2_RESERVED) {
    assert.equal(r.launch, false, r.path);
    assert.equal(ledgerPaths.has(r.path), false, r.path);
  }
});

test('newsletter and terms rows derive launch from forms and flags (both off by default)', () => {
  assert.equal(routes.find((r) => r.path === '/newsletter/')?.launch, false);
  assert.equal(routes.find((r) => r.path === '/legal/terms/')?.launch, false);
});

test('security.txt launches only with a confirmed security contact', () => {
  assert.equal(MACHINE_ROUTES.find((m) => m.path === '/.well-known/security.txt')?.launch, false);
});

// ---------------------------------------------------------------------------------------------------------------------------------
// The derivation itself, over a fabricated content directory
// ---------------------------------------------------------------------------------------------------------------------------------

const made: string[] = [];
after(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

/** A fabricated repository root holding only the content files listed. */
function fabricate(files: readonly string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'ledger-'));
  made.push(dir);
  mkdirSync(join(dir, 'src', 'content'), { recursive: true });
  for (const file of files) {
    const full = join(dir, 'src', 'content', file);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, '---\ntitle: A title\n---\n');
  }
  return dir;
}

const rowOf = (rows: readonly RouteRow[], path: string): RouteRow | undefined => rows.find((r) => r.path === path);

test('a fabricated article in a new desk gets a row, a launched desk row and the desk owner', () => {
  const rows = buildRoutes(fabricate(['insights/funding/a-new-article.mdx']));
  assert.equal(rowOf(rows, '/insights/a-new-article/')?.layout, 'ArticleLayout');
  assert.equal(rowOf(rows, '/insights/a-new-article/')?.owner, 'WP-66');
  assert.equal(rowOf(rows, '/insights/topic/funding/')?.launch, true);
  assert.equal(rowOf(rows, '/insights/topic/legal/')?.launch, false, 'an empty desk is not launched');
});

test('with no article the ledger registers every desk, none launched', () => {
  const rows = buildRoutes(fabricate([]));
  assert.equal(rows.filter((r) => r.layout === 'ArticleLayout').length, 0);
  for (const d of DESKS) assert.equal(rowOf(rows, `/insights/topic/${d}/`)?.launch, false, d);
});

test('new playbook, guide and library files each get a row after the earlier ones', () => {
  const rows = buildRoutes(fabricate(['playbooks/zeta-new.mdx', 'playbooks/validate-the-problem.mdx', 'guides/new-guide.mdx', 'library/new-template.md']));
  assert.equal(rowOf(rows, '/playbooks/zeta-new/')?.layout, 'PlaybookLayout');
  assert.equal(rowOf(rows, '/fundability/new-guide/')?.layout, 'GuideLayout');
  assert.equal(rowOf(rows, '/library/new-template/')?.layout, 'TemplateLayout');
  const playbooks = rows.filter((r) => r.layout === 'PlaybookLayout').map((r) => r.path);
  assert.deepEqual(playbooks, ['/playbooks/validate-the-problem/', '/playbooks/zeta-new/']);
});

test('an article in an unknown desk, a duplicate slug, a reserved slug or the wrong depth fails loudly', () => {
  assert.throws(() => buildRoutes(fabricate(['insights/finance/a.mdx'])), /not a desk/);
  assert.throws(() => buildRoutes(fabricate(['insights/funding/a.mdx', 'insights/legal/a.mdx'])), /already used/);
  assert.throws(() => buildRoutes(fabricate(['insights/funding/topic.mdx'])), /reserved slug/);
  assert.throws(() => buildRoutes(fabricate(['insights/loose-article.mdx'])), /one folder deep/);
  assert.throws(() => buildRoutes(fabricate(['insights/funding/Not_A_Slug.mdx'])), /not a slug/);
  assert.throws(() => buildRoutes(fabricate(['playbooks/nested/deep.mdx'])), /directly in its folder/);
});

test('a wrong working directory fails instead of reading as empty', () => {
  assert.throws(() => buildRoutes(join(tmpdir(), 'no-such-repository-root')), /No content directory/);
});
