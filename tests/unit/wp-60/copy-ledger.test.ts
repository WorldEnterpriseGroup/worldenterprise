import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import * as claimsAudit from '../../../scripts/audit-claims.mjs';
import * as copy from '../../../src/components/forms/copy.ts';
import { AUDIENCE_LINKS } from '../../../src/data/cta/audiences.ts';
import { allKeys, targetFor } from '../../../src/data/cta/targets.ts';
import { BRIEFS } from '../../../src/data/families.ts';
import { repoViewAt } from './repo-view.ts';
import { checkSentences } from './sources.ts';
import type { SentenceRecord, SourcesFile } from './sources.ts';

/**
 * The sentence ledger of WP-60's own copy (docs/wave8-contracts.md, section 9; the WP-43 pattern). The strings come from the modules that
 * hold them: the CTA targets, the audience strip and the wave 8 form copy. `.astro-magazine/sources/wp-60.json` maps each sentence to a
 * claim, an existing page or a decision. A sentence with no mapping fails here, a mapping whose sentence is gone fails here, and every
 * sentence runs through the claims denylist.
 */
interface Hit {
  readonly rule: string;
  readonly match: string;
}
const audit = claimsAudit as unknown as { scan(text: string, options?: { route?: string; plain?: boolean; flagValues?: object }): Hit[] };

const root = new URL('../../../', import.meta.url).pathname;
const repo = repoViewAt(root);
const ledger = JSON.parse(readFileSync(join(root, '.astro-magazine/sources/wp-60.json'), 'utf8')) as SourcesFile;

const TARGETS = 'src/data/cta/targets.ts';
const AUDIENCES = 'src/data/cta/audiences.ts';
const FORM_COPY = 'src/components/forms/copy.ts';

/** A string split into its sentences, so the ledger maps sentences and not paragraphs. */
const sentencesOf = (text: string): string[] => text.split(/(?<=[.!?])\s+(?=[A-Z])/).map((s) => s.trim()).filter((s) => s !== '');

function targetStrings(): string[] {
  const strings: string[] = [];
  for (const key of allKeys()) {
    const target = targetFor(key);
    if (target === undefined) continue;
    strings.push(target.label);
    if (target.band === undefined) continue;
    // A brief's heading carries its registry label, which the registry tests govern; the ledger holds the template.
    const entry = key.startsWith('brief:') ? BRIEFS.entries.find((e) => `brief:${e.slug}` === key) : undefined;
    strings.push(entry === undefined ? target.band.heading : target.band.heading.replace(`: ${entry.label}`, ': {label}'));
    strings.push(...sentencesOf(target.band.body));
    if (target.band.note !== undefined) strings.push(...sentencesOf(target.band.note));
  }
  return strings;
}

function audienceStrings(): string[] {
  return AUDIENCE_LINKS.flatMap((link) => [link.label, ...sentencesOf(link.text)]);
}

function formCopyStrings(): string[] {
  const strings: string[] = [];
  const visit = (value: unknown): void => {
    if (typeof value === 'string') strings.push(...sentencesOf(value));
    else if (Array.isArray(value)) value.forEach(visit);
    else if (typeof value === 'object' && value !== null) {
      // An option is { value, label }: the value is a machine token, never copy.
      const record = value as Record<string, unknown>;
      if ('value' in record && 'label' in record) visit(record.label);
      else Object.values(record).forEach(visit);
    }
  };
  visit(copy);
  return strings;
}

const surfaces: ReadonlyArray<{ path: string; strings: string[] }> = [
  { path: TARGETS, strings: [...new Set(targetStrings())] },
  { path: AUDIENCES, strings: [...new Set(audienceStrings())] },
  { path: FORM_COPY, strings: [...new Set(formCopyStrings())] },
];

const documentFor = (path: string): readonly SentenceRecord[] => ledger.documents?.find((d) => d.path === path)?.sentences ?? [];

test('the WP-60 sources file is the WP-60 ledger and lists exactly the three copy modules', () => {
  assert.equal(ledger.wp, 'WP-60');
  assert.deepEqual((ledger.documents ?? []).map((d) => d.path).sort(), surfaces.map((s) => s.path).sort());
});

test('every sentence the modules hold is mapped (an unmapped sentence fails here)', () => {
  for (const surface of surfaces) {
    const mapped = new Set(documentFor(surface.path).map((s) => s.text));
    const missing = surface.strings.filter((text) => !mapped.has(text));
    assert.deepEqual(missing, [], `Unmapped in ${surface.path}. Add each to .astro-magazine/sources/wp-60.json:\n${missing.map((m) => `  ${JSON.stringify(m)}`).join('\n')}`);
  }
});

test('no mapping is stale: every mapped sentence is still in its module', () => {
  for (const surface of surfaces) {
    const live = new Set(surface.strings);
    const stale = documentFor(surface.path).map((s) => s.text).filter((text) => !live.has(text));
    assert.deepEqual(stale, [], `Stale in ${surface.path}`);
  }
});

test('every mapping is well formed: one claim, page, decision or label, and an existing page', () => {
  for (const doc of ledger.documents ?? []) assert.deepEqual(checkSentences('WP-60', doc.path, doc.sentences ?? [], repo), []);
});

test('no sentence the ledger holds trips the claims denylist', () => {
  for (const surface of surfaces) {
    for (const text of surface.strings) {
      const hits = audit.scan(text, { route: '/', plain: true, flagValues: {} });
      assert.deepEqual(hits.map((h) => h.rule), [], `${surface.path}: "${text}"`);
    }
  }
});

test('the funding sentence is the claim sentence, so no CTA can soften or promise it', () => {
  assert.equal(copy.FORM_NOTICES.noFunding, 'WE makes no promise of funding.');
  assert.ok(targetStrings().includes('WE makes no promise of funding.'));
  for (const surface of surfaces) {
    const entry = documentFor(surface.path).find((s) => s.text === 'WE makes no promise of funding.');
    if (entry !== undefined) assert.equal(entry.claim, 'C-05');
  }
});
