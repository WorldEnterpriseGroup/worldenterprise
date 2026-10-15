import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { AGENCIES } from '../../../src/data/sbir/agencies.ts';
import { AGGREGATES as A } from '../../../src/data/sbir/aggregates.ts';
import * as charts from '../../../src/data/sbir/charts.ts';
import { HELP_PROGRAMS, INDEPENDENT_NOTICE } from '../../../src/data/sbir/help.ts';
import { PHASES, TABA } from '../../../src/data/sbir/phases.ts';
import { ELIGIBILITY, LANES, PHASE2_START_MONTH, READINESS, REGISTRATION_STEPS, TIMELINE_MONTHS } from '../../../src/data/sbir/prepare.ts';
import { RETRIEVED, SBIR_SOURCES, sbirSource, sourceAnchor } from '../../../src/data/sbir/sources.ts';
import type { SbirSourceId } from '../../../src/data/sbir/sources.ts';
import {
  AUTHORIZED_THROUGH,
  CHECK_LATEST,
  LAW_CHANGES,
  STATUS_AS_OF,
  STATUS_AS_OF_LABEL,
  STATUS_BODY,
  STATUS_EVENTS,
  STATUS_HEADLINE,
} from '../../../src/data/sbir/status.ts';
import { DEFAULT_KEY, normaliseTicks, parseTicks, progressText, serializeTicks } from '../../../src/scripts/sbir-checklist.ts';

/**
 * WP-34 (#83): the SBIR and STTR guide. These tests hold the data to the page rules: the authorization status carries a date and says
 * where to check the latest, every source has an https URL and a retrieval date (or an honest null), every aggregate adds up, every
 * chart row is finite and has a table row, the preparation data is well formed, and no copy breaks the wave 10 wording rules.
 */
const root = new URL('../../../', import.meta.url).pathname;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function filesUnder(rel: string, ext: RegExp): string[] {
  const dir = join(root, rel);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? filesUnder(`${rel}/${d.name}`, ext) : ext.test(d.name) ? [`${rel}/${d.name}`] : [],
  );
}

const read = (rel: string): string => readFileSync(join(root, rel), 'utf8');

test.describe('the authorization status', () => {
  test('carries an ISO date, a long date, the end date and the line that sends readers to sbir.gov', () => {
    assert.match(STATUS_AS_OF, ISO);
    assert.equal(STATUS_AS_OF, RETRIEVED);
    assert.match(STATUS_AS_OF_LABEL, /^[A-Z][a-z]+ \d{1,2}, 20\d{2}$/);
    assert.equal(new Date(`${STATUS_AS_OF}T00:00:00Z`).getUTCFullYear(), Number(STATUS_AS_OF_LABEL.slice(-4)));
    assert.ok(STATUS_HEADLINE.includes(AUTHORIZED_THROUGH));
    assert.match(AUTHORIZED_THROUGH, /September 30, 2031/);
    assert.match(CHECK_LATEST, /Always check sbir\.gov/);
  });

  test('says what happened and when, in order, each event sourced', () => {
    assert.ok(STATUS_BODY.length >= 1);
    assert.ok(STATUS_BODY.join(' ').includes('April 13, 2026'));
    assert.ok(STATUS_EVENTS.length >= 4);
    const isos = STATUS_EVENTS.map((e) => e.iso);
    for (const iso of isos) assert.match(iso, ISO);
    assert.deepEqual([...isos].sort(), isos, 'events run oldest to newest');
    for (const e of STATUS_EVENTS) {
      assert.ok(e.sources.length >= 1, `event ${e.iso} cites a source`);
      for (const s of e.sources) sbirSource(s);
    }
    assert.ok(isos.includes('2025-09-30') && isos.includes('2026-04-13'));
    for (const c of LAW_CHANGES) assert.ok(c.sources.length >= 1, c.title);
  });

  test('never claims a Public Law number this build did not verify', () => {
    const text = [STATUS_HEADLINE, ...STATUS_BODY, ...STATUS_EVENTS.map((e) => e.text)].join(' ');
    assert.doesNotMatch(text, /Public Law|P\.L\./);
  });
});

