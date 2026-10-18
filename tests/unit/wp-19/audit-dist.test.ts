import assert from 'node:assert/strict';
import test from 'node:test';
import * as distAudit from '../../../scripts/lib/audit-dist.mjs';
import { makeDist, pagefindFragment } from '../shared/fixture-dist.ts';

// code-security P1-5: the published-output gate is an allowlist, recursive, with a leak scan, and it checks dist/CNAME. Every case
// below is a negative proof: the clean dist passes, and each defect on its own makes the gate fail with a message that names it.

interface Finding {
  readonly level: 'error' | 'warn';
  readonly where: string;
  readonly message: string;
}
const api = distAudit as unknown as {
  auditDist(options: { distDir: string; cnameFile: string; cnameInDist?: boolean }): Finding[];
  scanText(where: string, rel: string, text: string): Finding[];
  LEAK_PATTERNS: readonly { name: string }[];
};

const CLEAN: Record<string, string | number | Buffer> = {
  CNAME: 'worldenterprise.org\n',
  'dist/index.html': '<html><body><h1>Home</h1></body></html>',
  'dist/404.html': '<html><body><h1>Not found</h1></body></html>',
  'dist/robots.txt': 'User-agent: *\nAllow: /\n',
  'dist/sitemap-index.xml': '<sitemapindex/>',
  'dist/sitemap-0.xml': '<urlset/>',
  'dist/rss.xml': '<rss/>',
  'dist/favicon.svg': '<svg/>',
  'dist/apple-touch-icon.png': 20,
  'dist/_astro/a.Hash123.css': 'body{margin:0}',
  'dist/_astro/a.Hash123.js': 'console.log(1)',
  'dist/_astro/photo.Hash123.avif': 50,
  'dist/_astro/fonts/abc123.woff2': 50,
  'dist/pagefind/pagefind-entry.json': '{}',
  'dist/pagefind/wasm.en.pagefind': 30,
  'dist/pagefind/fragment/x.pf_fragment': pagefindFragment('A page about nothing in particular.'),
  'dist/pagefind/index/x.pf_index': 30,
  'dist/pagefind/pagefind.en_x.pf_meta': 30,
  'dist/press/index.html': '<html/>',
  'dist/press/we-logo-wordmark.svg': '<svg/>',
  'dist/library/index.html': '<html/>',
  'dist/library/one-page-brief.md': '# Brief',
  'dist/program/index.html': '<html/>',
  'dist/legal/privacy/index.html': '<html/>',
  'dist/.well-known/security.txt': 'Contact: mailto:security@worldenterprise.org\n',
};

function audit(extra: Record<string, string | number | Buffer | null> = {}, options: { cnameInDist?: boolean } = {}): string {
  const files: Record<string, string | number | Buffer> = { ...CLEAN };
  for (const [key, value] of Object.entries(extra)) {
    if (value === null) delete files[key];
    else files[key] = value;
  }
  const root = makeDist(files);
  return api
    .auditDist({ distDir: `${root}/dist`, cnameFile: `${root}/CNAME`, ...options })
    .map((f) => `${f.level} ${f.where.replace(root, '')}: ${f.message}`)
    .join('\n');
}

test('a clean dist passes', () => {
  assert.equal(audit(), '');
});

test('the allowlist is recursive: source maps, env files, backups and unknown types fail anywhere in the tree', () => {
  const text = audit({
    'dist/_astro/app.js.map': '{}',
    'dist/assets/deep/.env': 'X=1',
    'dist/program/notes.bak': 'x',
    'dist/press/draft.docx': 5,
    'dist/_astro/old.woff': 5,
    'dist/pagefind/leftover.orig': 'x',
  });
  assert.match(text, /app\.js\.map: source map in the published output/);
  assert.match(text, /\.env: hidden entry "\.env"/);
  assert.match(text, /notes\.bak: file type "\.bak" is not on the publish allowlist/);
  assert.match(text, /draft\.docx: file type "\.docx"/);
  assert.match(text, /old\.woff: file type "\.woff"/);
  assert.match(text, /leftover\.orig: file type "\.orig"/);
});

