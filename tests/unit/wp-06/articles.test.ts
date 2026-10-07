import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = new URL('../../../', import.meta.url).pathname;

interface DenyRule {
  readonly id: string;
  readonly pattern: string;
  readonly flags: string;
}

function loadDenylist(): readonly DenyRule[] {
  try {
    const parsed = JSON.parse(readFileSync(join(root, 'claims-denylist.json'), 'utf8')) as { rules: DenyRule[] };
    return parsed.rules;
  } catch (error) {
    throw new Error(`Could not read claims-denylist.json: ${(error as Error).message}`);
  }
}

function articles(desk: 'grow' | 'fundable'): { file: string; raw: string; body: string }[] {
  const dir = join(root, 'src/content/insights', desk);
  return readdirSync(dir)
    .filter((f) => /\.mdx?$/.test(f))
    .map((file) => {
      const raw = readFileSync(join(dir, file), 'utf8');
      const body = raw.split(/^---$/m).slice(2).join('---').replace(/^import .*$/gm, '');
      return { file, raw, body };
    });
}

const grow = articles('grow');
const fundable = articles('fundable');

test('four Grow and five Fundable articles exist', () => {
  assert.equal(grow.length, 4);
  assert.equal(fundable.length, 5);
});

test('each article is 1,200 to 1,800 words and has two or more sources', () => {
  for (const a of [...grow, ...fundable]) {
    const words = a.body.split(/\s+/).filter(Boolean).length;
    assert.ok(words >= 1200 && words <= 1800, `${a.file}: ${words} words`);
    assert.ok((a.raw.match(/^ {2}- id: /gm) ?? []).length >= 2, `${a.file}: needs two sources`);
    assert.match(a.raw, /^topic: (grow|fundable)$/m, a.file);
    assert.match(a.body, /^\|.*\|$/m, `${a.file}: needs a table`);
  }
});

test('Fundable articles carry the no-funding disclaimer and a not-legal-advice line', () => {
  for (const a of fundable) {
    assert.match(a.raw, /<NoFundingDisclaimer \/>/, a.file);
    assert.match(a.raw, /claimsUsed: \[C-05\]/, a.file);
    assert.match(a.body, /not legal(?: or financial)? advice/i, a.file);
  }
});

test('no article text matches the claims denylist or carries a currency figure', () => {
  const rules = loadDenylist().map((r) => ({ id: r.id, re: new RegExp(r.pattern, r.flags) }));
  for (const a of [...grow, ...fundable]) {
    for (const rule of rules) {
      assert.equal(rule.re.test(a.raw), false, `${a.file} matches ${rule.id}`);
    }
    assert.equal(/[$£€]\s?\d/.test(a.body), false, `${a.file}: currency figure`);
  }
});

test('topic introductions (including frontmatter) pass the denylist and stay within 120 to 200 words', () => {
  const rules = loadDenylist().map((r) => ({ id: r.id, re: new RegExp(r.pattern, r.flags) }));
  for (const name of ['topic-grow.mdx', 'topic-fundable.mdx']) {
    const raw = readFileSync(join(root, 'src/content/pages/insights', name), 'utf8');
    for (const rule of rules) assert.equal(rule.re.test(raw), false, `${name} matches ${rule.id}`);
    const words = raw.split(/^---$/m).slice(2).join(' ').split(/\s+/).filter(Boolean).length;
    assert.ok(words >= 120 && words <= 200, `${name}: ${words} words`);
  }
});

test('Fundable articles do not imply WE finds, introduces or secures investors', () => {
  for (const a of fundable) {
    const sentences = a.body.split(/(?<=[.!?])\s+/);
    for (const s of sentences) {
      const claimsAction = /\b(?:we|world enterprise)\s+(?:will\s+)?(?:find|introduce|connect|secure|match|source)\b/i.test(s);
      const negated = /\b(?:not|never|no)\b/i.test(s);
      assert.ok(!claimsAction || negated, `${a.file}: ${s}`);
    }
  }
});
