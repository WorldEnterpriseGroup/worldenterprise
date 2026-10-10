import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as claimsAudit from '../../../scripts/audit-claims.mjs';
import { CLAIM_IDS, claimRegistry, isClaimUsable } from '../../../src/data/claims.ts';
import type { ClaimId } from '../../../src/data/claims.ts';
import { INTRODUCTIONS_DISCLAIMER } from '../../../src/components/blocks/introductions.ts';
import { listCollectionFiles, listInsightFiles } from '../../../src/lib/content-files.ts';

/**
 * Wave 8 claims (WP-60, checkpoint 60a): the five claims the investor, partner and gated-brief pages cite, and the first-person peers rule
 * `W8-C13-own-peers`. The rule has positive and negative cases, and the real articles and pages must pass it today, so it starts green.
 */
interface Hit {
  rule: string;
  match: string;
}
const api = claimsAudit as unknown as {
  scan(text: string, options?: { route?: string; plain?: boolean; flagValues?: object }): Hit[];
};
const root = new URL('../../../', import.meta.url).pathname;
const html = (text: string, route = '/x/'): Hit[] => api.scan(`<main><p>${text}</p></main>`, { route, flagValues: {} });
const plain = (text: string, route = '/x/'): Hit[] => api.scan(text, { route, plain: true, flagValues: {} });
const caught = (hits: Hit[], rule: string): boolean => hits.some((h) => h.rule === rule);
const RULE = 'W8-C13-own-peers';

test('the five wave 8 claims are registered, published, enabled and sourced to the CEO direction', () => {
  const ids: readonly ClaimId[] = ['C-25', 'C-26', 'C-27', 'C-28', 'C-29'];
  for (const id of ids) {
    assert.ok((CLAIM_IDS as readonly string[]).includes(id), id);
    assert.equal(claimRegistry[id].status, 'publish', id);
    assert.equal(isClaimUsable(id), true, id);
    assert.match(claimRegistry[id].source, /CEO direction 2026-10-10/, id);
  }
});

test('the claims say what WE does and promise nothing', () => {
  assert.match(claimRegistry['C-25'].summary, /cannot promise a meeting, a reply or funding/);
  assert.match(claimRegistry['C-26'].summary, /creates no partnership/);
  assert.match(claimRegistry['C-27'].summary, /email to the address the reader gave/);
  assert.match(claimRegistry['C-28'].summary, /privacy notice/);
  assert.match(claimRegistry['C-29'].summary, /no promise of funding/);
  for (const id of ['C-25', 'C-26', 'C-27', 'C-28', 'C-29'] as const) assert.deepEqual(plain(claimRegistry[id].summary), [], id);
});

const POSITIVE = [
  'Join our cohort of founders.',
  'Our mentors review every plan.',
  'WE mentors founders weekly.',
  'We mentor first-time founders.',
  "WE's alumni network is open.",
  'Our upcoming cohort starts soon.',
  'Our first cohort opens in spring.',
  'Our accelerator takes ten teams.',
  'WE runs a cohort twice a year.',
  'WE offers startups a mentor.',
  'We host peer sessions on Fridays.',
  'Our peer groups meet monthly.',
  'We have mentors on call.',
  'WE provides a mentor network.',
] as const;

const NEGATIVE = [
  'WE has no mentors and runs no cohort.',
  'WE does not run a cohort.',
  'WE has no alumni.',
  'WE does not describe a cohort calendar or a demo day.',
  'A cohort analysis groups customers by signup month.',
  'Your mentor may ask for the plan.',
  'A founder may look for a mentor outside WE.',
  'Incubators and other startup programs differ in what they give a team.',
  'Dedicated offshore team seats, steered by WE.',
  'We offer a template for cohort analysis.',
  'Launch and Accelerate are packages sized by company stage.',
  INTRODUCTIONS_DISCLAIMER,
] as const;

test(`${RULE} catches first-person peer wording in a page and in a text file`, () => {
  for (const text of POSITIVE) {
    assert.equal(caught(html(text), RULE), true, `html: ${text}`);
    assert.equal(caught(plain(text), RULE), true, `plain: ${text}`);
  }
});

test(`${RULE} leaves denials, third-party use and neighbouring words alone`, () => {
  for (const text of NEGATIVE) {
    assert.equal(caught(html(text), RULE), false, `html: ${text}`);
    assert.equal(caught(plain(text), RULE), false, `plain: ${text}`);
  }
});

test(`${RULE} allows no marker and no path, even where the generic word is allowed`, () => {
  const document = JSON.parse(readFileSync(new URL('../../../claims-denylist.json', import.meta.url), 'utf8')) as {
    contextRules: { id: string; markerAllowed?: boolean; allowPaths?: string[] }[];
  };
  const rule = document.contextRules.find((r) => r.id === RULE);
  assert.ok(rule !== undefined, `${RULE} is a context rule`);
  assert.ok(!rule.markerAllowed && rule.allowPaths === undefined);
  const text = 'Our cohort starts in spring.';
  assert.equal(caught(html(`<span data-claim-allow="${RULE}">${text}</span>`), RULE), true, 'a marker naming the rule');
  assert.equal(caught(html(`<span data-claim-allow="*">${text}</span>`), RULE), true, 'a wildcard marker');
  assert.equal(caught(html(`<span data-claim-allow="C-13-peers">${text}</span>`), RULE), true, 'a marker for the generic rule');
  assert.equal(caught(html(text, '/faq/'), RULE), true, '/faq/ is not exempt');
  assert.equal(caught(html(text, '/research/early-stage-saas-metrics-definitions/'), RULE), true, 'the metrics page is not exempt');
  assert.equal(caught(plain(text, '/llms.txt'), RULE), true, 'llms.txt is not exempt');
  // The generic rule is still allowed on the FAQ, so the pair gives the FAQ its question without letting WE claim a cohort.
  assert.equal(caught(html('Is WE an accelerator?', '/faq/'), 'C-13-peers'), false);
  assert.equal(caught(html('Is WE an accelerator?', '/faq/'), RULE), false);
});

test(`${RULE} is green on the repository's own copy: every page, article, FAQ answer and llms file in source passes`, () => {
  const sources = [
    ...listInsightFiles(root).map((f) => f.file),
    ...['pages', 'guides', 'playbooks', 'library', 'research', 'services', 'glossary', 'briefs', 'faq', 'people', 'events', 'portfolio']
      .flatMap((collection) => listCollectionFiles(root, collection).map((rel) => `src/content/${collection}/${rel}`)),
    'src/data/faq.yaml',
  ];
  const offenders = sources.filter((file) => {
    try {
      return caught(plain(readFileSync(new URL(`../../../${file}`, import.meta.url), 'utf8')), RULE);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw error;
    }
  });
  assert.deepEqual(offenders, []);
});
