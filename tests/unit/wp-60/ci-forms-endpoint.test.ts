import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// 60a.3: the wave 8 form specs run their endpoint-mode cases in e2e:forms, the one job whose build has an intake endpoint. A test titled
// @endpoint skips itself in every other build, so the job runs the wave 8 projects with --grep @endpoint and nothing else from wave 8.

const ci = readFileSync(new URL('../../../.gitlab-ci.yml', import.meta.url), 'utf8');

function block(name: string): string {
  const start = ci.search(new RegExp(`^${name.replace(/[.:]/g, '\\$&')}:`, 'm'));
  assert.ok(start >= 0, `${name} is defined in .gitlab-ci.yml`);
  const rest = ci.slice(start + 1);
  const next = rest.search(/\n[^\s#]/);
  return next < 0 ? ci.slice(start) : ci.slice(start, start + 1 + next);
}

/** The `script:` commands of a job, comments dropped. */
function commands(job: string): string[] {
  const lines = block(job).split('\n');
  const from = lines.findIndex((l) => /^ {2}script:\s*$/.test(l));
  assert.ok(from >= 0, `${job} has a script`);
  const out: string[] = [];
  for (const line of lines.slice(from + 1)) {
    if (/^ {2}\S/.test(line)) break;
    const command = /^ {4}- (.+)$/.exec(line)?.[1];
    if (command !== undefined) out.push(command.trim());
  }
  return out;
}

const WAVE8_PROJECTS = ['--project=wave8-desktop-1440x900', '--project=wave8-mobile-390x844'];
const touchesWave8 = (command: string): boolean => /E2E_WAVE8|wave8/.test(command);

test('e2e:forms keeps its own run unchanged: the filter word forms, with no wave 8 projects loaded', () => {
  const forms = commands('e2e:forms');
  assert.ok(forms.includes('npx playwright test forms'), 'the existing forms command is still there, unchanged');
  assert.ok(!/E2E_WAVE8/.test(block('e2e:forms').split('script:')[0] ?? ''), 'E2E_WAVE8 is not a job variable, so the plain forms command never loads the wave 8 projects');
});

test('e2e:forms runs the wave 8 projects once, for @endpoint tests only, and passes when none exist yet', () => {
  const wave8 = commands('e2e:forms').filter(touchesWave8);
  assert.equal(wave8.length, 1, 'exactly one command in e2e:forms touches wave 8');
  const command = wave8[0] ?? '';
  assert.match(command, /^E2E_WAVE8=1 npx playwright test /);
  for (const project of WAVE8_PROJECTS) assert.ok(command.includes(project), `it runs ${project}`);
  assert.match(command, /--grep @endpoint(\s|$)/);
  assert.match(command, /--pass-with-no-tests/);
});

test('every wave 8 command in e2e:forms carries --grep @endpoint: wave 8 specs run there only filtered', () => {
  for (const command of commands('e2e:forms').filter(touchesWave8)) assert.match(command, /--grep[ =]@endpoint(\s|$)/, command);
});

test('the wave 8 command runs after the build with the intake endpoint, in the same job', () => {
  const forms = commands('e2e:forms');
  const build = forms.indexOf('npm run build');
  const wave8 = forms.findIndex(touchesWave8);
  assert.ok(build >= 0 && wave8 > build, 'the build comes first');
  const block8 = block('e2e:forms');
  assert.match(block8, /PUBLIC_WE_INTAKE_API_URL: "https:\/\/intake\.example\.test\/api\/intake"/);
  assert.match(block8, /E2E_REQUIRE_ENDPOINT: "1"/);
});

test('e2e:wave8 keeps running every wave 8 test, with no grep, so the disabled-mode cases run and the @endpoint ones skip themselves', () => {
  const wave8 = commands('e2e:wave8');
  assert.deepEqual(wave8, ['npx playwright test --project=wave8-desktop-1440x900 --project=wave8-mobile-390x844']);
});

test('no other job runs a wave 8 project: only e2e:wave8 and e2e:forms mention E2E_WAVE8', () => {
  const jobs = [...ci.matchAll(/^([A-Za-z0-9_.:-]+):\s*$/gm)].map((m) => m[1] as string);
  // A job block runs to the next unindented key, so the comment lines that introduce the next job sit at the end of this one: drop comments.
  const uncommented = (job: string): string => block(job).split('\n').filter((line) => !/^\s*#/.test(line)).join('\n');
  const mentioning = jobs.filter((job) => /E2E_WAVE8|--project=wave8-/.test(uncommented(job)));
  assert.deepEqual(mentioning.sort(), ['e2e:forms', 'e2e:wave8']);
});
