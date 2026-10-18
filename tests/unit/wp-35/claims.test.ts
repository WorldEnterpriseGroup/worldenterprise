import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CLAIM_IDS, claimRegistry, isClaimUsable } from '../../../src/data/claims.ts';
import type { ClaimId } from '../../../src/data/claims.ts';
import { FORMATION_PAGE, HUB, MILESTONES_PAGE, SURVIVAL_PAGE, WHO_PAGE } from '../../../src/data/datasets/copy.ts';
import * as figures from '../../../src/data/datasets/figures.ts';

/** WP-35 (#84): C-30 to C-36 register the statistics the four /data/ pages print, and each page cites the entries it relies on. */
const WP35: readonly ClaimId[] = ['C-30', 'C-31', 'C-32', 'C-33', 'C-34', 'C-35', 'C-36'];

test('C-30 to C-36 are registered in order, published, enabled and sourced', () => {
  assert.deepEqual(CLAIM_IDS.slice(29), WP35);
  assert.equal(CLAIM_IDS.length, 36);
  for (const id of WP35) {
    const c = claimRegistry[id];
    assert.equal(c.status, 'publish', id);
    assert.equal(c.enabled, true, id);
    assert.equal(isClaimUsable(id), true, id);
    assert.match(c.source, /wp-35\.json/, id);
  }
});

const PAGES = [
  { name: 'hub', page: HUB, cites: ['C-30', 'C-32', 'C-33', 'C-34', 'C-35', 'C-36'] },
  { name: 'survival', page: SURVIVAL_PAGE, cites: ['C-30', 'C-31'] },
  { name: 'formation', page: FORMATION_PAGE, cites: ['C-32', 'C-33'] },
  { name: 'who-starts', page: WHO_PAGE, cites: ['C-34', 'C-35'] },
  { name: 'years-to-milestones', page: MILESTONES_PAGE, cites: ['C-30', 'C-33', 'C-36'] },
] as const;

test('every data page cites its claims, and every cited claim is usable', () => {
  for (const { name, page, cites } of PAGES) {
    assert.deepEqual([...page.claimsUsed], cites, name);
    for (const id of page.claimsUsed) assert.ok(isClaimUsable(id), `${name} cites ${id}`);
  }
  const cited = new Set(PAGES.flatMap((p) => p.page.claimsUsed));
  for (const id of WP35) assert.ok(cited.has(id), `${id} is cited by a data page`);
});

/** All the words a page prints, from its copy and its charts' captions and descriptions. */
const printed = (...parts: readonly unknown[]): string => JSON.stringify(parts);

test('each claim states only what the pages print (the wording is held to the copy and the figures)', () => {
  const survival = printed(HUB.stages.survival, HUB.stages.exits, SURVIVAL_PAGE, figures.milestoneGantt);
  assert.match(survival, /About half of new establishments are gone by year 5/);
  assert.match(survival, /50\.2% of the 2015 group were still open at year 5/);
  assert.match(survival, /34\.7%/);
  assert.match(claimRegistry['C-30'].summary, /50\.2% were still open at year 5 and 34\.7% at year 10/);
  assert.equal(figures.SURVIVAL_2015_YEAR5, 50.2);
  assert.equal(figures.SURVIVAL_2015_YEAR10, 34.7);

  assert.match(printed(SURVIVAL_PAGE), /In year 1 about one in five establishments closes\. By year 13 the yearly figure is between 4 and 6 in 100/);
  assert.match(claimRegistry['C-31'].summary, /In year 1 about one in five establishments closes; by year 13 the yearly figure is between 4 and 6 in 100/);

  assert.match(printed(HUB.stages.formation), /Applications to start a business reached 5,671,836 in 2025, more than double 2005, in every industry/);
  assert.equal(figures.APPLICATIONS_2025, 5671836);
  assert.equal(figures.APPLICATIONS_2005, 2485100);
  assert.ok(figures.APPLICATIONS_2025 > 2 * figures.APPLICATIONS_2005);
  assert.match(claimRegistry['C-32'].summary, /5,671,836 in 2025, more than double the 2,485,100 of 2005/);

  assert.match(printed(FORMATION_PAGE), /fewer than 8 in 100 became an employer business within two years/);
  assert.ok(403072 / 5390816 < 0.08);
  assert.match(printed(figures.payrollSlope), /2\.29 quarters/);
  assert.equal(figures.QUARTERS_8Q_2005, 1.48);
  assert.equal(figures.QUARTERS_8Q_2021, 2.29);
  assert.match(claimRegistry['C-33'].summary, /1\.48 quarters in 2005 to 2\.29 in 2021/);

  assert.match(printed(figures.ageShareArea), /fell from 34\.3 percent in 1996 to 26\.2 percent in 2021, while the share aged 55 to 64 rose from 14\.8 to 22\.8 percent/);
  assert.match(claimRegistry['C-34'].summary, /34\.3% in 1996 to 26\.2% in 2021.*14\.8% to 22\.8%/);

  assert.match(printed(HUB.stages.exits), /fastest-growing 1 in 1,000 had founders averaging 45\.0 years old, against 41\.8 for all startups\. Founders of companies that exited averaged 46\.7/);
  assert.match(claimRegistry['C-35'].summary, /45\.0 years old, against 41\.8 for all startups.*46\.7/);

  assert.match(printed(HUB.stages.funding), /median gap from Seed to Series A is 2\.0 years, from A to B 2\.1 and from B to C 2\.4/);
  assert.match(printed(HUB.stages.funding), /Series E or later is a median 9\.5 years old/);
  assert.match(claimRegistry['C-36'].summary, /Seed to Series A is 2\.0 years, from A to B 2\.1 and from B to C 2\.4.*9\.5 years old/);
});
