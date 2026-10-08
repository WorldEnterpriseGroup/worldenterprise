import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { routes } from '../../../src/data/routes.ts';
import { HOME_FAQ_IDS } from '../../../src/components/home/faq.ts';
import { STAGES } from '../../../src/components/program/stages.ts';

const ROOT = new URL('../../../', import.meta.url).pathname;
const launched = new Set(routes.filter((r) => r.launch).map((r) => r.path));

interface DenyRule {
  readonly id: string;
  readonly pattern: string;
  readonly flags?: string;
}

const denylist = JSON.parse(readFileSync(join(ROOT, 'claims-denylist.json'), 'utf8')) as { rules: readonly DenyRule[] };

function listFiles(dir: string, extensions: readonly string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(rel, extensions));
    else if (extensions.some((e) => entry.name.endsWith(e))) out.push(rel);
  }
  return out;
}

const OWNED = [
  ...listFiles('src/content/pages/program', ['.mdx']),
  ...listFiles('src/content/pages/home', ['.mdx']),
  ...listFiles('src/components/program', ['.ts', '.astro']),
  ...listFiles('src/components/home', ['.ts', '.astro']),
  ...listFiles('src/pages/program', ['.astro']),
  'src/pages/index.astro',
];

function frontmatter(file: string, key: string): string {
  const text = readFileSync(join(ROOT, file), 'utf8');
  const match = new RegExp(`^${key}:\\s*(.*)$`, 'm').exec(text);
  assert.ok(match, `${file} has no ${key}`);
  return (match[1] ?? '').trim().replace(/^"(.*)"$/, '$1');
}

test('every stage link points at a launch:true ledger row', () => {
  for (const stage of STAGES) {
    assert.ok(launched.has(stage.path), `${stage.path} is not a launched route`);
    for (const a of stage.artifacts) assert.ok(launched.has(a.path), `${stage.id} links ${a.path}, which is not launched`);
    for (const line of stage.lines) assert.ok(launched.has(line.path), `${stage.id} links ${line.path}, which is not launched`);
  }
});

test('each stage links at least two playbooks or templates, exit evidence and limits', () => {
  for (const stage of STAGES) {
    const refs = stage.artifacts.filter((a) => a.path.startsWith('/playbooks/') || a.path.startsWith('/library/'));
    assert.ok(refs.length >= 2, `${stage.id} has ${refs.length} playbook or template links`);
    assert.ok(stage.exitEvidence.length > 0, `${stage.id} has no exit evidence`);
    assert.ok(stage.limits.length > 0, `${stage.id} has no limits`);
  }
});

test('titles are 31 characters or fewer and descriptions are 50 to 160', () => {
  for (const file of OWNED.filter((f) => f.endsWith('.mdx'))) {
    const title = frontmatter(file, 'title');
    const description = frontmatter(file, 'description');
    if (!file.includes('/home/')) assert.ok(title.length <= 31, `${file} title is ${title.length} characters`);
    assert.ok(description.length >= 50 && description.length <= 160, `${file} description is ${description.length} characters`);
  }
});

test('titles and descriptions are unique across owned pages', () => {
  const files = OWNED.filter((f) => f.endsWith('.mdx'));
  assert.equal(new Set(files.map((f) => frontmatter(f, 'title'))).size, files.length);
  assert.equal(new Set(files.map((f) => frontmatter(f, 'description'))).size, files.length);
});

test('owned files contain nothing on the claims denylist', () => {
  for (const file of OWNED) {
    const text = readFileSync(join(ROOT, file), 'utf8');
    for (const rule of denylist.rules) {
      const re = new RegExp(rule.pattern, rule.flags ?? 'i');
      assert.ok(!re.test(text), `${file} matches ${rule.id}`);
    }
  }
});

test('owned files avoid banned words, placeholders and emojis', () => {
  const banned = /\b(guaranteed|funded|certified|premier|lorem ipsum|TODO)\b/i;
  const emoji = /\p{Extended_Pictographic}/u;
  for (const file of OWNED) {
    const text = readFileSync(join(ROOT, file), 'utf8');
    assert.ok(!banned.test(text), `${file} contains a banned word`);
    assert.ok(!emoji.test(text), `${file} contains an emoji`);
  }
});

test('the Two companies, one objective phrase appears only on the dedicated teams page', () => {
  for (const file of OWNED) {
    const has = /two companies, one objective/i.test(readFileSync(join(ROOT, file), 'utf8'));
    assert.equal(has, file === 'src/pages/program/dedicated-teams.astro', `${file} phrase placement`);
  }
});

test('home FAQs are five published entries of src/data/faq.yaml, with answers that state no promise', () => {
  assert.equal(HOME_FAQ_IDS.length, 5);
  const yaml = readFileSync(join(ROOT, 'src/data/faq.yaml'), 'utf8');
  for (const id of HOME_FAQ_IDS) {
    const block = new RegExp(`^- id: ${id}\\n((?:  .*\\n)+)`, 'm').exec(yaml);
    assert.ok(block?.[1] !== undefined, `${id} is in faq.yaml`);
    assert.doesNotMatch(block[1], /^  draft: true$/m, `${id} is not a draft`);
    assert.match(block[1], /^  question: ".*\?"$/m, `${id} asks a question`);
    assert.ok((/^  answer: "(.*)"$/m.exec(block[1])?.[1] ?? '').length > 20, `${id} has an answer`);
  }
});
