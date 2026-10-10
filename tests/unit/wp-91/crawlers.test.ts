import assert from 'node:assert/strict';
import test from 'node:test';
import { AI_CRAWLER_AGENTS, AI_CRAWLER_GROUPS, robotsTxt } from '../../../src/lib/seo.ts';

/**
 * WP-41 carry-over (a): every crawler token in robots.txt checked against the vendor's own documentation.
 * The table is the record of that check (accessed 2026-10-10); .astro-magazine/sources/wp-91.json holds the fetches.
 * A token added to AI_CRAWLER_GROUPS must be added here with the page it was checked on, or marked unverified.
 */
interface Check {
  readonly agent: string;
  readonly status: 'verified' | 'legacy' | 'unverified';
  /** The vendor page the token was read on, or the reason no approved page covers it. */
  readonly note: string;
}

const OPENAI = 'https://developers.openai.com/api/docs/bots';
const ANTHROPIC = 'https://privacy.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler';
const GOOGLE = 'https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers';

const CHECKS: readonly Check[] = [
  { agent: 'GPTBot', status: 'verified', note: OPENAI },
  { agent: 'OAI-SearchBot', status: 'verified', note: OPENAI },
  { agent: 'ChatGPT-User', status: 'verified', note: OPENAI },
  { agent: 'ClaudeBot', status: 'verified', note: ANTHROPIC },
  { agent: 'Claude-User', status: 'verified', note: ANTHROPIC },
  { agent: 'Claude-SearchBot', status: 'verified', note: ANTHROPIC },
  { agent: 'anthropic-ai', status: 'legacy', note: `${ANTHROPIC} (the page names ClaudeBot, Claude-User and Claude-SearchBot; anthropic-ai is kept as the older token)` },
  { agent: 'Google-Extended', status: 'verified', note: GOOGLE },
  { agent: 'Applebot-Extended', status: 'unverified', note: 'the vendor page is not on an approved documentation host' },
  { agent: 'PerplexityBot', status: 'unverified', note: 'the vendor page is not on an approved documentation host' },
  { agent: 'Perplexity-User', status: 'unverified', note: 'the vendor page is not on an approved documentation host' },
  { agent: 'CCBot', status: 'unverified', note: 'the vendor page is not on an approved documentation host' },
];

test('every crawler token in robots.txt has a verification record, and every record names a token that is still listed', () => {
  assert.deepEqual([...AI_CRAWLER_AGENTS].sort(), CHECKS.map((c) => c.agent).sort());
});

test('a verified record cites an https vendor page, and no record is left without a note', () => {
  for (const check of CHECKS) {
    assert.ok(check.note !== '', check.agent);
    if (check.status === 'verified') assert.match(check.note, /^https:\/\//, check.agent);
  }
});

test('OAI-AdsBot is not named: it is an ad-review agent, not a crawler of this site', () => {
  assert.ok(!AI_CRAWLER_AGENTS.includes('OAI-AdsBot'));
});

test('production robots.txt names each token once under its vendor, and a preview build names none', () => {
  const text = robotsTxt(false);
  for (const group of AI_CRAWLER_GROUPS) for (const agent of group.agents) assert.equal(text.split(`User-agent: ${agent}\n`).length - 1, 1, agent);
  const preview = robotsTxt(true);
  assert.ok(!AI_CRAWLER_AGENTS.some((agent) => preview.includes(agent)));
  assert.ok(preview.includes('Disallow: /'));
});
