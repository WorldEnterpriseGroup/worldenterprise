import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { groupByAudience, liveBriefs, relatedFor, RELATED_LIMIT, sectionCount, staticPaths } from '../../../src/components/briefs/plan.ts';
import type { BriefAbstract, BriefRegistryRow } from '../../../src/components/briefs/plan.ts';
import { BRIEFS } from '../../../src/data/families.ts';
import { liveRoutesAt } from '../wp-60/live-routes.ts';

const root = new URL('../../../', import.meta.url).pathname;

/**
 * The squeeze-page plan on fixtures of 1, 3 and 10 abstracts and on a registry entry that does not launch (docs/wave8-contracts.md
 * section 5). The functions are the ones the pages call, so a page can only differ from this by how it renders what the plan returns.
 */
const row = (slug: string, order: number, over: Partial<BriefRegistryRow> = {}): BriefRegistryRow => ({
  slug,
  path: `/briefs/${slug}/`,
  label: slug,
  order,
  launch: true,
  audience: ['startup'],
  desks: ['funding'],
  ...over,
});

const abstract = (id: string, over: { draft?: boolean; outline?: readonly string[] } = {}): BriefAbstract => ({
  id,
  data: {
    title: `Title of ${id}`,
    subtitle: `Subtitle of ${id}`,
    description: `Description of ${id}, long enough to be a description for the plan and nothing else.`,
    topics: ['funding'],
    audience: ['startup'],
    outline: over.outline ?? ['One', 'Two', 'Three'],
    updated: new Date('2026-10-10T00:00:00Z'),
    ...(over.draft !== undefined ? { draft: over.draft } : {}),
  },
  body: 'A short abstract.',
});

const ten = Array.from({ length: 10 }, (_, i) => row(`brief-${i + 1}`, i + 1));

for (const count of [1, 3, 10]) {
  test(`${count} abstract${count === 1 ? '' : 's'}: one route each, in registry order, with the registry id as the param`, () => {
    const abstracts = ten.slice(0, count).map((r) => abstract(r.slug)).reverse();
    const paths = staticPaths(ten, abstracts);
    assert.equal(paths.length, count);
    assert.deepEqual(paths.map((p) => p.params.id), ten.slice(0, count).map((r) => r.slug));
    for (const p of paths) assert.equal(p.props.brief.row.path, `/briefs/${p.params.id}/`);
  });

  test(`${count} abstract${count === 1 ? '' : 's'}: related briefs never include the brief itself and never exceed ${RELATED_LIMIT}`, () => {
    const live = liveBriefs(ten, ten.slice(0, count).map((r) => abstract(r.slug)));
    for (const entry of live) {
      const related = relatedFor(entry.row.slug, live);
      assert.ok(related.length <= RELATED_LIMIT);
      assert.ok(!related.some((r) => r.row.slug === entry.row.slug));
      assert.equal(related.length, Math.min(RELATED_LIMIT, count - 1));
    }
  });
}

test('a registry entry that does not launch yields no route, though its abstract exists', () => {
  const registry = [row('open', 1), row('cut', 2, { launch: false })];
  const paths = staticPaths(registry, [abstract('open'), abstract('cut')]);
  assert.deepEqual(paths.map((p) => p.params.id), ['open']);
});

test('a registry entry with no abstract yields no route', () => {
  assert.deepEqual(staticPaths([row('a', 1), row('b', 2)], [abstract('a')]).map((p) => p.params.id), ['a']);
});

test('a draft abstract has no route in a release build and one in a preview build', () => {
  const registry = [row('a', 1), row('b', 2)];
  const abstracts = [abstract('a'), abstract('b', { draft: true })];
  assert.deepEqual(staticPaths(registry, abstracts).map((p) => p.params.id), ['a']);
  assert.deepEqual(staticPaths(registry, abstracts, { includeDrafts: true }).map((p) => p.params.id), ['a', 'b']);
});

test('an abstract that is not in the registry is a content error, and so is a duplicate', () => {
  assert.throws(() => liveBriefs([row('a', 1)], [abstract('not-in-the-registry')]), /not in the registry/);
  assert.throws(() => liveBriefs([row('a', 1)], [abstract('a'), abstract('a')]), /appears twice/);
});

test('with no abstract at all there is no route and no group', () => {
  assert.deepEqual(staticPaths(ten, []), []);
  assert.deepEqual(groupByAudience(liveBriefs(ten, [])), []);
});

test('the hub groups by audience in the order of the enum, lists a multi-audience brief under each, and omits an empty audience', () => {
  const registry = [
    row('s1', 1),
    row('i1', 2, { audience: ['investor'], desks: ['fundable'] }),
    row('both', 3, { audience: ['startup', 'investor'] }),
  ];
  const groups = groupByAudience(liveBriefs(registry, registry.map((r) => abstract(r.slug))));
  assert.deepEqual(groups.map((g) => g.audience), ['startup', 'investor']);
  assert.deepEqual(groups[0]?.briefs.map((b) => b.row.slug), ['s1', 'both']);
  assert.deepEqual(groups[1]?.briefs.map((b) => b.row.slug), ['i1', 'both']);
});

test('related briefs rank a shared desk above a shared audience, then registry order', () => {
  const registry = [
    row('self', 1, { desks: ['legal'] }),
    row('same-audience', 2, { desks: ['ai'] }),
    row('same-desk', 3, { desks: ['legal'], audience: ['investor'] }),
  ];
  const live = liveBriefs(registry, registry.map((r) => abstract(r.slug)));
  assert.deepEqual(relatedFor('self', live).map((r) => r.row.slug), ['same-desk', 'same-audience']);
  assert.deepEqual(relatedFor('self', live, 1).map((r) => r.row.slug), ['same-desk']);
  assert.deepEqual(relatedFor('unknown', live), []);
});

test('the section count is the outline length, never a reading time', () => {
  assert.equal(sectionCount(abstract('a', { outline: ['One', 'Two'] })), 2);
  assert.equal(sectionCount(abstract('a', { outline: [] })), 0);
});

test('the working tree: the hub, the thanks page and each launched brief with an abstract are live routes, and a cut brief never is', () => {
  const live = liveRoutesAt(root);
  assert.ok(live.has('/briefs/'), 'the hub is live from its page file');
  assert.ok(live.has('/briefs/thanks/'), 'the thanks page is live');
  for (const entry of BRIEFS.entries) {
    const hasAbstract = existsSync(join(root, 'src/content/briefs', `${entry.slug}.md`));
    assert.equal(live.has(entry.path), entry.launch && hasAbstract, `${entry.path}: launch ${String(entry.launch)}, abstract ${String(hasAbstract)}`);
  }
});
