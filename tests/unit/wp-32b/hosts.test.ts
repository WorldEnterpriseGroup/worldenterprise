import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { classifyHost } from '../wp-60/sources.ts';

test('D-W10-6: the hosts the wave 10 hubs need are on the allowlist in the right class', () => {
  for (const u of ['https://www.nber.org/papers/w24489', 'https://indicators-new.kauffman.org/x', 'https://gemconsortium.org/x']) assert.equal(classifyHost(u), 'scholarly', u);
  for (const u of ['https://carta.com/data/x', 'https://www.cbinsights.com/research/x']) assert.equal(classifyHost(u), 'datapublisher', u);
  for (const u of ['https://www.score.org/x', 'https://www.americassbdc.org/x', 'https://www.angelcapitalassociation.org/x', 'https://aws.amazon.com/startups']) {
    assert.equal(classifyHost(u), 'program', u);
  }
  for (const u of ['https://www.sbir.gov/x', 'https://www.sba.gov/x', 'https://www.congress.gov/x', 'https://www.census.gov/x', 'https://www.bls.gov/x', 'https://www.nsf.gov/x']) {
    assert.equal(classifyHost(u), 'government', u);
  }
  assert.equal(classifyHost('https://www.babson.edu/x'), 'university');
});

test('D-W10-6: whole big-vendor domains and the law-firm host stay off the list', () => {
  for (const u of ['https://www.amazon.com/x', 'https://cloud.microsoft.example/x', 'https://www.crowell.com/x', 'https://carta.com.evil.example/x']) {
    assert.notEqual(['program', 'datapublisher', 'scholarly'].includes(classifyHost(u)), true, u);
  }
});

test('ST-16 and ST-18 state the 2007 to 2009 founding window of the top 0.1% figures', () => {
  const src = readFileSync(new URL('../../../src/data/sales/stats.ts', import.meta.url), 'utf8');
  const row = (id: string): string => src.split('\n').find((l) => l.includes(`'${id}': { id: '${id}'`)) ?? '';
  assert.match(row('ST-16'), /2007 to 2009/);
  assert.match(row('ST-18'), /period: 'Founders of 2007 to 2009'/);
});
