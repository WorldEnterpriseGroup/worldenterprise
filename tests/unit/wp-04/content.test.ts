import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = new URL('../../../src/content/', import.meta.url).pathname;

function files(dir: string): string[] {
  return readdirSync(join(root, dir))
    .filter((name) => name.endsWith('.mdx'))
    .map((name) => join(root, dir, name));
}

const playbooks = files('playbooks');
const guides = files('guides');
const pages = ['playbooks', 'fundability', 'trust'].flatMap((d) => files(join('pages', d)));

function frontmatter(text: string): string {
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  assert.ok(m?.[1], 'frontmatter present');
  return m[1];
}

function body(text: string): string {
  return text.replace(/^---\n[\s\S]*?\n---/, '');
}

test('five playbooks and four fundability guides exist', () => {
  assert.equal(playbooks.length, 5);
  assert.equal(guides.length, 4);
});

test('playbook orders are 1 to 5 with no repeats', () => {
  const orders = playbooks.map((p) => Number(/^order: (\d+)$/m.exec(frontmatter(readFileSync(p, 'utf8')))?.[1])).sort();
  assert.deepEqual(orders, [1, 2, 3, 4, 5]);
});

test('every fundability guide declares the no-funding disclaimer', () => {
  for (const g of guides) {
    const fm = frontmatter(readFileSync(g, 'utf8'));
    assert.match(fm, /^section: fundability$/m, g);
    assert.match(fm, /^ {2}- no-funding$/m, g);
  }
});

test('the SAFE terms appear only inside data-generic-definition elements', () => {
  const term = /valuation\s+cap|\bMFN\b|discount\s+rate|pro[- ]rata/i;
  for (const file of [...guides, ...playbooks, ...pages]) {
    let text = body(readFileSync(file, 'utf8'));
    text = text.replace(/<(dl|p) data-generic-definition>[\s\S]*?<\/\1>/g, '');
    assert.doesNotMatch(text, term, `${file} uses a SAFE term outside a generic definition`);
    assert.doesNotMatch(frontmatter(readFileSync(file, 'utf8')), term, `${file} frontmatter`);
  }
});

test('generic definitions are used on the SAFE guide only', () => {
  for (const file of [...guides, ...playbooks, ...pages]) {
    const has = /data-generic-definition/.test(body(readFileSync(file, 'utf8')));
    assert.equal(has, file.endsWith('safe-explained.mdx'), file);
  }
});

test('no excluded wording appears in any copy', () => {
  const banned = /tranche|success[- ]fee|guarantee|premier|certified|funded\b|lorem|testimonial|trusted by|investor introductions|\b10x\b/i;
  for (const file of [...guides, ...playbooks, ...pages]) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), banned, file);
  }
});

test('descriptions fit the 50 to 160 character schema window', () => {
  for (const file of [...guides, ...playbooks, ...pages]) {
    const d = (/^description: (.*)$/m.exec(frontmatter(readFileSync(file, 'utf8')))?.[1] ?? '').replace(/^"|"$/g, '');
    assert.ok(d.length >= 50 && d.length <= 160, `${file}: ${d.length}`);
  }
});

test('copy contains no commented-out code or placeholders', () => {
  for (const file of [...guides, ...playbooks, ...pages]) {
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /<!--|TODO|TBD|\bXXX\b/, file);
  }
});
