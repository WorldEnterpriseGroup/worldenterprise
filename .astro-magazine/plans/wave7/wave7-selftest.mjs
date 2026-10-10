// Self-test for wave7-overlap.mjs: injects one conflict per lane and expects the checker to fail with exactly those findings.
// Run: node .astro-magazine/plans/wave7/wave7-selftest.mjs   (exit 0 means every injected conflict was caught)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = import.meta.dirname;
const base = JSON.parse(readFileSync(join(dir, 'wave7-writesets.json'), 'utf8'));
const scratch = mkdtempSync(join(tmpdir(), 'wave7-selftest-'));
const mutate = (id, extra) => {
  const copy = structuredClone(base);
  copy.workPackages.find((w) => w.id === id).writes.push(extra);
  return copy;
};

const cases = [
  ['release lane', mutate('WP-46', '.gitlab-ci.yml'), 'RELEASE-LANE .gitlab-ci.yml'],
  ['release lane (docs)', mutate('WP-44', 'docs/runbook-release.md'), 'RELEASE-LANE docs/runbook-release.md'],
  ['orphan layout claimed twice', mutate('WP-41', 'src/layouts/TemplateLayout.astro'), 'WP-45 src/layouts/TemplateLayout.astro'],
  ['frozen', mutate('WP-47', 'src/data/nav.ts'), 'FROZEN src/data/nav.ts'],
  ['photo lane', mutate('WP-49', 'src/components/cards/**'), 'PHOTO-LANE src/components/cards/**'],
];

let bad = 0;
for (const [name, map, needle] of cases) {
  const path = join(scratch, 'case.json');
  writeFileSync(path, JSON.stringify(map));
  let out = '';
  let code = 0;
  try {
    out = execFileSync('node', [join(dir, 'wave7-overlap.mjs'), path], { encoding: 'utf8' });
  } catch (error) {
    code = error.status ?? 1;
    out = String(error.stdout ?? '');
  }
  const ok = code === 1 && out.includes(needle);
  if (!ok) bad += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
}
process.exit(bad === 0 ? 0 : 1);
