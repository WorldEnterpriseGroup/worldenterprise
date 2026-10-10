// Self-test for the wave 8 checker: injects one conflict per rule and expects the checker to report exactly that conflict.
import { readFileSync } from 'node:fs';
import { check, overlaps } from './lib.mjs';

const base = JSON.parse(readFileSync(new URL('./writesets.json', import.meta.url), 'utf8'));
const add = (id, extra) => {
  const copy = structuredClone(base);
  copy.workPackages.find((w) => w.id === id).writes.push(extra);
  return copy;
};
const without = (id, key, value) => {
  const copy = structuredClone(base);
  const wp = copy.workPackages.find((w) => w.id === id);
  wp[key] = wp[key].filter((v) => v !== value);
  return copy;
};

const cases = [
  ['P1 pair: partners reaching the investors copy', add('WP-65', 'src/content/pages/investors/**'), 'WP-64 src/content/pages/investors/**'],
  ['P0b pair: two article agents on one desk folder', add('WP-66', 'src/content/insights/legal/**'), 'WP-67 src/content/insights/legal/**'],
  ['P0b pair: an article agent on another agent\'s desk topic page', add('WP-66', 'src/content/pages/insights/topic-team.mdx'), 'WP-68 src/content/pages/insights/topic-team.mdx'],
  ['P1 pair: literal path inside another package glob', add('WP-62', 'src/content/pages/network/index.mdx'), 'WP-65 src/content/pages/network/**'],
  ['P1 pair: briefs source folder claimed by the intake package', add('WP-61', 'infra/intake/briefs/**'), 'WP-63 infra/intake/briefs/funding-paths.md'],
  ['P1 pair: a second brief owner on one brief file', add('WP-80', 'src/content/briefs/first-hires.md'), 'WP-79 src/content/briefs/first-hires.md'],
  ['P1 pair: segment pages reaching the founders hub copy', add('WP-73', 'src/content/pages/founders/index.mdx'), 'WP-62 src/content/pages/founders/index.mdx'],
  ['P1 pair: the founders hub package reaching the dynamic segment route', add('WP-62', 'src/pages/founders/[segment].astro'), 'WP-71 src/pages/founders/[segment].astro'],
  ['P1 pair: FAQ package reaching the glossary data', add('WP-78', 'src/data/glossary.yaml'), 'WP-77 src/data/glossary.yaml'],
  ['P1 pair: guides package reaching a playbook', add('WP-87', 'src/content/playbooks/**'), 'WP-86 src/content/playbooks/**'],
  ['P1 pair: tools package reaching the journey pages', add('WP-76', 'src/content/pages/journey/**'), 'WP-72 src/content/pages/journey/**'],
  ['P0b pair: foundation and intake on the same doc', add('WP-61', 'docs/forms-contract.md'), 'WP-60 docs/forms-contract.md'],
  ['P0b pair: brand package on the page-family registry', add('WP-71', 'src/data/families.ts'), 'WP-60 src/data/families.ts'],
  ['P2 pair: integrator reaching the journey suite', add('WP-99', 'tests/e2e/wave8/journeys/**'), 'WP-90 tests/e2e/wave8/journeys/**'],
  ['P1 pair: the journey suite reaching a page package suite', add('WP-90', 'tests/e2e/wave8/wp-62/**'), 'WP-62 tests/e2e/wave8/wp-62/**'],
  ['frozen: a stage-1 package on content.config.ts', add('WP-63', 'src/content.config.ts'), 'FROZEN src/content.config.ts'],
  ['frozen exception dropped: WP-60 on nav.ts', without('WP-60', 'frozenExceptions', 'src/data/nav.ts'), 'FROZEN src/data/nav.ts'],
  ['frozen wave-8 addition: CTA package on a layout', add('WP-62', 'src/layouts/ArticleLayout.astro'), 'FROZEN-WAVE8 src/layouts/**'],
  ['frozen wave-8 addition: partners on the forms components', add('WP-65', 'src/components/forms/PartnerEnquiryForm.astro'), 'FROZEN-WAVE8 src/components/forms/**'],
  ['frozen wave-8 addition: segment package on the family registry', add('WP-73', 'src/data/families.ts'), 'FROZEN-WAVE8 src/data/families.ts'],
  ['frozen wave-8 addition: an article package on the desk registry', add('WP-88', 'src/data/desks.ts'), 'FROZEN-WAVE8 src/data/desks.ts'],
  ['photography lane: investors on cards', add('WP-64', 'src/components/cards/**'), 'PHOTO-LANE src/components/cards/**'],
  ['photography lane: CTA package on the gated pricing page', add('WP-62', 'src/pages/pricing/index.astro'), 'PHOTO-LANE src/pages/pricing/index.astro'],
  ['photography lane: brand package on the OG cards', add('WP-71', 'src/assets/og/**'), 'PHOTO-LANE src/assets/og/**'],
  ['photography lane: brand package on the OG slot map', add('WP-71', 'src/components/media/OgMap.ts'), 'PHOTO-LANE src/components/media/**'],
  ['release lane: an article agent on the CI file', add('WP-68', '.gitlab-ci.yml'), 'RELEASE-LANE .gitlab-ci.yml'],
  ['release lane: a package on the counsel register', add('WP-64', '.astro-magazine/release/RELEASE.md'), 'RELEASE-LANE .astro-magazine/release/**'],
  ['declared exception sitting in a stage-1 write set', add('WP-62', 'src/data/nav.ts'), 'declared exception src/data/nav.ts'],
  ['declared exception sitting in a stage-1 write set: the desk registry', add('WP-82', 'src/data/desks.ts'), 'declared exception src/data/desks.ts'],
];

let bad = 0;
for (const [name, map, needle] of cases) {
  const { failures } = check(map);
  const ok = failures.some((f) => f.includes(needle));
  if (!ok) bad += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
}
// The glob comparison itself: exact for single-star globs, conservative when both sides hold a double star.
const globCases = [
  ['a single-star glob does not reach into a deeper folder', 'tests/e2e/*.spec.ts', 'tests/e2e/wave8/wp-68/**', false],
  ['a single-star glob meets a deep glob over the same folder', 'src/data/*.ts', 'src/data/**', true],
  ['a deeper folder never matches a single-star file glob', 'src/data/cta/**', 'src/data/*.ts', false],
  ['two single-star globs of different depth never meet', 'docs/*.md', 'docs/adr/*.md', false],
  ['two single-star globs on one folder with compatible suffixes meet', 'tests/e2e/*.spec.ts', 'tests/e2e/f*.spec.ts', true],
  ['two single-star globs on one folder with different suffixes do not meet', 'tests/e2e/*.spec.ts', 'tests/e2e/*.json', false],
  ['a literal path inside a deep glob meets it', 'src/pages/investors/index.astro', 'src/pages/investors/**', true],
  ['two deep globs on one folder meet', 'src/pages/investors/**', 'src/pages/investors/interest/**', true],
  ['two deep globs on sibling folders do not meet', 'src/pages/investors/**', 'src/pages/network/**', false],
];
for (const [name, a, b, expected] of globCases) {
  const ok = overlaps(a, b) === expected && overlaps(b, a) === expected;
  if (!ok) bad += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} glob: ${name}`);
}

const baseline = check(base).failures.length;
console.log(`${baseline === 0 ? 'ok  ' : 'FAIL'} baseline map has zero failures (${baseline})`);
if (baseline !== 0) bad += 1;
process.exit(bad === 0 ? 0 : 1);
