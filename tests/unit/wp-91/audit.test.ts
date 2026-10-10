import assert from 'node:assert/strict';
import test from 'node:test';
import * as geoAudit from '../../../scripts/audit-geo.mjs';
import { LLMS_SECTIONS } from '../../../scripts/audit-geo.mjs';
import { routes } from '../../../src/data/routes.ts';
import { isSitemapUrl } from '../../../src/lib/seo.ts';

interface Geo {
  routeOfUrl(url: string, options?: { origin?: string; base?: string }): string | null;
  xmlProblem(xml: string): string | null;
  auditSitemap(xml: string | undefined, pages: Map<string, string>, options: { base?: string; preview?: boolean; isListed: (route: string) => boolean }): string[];
  auditRss(xml: string | undefined, pages: Map<string, string>, options?: { base?: string }): string[];
  auditPalette(hrefs: string[] | null, pages: Map<string, string>): string[];
  paletteHrefs(html: string): string[] | null;
  auditMachineLists(lists: { name: string; routes: (string | null)[] }[]): string[];
  llmsRoutes(text: string, options?: { base?: string }): string[];
}
const geo = geoAudit as unknown as Geo;

const ORIGIN = 'https://worldenterprise.org';
const isListed = (route: string): boolean => isSitemapUrl(`${ORIGIN}${route}`);

const launched = routes.filter((r) => r.launch).map((r) => r.path);
const pages = new Map<string, string>(launched.map((route) => [route, '<html></html>']));
const listedRoutes = launched.filter(isListed);
const sitemapOf = (paths: readonly string[], base = ''): string =>
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((p) => `<url><loc>${ORIGIN}${base}${p}</loc></url>`).join('')}</urlset>`;

test('LLMS_SECTIONS has the two generated sections as optional, after Key pages and before How WE decides', () => {
  const headings = LLMS_SECTIONS.map((s) => s.heading);
  assert.ok(headings.indexOf('Insight desks') === headings.indexOf('Key pages') + 1);
  assert.ok(headings.indexOf('Page families') === headings.indexOf('Insight desks') + 1);
  assert.ok(headings.indexOf('How WE decides') === headings.indexOf('Page families') + 1);
  for (const heading of ['Insight desks', 'Page families']) assert.equal(LLMS_SECTIONS.find((s) => s.heading === heading)?.optional, true);
});

test('a sitemap of exactly the listed ledger routes passes, with and without a preview base path', () => {
  assert.deepEqual(geo.auditSitemap(sitemapOf(listedRoutes), pages, { isListed }), []);
  const based = new Map([...pages].map(([route, html]) => [route, html]));
  assert.deepEqual(geo.auditSitemap(sitemapOf(listedRoutes, '/worldenterprise'), based, { base: '/worldenterprise', isListed }), []);
});

test('the sitemap check fails for a thank-you page, a missing page, a duplicate, a page that is not built and a foreign URL', () => {
  const thanks = launched.find((p) => p.endsWith('/thanks/'));
  assert.ok(thanks !== undefined);
  assert.ok(geo.auditSitemap(sitemapOf([...listedRoutes, thanks]), pages, { isListed }).some((e) => e.includes(thanks)));
  const first = listedRoutes[0];
  assert.ok(first !== undefined);
  assert.ok(geo.auditSitemap(sitemapOf(listedRoutes.slice(1)), pages, { isListed }).some((e) => e.includes(`${first} is a built, indexable page`)));
  assert.ok(geo.auditSitemap(sitemapOf([...listedRoutes, first]), pages, { isListed }).some((e) => e.includes('twice')));
  assert.ok(geo.auditSitemap(sitemapOf([...listedRoutes, '/not-built/']), pages, { isListed }).some((e) => e.includes('/not-built/')));
  assert.ok(geo.auditSitemap(sitemapOf(listedRoutes).replace(ORIGIN, 'https://elsewhere.example'), pages, { isListed }).some((e) => e.includes('is not on')));
  assert.ok(geo.auditSitemap(undefined, pages, { isListed }).length === 1);
});

test('a listed page marked noindex is an error in production, and a new family route must be in the sitemap once its page is built', () => {
  const route = listedRoutes[1];
  assert.ok(route !== undefined);
  const marked = new Map(pages).set(route, '<meta name="robots" content="noindex,nofollow">');
  assert.ok(geo.auditSitemap(sitemapOf(listedRoutes), marked, { isListed }).some((e) => e.includes('marked noindex')));
  const withNew = new Map(pages).set('/founders/new-segment/', '<html></html>');
  const quiet = (r: string): boolean => r === '/founders/new-segment/' || isListed(r);
  assert.ok(geo.auditSitemap(sitemapOf(listedRoutes), withNew, { isListed: quiet }).some((e) => e.includes('/founders/new-segment/ is a built, indexable page')));
});

test('a preview build checks the structure of the sitemap and leaves the set comparison to production', () => {
  const sitemap = sitemapOf(launched, '/worldenterprise');
  assert.deepEqual(geo.auditSitemap(sitemap, pages, { base: '/worldenterprise', preview: true, isListed }), []);
  assert.ok(geo.auditSitemap(sitemapOf(['/nowhere/'], '/worldenterprise'), pages, { base: '/worldenterprise', preview: true, isListed }).length > 0);
});

const item = (route: string, extra = ''): string =>
  `<item><title>T</title><link>${ORIGIN}${route}</link><guid isPermaLink="true">${ORIGIN}${route}</guid><description>D</description><pubDate>Mon, 05 Oct 2026 00:00:00 GMT</pubDate>${extra}</item>`;
const feed = (items: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>Feed</title><description>A feed.</description><link>${ORIGIN}/</link><atom:link href="${ORIGIN}/rss.xml" rel="self" type="application/rss+xml"/><language>en-us</language>${items}</channel></rss>`;
const articles = new Map<string, string>([...pages, ['/insights/a/', ''], ['/insights/b/', ''], ['/research/c/', '']]);

