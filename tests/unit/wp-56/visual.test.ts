import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import * as claimsAudit from '../../../scripts/audit-claims.mjs';
import { IDENTITY, READING } from '../../../src/components/families/visual/copy.ts';
import {
  HOW_LONG,
  HOW_WE_WORKS,
  READINESS_REVIEW,
  TALK_TO_WE,
  TIMELINE_BRIEF,
  endLadder,
  hubActions,
  midBody,
} from '../../../src/components/families/visual/cta.ts';
import { ACCENT_TONES, EMBLEM_KINDS, emblem, seedOf } from '../../../src/components/families/visual/emblems.ts';
import { kindForPath } from '../../../src/components/families/visual/kinds.ts';
import { HONESTY_LINE, TIMELINE_BLOCK } from '../../../src/components/families/visual/stats.ts';

// WP-56: the visual layer of the content families. The emblems are pure functions of (kind, seed, index), so a page renders the same
// picture on every build; the CTA ladder follows SALES.md 6.1 and drops a rung whose route is not live; the copy and the statistics
// keep the wave 9 rules.

interface Hit {
  rule: string;
  match: string;
}
const audit = claimsAudit as unknown as { scan(text: string, options?: { route?: string; plain?: boolean; flagValues?: object }): Hit[] };

const only =
  (...live: string[]) =>
  (path: string): boolean =>
    live.includes(path);

test('every emblem is deterministic for its kind, seed and index', () => {
  for (const kind of EMBLEM_KINDS) {
    const a = emblem(kind, seedOf(`seed-${kind}`), 2);
    const b = emblem(kind, seedOf(`seed-${kind}`), 2);
    assert.deepEqual(a, b, kind);
    assert.equal(a.viewBox, '0 0 320 200');
    assert.ok(a.shapes.length > 3, `${kind}: a picture, not a blank sky`);
  }
});

test('every emblem carries exactly one accent shape: one amber point per picture', () => {
  for (const kind of EMBLEM_KINDS) {
    for (const seed of [1, 7, seedOf('playbooks-hub'), seedOf('/industries/fintech/')]) {
      for (const index of [0, 1, 3]) {
        const accents = emblem(kind, seed, index).shapes.filter((s) => ACCENT_TONES.includes(s.tone));
        assert.equal(accents.length, 1, `${kind} seed ${seed} index ${index}: ${accents.length} accents`);
      }
    }
  }
});

test('different seeds give different skies, so cards in one hub are not copies', () => {
  for (const kind of EMBLEM_KINDS) {
    assert.notDeepEqual(emblem(kind, 1, 0).shapes, emblem(kind, 2, 0).shapes, kind);
  }
});

test('every emblem kind has an identity caption, and paths map to their family', () => {
  for (const kind of EMBLEM_KINDS) assert.ok(IDENTITY[kind].caption.length > 10, kind);
  assert.equal(kindForPath('/playbooks/validate-the-problem/'), 'playbooks');
  assert.equal(kindForPath('/library/pricing-page-checklist/'), 'library');
  assert.equal(kindForPath('/insights/reading-a-term-sheet-line-by-line/'), 'insights');
  assert.equal(kindForPath('/industries/fintech/'), 'industries');
  assert.equal(kindForPath('/somewhere-else/'), 'resources');
});

test('the CTA ladder uses the SALES.md 6.1 labels and targets', () => {
  assert.deepEqual([READINESS_REVIEW.label, READINESS_REVIEW.href], ['Start a readiness review', '/apply/']);
  assert.deepEqual([HOW_LONG.label, HOW_LONG.href], ['See how long it really takes', '/why-it-takes-time/']);
  assert.deepEqual([HOW_WE_WORKS.label, HOW_WE_WORKS.href], ['See how WE works', '/how-we-work/']);
  assert.deepEqual([TIMELINE_BRIEF.label, TIMELINE_BRIEF.href], ['Get the timeline brief', '/briefs/real-timeline/']);
  assert.deepEqual([TALK_TO_WE.label, TALK_TO_WE.href], ['Talk to WE', '/contact/']);
});

test('the timeline brief stays hidden until its route is live; "See how long it really takes" stands in for it', () => {
  assert.equal(midBody(only()), undefined);
  assert.equal(midBody(only('/why-it-takes-time/')), HOW_LONG);
  assert.equal(midBody(only('/why-it-takes-time/', '/briefs/real-timeline/')), TIMELINE_BRIEF);

  const today = endLadder(only('/apply/', '/contact/'));
  assert.equal(today.primary, READINESS_REVIEW);
  assert.equal(today.secondary, undefined);
  assert.equal(today.utility, TALK_TO_WE);

  assert.equal(endLadder(only('/apply/', '/how-we-work/')).secondary, HOW_WE_WORKS);
  assert.equal(endLadder(only('/apply/', '/how-we-work/', '/why-it-takes-time/')).secondary, HOW_LONG);
  assert.equal(endLadder(only('/apply/', '/why-it-takes-time/', '/briefs/real-timeline/')).secondary, TIMELINE_BRIEF);
  assert.deepEqual(endLadder(only()), {});
});

