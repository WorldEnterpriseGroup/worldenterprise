// What the release gate says about the open human items (#49 scope item 3). `verify:release` used to report only what the production
// build asserts (a launched route that does not exist, draft content, a launched form in disabled mode). A release also waits on people:
// counsel signs the wording in .astro-magazine/release/RELEASE.md section 8, an operator provisions the intake endpoint, mailboxes are
// confirmed. This module turns each of those into a line the gate can fail on, and explains every failing line in plain words.
//
// The rule it enforces: nothing here is allowed silently. A line that starts with "human item open:" is a problem like any other, so it
// fails the gate unless RELEASE_ALLOW names it. demo allows the two kinds named in .gitlab-ci.yml (`^launched form route` and
// `^human item open:`) so branch pipelines stay readable; a release tag and gh-pages run with RELEASE_ALLOW empty, so every line fails.
import { parseProblems, unallowed } from '../release-gate.mjs';

export const HUMAN_PREFIX = 'human item open: ';

const SECTION_8 = /^## 8\. [^\n]*\n([\s\S]*?)(?=^## 9\. )/m;
const CR_HEADING = /^#### (CR-\d+)\. (.*)$/;
const CHECKBOX = /^- \[([ xX])\] (.*)$/;
const CHECKLIST_END = '<!-- COUNSEL-CHECKLIST:END -->';

/**
 * Reads the decision checklist of RELEASE.md section 8. An entry is signed only when its approval box ("Decided as written under CEO delegation ..." or, after an outside review, "Counsel approves as written") is ticked;
 * the change box ("Change required before release") ticked alone is not a sign-off (the change is made and the box above ticked after it). The sign-off
 * block after the checklist is a list of its own.
 * @returns {{ entries: { id: string, title: string, approved: boolean }[], tail: { text: string, done: boolean }[] }}
 */
export function counselSignoff(markdown) {
  const section = SECTION_8.exec(markdown)?.[1];
  if (section === undefined) throw new Error('RELEASE.md has no "## 8." section followed by "## 9.": the counsel checklist cannot be read.');
  const end = section.indexOf(CHECKLIST_END);
  if (end === -1) throw new Error(`RELEASE.md section 8 has no ${CHECKLIST_END} marker.`);
  const entries = [];
  for (const line of section.slice(0, end).split('\n')) {
    const heading = CR_HEADING.exec(line);
    if (heading !== null) {
      entries.push({ id: heading[1], title: heading[2].trim(), approved: false });
      continue;
    }
    const box = CHECKBOX.exec(line);
    if (box !== null && entries.length > 0 && /^(Decided as written\b|Counsel approves as written\b)/.test(box[2])) entries[entries.length - 1].approved = box[1] !== ' ';
  }
  const tail = [];
  for (const line of section.slice(end + CHECKLIST_END.length).split('\n')) {
    const box = CHECKBOX.exec(line);
    if (box !== null) tail.push({ text: box[2].trim(), done: box[1] !== ' ' });
  }
  if (entries.length === 0) throw new Error('RELEASE.md section 8 lists no CR entries: the counsel checklist cannot be empty.');
  if (tail.length === 0) throw new Error('RELEASE.md section 8 has no counsel sign-off block after the checklist.');
  return { entries, tail };
}

/** Problem lines for every unsigned counsel entry and every unticked item of the sign-off block. */
export function humanItemProblems(markdown) {
  const { entries, tail } = counselSignoff(markdown);
  const problems = [];
  for (const entry of entries) {
    if (!entry.approved) problems.push(`${HUMAN_PREFIX}counsel has not signed ${entry.id} (${entry.title}), RELEASE.md section 8`);
  }
  for (const item of tail) {
    if (!item.done) problems.push(`${HUMAN_PREFIX}counsel sign-off block not ticked: ${item.text}`);
  }
  return problems;
}

/**
 * Human items that are open but do not by themselves stop a build: they are reported next to the verdict so nobody reads a green gate as
 * "nothing is waiting". Names only, never a value of a secret or variable.
 * @param {{ site: any, flags: any, env: Record<string, string | undefined> }} input
 */
