import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { parse } from 'yaml';
import { DESKS, isDeskId } from '../../../src/data/desks.ts';
import { loadDenylist as loadClaims, scan } from '../../../scripts/audit-claims.mjs';
import { AUDIENCES, BRIEFS, COMPARISONS, FAMILIES, familyLabel, familyPaths, RESERVED_SLUGS, SEGMENTS, SEGMENT_SHORT_NAMES, SEGMENT_SLUGS } from '../../../src/data/families.ts';
import type { FamilyDefinition } from '../../../src/data/families.ts';
import { routes } from '../../../src/data/routes.ts';
import { listBriefIds, listCollectionFiles, listInsightFiles, listPageSlugs } from '../../../src/lib/content-files.ts';

/**
 * Invariants of the page-family registry (docs/wave8-contracts.md, section 8.1). The registry is the only hand-edited list; these tests
 * keep it consistent with the files on disk, with the ledger and with the claims denylist, whatever packages add to it.
 */
const root = new URL('../../../', import.meta.url).pathname;

interface DenyRule {
  readonly id: string;
  readonly pattern: string;
  readonly flags: string;
}

function loadDenylist(): readonly DenyRule[] {
  try {
    const parsed = JSON.parse(readFileSync(join(root, 'claims-denylist.json'), 'utf8')) as { rules: DenyRule[]; contextRules: DenyRule[] };
    return [...parsed.rules, ...parsed.contextRules];
  } catch (error) {
    throw new Error(`Could not read claims-denylist.json: ${(error as Error).message}`);
  }
}

const denylist = loadDenylist();
const matches = (text: string): string[] => denylist.filter((r) => new RegExp(r.pattern, r.flags).test(text)).map((r) => r.id);

function frontmatter(path: string): Record<string, unknown> {
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(path, 'utf8'))?.[1];
  if (block === undefined) throw new Error(`${path} has no frontmatter block.`);
  return parse(block) as Record<string, unknown>;
}

test('the registry holds the five families, each with entries', () => {
  assert.deepEqual(FAMILIES.map((f) => f.id), ['segments', 'industries', 'compare', 'journey', 'briefs']);
  for (const family of FAMILIES) assert.ok(family.entries.length > 0, family.id);
});