test('a hub leads with the readiness review and keeps its own secondary only when live', () => {
  const library = { label: 'Open the templates', href: '/library/' };
  assert.deepEqual(hubActions(only('/apply/', '/library/'), library), { primary: READINESS_REVIEW, secondary: library });
  assert.deepEqual(hubActions(only('/apply/'), library), { primary: READINESS_REVIEW });
  assert.deepEqual(hubActions(only()), {});
});

test('every pull-stat is an ST register figure with a source line, and the honesty line is the SITE-COPY wording', () => {
  assert.equal(HONESTY_LINE, "These figures describe all new U.S. businesses, not WE's results.");
  const file = new URL('../../../.astro-magazine/plans/wave9/statistics.json', import.meta.url);
  const register = JSON.parse(readFileSync(file, 'utf8')) as { statistics: { id: string; statistic: string; status: string }[] };
  const ledger = JSON.parse(readFileSync(new URL('../../../.astro-magazine/sources/wp-56.json', import.meta.url), 'utf8')) as {
    sources: { source_id: string }[];
  };
  assert.ok(TIMELINE_BLOCK.source.length > 10);
  for (const stat of TIMELINE_BLOCK.stats) {
    const row = register.statistics.find((r) => r.id === stat.id);
    assert.ok(row !== undefined, `${stat.id} is in the register`);
    assert.match(row.status, /^VERIFIED/, stat.id);
    assert.ok(row.statistic.startsWith(`${stat.figure} ${stat.label.replace(/\.$/, '')}`), `${stat.id}: quoted as the register words it`);
    assert.ok(ledger.sources.some((s) => s.source_id === stat.id), `${stat.id}: a source record in wp-56.json`);
  }
});

const strings = (value: unknown): string[] => {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
};
const copy = [
  ...strings(IDENTITY),
  ...strings(READING),
  ...[READINESS_REVIEW, HOW_LONG, HOW_WE_WORKS, TIMELINE_BRIEF, TALK_TO_WE].flatMap((c) => [c.label, c.note ?? '']).filter(Boolean),
  ...[TIMELINE_BLOCK].flatMap((b) => [b.heading, b.source, ...b.stats.map((s) => s.label)]),
];

test('the visual copy passes the claims denylist', () => {
  for (const text of copy) {
    for (const route of ['/insights/', '/playbooks/', '/fundability/', '/industries/fintech/']) {
      assert.deepEqual(audit.scan(text, { route, plain: true, flagValues: {} }), [], `${route}: ${text}`);
    }
  }
});

const BANNED =
  /\b(free|no cost|accelerators?|cohorts?|batch(es)?|class(es)?|demo day|graduat\w*|mentors?|alumni|investor network|perks?|credits?|deals?|co-founder|venture studio|employer of record|outsourcing|headcount|portfolio|no equity|SAFE|valuation cap|success fees?|fundable company|become fundable|guaranteed?|proven|10x|beat the odds|premier|trusted by|testimonials?|diverse founders|minority founders|Y Combinator|Techstars)\b/i;

test('the visual copy keeps the wave 9 banned words out, writes WE in capitals and uses US spelling', () => {
  for (const text of copy) {
    assert.doesNotMatch(text, BANNED, text);
    assert.doesNotMatch(text, /\bwe (are|do|will|can|build)\b/, `${text}: a lowercase "we" for the company`);
    assert.doesNotMatch(text, /\b(colour|centre|programme|organis|recognis|behaviour)\w*/i, `${text}: British spelling`);
    assert.doesNotMatch(text, /[$€£]/, `${text}: a price`);
  }
});

test('the visual components keep the brand rules: no hard-coded colour, no inline style, no button markup of their own', () => {
  const dir = new URL('../../../src/components/families/visual/', import.meta.url);
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.astro'))) {
    const source = readFileSync(new URL(name, dir), 'utf8');
    assert.doesNotMatch(source, /#[0-9a-f]{3,8}\b(?![\w-]*\})|\brgba?\(|\bhsla?\(|\boklch\(/i, `${name}: a literal colour`);
    assert.doesNotMatch(source, /\sstyle=|define:vars|is:inline/, `${name}: inline style or script`);
    assert.doesNotMatch(source, /<button|class="[^"]*btn/, `${name}: button markup`);
  }
});
