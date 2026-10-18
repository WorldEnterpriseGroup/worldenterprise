import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as distAudit from '../../../scripts/lib/audit-dist.mjs';
import { makeDist, pagefindFragment } from '../shared/fixture-dist.ts';

// WP-108 (#108): audit:dist fails on personal data by shape (an email outside the allowlist, a phone number or tel: link, a LinkedIn or X
// profile URL) in pages, Markdown twins, llms files, xml, JSON-LD and decoded Pagefind fragments. Each shape has a negative proof, and the
// false-positive shapes a real build holds (versions, dates, ISO numbers, SVG path data) have a positive one.

interface Finding {
  readonly level: 'error' | 'warn';
  readonly where: string;
  readonly message: string;
}
const api = distAudit as unknown as {
  auditDist(options: { distDir: string; cnameFile: string }): Finding[];
  scanPrivacy(where: string, rel: string, text: string): Finding[];
  selfTest(): { label: string; ok: boolean }[];
  EMAIL_ALLOWED_DOMAINS: ReadonlySet<string>;
  PRIVACY_VENDOR_FILES: ReadonlySet<string>;
};

const root = new URL('../../../', import.meta.url);
const read = (path: string): string => readFileSync(new URL(path, root), 'utf8');
const scan = (rel: string, text: string): string[] => api.scanPrivacy(rel, rel, text).map((f) => f.message);

test('the audit proves itself: every check of its self-test passes', () => {
  const results = api.selfTest();
  assert.ok(results.length >= 20, `the self-test has ${results.length} checks`);
  for (const r of results) assert.equal(r.ok, true, r.label);
});

test('the WE addresses and example domains pass, any other address fails', () => {
  assert.deepEqual(scan('index.html', '<a href="mailto:hello@worldenterprise.org">hello@worldenterprise.org</a> apply@worldenterprise.org a@example.org b@example.com c@example.test'), []);
  assert.deepEqual([...api.EMAIL_ALLOWED_DOMAINS].sort(), ['example.com', 'example.org', 'example.test', 'worldenterprise.org']);
  for (const email of ['sentinel-client@leak.invalid', 'someone@gmail.com', 'a@mail.worldenterprise.org', 'a@worldenterprise.org.evil.com', 'A@WORLDENTERPRISE.COM']) {
    assert.match(scan('index.html', `<p>${email}</p>`).join('\n'), /email address outside the allowlist/, email);
  }
  assert.match(scan('index.html', '<p>sentinel-client&#x40;leak.invalid and x%40leak.invalid</p>').join('\n'), /email address/, 'an encoded @ does not hide an address');
});

test('a finding masks the value, so a CI log is not a second copy of the data', () => {
  const messages = scan('index.html', '<p>sentinel-client@leak.invalid +1 555 0100 (555) 210-0100 https://linkedin.com/in/sentinel-client</p>').join('\n');
  assert.doesNotMatch(messages, /sentinel-client|555|0100/);
  assert.match(messages, /s\*\*\*@leak\.invalid/);
});

test('a phone number is caught in each shape, in prose file types and in fragments', () => {
  for (const number of ['+1 555 0100', '+44 20 7946 0958', '+49 (0)30 1234567', '(555) 210-0100', '555-210-0100', '555.210.0100', '020 7946 0958']) {
    for (const rel of ['index.html', 'insights/x.md', 'llms-full.txt', 'rss.xml', 'pagefind/fragment/en_a.pf_fragment']) {
      assert.match(scan(rel, `Call ${number} now`).join('\n'), /phone number/, `${number} in ${rel}`);
    }
  }
});

test('tel:, callto: and wa.me links are caught anywhere', () => {
  for (const link of ['<a href="tel:+15550100">', '<a href="TEL:555-0100">', '<a href="callto:+15550100">', '<a href="https://wa.me/15550100">']) {
    assert.match(scan('index.html', link).join('\n'), /telephone link/, link);
  }
  assert.deepEqual(scan('index.html', '<p>Hotel: Alpine. The mortel: x</p>'), []);
});

test('LinkedIn and X or Twitter profile URLs are caught, company pages and share links are not', () => {
  assert.match(scan('index.html', '<a href="https://www.linkedin.com/in/sentinel-client/">').join('\n'), /LinkedIn profile URL/);
  assert.match(scan('index.html', '<a href="https://x.com/sentinel_client">').join('\n'), /X or Twitter profile URL/);
  assert.match(scan('index.html', '<a href="https://twitter.com/sentinel_client">').join('\n'), /X or Twitter profile URL/);
  assert.deepEqual(scan('index.html', '<a href="https://www.linkedin.com/company/world-enterprise/">'), []);
  assert.deepEqual(scan('index.html', '<a href="https://x.com/intent/tweet?text=a">https://x.com/home https://box.com/page example.com/x</a>'), []);
});

