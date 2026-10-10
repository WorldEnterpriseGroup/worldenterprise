import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import * as claimsAudit from '../../../scripts/audit-claims.mjs';
import { claimRegistry } from '../../../src/data/claims.ts';
import type { ClaimId } from '../../../src/data/claims.ts';
import { interfaceStrings, surfaces } from './sentences.ts';

// WP-43 (DP-5): /program/how-we-decide/ and the new Apply copy restate what the site already says. .astro-magazine/sources/wp-43.json maps
// every string to an existing page and line or a claim id. This test fails on a string with no mapping, on a mapping with no string, on a
// quote that is no longer in its file, and on any string the claims denylist or the wave 7 truth policy rejects.

interface QuoteSource {
  file: string;
  line: number;
  quote: string;
}
interface ClaimSource {
  claims: string[];
}
interface Entry {
  text: string;
  ui_label?: boolean;
  sources?: (QuoteSource | ClaimSource)[];
}
interface SourcesFile {
  wp: string;
  sources: Record<string, unknown>[];
  sentences: Entry[];
}
interface Hit {
  rule: string;
  match: string;
}
const audit = claimsAudit as unknown as { scan(text: string, options?: { route?: string; plain?: boolean; flagValues?: object }): Hit[] };

const root = new URL('../../../', import.meta.url);
const sources = JSON.parse(readFileSync(new URL('.astro-magazine/sources/wp-43.json', root), 'utf8')) as SourcesFile;
const collected = surfaces().flatMap((surface) => surface.strings.map((text) => ({ where: surface.where, text })));
const texts = [...new Set(collected.map((c) => c.text))];
const isQuote = (source: QuoteSource | ClaimSource): source is QuoteSource => 'quote' in source;
const squash = (value: string): string => value.replace(/\s+/g, ' ');

test('the sources file is WP-43 and carries complete source records', () => {
  assert.equal(sources.wp, 'WP-43');
  assert.ok(sources.sources.length >= 1);
  const required = ['schema_version', 'source_id', 'publisher_or_author', 'title', 'source_tier', 'exact_url_or_locator', 'retrieved_at', 'claims_supported', 'claims_not_supported', 'captured_by'];
  for (const record of sources.sources) for (const key of required) assert.ok(key in record, `a source record has no ${key}`);
});

test('every string on the new page and in the new Apply copy is mapped (an unmapped sentence fails here)', () => {
  const mapped = new Set(sources.sentences.map((s) => s.text));
  const missing = texts.filter((text) => !mapped.has(text));
  assert.deepEqual(missing, [], `Unmapped strings. Add each to .astro-magazine/sources/wp-43.json:\n${missing.map((m) => `  ${JSON.stringify(m)}`).join('\n')}`);
});

test('no mapping is stale: every mapped string is still on the site', () => {
  const live = new Set(texts);
  const stale = sources.sentences.map((s) => s.text).filter((text) => !live.has(text));
  assert.deepEqual(stale, []);
  assert.equal(new Set(sources.sentences.map((s) => s.text)).size, sources.sentences.length, 'a string is mapped twice');
});

test('every mapping names a quote or a claim, or is a short control label', () => {
  for (const entry of sources.sentences) {
    if (entry.ui_label === true) {
      assert.equal(entry.sources, undefined, `${entry.text}: a ui_label has no sources`);
      assert.ok(entry.text.split(/\s+/).length <= 7 || /^Use Change/.test(entry.text), `${entry.text}: too long for a label`);
      continue;
    }
    assert.ok(Array.isArray(entry.sources) && entry.sources.length > 0, `${entry.text}: no source`);
  }
});

test('every quote is in its file, and a moved line is reported', (t) => {
  for (const entry of sources.sentences) {
    for (const source of entry.sources ?? []) {
      if (!isQuote(source)) continue;
      assert.ok(!source.file.startsWith('/') && !source.file.includes('..'), `${source.file}: not a repository path`);
      const url = new URL(source.file, root);
      assert.ok(existsSync(url), `${source.file} does not exist (for: ${entry.text})`);
      const lines = readFileSync(url, 'utf8').split('\n');
      assert.ok(source.line >= 1 && source.line <= lines.length, `${source.file}:${source.line} is outside the file`);
      const quote = squash(source.quote);
      assert.ok(squash(lines.join(' ')).includes(quote), `${source.file} no longer contains: ${source.quote} (for: ${entry.text})`);
      if (!squash(lines[source.line - 1] ?? '').includes(quote)) t.diagnostic(`${source.file}:${source.line} has moved; the quote is still in the file (for: ${entry.text})`);
    }
  }
});

test('a claim source names a published, enabled claim', () => {
  for (const entry of sources.sentences) {
    for (const source of entry.sources ?? []) {
      if (isQuote(source)) continue;
      for (const id of source.claims) {
        const claim = claimRegistry[id as ClaimId];
        assert.ok(claim !== undefined, `${id} is not a claim`);
        assert.equal(claim.status, 'publish', `${id} is not a published claim (for: ${entry.text})`);
        assert.equal(claim.enabled, true, `${id} is not enabled (for: ${entry.text})`);
      }
    }
  }
});

test('the claims denylist finds nothing in any string, interface text included', () => {
  for (const text of [...texts, ...interfaceStrings()]) {
    assert.deepEqual(audit.scan(text, { route: '/program/how-we-decide/', plain: true, flagValues: {} }), [], text);
  }
});

test('the page copy states no timeline, count, currency, response time or fee wording (DP-5, C-09)', () => {
  for (const text of texts) {
    assert.doesNotMatch(text, /\d/, `${text}: a digit`);
    assert.doesNotMatch(text, /[$€£%]/, `${text}: a currency sign or a percentage`);
    assert.doesNotMatch(text, /\b(within|hours?|days?|weeks?|months?|minutes?|instantly|immediately|guarantee[sd]?|free of charge|no fee|no equity|no cost|for free)\b/i, text);
  }
});

test('the page says WE makes no promise of funding, and keeps Investor Introductions off the page', () => {
  const page = texts.join('\n');
  assert.match(page, /WE makes no promise of funding\./);
  assert.doesNotMatch(page, /Investor Introductions|investor network|Demo Day/i);
});
