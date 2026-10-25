import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { checkSeams, internalLinks } from '../../../scripts/lib/wave8/seams.mjs';
import { DESKS } from '../../../src/data/desks.ts';
import { BRIEFS, SEGMENTS } from '../../../src/data/families.ts';

// #49 item 1: the seams check. The first test runs it on the working tree and demands zero dead seams. The others copy the sources to a
// temporary root, break exactly one seam, and demand that the check names it, so a check that quietly passes everything fails here.

interface Finding {
  readonly check: string;
  readonly file: string;
  readonly message: string;
}
interface Check {
  readonly id: string;
  readonly examined: number;
  readonly findings: readonly Finding[];
  readonly notes: readonly string[];
}
interface Report {
  readonly ok: boolean;
  readonly checks: readonly Check[];
  readonly findings: readonly Finding[];
}
const seams = checkSeams as (root?: string) => Report;
const links = internalLinks as (body: string) => string[];

const repo = new URL('../../../', import.meta.url).pathname;

function withCopy(run: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'we-seams-'));
  try {
    for (const dir of ['src/content', 'src/pages', 'public']) cpSync(join(repo, dir), join(root, dir), { recursive: true });
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const find = (report: Report, id: string): Check => {
  const check = report.checks.find((c) => c.id === id);
  assert.ok(check, `check ${id} ran`);
  return check;
};

test('the working tree has zero dead seams, and every check examined something', () => {
  const report = seams(repo);
  assert.deepEqual(report.findings, []);
  assert.equal(report.ok, true);
  assert.deepEqual(report.checks.map((c) => c.id), [
    'articles-to-reference',
    'playbooks-to-end-bands',
    'insights-to-desks',
    'home-audience-strip',
    'segments-to-reading-paths',
    'briefs-to-desks',
  ]);
  for (const check of report.checks) assert.ok(check.examined > 0, `${check.id} examined nothing`);
});

test('the checks cover what the plan names: 14 desks, 4 audience doors, every launched segment and brief', () => {
  const report = seams(repo);
  assert.equal(find(report, 'insights-to-desks').examined, DESKS.length);
  assert.equal(find(report, 'insights-to-desks').examined, 14);
  assert.equal(find(report, 'home-audience-strip').examined, 4);
  assert.equal(find(report, 'segments-to-reading-paths').examined, SEGMENTS.entries.filter((s) => s.launch).length);
  assert.equal(find(report, 'briefs-to-desks').examined, BRIEFS.entries.filter((b) => b.launch).length);
  assert.equal(find(report, 'playbooks-to-end-bands').examined, readdirSync(join(repo, 'src/content/playbooks')).length);
});

test('internalLinks reads Markdown links and href, path and to attributes, strips fragments and normalises the slash', () => {
  const body = ['[a](/briefs/funding-paths/#x)', '<a href="/tools/metrics-calculator">b</a>', '<MaybeLink path="/program/">c</MaybeLink>', '[ext](https://example.org/x/)', '[proto](//cdn.example/x/)', '[file](/docs/guide.pdf)'].join('\n');
  assert.deepEqual(links(body), ['/briefs/funding-paths/', '/docs/guide.pdf', '/program/', '/tools/metrics-calculator/']);
});

test('a dead link in an article body is named', () => {
  withCopy((root) => {
    const file = join(root, 'src/content/insights/ai/ai-features-and-customer-data-what-to-decide-first.mdx');
    writeFileSync(file, `${readFileSync(file, 'utf8')}\n\nSee [the brief](/briefs/does-not-exist/).\n`);
    const check = find(seams(root), 'articles-to-reference');
    assert.ok(check.findings.some((f) => f.message.includes('/briefs/does-not-exist/') && f.file.endsWith('ai-features-and-customer-data-what-to-decide-first.mdx')), JSON.stringify(check.findings));
  });
});

test('a related slug, playbook or template that does not exist is named', () => {
  withCopy((root) => {
    const file = join(root, 'src/content/insights/ai/ai-features-and-customer-data-what-to-decide-first.mdx');
    const raw = readFileSync(file, 'utf8')
      .replace(/^relatedPlaybook: .*$/m, 'relatedPlaybook: no-such-playbook')
      .replace(/^relatedTemplate: .*$/m, 'relatedTemplate: no-such-template')
      .replace(/^related: \[/m, 'related: [no-such-article, ');
    writeFileSync(file, raw);
    const messages = find(seams(root), 'articles-to-reference').findings.map((f) => f.message);
    assert.ok(messages.some((m) => m.includes('no-such-article')), messages.join('\n'));
    assert.ok(messages.some((m) => m.includes('no-such-playbook')), messages.join('\n'));
    assert.ok(messages.some((m) => m.includes('no-such-template')), messages.join('\n'));
  });
});

test('a desk with no published article is named', () => {
  withCopy((root) => {
    rmSync(join(root, 'src/content/insights/ops'), { recursive: true });
    const messages = find(seams(root), 'insights-to-desks').findings.map((f) => f.message);
    assert.ok(messages.some((m) => m.includes('desk "ops"')), messages.join('\n'));
  });
});

test('an article on a folder that is not its desk is named', () => {
  withCopy((root) => {
    const file = join(root, 'src/content/insights/ai/ai-features-and-customer-data-what-to-decide-first.mdx');
    writeFileSync(file, readFileSync(file, 'utf8').replace(/^topic: ai$/m, 'topic: legal'));
    const messages = find(seams(root), 'insights-to-desks').findings.map((f) => f.message);
    assert.ok(messages.some((m) => m.includes('sits in the "ai" folder but its topic is "legal"')), messages.join('\n'));
  });
});

test('a segment whose reading path is empty, and an article naming an unknown segment, are named', () => {
  withCopy((root) => {
    const base = join(root, 'src/content/insights');
    for (const desk of readdirSync(base)) {
      for (const name of readdirSync(join(base, desk))) {
        const file = join(base, desk, name);
        const raw = readFileSync(file, 'utf8');
        if (/^segments:.*student-founders/m.test(raw)) writeFileSync(file, raw.replace(/^(segments:.*)$/m, (line) => line.replace(/,?\s*student-founders/, '').replace(/\[\s*,\s*/, '[')));
      }
    }
    const one = join(base, 'ai/ai-features-and-customer-data-what-to-decide-first.mdx');
    writeFileSync(one, readFileSync(one, 'utf8').replace(/^segments: \[/m, 'segments: [imaginary-founders, '));
    const messages = find(seams(root), 'segments-to-reading-paths').findings.map((f) => f.message);
    assert.ok(messages.some((m) => m.includes('"student-founders"') && m.includes('reading path is empty')), messages.join('\n'));
    assert.ok(messages.some((m) => m.includes('"imaginary-founders"')), messages.join('\n'));
  });
});

test('a launched brief with no file is named', () => {
  withCopy((root) => {
    rmSync(join(root, 'src/content/briefs/first-hires.md'));
    const findings = find(seams(root), 'briefs-to-desks').findings;
    assert.ok(findings.some((f) => f.message.includes('no published brief file')), JSON.stringify(findings));
    assert.ok(findings.some((f) => f.message.includes('/briefs/first-hires/ is not a live route')), JSON.stringify(findings));
  });
});

test('an audience door whose page is gone is named', () => {
  withCopy((root) => {
    rmSync(join(root, 'src/pages/network/partners/index.astro'));
    const messages = find(seams(root), 'home-audience-strip').findings.map((f) => f.message);
    assert.equal(messages.length, 1, messages.join('\n'));
    assert.match(messages[0] ?? '', /"For partners" door points at \/network\/partners\/, which is not a live route/);
  });
});

test('a playbook whose route is gone is named, and the end band of every other playbook still resolves', () => {
  withCopy((root) => {
    const file = join(root, 'src/content/playbooks/set-up-the-company.mdx');
    writeFileSync(file, readFileSync(file, 'utf8').replace(/^relatedLibrary:\n  - .*$/m, 'relatedLibrary:\n  - no-such-library-page'));
    const check = find(seams(root), 'playbooks-to-end-bands');
    assert.ok(check.findings.some((f) => f.message.includes('no-such-library-page')), JSON.stringify(check.findings));
    assert.equal(check.findings.length, 1);
  });
});
