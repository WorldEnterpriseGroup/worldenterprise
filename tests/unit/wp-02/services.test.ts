import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { SLOT_SPECS } from '../../../src/assets/photo/slots.ts';
import { LINE_ORDER, LINE_SLOT, lineTagline, playbookPath, servicePath } from '../../../src/components/services/lines.ts';
import { routes } from '../../../src/data/routes.ts';
import { site } from '../../../src/data/site.ts';

const root = new URL('../../../', import.meta.url).pathname;
const serviceDir = join(root, 'src/content/services');
const hubFile = join(root, 'src/content/pages/services/index.mdx');
// Playbook slugs are the file names in the playbooks collection, the same rule the line pages use to look them up.
const playbookSlugs = new Set(readdirSync(join(root, 'src/content/playbooks')).filter((f) => /\.mdx?$/.test(f)).map((f) => f.replace(/\.mdx?$/, '')));

interface Frontmatter {
  readonly scalars: Record<string, string>;
  readonly lists: Record<string, string[]>;
}

interface Entry {
  readonly slug: string;
  readonly text: string;
  readonly body: string;
  readonly data: Frontmatter;
}

function unquote(value: string): string {
  const v = value.trim();
  return v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v;
}

/** Minimal parser for the frontmatter shape used by these entries: scalars and block lists of strings. */
function parseFrontmatter(text: string, file: string): { data: Frontmatter; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (match?.[1] === undefined || match[2] === undefined) throw new Error(`${file}: no frontmatter block.`);
  const scalars: Record<string, string> = {};
  const lists: Record<string, string[]> = {};
  let current: string | undefined;
  for (const line of match[1].split('\n')) {
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item?.[1] !== undefined && current !== undefined) {
      (lists[current] ??= []).push(unquote(item[1]));
      continue;
    }
    const kv = /^([A-Za-z]+):\s*(.*)$/.exec(line);
    if (kv?.[1] === undefined) throw new Error(`${file}: cannot parse frontmatter line "${line}".`);
    if (kv[2] === '') {
      current = kv[1];
      lists[current] = [];
    } else {
      current = undefined;
      scalars[kv[1]] = unquote(kv[2] ?? '');
    }
  }
  return { data: { scalars, lists }, body: match[2] };
}

