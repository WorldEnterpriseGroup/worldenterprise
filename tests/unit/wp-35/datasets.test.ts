import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BED_OPENINGS_TOTAL, BED_SURVIVAL_INFORMATION, BED_SURVIVAL_PROFESSIONAL, BED_SURVIVAL_TOTAL, BED_YEARLY_SURVIVAL_TOTAL } from '../../../src/data/datasets/bed-survival.generated.ts';
import {
  BFS_APPLICATIONS_BY_SECTOR,
  BFS_APPLICATIONS_TOTAL,
  BFS_APPLICATION_YEARS,
  BFS_FORMATIONS_4Q,
  BFS_FORMATIONS_8Q,
  BFS_HIGH_PROPENSITY,
  BFS_QUARTERS_TO_PAYROLL_4Q,
  BFS_QUARTERS_TO_PAYROLL_8Q,
} from '../../../src/data/datasets/bfs.generated.ts';
import { FOUNDER_AGE_BY_SEGMENT, FOUNDER_AGE_BY_TIER } from '../../../src/data/datasets/founder-age.ts';
import { MEDIAN_DILUTION, MILESTONES } from '../../../src/data/datasets/funding-clock.ts';
import * as kauffman from '../../../src/data/datasets/kauffman.generated.ts';
import { DATASET_SOURCES, RETRIEVED, datasetSource, sourceAnchor } from '../../../src/data/datasets/sources.ts';
import type { DatasetSourceId } from '../../../src/data/datasets/types.ts';

/**
 * WP-35, the datasets behind /data/. Every figure on the page comes from a typed module here. These tests hold each dataset to its source
 * (a recorded URL, publisher, publication and retrieval date, and a note on what WE did to the numbers) and to the published figures it
 * was copied from, and check the internal consistency a transcription error would break.
 */

