import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import * as claimsAudit from '../../../scripts/audit-claims.mjs';
import { repoViewAt } from '../wp-60/repo-view.ts';
import { checkSentences, checkSourcesFile, classifyHost } from '../wp-60/sources.ts';
import type { SentenceRecord, SourcesFile } from '../wp-60/sources.ts';
import { LEDGER_PATH, buildLedger, hubCopyEntries, playbookPath } from './build-ledger.ts';
import { enumerateHub, enumeratePlaybook, uniqueEntries } from './enumerate.ts';
import { FACTS, FETCHES, HUB_COPY, HUB_LEAD, HUB_PAGE, PLAYBOOKS } from './ledger-spec.ts';

/**
 * The sentence ledger of the ten playbooks and the hub (docs/wave8-contracts.md, section 9). The sentences are enumerated from the content
 * files here, the ledger is the JSON the generator wrote, and each side is held to the other: a sentence with no mapping fails, a mapping
 * with no sentence fails, and the whole file equals what the generator would write now. Every sentence runs through the claims denylist.
 */
interface Fact {
  readonly path: string;
  readonly sentence: string;
  readonly fetchId: string;
  readonly quotes: readonly string[];
}
interface Ledger extends SourcesFile {
  readonly facts: readonly Fact[];
}
interface Hit {
  readonly rule: string;
  readonly match: string;
}
const audit = claimsAudit as unknown as { scan(text: string, options?: { route?: string; plain?: boolean; flagValues?: object }): Hit[] };

const root = new URL('../../../', import.meta.url).pathname;
const repo = repoViewAt(root);
const ledger = JSON.parse(readFileSync(join(root, LEDGER_PATH), 'utf8')) as Ledger;
const read = (path: string): string => readFileSync(join(root, path), 'utf8');
const MAX_QUOTE_WORDS = 25;

const docOf = (path: string): { sentences: SentenceRecord[] } => {
  const doc = (ledger.documents ?? []).find((d) => d.path === path);
  assert.ok(doc?.sentences !== undefined, `the ledger has no document for ${path}`);
  return { sentences: [...doc.sentences] };
};

test('the ledger holds every sources rule', () => {
  assert.equal(ledger.wp, 'WP-86');
  assert.deepEqual(checkSourcesFile(ledger, new Map(), repo), []);
});

test('the ledger covers the ten playbooks, the hub page and the hub copy, and nothing else', () => {
  const expected = [...Object.keys(PLAYBOOKS).map(playbookPath), HUB_PAGE, HUB_COPY];
  assert.deepEqual((ledger.documents ?? []).map((d) => d.path), expected);
});

for (const slug of Object.keys(PLAYBOOKS)) {
  const path = playbookPath(slug);
  test(`${path}: the ledger maps each sentence of the file and no other`, () => {
    const enumerated = uniqueEntries(enumeratePlaybook(path, read(path))).map((e) => e.text);
    const mapped = docOf(path).sentences.map((s) => s.text);
    assert.deepEqual(enumerated.filter((t) => !mapped.includes(t)), [], 'sentences with no mapping');
    assert.deepEqual(mapped.filter((t) => !enumerated.includes(t)), [], 'mappings with no sentence');
    assert.deepEqual(mapped, enumerated, 'same order');
  });
}

test('the hub page and the hub copy are mapped sentence for sentence', () => {
  const hub = uniqueEntries(enumerateHub(HUB_PAGE, read(HUB_PAGE))).map((e) => e.text);
  assert.deepEqual(docOf(HUB_PAGE).sentences.map((s) => s.text), hub);
  const copy = hubCopyEntries().map((e) => e.text);
  assert.deepEqual(docOf(HUB_COPY).sentences.map((s) => s.text), copy);
  assert.ok(read(HUB_COPY).includes(HUB_LEAD), 'the hub lead is in the page it is ledgered under');
});

test('the file is what the generator writes now', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(buildLedger())), ledger, 'run: node tests/unit/wp-86/build-ledger.ts');
});

test('every mapping is exactly one of claim, page, decision or label, and the page and decision mappings resolve', () => {
  for (const doc of ledger.documents ?? []) {
    assert.deepEqual(checkSentences(ledger.wp, doc.path, doc.sentences ?? [], repo), []);
  }
});