export function operatorNotes({ site, flags, env }) {
  const notes = [];
  for (const [name, box] of Object.entries(site.mailboxes)) {
    if (box.confirmed !== true) notes.push(`mailbox ${box.address} is confirmed:false in src/data/site.ts (${name}); it is not published and is no mailto fallback until an operator confirms it`);
  }
  if (site.securityContact === null) notes.push('site.securityContact is null in src/data/site.ts, so /.well-known/security.txt is not launched');
  if ((env.PUBLIC_WE_INTAKE_API_URL ?? '') === '') notes.push('PUBLIC_WE_INTAKE_API_URL is not set for this run (the intake endpoint is not provisioned or not visible to this pipeline)');
  if ((env.PUBLIC_WE_NEWSLETTER_API_URL ?? '') === '') notes.push('PUBLIC_WE_NEWSLETTER_API_URL is not set, so /newsletter/ stays launch:false');
  const flagState = [
    ['flags.legalTerms (terms of use, C-23)', flags.legalTerms === true],
    ['flags.pbcWording (public benefit corporation wording)', flags.pbcWording === true],
    ['flags.seatPrice.published (seat price)', flags.seatPrice.published === true],
    ['flags.focusShiftConfirmed', flags.focusShiftConfirmed === true],
    ['flags.briefUpdates (related-briefs checkbox)', flags.briefUpdates === true],
  ];
  for (const [name, on] of flagState) notes.push(`${name} is ${on ? 'ON' : 'off'}; it ships on only with the named sign-off in RELEASE.md section 9`);
  return notes;
}

/** Plain-words explanation of the failing lines, grouped by cause, with the exact fix and the sentence "do not add an allowance". */
export function explain(problems) {
  const lines = [];
  const forms = problems.filter((p) => p.startsWith('launched form route '));
  const missing = problems.filter((p) => p.startsWith('launch:true route does not exist: '));
  const drafts = problems.filter((p) => p.startsWith('draft content remains: '));
  const human = problems.filter((p) => p.startsWith(HUMAN_PREFIX));
  const other = problems.filter((p) => !forms.includes(p) && !missing.includes(p) && !drafts.includes(p) && !human.includes(p));
  if (forms.length > 0) {
    const routes = forms.map((p) => /^launched form route (\S+)/.exec(p)?.[1] ?? p);
    lines.push(
      `${forms.length} launched form routes are in disabled mode (${routes.join(' ')}). Cause: PUBLIC_WE_INTAKE_API_URL is not available to this build, ` +
        'because the intake service (WP-61) is not provisioned or the variable is not set in GitLab CI and GitHub. One variable clears all of them together. ' +
        'Do not allow them: a launched form that cannot be sent must not ship.',
    );
  }
  if (missing.length > 0) lines.push(`${missing.length} launched routes have no page (${missing.map((p) => p.replace('launch:true route does not exist: ', '')).join(' ')}). Fix: land the page, or flip its ledger row to launch:false with a reason.`);
  if (drafts.length > 0) lines.push(`${drafts.length} draft entries remain (${drafts.map((p) => p.replace('draft content remains: ', '')).join(' ')}). Fix: publish or remove them.`);
  if (human.length > 0) {
    const cr = human.filter((p) => p.includes('has not signed')).length;
    const tail = human.length - cr;
    lines.push(
      `Counsel has not finished the review in .astro-magazine/release/RELEASE.md section 8: ${cr} unsigned CR entries and ${tail} open sign-off items. ` +
        'Each entry needs its box ("Decided as written under CEO delegation" or "Counsel approves as written") ticked, then the sign-off block, against the exact release commit.',
    );
  }
  for (const p of other) lines.push(p);
  return lines;
}

/**
 * The verdict of verify:release: the build's own assertions plus the open human items, judged against RELEASE_ALLOW.
 * @param {{ run: { error?: Error, status: number | null, output: string }, allow: string, markdown: string | Error, notes?: string[] }} input
 */
export function composeVerdict({ run, allow, markdown, notes = [] }) {
  if (run.error !== undefined) return { ok: false, reason: `could not start the build: ${run.error.message}`, problems: [], blocking: [], explanation: [], notes };
  let build = [];
  if (run.status !== 0) {
    const parsed = parseProblems(run.output);
    if (parsed === null) return { ok: false, reason: 'the build failed for a reason other than the release assertions', problems: [], blocking: [], explanation: [], notes };
    build = parsed;
  }
  let human;
  if (markdown instanceof Error) human = [`${HUMAN_PREFIX}RELEASE.md could not be read: ${markdown.message}`];
  else {
    try {
      human = humanItemProblems(markdown);
    } catch (error) {
      human = [`${HUMAN_PREFIX}the counsel checklist could not be read: ${error instanceof Error ? error.message : String(error)}`];
    }
  }
  const problems = [...build, ...human];
  const blocking = unallowed(problems, allow);
  const reason =
    problems.length === 0
      ? 'release build passed and no human item is open'
      : blocking.length === 0
        ? `all ${problems.length} problems are covered by RELEASE_ALLOW`
        : `${blocking.length} of ${problems.length} problems are not covered by RELEASE_ALLOW`;
  return { ok: blocking.length === 0, reason, problems, blocking, explanation: explain(blocking), notes };
}