test('every source has an https URL, a publisher, a publication note, the retrieval date and a transformation note', () => {
  assert.equal(RETRIEVED, '2026-10-15');
  const seen = new Set<string>();
  for (const s of DATASET_SOURCES) {
    assert.ok(!seen.has(s.id), `duplicate source id ${s.id}`);
    seen.add(s.id);
    assert.match(s.url, /^https:\/\/[a-z0-9.-]+\//, `${s.id} url`);
    for (const field of ['title', 'publisher', 'published', 'short', 'transformation'] as const) assert.ok(s[field].trim().length > 3, `${s.id} has no ${field}`);
    assert.equal(s.retrieved, RETRIEVED, `${s.id} retrieval date`);
    assert.ok(Array.isArray(s.caveats), `${s.id} caveats`);
    assert.equal(sourceAnchor(s.id), `#source-${s.id}`);
    assert.equal(datasetSource(s.id), s);
  }
  assert.throws(() => datasetSource('nope' as DatasetSourceId));
});

test('Carta is quoted figure by figure, with the report’s own usage note, and its figures are not a dataset', () => {
  const carta = datasetSource('carta-spm-q1-2026');
  assert.match(carta.usage ?? '', /Reproduction prohibited/);
  assert.match(carta.url, /^https:\/\/carta\.com\/data\//);
  assert.ok(MILESTONES.filter((m) => m.source === 'carta-spm-q1-2026').length <= 6, 'only single figures are quoted');
  assert.equal(MEDIAN_DILUTION.length, 5);
});

test('BLS survival: groups run 1994 to 2025 in all three industries, each curve starts at 100, and the all-industry curves never rise', () => {
  for (const rec of [BED_SURVIVAL_TOTAL, BED_SURVIVAL_INFORMATION, BED_SURVIVAL_PROFESSIONAL]) {
    const years = Object.keys(rec).map(Number);
    assert.equal(Math.min(...years), 1994);
    assert.equal(Math.max(...years), 2025);
    for (const [y, curve] of Object.entries(rec)) {
      assert.equal(curve[0], 100, `${y} starts at 100`);
      assert.equal(curve.length, 2025 - Number(y) + 1, `${y} has one value per March since opening`);
      // Industry cells are small: the published Information curves rise by up to two points in a few years (reclassification), and are kept as published.
      const slack = rec === BED_SURVIVAL_TOTAL ? 0 : 2;
      for (let i = 1; i < curve.length; i++) assert.ok((curve[i] ?? 0) <= (curve[i - 1] ?? 0) + slack, `${y} rises at age ${i}`);
    }
  }
});

test('BLS survival matches the published figures for the 2015 group (the figures the kit and /why-it-takes-time/ also cite)', () => {
  const g = BED_SURVIVAL_TOTAL[2015];
  assert.deepEqual(g, [100, 79.6, 69.1, 61.4, 55.4, 50.2, 46.4, 43.6, 40.3, 37.4, 34.7]);
  assert.equal(BED_SURVIVAL_TOTAL[2010]?.[15], 25.5);
});

test('the yearly survival of previous survivors agrees with the cumulative curve to within rounding', () => {
  for (const [y, yearly] of Object.entries(BED_YEARLY_SURVIVAL_TOTAL)) {
    const curve = BED_SURVIVAL_TOTAL[Number(y)];
    assert.ok(curve, `${y} curve`);
    yearly.forEach((rate, i) => {
      const expected = ((curve[i + 1] ?? 0) / (curve[i] ?? 1)) * 100;
      assert.ok(Math.abs(expected - rate) < 0.6, `${y} age ${i + 1}: ${rate} against ${expected.toFixed(2)}`);
    });
  }
  assert.ok(Object.keys(BED_OPENINGS_TOTAL).length >= 31);
});

test('Census BFS: 2005 to 2025, sectors add up to the total, and the published anchors hold', () => {
  assert.equal(BFS_APPLICATION_YEARS.length, 21);
  assert.equal(BFS_APPLICATION_YEARS[0], 2005);
  assert.equal(BFS_APPLICATION_YEARS[20], 2025);
  assert.equal(BFS_APPLICATIONS_TOTAL[20], 5671836);
  assert.equal(BFS_APPLICATIONS_TOTAL[0], 2485100);
  assert.equal(BFS_APPLICATIONS_TOTAL[16], 5390816);
  assert.equal(BFS_HIGH_PROPENSITY[20], 1708842);
  BFS_APPLICATION_YEARS.forEach((year, i) => {
    const sum = Object.values(BFS_APPLICATIONS_BY_SECTOR).reduce((a, series) => a + (series[i] ?? 0), 0);
    assert.equal(sum, BFS_APPLICATIONS_TOTAL[i], `sectors in ${year}`);
  });
  for (const [key, series] of Object.entries(BFS_APPLICATIONS_BY_SECTOR)) assert.equal(series.length, 21, key);
  assert.equal(BFS_FORMATIONS_4Q.length, 17);
  assert.equal(BFS_FORMATIONS_4Q[16], 315318);
  assert.equal(BFS_FORMATIONS_8Q[16], 403072);
  assert.equal(BFS_QUARTERS_TO_PAYROLL_8Q[0], 1.48);
  assert.equal(BFS_QUARTERS_TO_PAYROLL_8Q[16], 2.29);
  assert.equal(BFS_QUARTERS_TO_PAYROLL_4Q[0], 0.95);
  assert.equal(BFS_QUARTERS_TO_PAYROLL_4Q[16], 1.39);
  BFS_FORMATIONS_4Q.forEach((v, i) => assert.ok(v <= (BFS_FORMATIONS_8Q[i] ?? 0), `4Q formations exceed 8Q in ${2005 + i}`));
});

test('Kauffman: shares add to 100 each year, 1996 and 2021 match the report, and rates match 2025', () => {
  const shares = [kauffman.KAUFFMAN_SHARE_20_34, kauffman.KAUFFMAN_SHARE_35_44, kauffman.KAUFFMAN_SHARE_45_54, kauffman.KAUFFMAN_SHARE_55_64];
  assert.equal(kauffman.KAUFFMAN_AGE_SHARE_YEARS.length, 26);
  kauffman.KAUFFMAN_AGE_SHARE_YEARS.forEach((y, i) => {
    const sum = shares.reduce((a, s) => a + (s[i] ?? 0), 0);
    assert.ok(Math.abs(sum - 100) <= 0.2, `${y}: shares add to ${sum.toFixed(1)}`);
  });
  assert.deepEqual(shares.map((s) => s[0]), [34.3, 27.4, 23.5, 14.8]);
  assert.deepEqual(shares.map((s) => s[25]), [26.2, 26.1, 24.9, 22.8]);
  const rates = [kauffman.KAUFFMAN_RATE_20_34, kauffman.KAUFFMAN_RATE_35_44, kauffman.KAUFFMAN_RATE_45_54, kauffman.KAUFFMAN_RATE_55_64];
  assert.equal(kauffman.KAUFFMAN_RATE_YEARS.length, 30);
  for (const r of rates) assert.equal(r.length, 30);
  assert.deepEqual(rates.map((r) => r[29]), [0.26, 0.43, 0.43, 0.37]);
});

test('Azoulay et al.: Table 5 values as printed, and every segment shows the same ordering the paper reports', () => {
  const all = FOUNDER_AGE_BY_TIER[0];
  assert.deepEqual([all?.mean, all?.sd, all?.founders], [41.8, 11.9, 1079000]);
  assert.equal(FOUNDER_AGE_BY_TIER[4]?.mean, 45.0);
  assert.equal(FOUNDER_AGE_BY_TIER[5]?.mean, 46.7);
  assert.equal(FOUNDER_AGE_BY_SEGMENT.length, 9);
  for (const s of FOUNDER_AGE_BY_SEGMENT) {
    assert.ok(s.topTenth > s.allStartups, `${s.segment}: the fastest-growing 1 in 1,000 are older than all startups`);
    assert.ok(s.exited > s.topTenth - 3, `${s.segment}: exit ages are in range`);
  }
});

test('funding clock: milestone rows are inside the axis and name a known source', () => {
  for (const m of MILESTONES) {
    assert.ok(m.start >= 0 && m.end >= m.start && m.end <= 10, `${m.id} range`);
    assert.ok(DATASET_SOURCES.some((s) => s.id === m.source), `${m.id} source`);
    assert.ok(m.figure.length > 3);
    if (m.kind === 'point') assert.equal(m.start, m.end);
  }
  assert.deepEqual(MEDIAN_DILUTION.map((d) => d.stage), ['Seed', 'Series A', 'Series B', 'Series C', 'Series D']);
  assert.ok(MEDIAN_DILUTION.every((d) => d.percent > 0 && d.percent < 30));
});
