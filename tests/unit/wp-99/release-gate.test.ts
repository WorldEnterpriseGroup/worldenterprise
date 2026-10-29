import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { unallowed } from '../../../scripts/lib/release-gate.mjs';
import { HUMAN_PREFIX, composeVerdict, counselSignoff, explain, humanItemProblems, operatorNotes } from '../../../scripts/lib/wave8/release-open-items.mjs';
import { flags } from '../../../src/data/flags.ts';
import { site } from '../../../src/data/site.ts';

// #49 item 3: the release gate reports honestly. The 15 disabled form routes and the unsigned counsel items are never allowed silently:
// a release tag and gh-pages run with RELEASE_ALLOW empty, so every one of them fails, and the gate says which human item is open.

const repo = new URL('../../../', import.meta.url).pathname;
const read = (path: string): string => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
const releaseMd = read('.astro-magazine/release/RELEASE.md');
const ci = read('.gitlab-ci.yml');

interface Verdict {
  readonly ok: boolean;
  readonly reason: string;
  readonly problems: readonly string[];
  readonly blocking: readonly string[];
  readonly explanation: readonly string[];
  readonly notes: readonly string[];
}
const compose = composeVerdict as (input: { run: { error?: Error; status: number | null; output: string }; allow: string; markdown: string | Error; notes?: string[] }) => Verdict;
const signoff = counselSignoff as (markdown: string) => { entries: { id: string; title: string; approved: boolean }[]; tail: { text: string; done: boolean }[] };
const humanProblems = humanItemProblems as (markdown: string) => string[];
const explainAll = explain as (problems: readonly string[]) => string[];
const notesFor = operatorNotes as (input: { site: unknown; flags: unknown; env: Record<string, string | undefined> }) => string[];
const gate = unallowed as (problems: readonly string[], allow: string) => string[];

/** The launched form routes of a build without PUBLIC_WE_INTAKE_API_URL, measured in a child process so this run's environment cannot change the answer. */
function disabledFormRoutes(): string[] {
  const env = { ...process.env };
  delete env.PUBLIC_WE_INTAKE_API_URL;
  delete env.PUBLIC_WE_NEWSLETTER_API_URL;
  const script = `
    import { routes } from './src/data/routes.ts';
    import { effectiveRouteMode, FORM_ROUTES } from './src/data/forms.ts';
    const out = routes.filter((r) => r.launch && FORM_ROUTES[r.path] !== undefined && effectiveRouteMode(r.path) === 'disabled').map((r) => r.path);
    console.log(JSON.stringify(out));`;
  const stdout = execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd: repo, env, encoding: 'utf8' });
  return JSON.parse(stdout) as string[];
}

const formLine = (path: string): string => `launched form route ${path} has form "intake" in disabled mode`;
const buildFailure = (problems: readonly string[]): string => `> build\n\nRelease assertions failed (${problems.length}):\n${problems.map((p) => `- ${p}`).join('\n')}\n`;

const SIGNED = `## 8. Counsel review: x

<!-- COUNSEL-CHECKLIST:START -->

#### CR-01. First

- [x] Counsel approves as written
- [ ] Counsel requires this change: ______

#### CR-02. Second

- [X] Counsel approves as written
- [ ] Counsel requires this change: ______

<!-- COUNSEL-CHECKLIST:END -->

Counsel sign-off:

- [x] Every item above approved
- [x] Read in full
- [x] Name, date and SHA recorded

## 9. Terms
`;

test('there are exactly 13 launched form routes in disabled mode with no endpoint: the two fixed forms with no mailbox fallback and eleven briefs (apply and contact fall back to their confirmed mailbox since 2026-10-28)', () => {
  const disabled = disabledFormRoutes();
  assert.equal(disabled.length, 13);
  assert.deepEqual(disabled.filter((p) => !p.startsWith('/briefs/')).sort(), ['/investors/interest/', '/network/partners/enquire/']);
  assert.equal(disabled.filter((p) => p.startsWith('/briefs/')).length, 11);
});