test('every slug is unique within its family and is not a reserved slug', () => {
  for (const family of FAMILIES) {
    const slugs = family.entries.map((e) => e.slug);
    assert.deepEqual(slugs.filter((s, i) => slugs.indexOf(s) !== i), [], `${family.id} repeats a slug`);
    for (const slug of slugs) assert.ok(!RESERVED_SLUGS.includes(slug), `${family.id}/${slug} is reserved`);
    for (const slug of slugs) assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${family.id}/${slug}`);
  }
});

test('every registry path is unique across the families and registered in the ledger', () => {
  const all = FAMILIES.flatMap((f) => familyPaths(f));
  assert.deepEqual(all.filter((p, i) => all.indexOf(p) !== i), []);
  const ledger = new Set(routes.map((r) => r.path));
  for (const path of all) assert.ok(ledger.has(path), `${path} has no ledger row`);
});

test('entries are ordered from one, have a label of at most 40 characters and an owner in WP-60 to WP-99', () => {
  for (const family of FAMILIES) {
    family.entries.forEach((e, i) => {
      assert.equal(e.order, i + 1, `${family.id}/${e.slug} order`);
      assert.ok(e.label.length > 0 && e.label.length <= 40, `${family.id}/${e.slug} label "${e.label}" is ${e.label.length} characters`);
      assert.match(e.owner, /^WP-[6-9]\d$/, `${family.id}/${e.slug} owner`);
    });
  }
});

test('a launch:false entry carries a reason, and a launched entry carries none', () => {
  for (const family of FAMILIES) {
    for (const e of family.entries) {
      if (e.launch) assert.equal(e.reason, undefined, `${family.id}/${e.slug} is launched and needs no reason`);
      else assert.ok((e.reason ?? '').length > 0, `${family.id}/${e.slug} is cut and needs a reason`);
    }
  }
});

test('the first cut is named: every family keeps core entries and the rest are not core', () => {
  for (const family of FAMILIES) assert.ok(family.entries.some((e) => e.core), `${family.id} has no core entry`);
  assert.deepEqual(SEGMENTS.entries.filter((e) => !e.core), [], 'every segment is core');
  assert.deepEqual(BRIEFS.entries.filter((e) => e.core).map((e) => e.slug), ['funding-paths', 'company-setup', 'ai-native-build', 'first-100-customers']);
});

test('every pages file in a family folder has a registry entry, and an entry with no file is pending, not an error', () => {
  for (const family of FAMILIES.filter((f): f is FamilyDefinition => f.collection === 'pages')) {
    const known = new Set(family.entries.map((e) => e.slug));
    for (const slug of listPageSlugs(root, family.folder)) {
      if (slug === 'index') {
        // The hub of the family is its own ledger row: registered by the registry (industries, compare, journey) or a fixed row (`/founders/`).
        assert.ok(routes.some((r) => r.path === `/${family.folder}/`), `${family.folder}/index has no ledger row`);
        continue;
      }
      assert.ok(known.has(slug), `src/content/pages/${family.folder}/${slug} has no registry entry; add it to src/data/families.ts through WP-60`);
    }
  }
});

test('the briefs folder holds only registry ids, and an abstract names the same audiences as its entry', () => {
  const known = new Map(BRIEFS.entries.map((e) => [e.slug, e]));
  for (const id of listBriefIds(root)) {
    const entry = known.get(id);
    assert.ok(entry !== undefined, `src/content/briefs/${id} has no registry entry`);
    const file = listCollectionFiles(root, 'briefs').find((f) => f.replace(/\.mdx?$/, '') === id) ?? '';
    const data = frontmatter(join(root, 'src/content/briefs', file));
    assert.deepEqual([...((data.audience as string[]) ?? [])].sort(), [...entry.audience].sort(), `${id} audience`);
  }
});

test('every brief names real desks and audiences', () => {
  for (const b of BRIEFS.entries) {
    assert.ok(b.audience.length > 0, b.slug);
    for (const a of b.audience) assert.ok((AUDIENCES as readonly string[]).includes(a), `${b.slug}: ${a}`);
    assert.ok(b.desks.length >= 1 && b.desks.length <= 2, `${b.slug} desks`);
    for (const d of b.desks) assert.ok(isDeskId(d) && DESKS.includes(d), `${b.slug}: ${d}`);
  }
});

test('the segment short names map back to the slugs, and every segment value in an article is a registry slug', () => {
  for (const e of SEGMENTS.entries) assert.equal(SEGMENT_SHORT_NAMES[e.short], e.slug);
  assert.equal(new Set(SEGMENTS.entries.map((e) => e.short)).size, SEGMENTS.entries.length);
  for (const f of listInsightFiles(root)) {
    const data = frontmatter(join(root, f.file));
    for (const segment of (data.segments as string[] | undefined) ?? []) assert.ok(SEGMENT_SLUGS.includes(segment), `${f.file}: "${segment}" is not a segment slug`);
  }
});

test('a family page declares its own family id and slug', () => {
  for (const family of FAMILIES.filter((f) => f.collection === 'pages')) {
    // `index` is the hub of the family, not an entry of the registry, so it has no family id to declare. Every other page must declare one.
    for (const slug of listPageSlugs(root, family.folder).filter((s) => s !== 'index')) {
      const data = frontmatter(join(root, 'src/content/pages', family.folder, `${slug}.mdx`));
      const declared = data.family as { id?: string; slug?: string } | undefined;
      assert.ok(declared !== undefined, `${family.folder}/${slug} has no \`family\` frontmatter, so nothing ties it to the registry`);
      assert.equal(declared.id, family.id, `${family.folder}/${slug} family id`);
      assert.equal(declared.slug, slug, `${family.folder}/${slug} family slug equals the file name`);
    }
  }
});