test('versions, dates, ISO numbers, timestamps, prices and SVG path data are not phone numbers', () => {
  const clean = [
    '<p>Astro 5.14.1 and Node 24.9.0, build 2026.10.17, v1.2.3-rc.1.</p>',
    '<p>Updated 2026-10-17, 17 Oct 2026, 2026-10-17T12:00:00+00:00 and 2026-10-17T12:00:00+0200.</p>',
    '<p>ISO 27001:2022, ISO/IEC 42001:2023, ISO 8601, RFC 9110, EIN 12-3456789.</p>',
    '<p>$100,000 to $250,000, 120 100 2026 reviews, 4.5 of 5, 2 3 4 5 6 7 8 steps, 1 000 000 units.</p>',
    '<svg viewBox="0 0 120 120"><path d="M10 20 30.456.789.1234 L 100 200.555.666.7777 5 5 5 5 5 5 5 5"/><polygon points="212 345 6789 100 200 3000"/></svg>',
    '<style>.a{margin:0 555 123 4567;background:url(a.avif)}</style>',
    '<script>var n="555 210 0100"; var v="1.2.3";</script>',
  ].join('\n');
  assert.deepEqual(scan('index.html', clean), []);
  assert.deepEqual(scan('sitemap-0.xml', '<lastmod>2026-10-17T12:00:00.000Z</lastmod><loc>https://worldenterprise.org/a/</loc>'), []);
});

test('a number inside a script is still a finding when the script is JSON-LD', () => {
  const ld = '<script type="application/ld+json">{"@type":"Organization","telephone":"+1 555 0100"}</script>';
  assert.match(scan('index.html', ld).join('\n'), /phone number/);
  assert.deepEqual(scan('index.html', '<script type="application/ld+json">{"@type":"Organization","email":"hello@worldenterprise.org","address":{"addressLocality":"Lewes","addressRegion":"DE"}}</script>'), []);
});

test('the Pagefind vendor credits are exempt by file name, and only by file name', () => {
  const credit = 'Danish translation by dr@jones.dk';
  assert.deepEqual([...api.PRIVACY_VENDOR_FILES].sort(), ['pagefind/pagefind-component-ui.js', 'pagefind/pagefind-highlight.js', 'pagefind/pagefind-modular-ui.js', 'pagefind/pagefind-ui.js']);
  assert.deepEqual(scan('pagefind/pagefind-ui.js', `var c="${credit}"`), []);
  assert.match(scan('pagefind/pagefind-other.js', `var c="${credit}"`).join('\n'), /email address/);
  assert.match(scan('_astro/app.abc.js', `var c="${credit}"`).join('\n'), /email address/);
  assert.match(scan('index.html', credit).join('\n'), /email address/);
});

test('auditDist reads the decoded content of a gzip Pagefind fragment, and reports one it cannot decode', () => {
  const base = { CNAME: 'worldenterprise.org\n', 'dist/index.html': '<main>Home</main>', 'dist/404.html': '<main>Not found</main>' };
  const audit = (fragment: string | number | Buffer): string => {
    const dist = makeDist({ ...base, 'dist/pagefind/fragment/en_a.pf_fragment': fragment });
    return api
      .auditDist({ distDir: `${dist}/dist`, cnameFile: `${dist}/CNAME` })
      .map((f) => f.message)
      .join('\n');
  };
  assert.equal(audit(pagefindFragment('A page about nothing.')), '');
  assert.match(audit(pagefindFragment('Mail sentinel-client@leak.invalid')), /email address/);
  assert.match(audit(pagefindFragment('Call +1 555 0100')), /phone number/);
  assert.match(audit('not gzip'), /Pagefind fragment could not be decoded/);
  assert.match(audit(30), /Pagefind fragment could not be decoded/);
});

test('the self-test is wired: an npm script, and the verify:static job that runs it on every pipeline', () => {
  const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
  assert.equal(pkg.scripts['audit:dist:selftest'], 'node scripts/lib/audit-dist.mjs --self-test');
  assert.equal(pkg.scripts['audit:dist'], 'node scripts/lib/audit-dist.mjs --dist dist --cname CNAME');
  const ci = read('.gitlab-ci.yml');
  const verify = /^verify:static:\n[\s\S]*?(?=^\S)/m.exec(ci)?.[0] ?? '';
  assert.match(verify, /npm run audit:dist:selftest\n/);
  assert.match(ci, /^audit:dist:\n[\s\S]*?npm run audit:dist \|\| status=1/m);
});
