import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import test from 'node:test';
import * as claimsAudit from '../../../scripts/audit-claims.mjs';
import { CLAIM_IDS, isClaimUsable } from '../../../src/data/claims.ts';
import { routes } from '../../../src/data/routes.ts';
import { SEE_ALSO_TITLES } from '../../../src/pages/faq/_model.ts';
import { faqRows, newRows, originalIds, read, root, sentencesOf } from './faq.ts';

/**
 * The FAQ at scale (WP-78, issue #58). `src/data/faq.yaml` keeps the 18 original general entries first, byte for byte, and WP-78 adds the
 * audience entries after them. These tests state what the data must stay: unique, linked, inside the claims, short, and grouped by audience.
 */
interface Hit {
  readonly rule: string;
  readonly match: string;
}
const audit = claimsAudit as unknown as { scan(text: string, options?: { route?: string; plain?: boolean; flagValues?: object }): Hit[] };

const rows = faqRows();
const added = newRows();
const AUDIENCES = ['startup', 'investor', 'partner', 'corporate'] as const;

/** The groups WP-78 adds, per audience, in the order the page shows them. The general group lists only the topics WP-78 added to it. */
const NEW_GROUPS: Readonly<Record<'general' | (typeof AUDIENCES)[number], readonly string[]>> = {
  general: ['Your details and this site', 'Founder tools'],
  startup: ['Applying', 'How the program works', 'Dream, Build and Grow', 'Service lines', 'Team size and pricing'],
  investor: ['Asking to meet a company', 'Before you ask', 'What WE does and does not do'],
  partner: ['Who can send an enquiry', 'What an enquiry does and does not create', 'After you send an enquiry'],
  corporate: ['Starting from an employer', 'What WE does and does not do for you'],
};

const audienceOf = (row: { readonly audience?: string | undefined }): string => row.audience ?? 'general';

test('the FAQ holds at least 40 entries, and the 18 originals come first', () => {
  assert.ok(rows.length >= 40, `${rows.length} entries`);
  assert.deepEqual(rows.slice(0, 18).map((r) => r.id), originalIds());
});

test('ids are unique', () => {
  const ids = rows.map((r) => r.id);
  assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), []);
});

test('every related id names an entry, and never its own', () => {
  const ids = new Set(rows.map((r) => r.id));
  for (const row of rows) {
    for (const related of row.related) {
      assert.ok(ids.has(related), `${row.id} relates to ${related}, which is not an entry`);
      assert.notEqual(related, row.id, `${row.id} relates to itself`);
    }
  }
});

test('every claim an entry uses exists and is enabled', () => {
  const known = new Set<string>(CLAIM_IDS);
  for (const row of rows) {
    for (const claim of row.claimsUsed) {
      assert.ok(known.has(claim), `${row.id} uses ${claim}, which is not in the registry`);
      assert.ok(isClaimUsable(claim as (typeof CLAIM_IDS)[number]), `${row.id} uses ${claim}, which is not enabled`);
    }
  }
});

test('every answer is one to four sentences', () => {
  for (const row of rows) {
    const count = sentencesOf(row.answer).length;
    assert.ok(count >= 1 && count <= 4, `${row.id} has ${count} sentences`);
  }
});

test('the 18 originals are unchanged byte for byte, and are general (no audience)', () => {
  const pin = JSON.parse(read('tests/unit/wp-60/fixtures/reference-originals.json')) as { faq: Record<string, string> };
  const text = read('src/data/faq.yaml');
  const starts = [...text.matchAll(/^- id: /gm)].map((m) => m.index ?? 0);
  const blocks = new Map<string, string>();
  starts.forEach((start, i) => {
    const block = text.slice(start, starts[i + 1] ?? text.length);
    blocks.set(/^- id: (\S+)/.exec(block)?.[1] ?? '', block);
  });
  for (const [id, sha] of Object.entries(pin.faq)) {
    const block = blocks.get(id);
    assert.ok(block !== undefined, `original ${id} is gone`);
    const hash = (b: string): string => createHash('sha256').update(b).digest('hex');
    // The pin hashes the block as it stood; the last original is followed by WP-78's first entry, so trailing blank lines are not part of it.
    assert.ok([hash(block), hash(block.trimEnd()), hash(`${block.trimEnd()}\n`)].includes(sha), `original ${id} changed`);
  }
  for (const row of rows.slice(0, 18)) assert.equal(row.audience, undefined, `${row.id} is an original and must stay general`);
});

test('every entry is general (no audience) or names a known audience', () => {
  for (const row of rows) {
    assert.ok(row.audience === undefined || (AUDIENCES as readonly string[]).includes(row.audience), `${row.id}: ${row.audience}`);
  }
});

test('every audience has entries, and the counts are the ones the handoff states', () => {
  const count = (audience: string): number => rows.filter((r) => audienceOf(r) === audience).length;
  assert.equal(count('general'), 23);
  assert.equal(count('startup'), 18);
  assert.equal(count('investor'), 9);
  assert.equal(count('partner'), 9);
  assert.equal(count('corporate'), 5);
  assert.equal(rows.length, 64);
});

test('the new groups WP-78 adds are listed here, per audience, in page order', () => {
  for (const audience of ['general', ...AUDIENCES] as const) {
    const groups: string[] = [];
    for (const row of added.filter((r) => audienceOf(r) === audience)) if (!groups.includes(row.group)) groups.push(row.group);
    assert.deepEqual(groups, NEW_GROUPS[audience], audience);
  }
});