function loadEntries(): Entry[] {
  return readdirSync(serviceDir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.mdx'))
    .map((d) => {
      const text = readFileSync(join(serviceDir, d.name), 'utf8');
      const { data, body } = parseFrontmatter(text, d.name);
      return { slug: d.name.replace(/\.mdx$/, ''), text, body, data };
    })
    .sort((a, b) => LINE_ORDER.indexOf(a.data.scalars['line'] as never) - LINE_ORDER.indexOf(b.data.scalars['line'] as never));
}

const entries = loadEntries();
const ledgerPaths = new Set(routes.map((r) => r.path));
const wp02Paths = routes.filter((r) => r.owner === 'WP-02').map((r) => r.path);

test('there are exactly seven published entries, lines A to G once each', () => {
  assert.equal(entries.length, 7);
  assert.deepEqual(entries.map((e) => e.data.scalars['line']), [...LINE_ORDER]);
  for (const e of entries) assert.equal(e.data.scalars['icon'], e.data.scalars['line'], e.slug);
});

test('entry slugs match the WP-02 ledger rows exactly (hub plus seven lines)', () => {
  const expected = ['/services/', ...entries.map((e) => servicePath(e.slug))].sort();
  assert.deepEqual([...wp02Paths].sort(), expected);
});

test('each line has at least two does-not-do items and four covers items', () => {
  for (const e of entries) {
    assert.ok((e.data.lists['doesNotCover']?.length ?? 0) >= 2, `${e.slug} doesNotCover`);
    assert.ok((e.data.lists['covers']?.length ?? 0) >= 4, `${e.slug} covers`);
  }
});

test('each line links at least two playbooks that are in the ledger', () => {
  for (const e of entries) {
    const related = e.data.lists['relatedPlaybooks'] ?? [];
    assert.ok(related.length >= 2, `${e.slug} relatedPlaybooks`);
    for (const slug of related) {
      assert.ok(playbookSlugs.has(slug), `${e.slug}: unknown playbook ${slug}`);
      assert.ok(ledgerPaths.has(playbookPath(slug)), `${e.slug}: ${playbookPath(slug)} is not a ledger route`);
    }
  }
});

test('summaries double as meta descriptions: unique, 50 to 160 characters', () => {
  const seen = new Set<string>();
  for (const e of entries) {
    const summary = e.data.scalars['summary'] ?? '';
    assert.ok(summary.length >= 50 && summary.length <= 160, `${e.slug} summary is ${summary.length} characters`);
    assert.ok(!seen.has(summary), `${e.slug} duplicates a summary`);
    seen.add(summary);
  }
});

test('page titles fit the 60 character limit with the site suffix', () => {
  for (const e of entries) {
    const title = e.data.scalars['shortTitle'] ?? '';
    const full = `${title} | ${site.titleSuffix}`;
    assert.ok(full.length <= 60, `${e.slug}: "${full}" is ${full.length} characters`);
  }
  const hubTitle = /^title: (.+)$/m.exec(readFileSync(hubFile, 'utf8'))?.[1];
  assert.ok(hubTitle !== undefined, 'hub title');
  assert.ok(`${hubTitle} | ${site.titleSuffix}`.length <= 60);
});

test('claims cited are C-04, plus C-05 on line F, never an excluded id', () => {
  for (const e of entries) {
    const cited = e.data.lists['claimsUsed'] ?? [];
    const allowed = new Set(['C-01', 'C-04', 'C-05']);
    for (const id of cited) assert.ok(allowed.has(id), `${e.slug} cites ${id}`);
    assert.ok(cited.includes('C-04'), `${e.slug} must cite C-04`);
    assert.equal(cited.includes('C-05'), e.data.scalars['line'] === 'F', `${e.slug} C-05 use`);
  }
});

test('every body has the artifacts table, steps and a FAQ, and no raw internal markdown links', () => {
  for (const e of entries) {
    assert.match(e.body, /^## What you receive$/m, e.slug);
    assert.match(e.body, /<Steps/, e.slug);
    assert.match(e.body, /<FaqList/, e.slug);
    assert.doesNotMatch(e.body, /\]\(\//, `${e.slug} has a raw internal link; use components that call href()`);
    assert.doesNotMatch(e.body, /href="\//, `${e.slug} has a raw internal href`);
  }
});

test('copy contains no excluded wording from the claims denylist or the WP-02 extras', () => {
  const denylist = JSON.parse(readFileSync(join(root, 'claims-denylist.json'), 'utf8')) as { rules: { id: string; pattern: string; flags: string }[] };
  const extras = [/\bguarantee/i, /\bcertified\b/i, /\bfunded\b/i, /\bcase stud/i, /\bcohort/i, /\bdemo day/i, /\bscorecard/i, /\bmilestone/i, /\bpackages?\b/i, /!/];
  const files = [...entries.map((e) => ({ name: e.slug, text: e.text })), { name: 'services/index.mdx', text: readFileSync(hubFile, 'utf8') }];
  for (const file of files) {
    for (const rule of denylist.rules) {
      assert.doesNotMatch(file.text, new RegExp(rule.pattern, rule.flags), `${file.name} hits ${rule.id}`);
    }
    for (const re of extras) assert.doesNotMatch(file.text, re, `${file.name} matches ${String(re)}`);
  }
});

test('line helpers: every line has a photo slot, a tagline and a unique route', () => {
  const slotIds = new Set(SLOT_SPECS.map((s) => s.id));
  const paths = new Set<string>();
  for (const line of LINE_ORDER) {
    assert.ok(slotIds.has(LINE_SLOT[line]), line);
    assert.ok(lineTagline(line).length > 0, line);
  }
  for (const e of entries) paths.add(servicePath(e.slug));
  assert.equal(paths.size, 7);
});
