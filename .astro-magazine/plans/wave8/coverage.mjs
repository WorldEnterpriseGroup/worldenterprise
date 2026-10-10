// Coverage check: every write pattern is compared with the tracked files of origin/demo.
// A pattern that matches no tracked file must be a file or folder this wave creates (otherwise it is a typo).
// Usage: node coverage.mjs <writesets.json> <tracked-files.txt>
import { readFileSync } from 'node:fs';
import { matchesPath } from './lib.mjs';

const map = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const tracked = readFileSync(process.argv[3], 'utf8').split('\n').filter((l) => l !== '');
const globs = map.workPackages.flatMap((w) => w.writes.map((p) => ({ id: w.id, p })));

const unmatched = globs.filter(({ p }) => !tracked.some((f) => matchesPath(p, f)));
console.log(`patterns: ${globs.length}; files in the base tree (demo plus the files the unmerged wave-7 branches add): ${tracked.length}`);
console.log(`patterns matching no file of the base tree (files this wave creates, review for typos): ${unmatched.length}`);
for (const { id, p } of unmatched) console.log(`  ${id} ${p}`);

const roots = ['src/', 'scripts/', 'docs/', 'tests/', '.astro-magazine/'];
const unclaimed = tracked.filter((f) => roots.some((r) => f.startsWith(r)) && !globs.some(({ p }) => matchesPath(p, f)));
const byDir = new Map();
for (const f of unclaimed) {
  const parts = f.split('/');
  const key = parts.slice(0, Math.min(3, parts.length - 1)).join('/');
  byDir.set(key, (byDir.get(key) ?? 0) + 1);
}
console.log(`tracked files under ${roots.join(' ')} that no wave-8 package edits: ${unclaimed.length}`);
for (const [dir, n] of [...byDir.entries()].sort()) console.log(`  ${dir}/  ${n}`);

// Files that three or more packages each need but nobody owns would show here: list tracked files that a package's prose names. Reviewed by hand.
const mustBeClaimed = [
  'src/content/pages/network/index.mdx',
  'src/content/pages/investors/index.mdx',
  'src/pages/investors/index.astro',
  'src/pages/network/index.astro',
  'src/components/insights/articles.ts',
  'src/components/insights/related.ts',
  'src/components/insights/DeskRail.astro',
  'src/components/blocks/ContextualNext.astro',
  'src/content/pages/legal/privacy.md',
  'src/pages/research/index.astro',
  'src/content/pages/research/index.md',
  'src/content/pages/insights/topic-grow.mdx',
  'src/scripts/forms.ts',
  'src/data/forms.ts',
  'src/layouts/ArticleLayout.astro',
  'src/layouts/MarketingLayout.astro',
  'src/layouts/HubLayout.astro',
  'src/layouts/FormLayout.astro',
  'src/components/layout/MegaNav.astro',
  'src/pages/insights/index.astro',
  'tests/unit/foundation/ledger.test.ts',
  'tests/unit/wp-05/articles.test.ts',
  'tests/e2e/support/routes.ts',
  'src/data/faq.yaml',
  'src/data/glossary.yaml',
  'src/components/reference/resources.ts',
  'src/components/reference/GlossaryList.astro',
  'src/components/reference/jsonld.ts',
  'src/pages/tools/index.astro',
  'src/components/nav/commands.ts',
  'src/components/nav/panels.ts',
  'src/lib/llms.ts',
  'src/lib/markdown-twins.ts',
  'src/content/pages/press/index.md',
  'src/pages/press/index.astro',
  'src/pages/resources/index.astro',
  'src/pages/library/index.astro',
  'src/pages/playbooks/index.astro',
  'src/pages/fundability/index.astro',
  'src/pages/glossary/index.astro',
  'src/pages/faq/index.astro',
  'src/content/pages/home/index.mdx',
  'src/content/pages/founders/index.mdx',
  'src/pages/founders/index.astro',
];
let missing = 0;
for (const f of mustBeClaimed) {
  const owners = map.workPackages.filter((w) => w.writes.some((p) => matchesPath(p, f))).map((w) => w.id);
  if (owners.length === 0 && tracked.includes(f)) {
    console.log(`UNCLAIMED needed file: ${f}`);
    missing += 1;
  } else if (owners.length > 0) {
    console.log(`claimed ${f} -> ${owners.join(', ')}`);
  } else {
    console.log(`(not in the base tree yet) ${f}`);
  }
}
process.exit(missing === 0 ? 0 : 1);
