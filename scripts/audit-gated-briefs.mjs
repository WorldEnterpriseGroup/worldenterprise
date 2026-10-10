#!/usr/bin/env node
// Proves that no gated brief reached the built site (docs/wave8-contracts.md, section 5.3, decision D-23).
//
// Usage: node scripts/audit-gated-briefs.mjs [--dist dist] [--briefs infra/intake/briefs] [--also <dir>]... [--abstracts <dir>] | --self-test
//
//   --dist       the built site (default dist)
//   --briefs     the brief sources, one `<briefId>.md` each (default infra/intake/briefs); no brief means nothing to audit
//   --also       a source tree that must not hold a brief's sentinel either, such as src or docs (repeatable)
//   --abstracts  the open abstracts (src/content/briefs): none may share ten words with its brief, none may run past 300 words
//   --self-test  plant a sentinel in a page, a Markdown twin, llms-full.txt and a Pagefind fragment and fail unless every plant is found
//
// Exit: 0 clean, 1 a leak or an audit that could not conclude, 2 usage. A finding names the brief and the file, never the sentence.
// Node built-ins only: the CI audit job runs it without npm ci.
import { fileURLToPath } from 'node:url';
import { auditBriefs, selfTest } from './lib/gated-briefs.mjs';

function parseCli(argv) {
  const cli = { dist: 'dist', briefs: 'infra/intake/briefs', also: [], abstracts: undefined, selfTest: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--self-test') cli.selfTest = true;
    else if (arg === '--dist' || arg === '--briefs' || arg === '--also' || arg === '--abstracts') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) throw new Error(`${arg} needs a path`);
      if (arg === '--also') cli.also.push(value);
      else cli[arg.slice(2)] = value;
      i += 1;
    } else throw new Error(`unknown argument ${arg}`);
  }
  return cli;
}

function main() {
  let cli;
  try {
    cli = parseCli(process.argv.slice(2));
  } catch (error) {
    console.error(`audit-gated-briefs: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }
  if (cli.selfTest) {
    const results = selfTest();
    for (const r of results) (r.ok ? console.log : console.error)(`self-test ${r.ok ? 'ok' : 'FAIL'}: ${r.label}`);
    process.exit(results.every((r) => r.ok) ? 0 : 1);
  }
  let result;
  try {
    result = auditBriefs({ dist: cli.dist, briefsDir: cli.briefs, also: cli.also, abstractsDir: cli.abstracts });
  } catch (error) {
    console.error(`audit-gated-briefs: cannot audit ${cli.dist}: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }
  if (result.briefs.length === 0) {
    console.log(`audit-gated-briefs: no brief under ${cli.briefs}, nothing to audit`);
    return;
  }
  for (const problem of result.problems) console.error(`FAIL  ${problem}`);
  for (const f of result.findings) console.error(`FAIL  ${f.briefId}: ${f.label} found in ${f.where}`);
  console.log(`audit-gated-briefs: ${result.briefs.length} briefs, ${result.files} files and ${result.fragments} search fragments read, ${result.findings.length} leaks, ${result.problems.length} problems`);
  process.exit(result.findings.length === 0 && result.problems.length === 0 ? 0 : 1);
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) main();
