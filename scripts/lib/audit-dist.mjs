#!/usr/bin/env node
// Deploy-integrity gate shared by GitLab (audit:dist) and GitHub Actions (pages.yml).
//   CNAME:     the repository CNAME is exactly "worldenterprise.org" (SAGE-PLAN 2: never modified).
//   Forbidden: dist holds none of the repository-internal paths that must never be published.
//   Shape:     dist/index.html and dist/404.html exist.
// Usage: node scripts/lib/audit-dist.mjs [--dist dist] [--cname CNAME]
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs, report } from './html.mjs';

export const EXPECTED_CNAME = 'worldenterprise.org';
export const FORBIDDEN = ['.plan', '.claude', '.astro-magazine', '.git', '.gitlab-ci.yml', '.github', 'CLAUDE.md', 'plan.md', 'docs', 'documents', 'package.json', 'package-lock.json', 'scripts', 'tests', 'e2e', 'reports', 'test-results', 'playwright-report', '_refs', 'node_modules', 'src', 'claims-denylist.json'];

export function auditDist({ distDir, cnameFile, read = (p) => readFileSync(p, 'utf8'), exists = existsSync }) {
  const findings = [];
  if (!exists(cnameFile)) findings.push({ level: 'error', where: cnameFile, message: 'CNAME file is missing' });
  else {
    const value = read(cnameFile).trim();
    if (value !== EXPECTED_CNAME) findings.push({ level: 'error', where: cnameFile, message: `CNAME is "${value}", expected "${EXPECTED_CNAME}"` });
  }
  for (const name of FORBIDDEN) {
    if (exists(join(distDir, name))) findings.push({ level: 'error', where: `${distDir}/${name}`, message: 'repository-internal path present in the published output' });
  }
  for (const required of ['index.html', '404.html']) {
    if (!exists(join(distDir, required))) findings.push({ level: 'error', where: `${distDir}/${required}`, message: 'required file missing from the build output' });
  }
  return findings;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2), { dist: 'dist', cname: 'CNAME' });
  process.exit(report('audit-dist', auditDist({ distDir: args.dist, cnameFile: args.cname })));
}
