import assert from 'node:assert/strict';
import test from 'node:test';
import * as ledgerAudit from '../../../scripts/audit-route-ledger.mjs';
import * as linksAudit from '../../../scripts/audit-links.mjs';
import * as imagesAudit from '../../../scripts/audit-images.mjs';
import * as a11yAudit from '../../../scripts/audit-a11y.mjs';
import * as distAudit from '../../../scripts/lib/audit-dist.mjs';
import * as html from '../../../scripts/lib/html.mjs';
import { cleanSite, LEDGER, makeDist, page } from './fixture-dist.ts';

interface Finding {
  readonly level: 'error' | 'warn';
  readonly where: string;
  readonly message: string;
}
interface Page {
  readonly route: string;
  readonly file: string;
  readonly html: string;
}
interface Ledger {
  readonly routes: readonly { path: string; launch: boolean; indexable: boolean; owner: string; reason?: string }[];
  readonly machine: readonly { path: string; launch: boolean; generated: string }[];
}

const htmlApi = html as unknown as { readPages(root: string): Page[] };
const ledgerApi = ledgerAudit as unknown as {
  auditLedger(o: { distDir: string; ledger: Ledger; pages: Page[]; strict?: boolean; fileExists?: (rel: string) => boolean }): { findings: Finding[] };
};
const linksApi = linksAudit as unknown as {
  auditLinks(o: { distDir: string; pages: Page[]; ledger?: Ledger | null; strict?: boolean }): { findings: Finding[]; orphans: string[] };
};
const imagesApi = imagesAudit as unknown as {
  auditFiles(root: string): Finding[];
  auditMarkup(o: { root: string; pages: Page[] }): { findings: Finding[] };
};
const a11yApi = a11yAudit as unknown as { auditA11y(pages: Page[]): Finding[] };
const distApi = distAudit as unknown as { auditDist(o: { distDir: string; cnameFile: string }): Finding[] };

const errors = (findings: readonly Finding[]): Finding[] => findings.filter((f) => f.level === 'error');
const messages = (findings: readonly Finding[]): string => findings.map((f) => `${f.where}: ${f.message}`).join('\n');
const ledger = LEDGER as unknown as Ledger;

function pagesOf(files: Record<string, string | number>): { root: string; pages: Page[] } {
  const root = makeDist(files);
  return { root, pages: htmlApi.readPages(root) };
}

test('links: a clean site passes', () => {
  const { root, pages } = pagesOf(cleanSite());
  assert.deepEqual(errors(linksApi.auditLinks({ distDir: root, pages }).findings), []);
});

