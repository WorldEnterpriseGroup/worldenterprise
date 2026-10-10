import assert from 'node:assert/strict';
import test from 'node:test';
import * as distAudit from '../../../scripts/lib/audit-dist.mjs';
import { makeDist } from '../shared/fixture-dist.ts';

// Wave 7 (WP-40): the publish allowlist learns the machine layer. llms.txt and llms-full.txt are known top-level files, and a Markdown
// twin is published only beside the page it mirrors. tests/unit/wp-19/audit-dist.test.ts keeps the original negative proofs.

interface Finding {
  readonly level: 'error' | 'warn';
  readonly where: string;
  readonly message: string;
}
const api = distAudit as unknown as {
  auditDist(options: { distDir: string; cnameFile: string }): Finding[];
  twinPage(rel: string): string;
};

const BASE: Record<string, string> = {
  CNAME: 'worldenterprise.org\n',
  'dist/index.html': '<html><body><h1>Home</h1></body></html>',
  'dist/404.html': '<html><body><h1>Not found</h1></body></html>',
  'dist/robots.txt': 'User-agent: *\nAllow: /\n',
  'dist/insights/index.html': '<html/>',
  'dist/insights/first-idea/index.html': '<html/>',
  'dist/pricing/index.html': '<html/>',
  'dist/library/index.html': '<html/>',
  'dist/library/one-page-brief.md': '# Brief',
};

function audit(extra: Record<string, string>, remove: string[] = []): string {
  const files = { ...BASE, ...extra };
  for (const key of remove) delete files[key];
  const root = makeDist(files);
  return api
    .auditDist({ distDir: `${root}/dist`, cnameFile: `${root}/CNAME` })
    .map((f) => `${f.level} ${f.where.replace(root, '')}: ${f.message}`)
    .join('\n');
}

test('the base fixture is clean, so every finding below comes from the file under test', () => {
  assert.equal(audit({}), '');
});

test('llms.txt and llms-full.txt are published at the top level', () => {
  assert.equal(audit({ 'dist/llms.txt': '# WE\n', 'dist/llms-full.txt': '# WE\n\nBody.\n' }), '');
});

test('other look-alike top-level text files stay off the allowlist', () => {
  for (const name of ['llms-old.txt', 'llms.md', 'llm.txt', 'llms-full.json.txt', 'notes.txt']) {
    assert.match(audit({ [`dist/${name}`]: 'x' }), new RegExp(`top-level file "${name.replace('.', '\\.')}" is not on the publish allowlist`), name);
  }
});

test('a Markdown twin beside its page is published, at the top level and in a folder', () => {
  assert.equal(audit({ 'dist/insights/first-idea.md': '# First idea\n' }), '');
  assert.equal(audit({ 'dist/pricing.md': '# Pricing\n' }), '');
  assert.equal(audit({ 'dist/index.md': '# World Enterprise Incubator\n' }), '');
});

test('a Markdown file with no page beside it is refused, with a message that names the missing page', () => {
  assert.match(audit({ 'dist/insights/ghost.md': '# Ghost\n' }), /insights\/ghost\.md: \.md files are published only under library\/, or beside the page they mirror \(insights\/ghost\/index\.html\)/);
  assert.match(audit({ 'dist/ghost.md': '# Ghost\n' }), /top-level file "ghost\.md" is not on the publish allowlist/);
  assert.match(audit({ 'dist/program/readme.md': '# x' }), /readme\.md: \.md files are published only under library\//);
});

test('a twin disappears from the allowlist when its page does', () => {
  assert.match(audit({ 'dist/pricing.md': '# Pricing\n' }, ['dist/pricing/index.html']), /pricing\.md/);
});

test('every .md in a built output has a sibling page, except library templates (the invariant, stated as a property)', () => {
  const files = { ...BASE, 'dist/insights/first-idea.md': '# a', 'dist/pricing.md': '# b', 'dist/index.md': '# c' };
  const present = new Set(Object.keys(files).map((k) => k.replace(/^dist\//, '')));
  for (const rel of present) {
    if (!rel.endsWith('.md') || rel.startsWith('library/')) continue;
    assert.ok(present.has(api.twinPage(rel)), `${rel} needs ${api.twinPage(rel)}`);
  }
  assert.equal(api.twinPage('a/b/c.md'), 'a/b/c/index.html');
  assert.equal(api.twinPage('index.md'), 'index.html');
});

test('a twin or llms file is still leak-scanned: an internal hostname in a twin fails the gate', () => {
  assert.match(audit({ 'dist/pricing.md': 'See https://git.developerdojo.org/x\n' }), /internal hostname/);
  assert.match(audit({ 'dist/llms.txt': 'Mirror at harbor.example.org\n' }), /internal registry hostname/);
});

test('source maps next to a twin are still refused', () => {
  assert.match(audit({ 'dist/insights/first-idea.md.map': '{}' }), /source map in the published output/);
});