test('a group name is not shared between the audience entries and the originals except by design', () => {
  const originalGroups = new Set(rows.slice(0, 18).map((r) => r.group));
  for (const row of added) {
    if (row.audience === undefined) continue;
    assert.ok(!originalGroups.has(row.group) || row.group === 'What WE does and does not do', `${row.id} reuses the original group "${row.group}"`);
  }
});

test('every investor-facing answer keeps "WE makes no promise of funding."', () => {
  const investors = added.filter((r) => r.audience === 'investor');
  assert.equal(investors.length, 9);
  for (const row of investors) {
    assert.ok(row.answer.includes('WE makes no promise of funding.'), `${row.id} lacks the funding sentence`);
    assert.ok(row.claimsUsed.includes('C-05'), `${row.id} carries the sentence without naming C-05`);
  }
});

test('the new answers use no word the program does not use for itself, and no amount, count or time', () => {
  const banned: readonly [string, RegExp][] = [
    ['accelerator', /accelerator/i],
    ['cohort', /cohort/i],
    ['mentor', /mentor/i],
    ['perks', /\bperks?\b/i],
    ['alumni', /alumn/i],
    ['demo day', /demo day/i],
    ['free', /\bfree\b|free of charge/i],
    ['no fee', /no fee|no equity|no stake/i],
    ['success fee', /success fee/i],
    ['a digit', /\d/],
    ['a number word', /\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i],
    ['We (capital) as the firm', /\bWe\b/],
  ];
  for (const row of added) {
    for (const [name, pattern] of banned) {
      for (const text of [row.question, row.answer]) {
        // "A to G" and the service-line names are letters, not numbers; no entry spells out a count of lines, so the rule stands as written.
        assert.doesNotMatch(text, pattern, `${row.id} contains ${name}: ${text}`);
      }
    }
  }
});

test('no new answer introduces, connects, matches or brokers investors, or names the Investor Introductions add-on', () => {
  for (const row of added) {
    assert.doesNotMatch(row.answer, /\b(introduces?|connects?|matches?|brokers?)\b[^.]*\binvestors?\b/i, `${row.id} makes an investor-introduction statement`);
    assert.doesNotMatch(`${row.question} ${row.answer}`, /investor introductions/i, `${row.id} names the add-on`);
  }
});

test('the claims denylist is clean on every new question and answer', () => {
  for (const row of added) {
    for (const text of [row.question, row.answer]) {
      const hits = audit.scan(text, { route: '/faq/', plain: true, flagValues: {} });
      assert.deepEqual(hits.map((h) => h.rule), [], `${row.id}: "${text}"`);
    }
  }
});

test('every seeAlso path is a launched ledger route and has a link title', () => {
  const ledger = new Map(routes.map((r) => [r.path, r]));
  for (const row of rows) {
    for (const path of row.seeAlso) {
      const entry = ledger.get(path);
      assert.ok(entry !== undefined, `${row.id} points at ${path}, which is not a ledger row`);
      assert.ok(entry.launch, `${row.id} points at ${path}, which is not launched`);
      assert.ok(SEE_ALSO_TITLES[path] !== undefined, `${row.id} points at ${path}, which has no title in SEE_ALSO_TITLES`);
    }
  }
});

test('no title in SEE_ALSO_TITLES is unused, so the table cannot drift', () => {
  const used = new Set(rows.flatMap((r) => r.seeAlso));
  assert.deepEqual(Object.keys(SEE_ALSO_TITLES).filter((p) => !used.has(p)), []);
});

/** The content entry that states a path's title, or the page file when it states the title itself; undefined while another package owns the page. */
function sourceOf(path: string): string | undefined {
  const bare = path.replace(/^\/|\/$/g, '');
  const last = bare.split('/').pop() ?? '';
  const candidates = [
    ...['md', 'mdx'].flatMap((ext) => [
      `src/content/pages/${bare}.${ext}`,
      `src/content/pages/${bare}/index.${ext}`,
      `src/content/pages/${bare}/${last}.${ext}`,
      `src/content/services/${last}.${ext}`,
    ]),
    `src/pages/${bare}/index.astro`,
    `src/pages/${bare}.astro`,
  ];
  return candidates.find((c) => existsSync(`${root}${c}`));
}

test('each link title is the title of the page it leads to, wherever that page is on this branch', () => {
  let compared = 0;
  for (const [path, title] of Object.entries(SEE_ALSO_TITLES)) {
    const file = sourceOf(path);
    if (file === undefined) continue; // the page is still with another package; the link stays hidden until it is live
    const raw = read(file);
    const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw)?.[1] ?? raw;
    const found = /^title:\s*"?([^"\n]+?)"?\s*$/m.exec(front)?.[1] ?? /\btitle="([^"]+)"/.exec(front)?.[1] ?? /\btitle=\{?'([^']+)'/.exec(front)?.[1];
    if (found === undefined) continue; // the page takes its title from a content entry rather than stating it
    assert.equal(title, found, `${path} (${file})`);
    compared += 1;
  }
  assert.ok(compared >= 10, `only ${compared} titles were compared; the page lookup has stopped finding pages`);
});