test('a registry label never carries a word the claims denylist blocks, so no generated list does', () => {
  for (const family of FAMILIES) {
    for (const e of family.entries) {
      assert.deepEqual(matches(familyLabel(e)), [], `${family.id}/${e.slug}: label "${e.label}"`);
    }
  }
});

test('the blocked-word entry is exactly one, named in the registry, and neither its label nor its slug carries the word (Q-7)', () => {
  const blocked = FAMILIES.flatMap((f) => f.entries.filter((e) => e.blockedWord !== undefined));
  assert.deepEqual(blocked.map((e) => e.slug), ['incubator-vs-other-programs']);
  const [entry] = blocked;
  assert.ok(entry !== undefined);
  assert.ok(!entry.label.toLowerCase().includes(entry.blockedWord ?? ''), 'the label drops the word');
  assert.ok(!entry.slug.includes(entry.blockedWord ?? ''), 'the slug drops the word too: the audit scans a URL in a sitemap, a feed, JSON-LD and an og:url meta');
  for (const family of FAMILIES) {
    for (const e of family.entries) assert.deepEqual(matches(e.slug), [], `${family.id}/${e.slug}: a slug trips a denylist rule`);
  }
});

test('the denylist exempts the one comparison page whose subject is the word, and no other path gains an exception (DP-W8-15)', () => {
  const rule = loadClaims().scanRules.find((r: { id: string }) => r.id === 'C-13-peers');
  assert.ok(rule !== undefined);
  const allowed = (path: string): boolean => rule.allow.some((re: RegExp) => re.test(path));
  const entry = COMPARISONS.entries.find((e) => e.blockedWord !== undefined);
  assert.ok(entry !== undefined);
  assert.equal(allowed(`/compare/${entry.slug}/`), true, 'the page is allowed (its Markdown twin maps to the same route)');
  for (const path of ['/compare/', '/compare/incubator-vs-venture-studio/', '/compare/build-vs-buy/', '/about/', '/insights/x/', '/']) assert.equal(allowed(path), false, `${path} stays blocked`);
  assert.equal(rule.allow.length, 4, 'the FAQ, the metrics definitions page, the comparison page and the llms files: four patterns');
  const strict = loadClaims().scanRules.find((r: { id: string }) => r.id === 'W8-C13-own-peers');
  assert.equal(strict?.allow.length, 0, 'first-person peer wording has no exempt path, not even the comparison page');
});

test('Q-7: the audit ignores an href but reads a URL in JSON-LD, an og:url meta, a sitemap and a feed, so a slug must not carry a blocked word', () => {
  const url = 'https://worldenterprise.org/compare/incubator-vs-accelerator/';
  const hits = (text: string, route: string, plain = false): string[] => (scan(text, { route, plain, flagValues: {} }) as { rule: string }[]).map((h) => h.rule);
  assert.deepEqual(hits(`<main><p><a href="${url}">Compare</a></p></main>`, '/compare/'), [], 'an href is not scanned');
  assert.deepEqual(hits(`[Compare](${url})`, '/llms.txt', true), [], 'a link address in plain text is not scanned');
  assert.ok(hits(`<script type="application/ld+json">{"item":"${url}"}</script>`, '/compare/').includes('C-13-peers'));
  assert.deepEqual(hits(`<head><link rel="canonical" href="${url}"></head><body><main>x</main></body>`, '/x/'), [], 'a link element is not scanned');
  assert.ok(hits(`<head><meta property="og:url" content="${url}"></head><body><main>x</main></body>`, '/x/').includes('C-13-peers'));
  assert.ok(hits(`<urlset><url><loc>${url}</loc></url></urlset>`, '/sitemap-0.xml').includes('C-13-peers'));
  assert.ok(hits(`<rss><channel><item><link>${url}</link></item></channel></rss>`, '/rss.xml').includes('C-13-peers'));
  const renamed = url.replace('incubator-vs-accelerator', 'incubator-vs-other-programs');
  assert.deepEqual(hits(`<urlset><url><loc>${renamed}</loc></url></urlset>`, '/sitemap-0.xml'), [], 'the renamed slug is clean in a sitemap');
});