test('with an empty RELEASE_ALLOW every one of them fails the gate, and demo is the only place they are tolerated', () => {
  const lines = disabledFormRoutes().map(formLine);
  assert.deepEqual(gate(lines, ''), lines, 'a release tag allows nothing');
  const verdict = compose({ run: { status: 1, output: buildFailure(lines) }, allow: '', markdown: SIGNED });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.blocking.length, 13);
  assert.match(verdict.reason, /^13 of 13 problems are not covered by RELEASE_ALLOW$/);
  assert.equal(compose({ run: { status: 1, output: buildFailure(lines) }, allow: branchAllow(), markdown: SIGNED }).ok, true, 'a branch tolerates them, and lists them as allowed');
});

test('the gate explains the form routes: the cause, the variable, and that they must not be allowed', () => {
  const lines = disabledFormRoutes().map(formLine);
  const verdict = compose({ run: { status: 1, output: buildFailure(lines) }, allow: '', markdown: SIGNED });
  const text = verdict.explanation.join('\n');
  assert.match(text, /13 launched form routes are in disabled mode/);
  assert.match(text, /\/briefs\/real-timeline\//);
  assert.match(text, /PUBLIC_WE_INTAKE_API_URL/);
  assert.match(text, /WP-61/);
  assert.match(text, /Do not allow them/);
});

test('every unsigned counsel entry and every open sign-off item is a problem line, and none is ticked on the strength of this change', () => {
  const parsed = signoff(releaseMd);
  assert.ok(parsed.entries.length >= 44, `section 8 lists ${parsed.entries.length} CR entries`);
  assert.deepEqual(parsed.entries.slice(0, 3).map((e) => e.id), ['CR-01', 'CR-02', 'CR-03']);
  assert.equal(parsed.tail.length, 3);
  const problems = humanProblems(releaseMd);
  assert.equal(problems.length, parsed.entries.filter((e) => !e.approved).length + parsed.tail.filter((t) => !t.done).length);
  for (const line of problems) assert.ok(line.startsWith(HUMAN_PREFIX));
  // The count of ticked boxes in the file equals the count the parser reads as approved or done: nothing is signed that the parser ignores.
  const ticked = (releaseMd.match(/^- \[[xX]\] /gm) ?? []).length;
  assert.equal(ticked, parsed.entries.filter((e) => e.approved).length + parsed.tail.filter((t) => t.done).length);
});

test('the counsel parser: approved needs the approval box, a ticked "requires this change" box alone is not a sign-off', () => {
  assert.deepEqual(humanProblems(SIGNED), []);
  const parsed = signoff(SIGNED);
  assert.deepEqual(parsed.entries.map((e) => [e.id, e.approved]), [['CR-01', true], ['CR-02', true]]);
  const changeOnly = SIGNED.replace('- [x] Counsel approves as written', '- [ ] Counsel approves as written').replace('- [ ] Counsel requires this change: ______', '- [x] Counsel requires this change: ______');
  assert.deepEqual(humanProblems(changeOnly).map((p) => /CR-\d+/.exec(p)?.[0]), ['CR-01']);
  const tailOpen = SIGNED.replace('- [x] Read in full', '- [ ] Read in full');
  assert.deepEqual(humanProblems(tailOpen), [`${HUMAN_PREFIX}counsel sign-off block not ticked: Read in full`]);
});

test('the delegated-decision wording signs an entry exactly like the counsel wording', () => {
  const delegated = SIGNED.replaceAll('- [x] Counsel approves as written', '- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)').replaceAll('- [X] Counsel approves as written', '- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)');
  assert.deepEqual(humanProblems(delegated), []);
  assert.deepEqual(signoff(delegated).entries.map((e) => e.approved), [true, true]);
  const unticked = delegated.replace('- [x] Decided as written', '- [ ] Decided as written');
  assert.deepEqual(humanProblems(unticked).map((p) => /CR-\d+/.exec(p)?.[0]), ['CR-01']);
});

test('a checklist that cannot be read fails loudly instead of passing', () => {
  assert.throws(() => signoff('# nothing here'), /no "## 8\." section/);
  assert.throws(() => signoff('## 8. x\n\ntext\n\n## 9. y\n'), /COUNSEL-CHECKLIST:END/);
  assert.throws(() => signoff('## 8. x\n\n<!-- COUNSEL-CHECKLIST:START -->\n<!-- COUNSEL-CHECKLIST:END -->\n- [ ] a\n\n## 9. y\n'), /lists no CR entries/);
  assert.throws(() => signoff('## 8. x\n\n#### CR-01. a\n\n- [x] Counsel approves as written\n<!-- COUNSEL-CHECKLIST:END -->\n\n## 9. y\n'), /no counsel sign-off block/);
  const unreadable = compose({ run: { status: 0, output: '' }, allow: '', markdown: new Error('ENOENT') });
  assert.equal(unreadable.ok, false);
  assert.match(unreadable.blocking[0] ?? '', /^human item open: RELEASE\.md could not be read: ENOENT/);
  const malformed = compose({ run: { status: 0, output: '' }, allow: '', markdown: '# nothing here' });
  assert.equal(malformed.ok, false);
  assert.match(malformed.blocking[0] ?? '', /the counsel checklist could not be read/);
});

test('on the real RELEASE.md an empty RELEASE_ALLOW fails and names counsel, even when the build itself has no problem', () => {
  const verdict = compose({ run: { status: 0, output: '' }, allow: '', markdown: releaseMd });
  const open = humanProblems(releaseMd);
  assert.equal(verdict.ok, open.length === 0);
  assert.equal(verdict.blocking.length, open.length);
  if (open.length > 0) {
    assert.match(verdict.explanation.join('\n'), /Counsel has not finished the review in \.astro-magazine\/release\/RELEASE\.md section 8/);
    assert.match(verdict.explanation.join('\n'), /Nobody else can do this/);
  }
});

test('a passing build and a fully signed checklist is the only way to a green release gate', () => {
  const green = compose({ run: { status: 0, output: '' }, allow: '', markdown: SIGNED });
  assert.equal(green.ok, true);
  assert.equal(green.reason, 'release build passed and no human item is open');
  assert.deepEqual(green.problems, []);
  assert.deepEqual(green.explanation, []);
});

test('a missing page, a draft, or a build that fails for another reason is never covered by the branch allowance', () => {
  const allow = branchAllow();
  const lines = ['launch:true route does not exist: /ecosystem/', 'draft content remains: src/content/insights/x.mdx'];
  const verdict = compose({ run: { status: 1, output: buildFailure(lines) }, allow, markdown: SIGNED });
  assert.equal(verdict.ok, false);
  assert.deepEqual(verdict.blocking, lines);
  assert.match(verdict.explanation.join('\n'), /launched routes have no page \(\/ecosystem\/\)/);
  assert.match(verdict.explanation.join('\n'), /draft entries remain/);
  const other = compose({ run: { status: 1, output: 'Error: vite exploded' }, allow, markdown: SIGNED });
  assert.equal(other.ok, false);
  assert.equal(other.reason, 'the build failed for a reason other than the release assertions');
  const spawn = compose({ run: { error: new Error('spawn npm ENOENT'), status: null, output: '' }, allow, markdown: SIGNED });
  assert.equal(spawn.ok, false);
  assert.match(spawn.reason, /could not start the build: spawn npm ENOENT/);
});

test('explain names each cause once and passes unknown lines through verbatim', () => {
  const lines = explainAll([formLine('/apply/'), `${HUMAN_PREFIX}counsel has not signed CR-09 (x), RELEASE.md section 8`, 'something new broke']);
  assert.equal(lines.length, 3);
  assert.match(lines[0] ?? '', /^1 launched form routes are in disabled mode \(\/apply\/\)/);
  assert.match(lines[1] ?? '', /1 unsigned CR entries and 0 open sign-off items/);
  assert.equal(lines[2], 'something new broke');
});

test('the operator notes name every open human item without a value', () => {
  const notes = notesFor({ site, flags, env: {} }).join('\n');
  // The mailboxes and the security contact were confirmed on 2026-10-28 (RELEASE.md sections 6 and 7), so they no longer appear as open.
  assert.doesNotMatch(notes, /is confirmed:false/);
  assert.doesNotMatch(notes, /site\.securityContact is null/);
  const unconfirmed = notesFor({ site: { ...site, mailboxes: { hello: { address: 'hello@worldenterprise.org', confirmed: false }, apply: { address: 'apply@worldenterprise.org', confirmed: false } }, securityContact: null }, flags, env: {} }).join('\n');
  assert.match(unconfirmed, /hello@worldenterprise\.org is confirmed:false/);
  assert.match(unconfirmed, /apply@worldenterprise\.org is confirmed:false/);
  assert.match(unconfirmed, /site\.securityContact is null/);
  assert.match(notes, /PUBLIC_WE_INTAKE_API_URL is not set/);
  assert.match(notes, /PUBLIC_WE_NEWSLETTER_API_URL is not set/);
  assert.match(notes, /flags\.legalTerms .* is off/);
  const set = notesFor({ site, flags, env: { PUBLIC_WE_INTAKE_API_URL: 'https://intake.example.org/v1' } }).join('\n');
  assert.doesNotMatch(set, /PUBLIC_WE_INTAKE_API_URL is not set/);
  assert.doesNotMatch(set, /intake\.example\.org/, 'a value never appears in the output');
});

/** The RELEASE_ALLOW a branch pipeline gets, read from the CI file. */
function branchAllow(): string {
  const match = /^ {2}RELEASE_ALLOW:\n {4}value: '([^']+)'\n {4}expand: false$/m.exec(ci);
  assert.ok(match, 'RELEASE_ALLOW is a literal variable');
  return match[1] as string;
}