test.describe('the sources', () => {
  test('have unique ids, https URLs, a publisher and a retrieval date or an honest null', () => {
    const ids = SBIR_SOURCES.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const s of SBIR_SOURCES) {
      assert.match(s.url, /^https:\/\//, s.id);
      assert.ok(s.title.length > 10 && s.publisher.length > 2 && s.short.length > 2, s.id);
      if (s.accessed !== null) {
        assert.match(s.accessed, ISO, s.id);
        assert.ok(s.accessed <= STATUS_AS_OF, `${s.id} is not retrieved in the future`);
      }
      assert.equal(sourceAnchor(s.id), `#source-${s.id}`);
    }
    assert.throws(() => sbirSource('nope' as SbirSourceId), /Unknown SBIR source id/);
  });

  test('every source id used by a data file or a page exists', () => {
    const known = new Set<string>(SBIR_SOURCES.map((s) => s.id));
    const files = [...filesUnder('src/data/sbir', /\.ts$/), ...filesUnder('src/pages/sbir-sttr', /\.astro$/)].filter(
      (f) => !f.endsWith('aggregates.ts') && !f.endsWith('sources.ts'),
    );
    for (const file of files) {
      for (const [, id] of read(file).matchAll(/'((?:sba|congress|crowell|uw|doe|nasa|nih|nsf|sbir|sam|taba|apex)-[a-z0-9-]+)'/g)) {
        assert.ok(known.has(id ?? ''), `${file} names an unknown source "${id}"`);
      }
    }
  });

  test('the sources record names every id, with how the figures were derived for the award data', () => {
    const record = JSON.parse(read('.astro-magazine/sources/wp-34.json')) as { sources: { id: string; url: string; retrieved: string | null }[] };
    assert.deepEqual(record.sources.map((s) => s.id).sort(), SBIR_SOURCES.map((s) => s.id).sort());
    for (const s of record.sources) {
      const own = sbirSource(s.id as SbirSourceId);
      assert.equal(s.url, own.url);
      assert.equal(s.retrieved, own.accessed);
    }
    assert.match(read('.astro-magazine/sources/wp-34.json'), /transformation/);
  });
});

test.describe('the aggregates', () => {
  test('add up to the cumulative figure and agree with SBA statement of more than $81 billion', () => {
    const awards = A.byYear.reduce((n, y) => n + y.awards, 0);
    const billions = A.byYear.reduce((n, y) => n + y.usdMillions, 0) / 1000;
    assert.equal(A.cumulative.awards, awards);
    assert.ok(Math.abs(A.cumulative.usdBillions - billions) < 0.2);
    assert.ok(A.cumulative.usdBillions > 81, 'cross-checks the SBA figure');
    assert.equal(A.byYear[0]?.year, A.cumulative.fromYear);
    assert.equal(A.byYear[A.byYear.length - 1]?.year, A.cumulative.toYear);
    assert.equal(charts.PEAK_YEAR.year, 2024);
  });

  test('keep the phase-to-phase and repeat-winner counts consistent', () => {
    const g = A.phaseGap;
    assert.ok(g.companiesWithLaterPhaseII <= g.companiesWithPhaseI);
    assert.equal(g.buckets.reduce((n, b) => n + b.companies, 0), g.companiesWithLaterPhaseII);
    assert.ok(g.medianMonths > 6 && g.medianMonths < 36);
    assert.equal(A.repeat.rows.reduce((n, r) => n + r.companies, 0), A.repeat.companies);
    const dollars = A.repeat.rows.reduce((n, r) => n + r.dollarSharePercent, 0);
    assert.ok(Math.abs(dollars - 100) < 0.5, `dollar shares sum to ${dollars}`);
  });

  test('keep first-time, state and agency rows in range', () => {
    for (const r of A.firstTime) {
      assert.ok(r.toFirstTime <= r.phase1Awards && r.percent >= 0 && r.percent <= 100, String(r.year));
      assert.ok(Math.abs(r.percent - (100 * r.toFirstTime) / r.phase1Awards) < 0.06, String(r.year));
    }
    assert.equal(A.states.rows.reduce((n, r) => n + r.awards, 0), A.states.total);
    assert.equal(A.states.rows.length, A.states.listed + 1, 'the listed states and one row for the rest');
    assert.ok(A.states.distinct > A.states.listed);
    assert.equal(A.states.rows[A.states.rows.length - 1]?.state, 'All other states and territories');
    for (const r of A.agencies.rows) assert.ok(r.phase1Awards + r.phase2Awards <= r.awards && r.sttrAwards <= r.awards, r.agency);
    assert.ok(A.agencies.rows.length >= 11);
  });

  test('keep NIH success rates equal to awarded over reviewed', () => {
    assert.ok(A.nih.length >= 10);
    for (const r of A.nih) {
      assert.ok(Math.abs(r.phase1Percent - (100 * r.phase1Awarded) / r.phase1Reviewed) < 0.1, `phase I ${r.fy}`);
      if (r.phase2Reviewed !== null && r.phase2Awarded !== null && r.phase2Percent !== null) {
        assert.ok(Math.abs(r.phase2Percent - (100 * r.phase2Awarded) / r.phase2Reviewed) < 0.1, `phase II ${r.fy}`);
      }
    }
  });

  test('show the pause in the monthly counts', () => {
    assert.ok(charts.PAUSE_COMPARE.during < charts.PAUSE_COMPARE.before / 3);
    assert.equal(charts.MONTHLY_BARS.filter((b) => b.highlight === true).length, 6);
  });
});