test('links: a broken internal link fails (negative proof)', () => {
  const { root, pages } = pagesOf({ ...cleanSite(), 'index.html': page({ body: '<h1>Home</h1><a href="/nope/">Gone</a>' }) });
  const found = errors(linksApi.auditLinks({ distDir: root, pages }).findings);
  assert.equal(found.length, 1);
  assert.match(found[0]?.message ?? '', /broken link: \/nope\//);
});

test('links: a link to a launched route that is not built is pending, and an error in strict mode', () => {
  const { root, pages } = pagesOf({ ...cleanSite(), 'index.html': page({ body: '<h1>Home</h1><a href="/apply/">Apply now</a><a href="/program/">The program</a>' }) });
  const relaxed = linksApi.auditLinks({ distDir: root, pages, ledger });
  assert.deepEqual(errors(relaxed.findings), []);
  assert.match(messages(relaxed.findings), /pending/);
  const strict = linksApi.auditLinks({ distDir: root, pages, ledger, strict: true });
  assert.ok(errors(strict.findings).some((f) => /pending/.test(f.message)));
});

test('links: missing fragments, insecure and unsafe external links fail', () => {
  const body = '<h1>Home</h1><a href="#absent">Jump</a><a href="http://example.org/">Plain http</a><a href="https://example.org/" target="_blank">New tab</a><a href="/program/#nope">Section</a>';
  const { root, pages } = pagesOf({ ...cleanSite(), 'index.html': page({ body }) });
  const text = messages(errors(linksApi.auditLinks({ distDir: root, pages }).findings));
  assert.match(text, /fragment #absent/);
  assert.match(text, /not https/);
  assert.match(text, /target=_blank without rel=noopener/);
  assert.match(text, /no id "nope"/);
});

test('links: orphan routes are reported', () => {
  const { root, pages } = pagesOf({ ...cleanSite(), 'index.html': page({ body: '<h1>Home</h1>' }) });
  const result = linksApi.auditLinks({ distDir: root, pages, ledger });
  assert.deepEqual(result.orphans, ['/program/']);
});

test('images: AVIF and SVG pass, a PNG file fails (negative proof)', () => {
  const root = makeDist({ ...cleanSite(), '_astro/a.avif': 100, '_astro/b.svg': '<svg/>', 'apple-touch-icon.png': 10 });
  assert.deepEqual(imagesApi.auditFiles(root), []);
  const bad = makeDist({ ...cleanSite(), '_astro/photo.png': 100 });
  assert.equal(imagesApi.auditFiles(bad).length, 1);
});

const img = (attrs: string): string => `<h1>Home</h1><img ${attrs}>`;
const good = 'src="/_astro/a.avif" alt="A desk by a window at dawn" width="512" height="384" loading="lazy" decoding="async"';

test('images: a well-formed image passes', () => {
  const { root, pages } = pagesOf({ ...cleanSite(), 'index.html': page({ body: img(good) }), '_astro/a.avif': 1000 });
  assert.deepEqual(errors(imagesApi.auditMarkup({ root, pages }).findings), []);
});

test('images: missing alt, dimensions, decoding, filler alt and lazy LCP fail (negative proof)', () => {
  const cases: [string, RegExp][] = [
    ['src="/_astro/a.avif" width="512" height="384" decoding="async"', /missing alt/],
    ['src="/_astro/a.avif" alt="x" height="384" decoding="async"', /missing width or height/],
    ['src="/_astro/a.avif" alt="x" width="512" height="384"', /decoding/],
    ['src="/_astro/a.avif" alt="Image of a desk" width="512" height="384" decoding="async"', /filler/],
    ['src="/_astro/a.avif" alt="x" width="512" height="384" decoding="async" fetchpriority="high" loading="lazy"', /LCP image is lazy/],
    ['src="https://cdn.example.org/a.avif" alt="x" width="512" height="384" decoding="async"', /external image/],
    ['src="/_astro/a.avif" alt="x" width="1400" height="800" decoding="async"', /above the 1024px cap/],
  ];
  for (const [attrs, pattern] of cases) {
    const { root, pages } = pagesOf({ ...cleanSite(), 'index.html': page({ body: img(attrs) }), '_astro/a.avif': 1000 });
    assert.match(messages(errors(imagesApi.auditMarkup({ root, pages }).findings)), pattern, attrs);
  }
});

test('images: card, band and page byte budgets are enforced', () => {
  const card = pagesOf({ ...cleanSite(), 'index.html': page({ body: img(good) }), '_astro/a.avif': 61 * 1024 });
  assert.match(messages(errors(imagesApi.auditMarkup({ root: card.root, pages: card.pages }).findings)), /card budget/);
  const band = pagesOf({ ...cleanSite(), 'index.html': page({ body: img(good.replace('512', '1024')) }), '_astro/a.avif': 121 * 1024 });
  assert.match(messages(errors(imagesApi.auditMarkup({ root: band.root, pages: band.pages }).findings)), /band budget/);
  const many = Array.from({ length: 5 }, (_, i) => `<img src="/_astro/m${i}.avif" alt="Detail ${i}" width="1024" height="576" decoding="async" loading="lazy">`).join('');
  const files: Record<string, string | number> = { ...cleanSite(), 'index.html': page({ body: `<h1>Home</h1>${many}` }) };
  for (let i = 0; i < 5; i += 1) files[`_astro/m${i}.avif`] = 100 * 1024;
  const heavy = pagesOf(files);
  assert.match(messages(errors(imagesApi.auditMarkup({ root: heavy.root, pages: heavy.pages }).findings)), /page budget/);
});

test('images: a non-AVIF og:image and a missing image file fail', () => {
  const og = pagesOf({ ...cleanSite(), 'index.html': page({ head: '<meta property="og:image" content="https://worldenterprise.org/og.jpg">' }) });
  assert.match(messages(errors(imagesApi.auditMarkup({ root: og.root, pages: og.pages }).findings)), /og:image is not AVIF/);
  const missing = pagesOf({ ...cleanSite(), 'index.html': page({ body: img(good) }) });
  assert.match(messages(errors(imagesApi.auditMarkup({ root: missing.root, pages: missing.pages }).findings)), /missing from dist/);
});

test('a11y: a clean page passes', () => {
  const { pages } = pagesOf(cleanSite());
  assert.deepEqual(errors(a11yApi.auditA11y(pages)), []);
});

test('a11y: structural defects fail (negative proof)', () => {
  const cases: [Record<string, string | number>, RegExp][] = [
    [{ 'index.html': page({ lang: null }) }, /lang/],
    [{ 'index.html': page({ body: '<h1>One</h1><h1>Two</h1>' }) }, /expected one h1, found 2/],
    [{ 'index.html': page({ body: '<h1>One</h1><h3>Skipped</h3>' }) }, /skips from h1 to h3/],
    [{ 'index.html': page({ skipLink: false }) }, /skip link/],
    [{ 'index.html': page({ body: '<h1>One</h1><p id="x"></p><p id="x"></p>' }) }, /duplicate id "x"/],
    [{ 'index.html': page({ body: '<h1>One</h1><form><input type="text" name="q"></form>' }) }, /has no label/],
    [{ 'index.html': page({ body: '<h1>One</h1><a href="/program/">click here</a>' }) }, /not descriptive/],
    [{ 'index.html': page({ body: '<h1>One</h1><a href="/program/"><img src="/a.svg" alt=""></a>' }) }, /no accessible name/],
    [{ 'index.html': page({ body: '<h1>One</h1><button></button>' }) }, /button has no accessible name/],
    [{ 'index.html': page({ body: '<h1>One</h1><div aria-labelledby="ghost"></div>' }) }, /points at no element/],
    [{ 'index.html': page({ head: '<meta name="viewport" content="width=device-width, user-scalable=no">' }).replace('<meta name="viewport" content="width=device-width, initial-scale=1">', '') }, /blocks zoom/],
  ];
  for (const [files, pattern] of cases) {
    const { pages } = pagesOf(files);
    assert.match(messages(errors(a11yApi.auditA11y(pages))), pattern);
  }
});

test('a11y: labelled controls and named links pass', () => {
  const body = '<h1>Form</h1><label for="n">Name</label><input id="n" name="n"><label>Mail <input name="m"></label><a href="/program/">The program</a><button aria-label="Open menu"></button>';
  const { pages } = pagesOf({ 'index.html': page({ body }) });
  assert.deepEqual(errors(a11yApi.auditA11y(pages)), []);
});

test('ledger: a clean build with one pending route passes', () => {
  const { root, pages } = pagesOf(cleanSite());
  const result = ledgerApi.auditLedger({ distDir: root, ledger, pages, fileExists: () => true });
  assert.deepEqual(errors(result.findings), []);
  assert.ok(result.findings.some((f) => f.level === 'warn' && f.where === '/apply/'));
});

test('ledger: pending routes fail in strict mode (release)', () => {
  const { root, pages } = pagesOf(cleanSite());
  const result = ledgerApi.auditLedger({ distDir: root, ledger, pages, strict: true, fileExists: () => true });
  assert.ok(errors(result.findings).some((f) => f.where === '/apply/'));
});

test('ledger: unledgered and launch:false pages fail, dev routes are tolerated until strict', () => {
  const { root, pages } = pagesOf({
    ...cleanSite(),
    'surprise/index.html': page(),
    'legal/terms/index.html': page(),
    'styleguide/index.html': page({ robots: 'noindex' }),
    'insights/fixture-article/index.html': page({ robots: 'noindex' }),
  });
  const text = messages(errors(ledgerApi.auditLedger({ distDir: root, ledger, pages, fileExists: () => true }).findings));
  assert.match(text, /\/surprise\/: page is built but is not in the route ledger/);
  assert.match(text, /\/legal\/terms\/: route is built but the ledger marks it launch:false/);
  assert.doesNotMatch(text, /styleguide|fixture/);
  const strict = messages(errors(ledgerApi.auditLedger({ distDir: root, ledger, pages, strict: true, fileExists: () => true }).findings));
  assert.match(strict, /development route present/);
});

test('ledger: robots meta must agree with indexable', () => {
  const { root, pages } = pagesOf({ ...cleanSite(), 'program/index.html': page({ robots: 'noindex' }), '404.html': page() });
  const text = messages(errors(ledgerApi.auditLedger({ distDir: root, ledger, pages, fileExists: () => true }).findings));
  assert.match(text, /\/program\/: ledger says indexable:true but the page carries noindex/);
  assert.match(text, /\/404\.html: ledger says indexable:false/);
});

test('ledger: a launched machine file that is missing is reported', () => {
  const { root, pages } = pagesOf(cleanSite());
  const text = messages(ledgerApi.auditLedger({ distDir: root, ledger, pages, fileExists: () => false }).findings);
  assert.match(text, /\/robots\.txt/);
});

test('dist: wrong CNAME, forbidden paths and missing shell files fail (negative proof)', () => {
  const ok = makeDist({ CNAME: 'worldenterprise.org\n', 'dist/index.html': '<html></html>', 'dist/404.html': '<html></html>' });
  assert.deepEqual(distApi.auditDist({ distDir: `${ok}/dist`, cnameFile: `${ok}/CNAME` }), []);
  const bad = makeDist({ CNAME: 'example.com', 'dist/index.html': '', 'dist/CLAUDE.md': 'x', 'dist/scripts/a.mjs': 'x' });
  const text = messages(distApi.auditDist({ distDir: `${bad}/dist`, cnameFile: `${bad}/CNAME` }));
  assert.match(text, /CNAME is "example\.com"/);
  assert.match(text, /CLAUDE\.md/);
  assert.match(text, /dist\/scripts/);
  assert.match(text, /404\.html/);
});
