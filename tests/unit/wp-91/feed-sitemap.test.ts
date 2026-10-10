import assert from 'node:assert/strict';
import test from 'node:test';
import { getRssString } from '@astrojs/rss';
import * as geoAudit from '../../../scripts/audit-geo.mjs';
import { feedItems } from '../../../src/components/geo/feed.ts';
import type { FeedEntry } from '../../../src/components/geo/feed.ts';
import { FAMILY_LABELS } from '../../../src/components/geo/llms-plan.ts';
import { DESK_DEFINITIONS, deskPath } from '../../../src/data/desks.ts';
import { familyLabel, FAMILIES } from '../../../src/data/families.ts';
import { routes } from '../../../src/data/routes.ts';
import { site } from '../../../src/data/site.ts';
import { groupSitemapRoutes, isSitemapUrl } from '../../../src/lib/seo.ts';

const geo = geoAudit as unknown as { xmlProblem(xml: string): string | null };

const entry = (id: string, title: string, date: string, topic?: string): FeedEntry => ({ id, data: { title, description: `About ${title}.`, publishedDate: new Date(date), topic } });

const insights: FeedEntry[] = [
  entry('dream/first', 'First', '2026-09-01', 'dream'),
  entry('ai/second', 'Second', '2026-10-02', 'ai'),
  entry('dream/hidden', 'Hidden', '2026-10-05', 'dream'),
];
const research: FeedEntry[] = [entry('metrics', 'Metrics', '2026-09-20')];
const live = (route: string): boolean => route !== '/insights/hidden/';

test('the feed lists live insights and research newest first, with the desk label as the category', () => {
  const items = feedItems(insights, research, live);
  assert.deepEqual(items.map((i) => i.path), ['/insights/second/', '/research/metrics/', '/insights/first/']);
  assert.deepEqual(items.map((i) => i.category), [DESK_DEFINITIONS.find((d) => d.id === 'ai')?.name, 'Research', DESK_DEFINITIONS.find((d) => d.id === 'dream')?.name]);
});

test('a route that is not live, a thank-you page and every non-article route are never in the feed', () => {
  const items = feedItems(insights, research, () => false);
  assert.deepEqual(items, []);
  const everything = feedItems(insights, research, () => true).map((i) => i.path);
  assert.ok(everything.every((p) => /^\/(insights|research)\/[^/]+\/$/.test(p)));
  assert.ok(!everything.some((p) => p.includes('thanks')));
});

test('an article of a desk the registry gains later is in the feed with no edit to the feed code', () => {
  const items = feedItems([entry('brand-new-desk/post', 'Post', '2026-10-03', 'brand-new-desk')], [], () => true);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.category, 'Insights');
});

test('the generated RSS is well-formed XML with one item per live article and an atom self link, and an empty feed is valid too', async () => {
  const build = async (items: ReturnType<typeof feedItems>): Promise<string> =>
    getRssString({
      title: `${site.name}: insights and research`,
      description: 'A feed.',
      site: new URL(site.origin),
      xmlns: { atom: 'http://www.w3.org/2005/Atom' },
      customData: `<atom:link href="${site.origin}/rss.xml" rel="self" type="application/rss+xml" /><language>en-us</language>`,
      items: items.map((i) => ({ title: i.title, description: i.description, link: i.path, pubDate: i.pubDate, categories: [i.category] })),
    });
  const xml = await build(feedItems(insights, research, live));
  assert.equal(geo.xmlProblem(xml), null);
  assert.equal(xml.match(/<item>/g)?.length, 3);
  assert.ok(xml.includes('rel="self"'));
  assert.ok(xml.includes('<category>Research</category>'));
  assert.ok(!xml.includes('Hidden'));
  assert.equal(geo.xmlProblem(await build([])), null);
});

const launched = routes.filter((r) => r.launch);
const urlOf = (path: string): string => new URL(path, site.origin).href;

test('the sitemap lists exactly the launched, indexable routes of the ledger (acceptance)', () => {
  const listed = launched.map((r) => r.path).filter((path) => isSitemapUrl(urlOf(path))).sort();
  const wanted = launched.filter((r) => r.indexable).map((r) => r.path).sort();
  assert.deepEqual(listed, wanted);
});

test('a thank-you page, a styleguide page and a fixture are never in the sitemap', () => {
  const thanks = routes.filter((r) => r.path.endsWith('/thanks/'));
  assert.ok(thanks.length > 0);
  for (const row of thanks) assert.equal(isSitemapUrl(urlOf(row.path)), false, row.path);
  assert.equal(isSitemapUrl(urlOf('/styleguide/')), false);
  assert.equal(isSitemapUrl(urlOf('/fixture-one/')), false);
});

test('the HTML sitemap names every desk and every family route from the registries, not from a hand list', () => {
  const labels = new Map<string, string>();
  for (const desk of DESK_DEFINITIONS) labels.set(deskPath(desk.id), desk.name);
  for (const family of FAMILIES) {
    if (family.hub !== undefined) labels.set(family.hub.path, FAMILY_LABELS[family.id]);
    for (const e of family.entries) labels.set(e.path, familyLabel(e));
  }
  const paths = [...labels.keys()];
  const sections = groupSitemapRoutes(paths, (path) => labels.get(path));
  const links = sections.flatMap((s) => s.links);
  assert.equal(links.length, paths.length, 'no route is dropped');
  for (const link of links) assert.equal(link.label, labels.get(link.href), link.href);
});