test.describe('the chart rows', () => {
  const bars = [
    ['AWARDS_BY_YEAR_BARS', charts.AWARDS_BY_YEAR_BARS, charts.AWARDS_BY_YEAR_TABLE],
    ['MONTHLY_BARS', charts.MONTHLY_BARS, charts.MONTHLY_TABLE],
    ['AGENCY_DOLLAR_BARS', charts.AGENCY_DOLLAR_BARS, charts.AGENCY_TABLE],
    ['PHASE2_PER_100_BARS', charts.PHASE2_PER_100_BARS, charts.PHASE2_PER_100_TABLE],
    ['STATE_BARS', charts.STATE_BARS, charts.STATE_TABLE],
    ['REPEAT_BARS', charts.REPEAT_BARS, charts.REPEAT_TABLE],
  ] as const;

  for (const [name, rows, table] of bars) {
    test(`${name} is finite and has a table`, () => {
      assert.ok(rows.length > 1 && table.length >= rows.length);
      for (const b of rows) {
        assert.ok(Number.isFinite(b.value) && b.value >= 0, `${name} ${b.label}`);
        assert.ok(b.label.length > 0 && b.display.length > 0);
      }
      assert.ok(table.every((r) => r.length === table[0]?.length && r.every((c) => c.length > 0)));
    });
  }

  test('series run over increasing x and stay in range', () => {
    for (const s of [...charts.NIH_SERIES, ...charts.FIRST_TIME_SERIES]) {
      assert.ok(s.points.length > 3, s.label);
      const xs = s.points.map((p) => p.x);
      assert.deepEqual([...xs].sort((a, b) => a - b), xs);
      assert.ok(s.points.every((p) => p.y >= 0 && p.y <= 50), s.label);
    }
    assert.equal(charts.NIH_TABLE.length, A.nih.length);
    assert.equal(charts.FIRST_TIME_TABLE.length, A.firstTime.length);
  });

  test('formats dollars and months', () => {
    assert.equal(charts.usdMillions(4906.2), '$4.9 billion');
    assert.equal(charts.usdMillions(93.3), '$93 million');
    assert.equal(charts.usd(300000), '$300,000');
    assert.equal(charts.monthLabel('2025-10'), 'Oct 25');
    assert.deepEqual(charts.monthRange('2025-11', '2026-02'), ['2025-11', '2025-12', '2026-01', '2026-02']);
    assert.throws(() => charts.monthLabel('2025-13'), /Bad month/);
  });
});