test('every sentence in the ledger passes the claims denylist', () => {
  for (const doc of ledger.documents ?? []) {
    const route = doc.path.startsWith('src/content/playbooks/') ? `/playbooks/${doc.path.split('/').pop()?.replace('.mdx', '')}/` : '/playbooks/';
    for (const sentence of doc.sentences ?? []) {
      assert.deepEqual(audit.scan(sentence.text, { route, plain: true, flagValues: {} }), [], `${doc.path}: "${sentence.text}"`);
    }
  }
});

test('a sentence about WE maps to a claim, never to an outside page, and the investor disclaimer maps to C-05', () => {
  const investor = docOf(playbookPath('prepare-for-investor-conversations')).sentences;
  assert.deepEqual(investor.find((s) => s.text === 'WE makes no promise of funding.'), { text: 'WE makes no promise of funding.', claim: 'C-05' });
  for (const slug of Object.keys(PLAYBOOKS)) {
    for (const sentence of docOf(playbookPath(slug)).sentences) {
      if (/\bWE\b/.test(sentence.text) && sentence.label !== true) {
        assert.ok(sentence.claim !== undefined || sentence.decision !== undefined, `${slug}: "${sentence.text}" about WE needs a claim or a decision`);
      }
    }
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------
// The facts: what an outside page says
// ---------------------------------------------------------------------------------------------------------------------------------

test('every fetch is a status 200 page on an approved government or standards host, recorded with a time and a tool', () => {
  assert.deepEqual(ledger.fetches, FETCHES);
  for (const f of ledger.fetches) {
    assert.equal(f.status, 200);
    assert.ok(['government', 'standards'].includes(classifyHost(f.url)), `${f.id} is a primary source`);
    assert.ok(!Number.isNaN(Date.parse(f.fetchedAt)), `${f.id} has a time`);
    assert.ok(f.tool === 'WebFetch', `${f.id} was fetched with WebFetch`);
  }
});

test('every fact names a fetch, sits in its playbook as a sentence mapped to the source rule, and quotes the page', () => {
  assert.deepEqual(ledger.facts, FACTS.map((f) => ({ path: playbookPath(f.slug), sentence: f.sentence, fetchId: f.fetchId, quotes: f.quotes })));
  const ids = new Set(ledger.fetches.map((f) => f.id));
  for (const fact of ledger.facts) {
    assert.ok(ids.has(fact.fetchId), `${fact.fetchId} was fetched`);
    const mapped = docOf(fact.path).sentences.find((s) => s.text === fact.sentence);
    assert.deepEqual(mapped, { text: fact.sentence, decision: 'W8-9' }, `"${fact.sentence}" is in ${fact.path}`);
    assert.ok(fact.quotes.length > 0);
    for (const quote of fact.quotes) assert.ok(quote.split(/\s+/).filter(Boolean).length <= MAX_QUOTE_WORDS, `quote over ${MAX_QUOTE_WORDS} words: ${quote}`);
  }
});

test('every outside link in a playbook is a fetched page, and every fetch is used by a playbook', () => {
  const urls = new Map(ledger.fetches.map((f) => [f.url, f.id]));
  const linked = new Set<string>();
  for (const slug of Object.keys(PLAYBOOKS)) {
    for (const [, url] of read(playbookPath(slug)).matchAll(/\]\((https:\/\/[^)\s]+)\)/g)) {
      assert.ok(urls.has(url ?? ''), `${slug} links ${url} with no fetch record`);
      linked.add(url ?? '');
    }
  }
  assert.deepEqual([...urls.keys()].filter((u) => !linked.has(u)), [], 'fetches no playbook cites');
});

test('each fact is quoted from the page the playbook names in its Sources list', () => {
  const byId = new Map(ledger.fetches.map((f) => [f.id, f.url]));
  for (const fact of ledger.facts) {
    assert.ok(read(fact.path).includes(`](${byId.get(fact.fetchId)})`), `${fact.path} does not list ${fact.fetchId} in its sources`);
  }
});
