import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { AUDITED_FOLDERS, LOCKUP_FILE, OWN_FOLDERS, auditFolders, auditSource, folderOf } from './support/brand-audit.ts';

// WP-71 brand consistency audit, static half (the rendered half is tests/e2e/wave8/wp-71/brand-audit.spec.ts). Zero findings in the
// folders WP-71 owns; every finding in a folder it does not own must be routed to an owner in the audit handoff.

const ROOT = new URL('../../../', import.meta.url).pathname;
const HANDOFF = '.astro-magazine/handoffs/wp-71-brand-audit.md';

const report = auditFolders(ROOT);
const show = (findings: readonly { file: string; line: number; rule: string; text: string }[]): string[] =>
  findings.map((f) => `${f.file}:${f.line} [${f.rule}] ${f.text}`);

test('the audit covers the folders WP-71 owns, and says which of the listed folders do not exist yet', () => {
  for (const own of OWN_FOLDERS) assert.ok(report.present.includes(own), `${own} is not audited`);
  assert.deepEqual([...report.present, ...report.absent].sort(), [...AUDITED_FOLDERS].sort());
});

test('zero findings in the family and brand components: tokens only, no hard-coded colour, no inline style, one lockup owner', () => {
  const own = report.findings.filter((f) => OWN_FOLDERS.includes(folderOf(f)));
  assert.deepEqual(show(own), []);
});

test('every finding in a folder WP-71 does not own is routed to an owner in the audit handoff', () => {
  const others = report.findings.filter((f) => !OWN_FOLDERS.includes(folderOf(f)));
  if (others.length === 0) return;
  const handoff = readFileSync(`${ROOT}${HANDOFF}`, 'utf8');
  const unrouted = others.filter((f) => !handoff.includes(`${f.file}:${f.line}`));
  assert.deepEqual(show(unrouted), [], `route each finding in ${HANDOFF}`);
});

test('the families layer never imports the shared Card, so a family card is neutral by construction', () => {
  assert.deepEqual(show(report.findings.filter((f) => f.rule === 'shared-card')), []);
});

test('only the lockup component references the wordmark among the audited folders', () => {
  assert.deepEqual(show(report.findings.filter((f) => f.rule === 'second-lockup')), []);
  const source = readFileSync(`${ROOT}${LOCKUP_FILE}`, 'utf8');
  assert.deepEqual(show(auditSource(LOCKUP_FILE, source)), []);
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Self-tests: the audit must fail on the thing it exists to catch.
// ---------------------------------------------------------------------------------------------------------------------------------

const CLEAN = `---
const { title } = Astro.props;
---

<section class="demo"><h2>{title}</h2></section>

<style>
  .demo {
    color: var(--color-text);
    padding: var(--sp-4);
  }
</style>
`;

const rulesOf = (file: string, text: string): string[] => auditSource(file, text).map((f) => f.rule);

test('self-test: a clean component has no findings', () => {
  assert.deepEqual(auditSource('src/components/families/Demo.astro', CLEAN), []);
});

test('self-test: a planted hard-coded colour fails, in a style block and in markup', () => {
  const inStyle = CLEAN.replace('var(--color-text)', '#123456');
  assert.deepEqual(rulesOf('src/components/families/Demo.astro', inStyle), ['raw-colour']);
  const inMarkup = CLEAN.replace('<h2>', '<h2 data-fill="rgb(1, 2, 3)">');
  assert.deepEqual(rulesOf('src/components/families/Demo.astro', inMarkup), ['hard-coded-colour']);
  const inAttribute = CLEAN.replace('<h2>', '<svg><path fill="#abc" /></svg><h2>');
  assert.deepEqual(rulesOf('src/components/families/Demo.astro', inAttribute), ['hard-coded-colour']);
});

test('self-test: magic spacing, !important and an inline style each fail', () => {
  assert.deepEqual(rulesOf('src/components/families/Demo.astro', CLEAN.replace('var(--sp-4)', '13px')), ['magic-spacing']);
  assert.deepEqual(rulesOf('src/components/families/Demo.astro', CLEAN.replace('var(--sp-4);', 'var(--sp-4) !important;')), ['important']);
  assert.deepEqual(rulesOf('src/components/families/Demo.astro', CLEAN.replace('class="demo"', 'class="demo" style="margin: 0"')), ['inline-style']);
});

test('self-test: a second lockup fails, however it is reached', () => {
  const file = 'src/components/families/Demo.astro';
  const viaComponent = CLEAN.replace('---\n', "---\nimport Lockup from '../brand/Lockup.astro';\n").replace('<h2>', '<Lockup /><h2>');
  assert.ok(rulesOf(file, viaComponent).includes('second-lockup'));
  const viaAsset = CLEAN.replace('---\n', "---\nimport mark from '../../assets/brand/we-logo-wordmark.svg';\n");
  assert.deepEqual(rulesOf(file, viaAsset), ['second-lockup']);
});

test('self-test: a logo on a dark band fails', () => {
  const dark = CLEAN.replace('class="demo"', 'class="demo on-inverse"').replace('<h2>', '<img src="/logo.svg" alt="logo" /><h2>');
  assert.ok(rulesOf('src/components/families/Demo.astro', dark).includes('dark-band-logo'));
});

test('self-test: the shared Card and a hand-built button fail', () => {
  const card = CLEAN.replace('---\n', "---\nimport Card from '../ui/Card.astro';\n");
  assert.deepEqual(rulesOf('src/components/families/Demo.astro', card), ['shared-card']);
  // Outside families the shared Card is allowed.
  assert.deepEqual(rulesOf('src/components/tools/Demo.astro', card), []);
  assert.deepEqual(rulesOf('src/components/families/Demo.astro', CLEAN.replace('<h2>', '<button>Go</button><h2>')), ['own-button']);
  assert.deepEqual(rulesOf('src/components/families/Demo.astro', CLEAN.replace('class="demo"', 'class="demo btn"')), ['own-button']);
});

test('self-test: comments, entities and anchors are not mistaken for colours', () => {
  const noisy = CLEAN.replace('<h2>', '<!-- #123456 --><a href="#source-a">&#8217;</a><h2>').replace('---\n', '---\n// #abcdef is a comment\n');
  assert.deepEqual(auditSource('src/components/families/Demo.astro', noisy), []);
});

test('self-test: the lockup component must keep its dark-ground guard', () => {
  const unguarded = '---\nimport wordmark from "../../assets/brand/we-logo-wordmark.svg";\n---\n<img src={wordmark.src} alt="World Enterprise" />\n';
  assert.deepEqual(rulesOf(LOCKUP_FILE, unguarded), ['dark-band-logo']);
});