test('CI: the release tag and gh-pages rule empties RELEASE_ALLOW first, cannot fail soft, and the mirror waits for it', () => {
  const job = ci.slice(ci.indexOf('\nverify:release:'), ci.indexOf('\n# The shared Pages job'));
  const rules = job.slice(job.indexOf('  rules:'));
  const first = rules.slice(0, rules.indexOf("    - if: '$CI_COMMIT_BRANCH =~ /^wp\\/' && $QA_STRICT"));
  assert.match(first, /CI_COMMIT_TAG =~ \/\^release-\/ \|\| \$CI_COMMIT_BRANCH == "gh-pages"/);
  assert.match(first, /RELEASE_ALLOW: ""/);
  // The production endpoints come from release-only names, so they never outrank a test build's endpoint (#119).
  assert.match(first, /PUBLIC_WE_INTAKE_API_URL: "\$\{WE_RELEASE_INTAKE_API_URL\}"/);
  assert.match(first, /PUBLIC_WE_NEWSLETTER_API_URL: "\$\{WE_RELEASE_NEWSLETTER_API_URL\}"/);
  assert.match(first, /allow_failure: false/);
  assert.ok(rules.indexOf('RELEASE_ALLOW: ""') < rules.indexOf('allow_failure: true'), 'the release rule comes before every soft rule');
  const mirror = ci.slice(ci.indexOf('\nmirror:'));
  assert.match(mirror, /needs:[\s\S]*- job: verify:release\n\s+artifacts: false/);
  assert.equal((ci.match(/RELEASE_ALLOW: ""/g) ?? []).length, 1, 'no other job or rule sets an allowance');
  assert.match(read('.github/workflows/pages.yml'), /RELEASE_ALLOW: ''[\s\S]*sh scripts\/ci\/release-gates\.sh/);
});

test('the branch allowance is exactly the two operator-gated kinds', () => {
  assert.deepEqual(branchAllow().split(',').map((p) => p.trim()), ['^launched form route', '^human item open:']);
});

test('flags that ship forms, terms or PBC wording stay off, and the mailboxes and security contact are the confirmed shared-mailbox aliases', () => {
  assert.equal(flags.legalTerms, false);
  assert.equal(flags.pbcWording, false);
  assert.equal(flags.seatPrice.published, false);
  assert.equal(flags.seatPrice.monthlyRate, null);
  assert.equal(flags.focusShiftConfirmed, false);
  assert.equal(flags.briefUpdates, false);
  assert.equal(site.mailboxes.hello.confirmed, true);
  assert.equal(site.mailboxes.apply.confirmed, true);
  assert.equal(site.securityContact, 'security@worldenterprise.org');
});
