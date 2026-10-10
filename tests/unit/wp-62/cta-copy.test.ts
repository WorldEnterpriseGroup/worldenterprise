import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import * as claimsAudit from '../../../scripts/audit-claims.mjs';
import { AUDIENCE_LINKS } from '../../../src/data/cta/audiences.ts';
import { allKeys, FAMILY_SURFACES, resolveCta, resolveMidCta, targetFor } from '../../../src/data/cta/index.ts';
import type { CtaModel } from '../../../src/data/cta/index.ts';
import type { SourcesFile } from '../wp-60/sources.ts';

/**
 * The truth policy of the call to action (docs/wave8-contracts.md, section 6.4; W8-25), stricter than the claims denylist: no urgency, no
 * scarcity, no countdown, no "exclusive", no exclamation mark; a heading of at most 70 characters in sentence case. The claims denylist runs
 * over the same strings. The strings come from the data modules that hold them and from the models the family table resolves, so a band added
 * later is held to the rule without a new test.
 */
const root = new URL('../../../', import.meta.url).pathname;
const live = (): boolean => true;

/** Pressure and scarcity words (the stricter list), on top of the claims denylist. */
const URGENCY =
  /\b(?:limited|last chance|hurry|don'?t miss|only (?:\d+|a few|\w+ (?:spots?|seats?|places?) left)|\d+ (?:spots?|seats?|places?) (?:left|remain)|spots? left|seats? left|countdown|exclusive|ends? (?:soon|today|tonight)|act now|today only|now or never|deadline|running out|expires?|while (?:stocks|places|spots) last|free|guarantee[ds]?)\b|!/i;

interface Hit {
  readonly rule: string;
}
const audit = claimsAudit as unknown as { scan(text: string, options?: { route?: string; plain?: boolean; flagValues?: object }): Hit[] };

/** Every string a model puts on a page. */
function stringsOf(model: CtaModel): string[] {
  return [model.heading, model.body, model.note, model.primary.label, model.secondary?.label].filter((s): s is string => s !== undefined);
}

/** A heading is sentence case when only its first word, `WE`, an acronym or a number-led token starts with a capital. */
function isSentenceCase(heading: string): boolean {
  const words = heading.split(/\s+/).filter(Boolean);
  const first = words[0] ?? '';
  if (!/^[A-Z]/.test(first)) return false;
  return words.slice(1).every((word) => !/^[A-Z][a-z]+[,.;:]?$/.test(word));
}

const models: Array<{ id: string; model: CtaModel }> = [];
for (const row of FAMILY_SURFACES) {
  for (const [kind, model] of [['end', resolveCta(row.input, live)], ['mid', resolveMidCta(row.input, live)]] as const) {
    if (model !== null) models.push({ id: `${row.id} (${kind})`, model });
  }
}

test('the table yields models to check, and the audience strip and the targets carry copy', () => {
  assert.ok(models.length >= FAMILY_SURFACES.length / 2);
  assert.ok(AUDIENCE_LINKS.length >= 2);
  assert.ok(allKeys().length > 0);
});

test('no string of a resolved band reads as urgency or scarcity, and none trips the claims denylist', () => {
  for (const { id, model } of models) {
    for (const text of stringsOf(model)) {
      assert.doesNotMatch(text, URGENCY, `${id}: "${text}" reads as pressure`);
      assert.deepEqual(audit.scan(text, { route: '/', plain: true, flagValues: {} }).map((h) => h.rule), [], `${id}: "${text}"`);
    }
  }
});

test('every heading is at most 70 characters, in sentence case, and every action label is short and has no exclamation mark', () => {
  for (const { id, model } of models) {
    assert.ok(model.heading.length <= 70, `${id}: the heading "${model.heading}" is ${model.heading.length} characters`);
    // A brief heading carries the registry label after the colon; the label is a name and keeps its own case.
    const lead = model.heading.split(': ')[0] ?? model.heading;
    assert.ok(isSentenceCase(lead), `${id}: the heading "${model.heading}" is not sentence case`);
    assert.ok(model.primary.label.length <= 40, `${id}: the primary label "${model.primary.label}" is long`);
    assert.ok((model.secondary?.label.length ?? 0) <= 40, `${id}: the secondary label is long`);
  }
});

test('the strings of the targets and the audience strip pass the stricter list', () => {
  for (const key of allKeys()) {
    const target = targetFor(key);
    assert.ok(target !== undefined, key);
    for (const text of [target.label, target.band?.heading, target.band?.body, target.band?.note]) {
      if (text !== undefined) assert.doesNotMatch(text, URGENCY, `${key}: "${text}"`);
    }
  }
  for (const link of AUDIENCE_LINKS) {
    for (const text of [link.label, link.text]) assert.doesNotMatch(text, URGENCY, `${link.href}: "${text}"`);
  }
});

test('the copy WP-62 wrote passes the stricter list and the claims denylist, and its labels are in sentence case', () => {
  const ledger = JSON.parse(readFileSync(join(root, '.astro-magazine/sources/wp-62.json'), 'utf8')) as SourcesFile;
  const sentences = (ledger.documents ?? []).flatMap((doc) => doc.sentences ?? []);
  assert.ok(sentences.length > 0);
  for (const sentence of sentences) {
    assert.doesNotMatch(sentence.text, URGENCY, `"${sentence.text}"`);
    assert.deepEqual(audit.scan(sentence.text, { route: '/', plain: true, flagValues: {} }).map((h) => h.rule), [], `"${sentence.text}"`);
    if (sentence.label === true) {
      assert.ok(sentence.text.length <= 70);
      assert.ok(isSentenceCase(sentence.text), `"${sentence.text}"`);
    }
  }
});

test('the sentence-case check itself rejects title case and accepts WE and acronyms', () => {
  assert.equal(isSentenceCase('Tell WE about your company'), true);
  assert.equal(isSentenceCase('Ask about B2B SaaS'), true);
  assert.equal(isSentenceCase('Tell Us About Your Company'), false);
  assert.equal(isSentenceCase('tell WE about your company'), false);
});