test('a feed of live articles validates, and an empty feed is valid', () => {
  assert.deepEqual(geo.auditRss(feed(`${item('/insights/a/')}${item('/research/c/')}`), articles), []);
  assert.deepEqual(geo.auditRss(feed(''), articles), []);
  assert.deepEqual(geo.auditRss(feed(item('/insights/a/', '<category>X</category>').replace(ORIGIN, `${ORIGIN}/worldenterprise`).replace(ORIGIN, ORIGIN)), articles, { base: '/worldenterprise' }), []);
});

test('the feed check fails for a thank-you page, a non-article, an unbuilt page, a duplicate, a bad date and broken XML', () => {
  const problems = (xml: string): string[] => geo.auditRss(xml, articles);
  assert.ok(problems(feed(item('/apply/thanks/'))).some((e) => e.includes('not an article')));
  assert.ok(problems(feed(item('/pricing/'))).some((e) => e.includes('not an article')));
  assert.ok(problems(feed(item('/insights/missing/'))).some((e) => e.includes('was not built')));
  assert.ok(problems(feed(`${item('/insights/a/')}${item('/insights/a/')}`)).some((e) => e.includes('twice')));
  assert.ok(problems(feed(item('/insights/a/').replace('Mon, 05 Oct 2026 00:00:00 GMT', 'not a date'))).some((e) => e.includes('unparseable')));
  assert.ok(problems(feed(item('/insights/a/')).replace('</channel>', '')).some((e) => e.includes('not well-formed')));
  assert.ok(problems(feed(item('/insights/a/')).replace(/<atom:link[^>]*>/, '')).some((e) => e.includes('self link')));
  assert.equal(geo.auditRss(undefined, articles).length, 1);
});

test('the palette check fails for a command whose page was not built, and reads the list from the data attribute', () => {
  const html = `<we-palette data-commands="[{&quot;label&quot;:&quot;Apply&quot;,&quot;href&quot;:&quot;/apply/&quot;,&quot;group&quot;:&quot;Start here&quot;}]"></we-palette>`;
  assert.deepEqual(geo.paletteHrefs(html), ['/apply/']);
  assert.equal(geo.paletteHrefs('<html></html>'), null);
  assert.deepEqual(geo.auditPalette(['/apply/'], pages), []);
  assert.ok(geo.auditPalette(['/apply/', '/apply/'], pages).some((e) => e.includes('twice')));
  assert.ok(geo.auditPalette(['/not-built/'], pages).some((e) => e.includes('no page was built')));
  assert.equal(geo.auditPalette(null, pages).length, 1);
});

test('a thank-you page in the sitemap, the feed, the palette or an llms file is an error; llms links are read through their twins', () => {
  const clean = [{ name: 'palette', routes: ['/apply/'] }];
  assert.deepEqual(geo.auditMachineLists(clean), []);
  for (const name of ['sitemap-0.xml', 'rss.xml', 'palette', 'llms.txt', 'llms-full.txt']) {
    assert.deepEqual(geo.auditMachineLists([{ name, routes: ['/contact/thanks/'] }]), [`${name}: lists the thank-you page /contact/thanks/`]);
  }
  assert.deepEqual(geo.llmsRoutes(`- [x](${ORIGIN}/insights/a.md)\n- [y](${ORIGIN}/contact/thanks/)\nSource: ${ORIGIN}/faq/`), ['/insights/a/', '/contact/thanks/', '/faq/']);
  assert.deepEqual(geo.auditMachineLists([{ name: 'llms.txt', routes: geo.llmsRoutes(`[y](${ORIGIN}/apply/thanks/)`) }]).length, 1);
});

test('route and XML helpers', () => {
  assert.equal(geo.routeOfUrl(`${ORIGIN}/worldenterprise/about/`, { base: '/worldenterprise' }), '/about/');
  assert.equal(geo.routeOfUrl(`${ORIGIN}/worldenterprise/`, { base: '/worldenterprise' }), '/');
  assert.equal(geo.routeOfUrl(`${ORIGIN}/about/`), '/about/');
  assert.equal(geo.routeOfUrl('https://other.example/about/'), null);
  assert.equal(geo.xmlProblem('<a><b/><c></c></a>'), null);
  assert.ok(geo.xmlProblem('<a><b></a>') !== null);
  assert.ok(geo.xmlProblem('<a>') !== null);
});
