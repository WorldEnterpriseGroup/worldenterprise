// Owner check for registry-derived files: every desk page, brief file, segment, industry, comparison and journey page must have exactly one owner,
// and it must be the owner the contracts name.
// usage: node owners.mjs <writesets.json>
import { readFileSync } from 'node:fs';
import { matchesPath } from './lib.mjs';

const sets = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const ownersOf = (path) => sets.workPackages.filter((w) => w.writes.some((g) => matchesPath(g, path))).map((w) => w.id);

const desks = {
  starting: 'WP-83', dream: 'WP-82', build: 'WP-82', grow: 'WP-85', fundable: 'WP-67', funding: 'WP-66', legal: 'WP-67',
  team: 'WP-68', ai: 'WP-69', gtm: 'WP-81', pathways: 'WP-84', models: 'WP-85', sectors: 'WP-88', ops: 'WP-89',
};
const briefs = {
  'funding-paths': 'WP-63', 'company-setup': 'WP-63', 'ai-native-build': 'WP-63',
  'first-100-customers': 'WP-79', 'pre-seed-evidence-pack': 'WP-79', 'first-hires': 'WP-79',
  'early-stage-diligence': 'WP-80', 'ai-company-diligence': 'WP-80', 'partnering-with-founders': 'WP-80', 'corporate-spinouts': 'WP-80',
};
const segments = ['first-time-founders', 'technical-founders', 'non-technical-founders', 'solo-founders', 'corporate-innovators', 'student-founders', 'second-career-founders', 'global-remote-founders'];
const industries = ['fintech', 'healthtech', 'edtech', 'climate-tech', 'legaltech', 'logistics', 'proptech'];
const compare = ['incubator-vs-other-programs', 'incubator-vs-venture-studio', 'dedicated-team-vs-agency', 'dedicated-team-vs-freelancers', 'build-vs-buy', 'onshore-vs-offshore-teams', 'bootstrapping-vs-outside-funding'];
const journey = ['index', 'after-you-apply', 'first-months', 'onboarding-checklist'];

const cases = [];
for (const [d, o] of Object.entries(desks)) {
  cases.push([`src/content/pages/insights/topic-${d}.mdx`, o]);
  cases.push([`src/content/insights/${d}/sample-article.mdx`, o]);
}
for (const [b, o] of Object.entries(briefs)) {
  cases.push([`src/content/briefs/${b}.md`, o]);
  cases.push([`infra/intake/briefs/${b}.md`, o]);
}
for (const s of segments) cases.push([`src/content/pages/founders/${s}.mdx`, 'WP-73']);
for (const i of industries) cases.push([`src/content/pages/industries/${i}.mdx`, 'WP-74']);
cases.push(['src/content/pages/industries/index.mdx', 'WP-74']);
for (const c of compare) cases.push([`src/content/pages/compare/${c}.mdx`, 'WP-75']);
cases.push(['src/content/pages/compare/index.mdx', 'WP-75']);
for (const j of journey) cases.push([`src/content/pages/journey/${j}.mdx`, 'WP-72']);

let bad = 0;
for (const [path, want] of cases) {
  const got = ownersOf(path);
  if (got.length !== 1 || got[0] !== want) {
    bad += 1;
    console.log(`MISMATCH ${path}: expected ${want}, found ${got.length ? got.join(',') : 'nobody'}`);
  }
}
console.log(`owner check: ${cases.length} registry-derived files, ${bad} mismatch(es)`);
process.exit(bad ? 1 : 0);