test.describe('agencies, phases and preparation', () => {
  test('list the eleven agencies, each with a type, ranges and a source', () => {
    assert.equal(AGENCIES.length, 11);
    assert.equal(new Set(AGENCIES.map((a) => a.id)).size, 11);
    assert.deepEqual(
      [...AGENCIES.map((a) => a.short)].sort(),
      ['DHS', 'DOC', 'DOE', 'DOT', 'DoD', 'ED', 'EPA', 'HHS', 'NASA', 'NSF', 'USDA'],
    );
    for (const a of AGENCIES) {
      assert.match(a.url, /^https:\/\//, a.id);
      assert.ok(a.sources.length >= 1 && a.phase1.includes('$') && a.phase2.includes('$') && a.budget.includes('$'), a.id);
      for (const s of a.sources) sbirSource(s);
    }
  });

  test('state the phases with sizes and sources', () => {
    assert.deepEqual(PHASES.map((p) => p.id), ['phase-0', 'phase-1', 'phase-2', 'phase-3']);
    for (const p of PHASES) assert.ok(p.sources.length >= 1 && p.points.length >= 1, p.id);
    assert.match(PHASES[1]?.size ?? '', /\$50,000 to \$323,000/);
    assert.match(PHASES[2]?.size ?? '', /\$650,000 to \$2\.2 million/);
    assert.match(PHASES[3]?.size ?? '', /No SBIR or STTR funding/);
    assert.match(TABA.body, /\$6,500/);
    assert.match(TABA.body, /\$50,000/);
  });

  test('draw a valid timeline', () => {
    assert.equal(new Set(LANES.map((l) => l.id)).size, LANES.length);
    for (const l of LANES) {
      assert.ok(l.from >= 0 && l.to > l.from && l.to <= TIMELINE_MONTHS, l.id);
      assert.ok(l.note.length > 20 && l.sources.length >= 1, l.id);
    }
    assert.ok(PHASE2_START_MONTH > 9 && PHASE2_START_MONTH < TIMELINE_MONTHS);
  });

  test('keep registration steps and checklists well formed', () => {
    for (const list of [ELIGIBILITY, READINESS]) {
      assert.ok(list.length >= 5);
      assert.equal(new Set(list.map((c) => c.id)).size, list.length);
      for (const c of list) assert.ok(c.label.length > 10 && c.hint.length > 10 && c.sources.length >= 1, c.id);
    }
    assert.ok(REGISTRATION_STEPS.length >= 4);
    assert.ok(REGISTRATION_STEPS.some((s) => /Unique Entity ID/.test(s.title)));
  });

  test('describe the help programs as independent, with no affiliation implied', () => {
    assert.match(INDEPENDENT_NOTICE, /independent programs WE encourages founders to consider; no affiliation is implied/);
    for (const h of HELP_PROGRAMS) {
      assert.match(h.url, /^https:\/\//, h.id);
      assert.ok(h.sources.length >= 1 && h.body.length > 30, h.id);
      assert.doesNotMatch(h.body, /\b(partner|partners|partnered|endorse[sd]?|official)\b/i, h.id);
    }
  });
});

test.describe('the checklist script', () => {
  const known = ['a', 'b', 'c'];

  test('reads and writes ticks in the hash, keeping other lists', () => {
    assert.deepEqual(parseTicks('#ready=a.c', known), ['a', 'c']);
    assert.deepEqual(parseTicks('#ready=c.a.a.zzz', known), ['a', 'c']);
    assert.deepEqual(parseTicks('#eligible=a&ready=b', known), ['b']);
    assert.deepEqual(parseTicks('#eligible=a', known, 'eligible'), ['a']);
    assert.deepEqual(parseTicks('#ready=%E0%A4%A', known), []);
    assert.deepEqual(parseTicks('#other', known), []);
    assert.deepEqual(parseTicks(`#ready=${'a.'.repeat(500)}`, known), ['a']);
    assert.equal(serializeTicks([]), '');
    assert.equal(serializeTicks(['a', 'b']), '#ready=a.b');
    assert.equal(serializeTicks(['a'], 'eligible', '#ready=b.c'), '#eligible=a&ready=b.c');
    assert.equal(serializeTicks([], 'ready', '#eligible=a&ready=b'), '#eligible=a');
    assert.equal(DEFAULT_KEY, 'ready');
    assert.deepEqual(normaliseTicks(['c', 'x', 'a'], known), ['a', 'c']);
  });

  test('words the count', () => {
    assert.equal(progressText(0, 7), '0 of 7 items ready.');
    assert.equal(progressText(1, 1), '1 of 1 item ready.');
  });
});

test.describe('the copy', () => {
  const copyFiles = [
    ...filesUnder('src/pages/sbir-sttr', /\.astro$/),
    ...filesUnder('src/components/sbir', /\.astro$/),
    ...filesUnder('src/data/sbir', /\.ts$/).filter((f) => !f.endsWith('aggregates.ts')),
    'src/scripts/sbir-checklist.ts',
  ];
  const text = (f: string): string => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  test('the guide has its four pages and every one is covered', () => {
    for (const rel of ['index', 'phases/index', 'agencies/index', 'prepare/index']) assert.ok(existsSync(join(root, `src/pages/sbir-sttr/${rel}.astro`)), rel);
    assert.ok(copyFiles.length >= 20);
  });

  const banned: readonly [string, RegExp][] = [
    ['free', /\bfree\b/i],
    ['non-dilutive wording', /non-?dilutive|equity-free|no stake|takes no equity|takes no shares/i],
    ['cohort, mentor, alumni, demo day', /\b(cohorts?|mentors?|mentorship|alumni|demo day|investor network)\b/i],
    ['accelerator (other than the named APEX program)', /\baccelerators?\b(?<!APEX Accelerators)/i],
    ['no cost wording', /at no cost|free of charge|no fee|no charge to you/i],
    ['a guarantee', /\bguarantee[sd]?\b/i],
    ['an award is likely', /\byou will (win|get|receive|be funded)\b/i],
    ['WE as investor or fund', /\bWE (is|are) (an? )?(investor|fund|accelerator)\b|\bWE invests?\b/i],
    ['a price WE charges', /\b(pricing|per month|per seat|monthly fee|retainer)\b/i],
    ['years claim', /20\+ years|twenty years|two decades/i],
    ['become fundable', /become fundable/i],
  ];

  for (const [name, re] of banned) {
    test(`no file uses ${name}`, () => {
      const hits = copyFiles.flatMap((f) => {
        const body = f.includes('/aggregates') ? '' : text(f);
        const cleaned = body.replace(/https?:\/\/[^\s'"`]+/g, '').replace(/APEX Accelerators/g, 'APEX');
        return re.test(cleaned) ? [f] : [];
      });
      assert.deepEqual(hits, []);
    });
  }

  test('says WE is not an agency and promises no award on the closing band', () => {
    const close = read('src/components/sbir/SbirClose.astro');
    assert.match(close, /WE is not an agency/);
    assert.match(close, /cannot promise/);
    assert.match(close, /NO_FUNDING/);
    assert.match(close, /Start a readiness review|PRIMARY_CTA/);
    assert.match(close, /Talk to WE/);
  });

  test('every page names its sources, links through href() or a relative anchor, and ships no inline script or style attribute', () => {
    for (const f of filesUnder('src/pages/sbir-sttr', /\.astro$/)) {
      const src = read(f);
      assert.match(src, /SbirSources/, f);
      assert.match(src, /sbir\.gov/, f);
      assert.doesNotMatch(src, /\sstyle=/, f);
      assert.doesNotMatch(src, /<script/, f);
      assert.doesNotMatch(src, /href="\/(?!\/)/, `${f} links with a bare absolute path`);
    }
  });

  test('uses no runtime fetch', () => {
    for (const f of copyFiles) assert.doesNotMatch(text(f), /\bfetch\(|XMLHttpRequest|new WebSocket/, f);
  });

  test('keeps raw award files and contact data out of the repository paths it owns', () => {
    const owned = [...filesUnder('src/data/sbir', /./), ...filesUnder('.astro-magazine', /wp-34/)];
    assert.ok(owned.every((f) => !/\.(csv|xlsx)$/.test(f)));
  });
});