test('markdown is published only under library', () => {
  assert.match(audit({ 'dist/program/readme.md': '# x' }), /readme\.md: \.md files are published only under library\//);
});

test('repository-internal names fail at any depth, and top-level docs, scripts and tests folders fail', () => {
  const text = audit({
    'dist/foo/.git/config': 'x',
    'dist/program/package.json': '{}',
    'dist/docs/a.html': '<html/>',
    'dist/scripts/a.mjs': 'x',
    'dist/tests/a.html': '<html/>',
    'dist/node_modules/x/index.js': 'x',
    'dist/CLAUDE.md': 'x',
  });
  for (const name of ['foo/.git', 'program/package.json', 'docs', 'scripts', 'tests', 'node_modules', 'CLAUDE.md']) {
    assert.match(text, new RegExp(`dist/${name.replace('.', '\\.')}: repository-internal path`), name);
  }
});

test('hidden entries other than .well-known fail', () => {
  const text = audit({ 'dist/.DS_Store': 'x', 'dist/press/.hidden/a.txt': 'x' });
  assert.match(text, /\.DS_Store: hidden entry/);
  assert.match(text, /\.hidden\/a\.txt: hidden entry/);
});

test('the top level is an allowlist: unknown files fail, unknown folders without an index fail, route and asset folders pass', () => {
  const text = audit({ 'dist/secrets.json': '{}', 'dist/stuff/a.txt': 'x', 'dist/notes.txt': 'x' });
  assert.match(text, /secrets\.json: top-level file "secrets\.json" is not on the publish allowlist/);
  assert.match(text, /notes\.txt: top-level file "notes\.txt"/);
  assert.match(text, /dist\/stuff: top-level folder is neither a known asset folder nor a route folder/);
  assert.doesNotMatch(text, /program|legal|library|press|pagefind|_astro/);
});

test('dist/CNAME: required with --cname-in-dist, checked whenever present', () => {
  assert.equal(audit({}, { cnameInDist: false }), '');
  assert.match(audit({}, { cnameInDist: true }), /dist\/CNAME: dist\/CNAME is missing/);
  assert.equal(audit({ 'dist/CNAME': 'worldenterprise.org\n' }, { cnameInDist: true }), '');
  assert.match(audit({ 'dist/CNAME': 'example.com' }, { cnameInDist: true }), /dist CNAME is "example\.com"/);
  assert.match(audit({ 'dist/CNAME': 'example.com' }), /dist CNAME is "example\.com"/);
});

test('the repository CNAME must still be exact', () => {
  const root = makeDist({ ...CLEAN, CNAME: 'example.com' });
  const text = api.auditDist({ distDir: `${root}/dist`, cnameFile: `${root}/CNAME` }).map((f) => f.message).join('\n');
  assert.match(text, /CNAME is "example\.com", expected "worldenterprise\.org"/);
});

test('the leak scan names internal hostnames, private addresses, build paths, mock endpoints and source map references', () => {
  const text = audit({
    'dist/a/index.html': '<a href="https://harbor.focuscell.org/x">x</a>',
    'dist/b/index.html': '<p>Reach git.developerdojo.org for the repo.</p>',
    'dist/c/index.html': '<p>host intake.internal and 10.20.30.40</p>',
    'dist/d/index.html': '<p>http://localhost:4321/</p>',
    'dist/_astro/m.js': 'var p="/home/seantech/repos/x/";\n//# sourceMappingURL=m.js.map',
    'dist/e/index.html': '<form data-endpoint="https://intake.example.test/api">',
    'dist/f/index.html': '<p>node.ziti</p>',
  });
  for (const expected of [
    /a\/index\.html: internal hostname: harbor\.focuscell\.org/,
    /b\/index\.html: internal hostname: git\.developerdojo\.org/,
    /c\/index\.html: internal top-level domain: intake\.internal/,
    /c\/index\.html: private network address: 10\.20\.30\.40/,
    /d\/index\.html: loopback or wildcard address: \/\/localhost/,
    /_astro\/m\.js: build or home directory path: \/home\/seantech\//,
    /_astro\/m\.js: source map reference/,
    /e\/index\.html: mock form endpoint: example\.test/,
    /f\/index\.html: Ziti overlay hostname: node\.ziti/,
  ]) {
    assert.match(text, expected);
  }
});

test('the leak scan names tokens and keys without printing them', () => {
  // Fake values shaped like the real thing. The key header is assembled at run time and the AWS id carries the word EXAMPLE, so no
  // line of this file looks like a credential to a secret scanner.
  const secret = `ghp_${'a1'.repeat(18)}`;
  const keyHeader = ['-----BEGIN', 'RSA', 'PRIVATE', 'KEY-----'].join(' ');
  const awsId = 'AKIAEXAMPLEEXAMPLE12';
  const text = audit({
    'dist/a/index.html': `<script type="application/json">{"t":"${secret}"}</script>`,
    'dist/b/index.html': keyHeader,
    'dist/c/index.html': awsId,
  });
  assert.match(text, /GitHub token: ghp_a1\.\.\./);
  assert.match(text, /private key block: -----B\.\.\./);
  assert.match(text, /AWS access key id: AKIAEX\.\.\./);
  assert.doesNotMatch(text, new RegExp(secret));
});

test('the leak scan does not trip on words that only mention the topic', () => {
  const prose = '<p>A zero trust overlay such as Ziti, a localhost-only dev server, the internal audit team, the focus cell method, and 10 steps in version 2.3.4.5.</p>';
  assert.equal(audit({ 'dist/a/index.html': prose, 'dist/_astro/lib.js': 'var x = a.local; var y = b.internal; var z = "10.0.0.1";' }), '');
});

test('a localhost URL fails in our files, and Pagefind vendor scripts are left alone', () => {
  assert.equal(audit({ 'dist/pagefind/pagefind-ui.js': 'fetch("http://localhost:1234/x")' }), '');
  assert.match(audit({ 'dist/_astro/ours.js': 'fetch("http://localhost:1234/x")' }), /ours\.js: loopback or wildcard address: \/\/localhost/);
});

test('every leak pattern has a name and the secret names are redacted', () => {
  assert.ok(api.LEAK_PATTERNS.length >= 12);
  assert.ok(api.LEAK_PATTERNS.every((p) => p.name !== ''));
  const found = api.scanText('x', 'x.html', 'AKIAEXAMPLEEXAMPLE12');
  assert.equal(found.length, 1);
  assert.doesNotMatch(found[0]?.message ?? '', /EXAMPLEEXAMPLE12/);
});
