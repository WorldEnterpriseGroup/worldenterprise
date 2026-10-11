import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { SHOWCASE_EMPTY } from '../../../src/components/investors/copy.ts';
import { safeWebsite, showcaseCard, showcaseCards } from '../../../src/components/investors/portfolio.ts';
import type { PortfolioData } from '../../../src/components/investors/portfolio.ts';
import { schemas } from '../../../src/lib/content-schemas.ts';

/**
 * The consent gate of the portfolio showcase (W8-17, D-21). The fixtures below are test data in this file only. They are never written to
 * src/content/portfolio, which stays empty until the operator supplies a real, consented record (OP-PORTFOLIO).
 */
const root = new URL('../../../', import.meta.url).pathname;

const base: PortfolioData = {
  company: 'Fixture Co',
  website: 'https://fixture.example/',
  oneLine: 'A fixture used by the unit test only.',
  stage: 'building',
  consent: true,
  consentRecord: { scope: ['name', 'description', 'website'] },
};

test('with no entry the showcase has nothing to list, and shows its one fixed sentence', () => {
  assert.deepEqual(showcaseCards([]), []);
  assert.equal(SHOWCASE_EMPTY, "No portfolio is published yet. WE lists a company here only with its founder's written consent.");
  const component = readFileSync(join(root, 'src/components/investors/PortfolioShowcase.astro'), 'utf8');
  assert.match(component, /cards\.length === 0/);
  assert.match(component, /SHOWCASE_EMPTY/);
  // Nothing else renders in the empty state: no count, no date, no promise that a company will appear.
  assert.doesNotMatch(component, /coming soon|forming|first group|\bsoon\b|new companies/i);
});

test('a company shows only the fields its consent scope covers', () => {
  assert.deepEqual(showcaseCard(base), { name: 'Fixture Co', oneLine: 'A fixture used by the unit test only.', stage: 'Building', website: 'https://fixture.example/' });
  assert.deepEqual(showcaseCard({ ...base, consentRecord: { scope: ['name'] } }), { name: 'Fixture Co' });
  assert.deepEqual(showcaseCard({ ...base, consentRecord: { scope: ['name', 'description'] } }), {
    name: 'Fixture Co',
    oneLine: 'A fixture used by the unit test only.',
    stage: 'Building',
  });
  assert.deepEqual(showcaseCard({ ...base, consentRecord: { scope: ['name', 'website'] } }), { name: 'Fixture Co', website: 'https://fixture.example/' });
});

test('a scope without the name lists nothing, whatever else it permits', () => {
  assert.equal(showcaseCard({ ...base, consentRecord: { scope: ['description', 'website'] } }), null);
  assert.equal(showcaseCard({ ...base, consentRecord: { scope: ['investor-introductions'] } }), null);
  assert.equal(showcaseCard({ ...base, consentRecord: { scope: [] } }), null);
});

test('the permission to meet investors shows nothing on the page', () => {
  assert.deepEqual(showcaseCard({ ...base, consentRecord: { scope: ['name', 'investor-introductions'] } }), { name: 'Fixture Co' });
});

test('a draft, or an entry without consent, is never shown', () => {
  assert.equal(showcaseCard({ ...base, draft: true }), null);
  assert.equal(showcaseCard({ ...base, consent: false }), null);
  assert.deepEqual(showcaseCards([base, { ...base, company: 'Draft Co', draft: true }]).map((c) => c.name), ['Fixture Co']);
});

test('a link is shown only for an http or https address', () => {
  assert.equal(safeWebsite('https://fixture.example/'), 'https://fixture.example/');
  assert.equal(safeWebsite('http://fixture.example/'), 'http://fixture.example/');
  assert.equal(safeWebsite('javascript:alert(1)'), undefined);
  assert.equal(safeWebsite('data:text/html,x'), undefined);
  assert.equal(safeWebsite('not a url'), undefined);
  assert.equal(safeWebsite(undefined), undefined);
  assert.equal(showcaseCard({ ...base, website: 'javascript:alert(1)' })?.website, undefined);
});

test('the schema rejects an entry without consent or without a consent record, so no draft can parse', () => {
  const entry = {
    company: 'Fixture Co',
    consent: true,
    consentRecord: { recordedOn: '2026-10-10', scope: ['name'], reference: 'register-0001' },
    source: { kind: 'founder-written', reference: 'register-0001' },
  };
  assert.equal(schemas.portfolio.safeParse(entry).success, true);
  assert.equal(schemas.portfolio.safeParse({ ...entry, consent: false }).success, false);
  assert.equal(schemas.portfolio.safeParse({ ...entry, consentRecord: undefined }).success, false);
  assert.equal(schemas.portfolio.safeParse({ ...entry, consentRecord: { ...entry.consentRecord, scope: [] } }).success, false);
  assert.equal(schemas.portfolio.safeParse({ ...entry, revenue: 1 }).success, false, 'the schema has no field for a metric');
});

test('src/content/portfolio holds no invented company: every entry present carries consent and a consent record', () => {
  const dir = join(root, 'src/content/portfolio');
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir).filter((f) => /\.mdx?$/.test(f));
  for (const file of entries) {
    const text = readFileSync(join(dir, file), 'utf8');
    assert.match(text, /^consent:\s*true\s*$/m, `${file} has no consent: true`);
    assert.match(text, /^consentRecord:/m, `${file} has no consent record`);
    assert.doesNotMatch(text, /\bfixture\b|\bexample\b|\bsample\b|lorem/i, `${file} looks like a sample`);
  }
});
