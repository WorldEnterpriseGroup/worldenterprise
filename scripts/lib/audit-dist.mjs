#!/usr/bin/env node
// Deploy-integrity gate shared by GitLab (audit:dist) and GitHub Actions (pages.yml). It runs on the exact dist that gets published.
//   CNAME:     the repository CNAME is exactly "worldenterprise.org" (SAGE-PLAN 2: never modified). With --cname-in-dist, dist/CNAME must
//              exist and match too (the GitHub workflow copies it in before this gate runs); without the flag it is checked only if present.
//   Allowlist: every file under dist has an extension that is meant to be published, and every top-level entry is a known file, a known
//              asset folder or a route folder (one that holds an index.html). Nothing is allowed because nobody thought of it.
//   Forbidden: no repository-internal path (.git, .github, .plan, CLAUDE.md, package.json ...) at any depth, no scripts, tests or docs
//              folder at the top level, and no dotfile or hidden folder other than .well-known.
//   Leaks:     no source maps (file or sourceMappingURL), no internal hostname, private address, build path or credential-shaped string
//              in any text file. Patterns name hostnames and tokens, never bare words, so prose about the topic cannot trip them.
//   Shape:     dist/index.html and dist/404.html exist.
// Usage: node scripts/lib/audit-dist.mjs [--dist dist] [--cname CNAME] [--cname-in-dist]
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { distRel, parseArgs, report, walkFiles } from './html.mjs';

export const EXPECTED_CNAME = 'worldenterprise.org';

/** Repository-internal names that must not appear at any depth under dist. */
export const FORBIDDEN_ANYWHERE = ['.plan', '.claude', '.astro-magazine', '.git', '.github', '.gitlab-ci.yml', 'CLAUDE.md', 'plan.md', 'package.json', 'package-lock.json', '_refs', 'node_modules', 'claims-denylist.json'];
/** Names that are forbidden at the top of dist only, because deeper down they could be a legitimate route name. */
export const FORBIDDEN_TOP_LEVEL = ['docs', 'documents', 'scripts', 'tests', 'e2e', 'reports', 'test-results', 'playwright-report', 'src'];
export const FORBIDDEN = [...FORBIDDEN_ANYWHERE, ...FORBIDDEN_TOP_LEVEL];

/** The only hidden folder that may be published (RFC 8615: security.txt lives there). */
export const ALLOWED_HIDDEN = new Set(['.well-known']);

/** File extensions that are meant to be published. Fonts are WOFF2 only. Images are audited separately (audit:images). */
export const ALLOWED_EXTENSIONS = new Set([
  '.html', '.css', '.js', '.mjs', '.json', '.xml', '.txt', '.svg', '.avif', '.png', '.ico', '.webmanifest', '.woff2',
  // Pagefind index files and its WebAssembly reader.
  '.pf_fragment', '.pf_index', '.pf_meta', '.pf_filter', '.pagefind',
]);
/** Extensions that are allowed only below a folder: the library templates are published as Markdown downloads. */
export const SCOPED_EXTENSIONS = { '.md': ['library/'] };

/** Top-level files. Everything else at the top of dist must be a folder. */
export const TOP_LEVEL_FILES = [/^index\.html$/, /^404\.html$/, /^robots\.txt$/, /^rss\.xml$/, /^sitemap(?:-index|-\d+)\.xml$/, /^favicon\.(?:svg|ico)$/, /^apple-touch-icon(?:-\d+x\d+)?\.png$/, /^CNAME$/, /^manifest\.webmanifest$/];
/** Top-level folders that hold assets rather than pages. Any other folder must hold an index.html. */
export const ASSET_FOLDERS = new Set(['_astro', 'pagefind', 'press', '.well-known']);

/** Text file types the leak scan reads. Fonts, images and Pagefind index files are binary and skipped. */
const SCANNED = new Set(['.html', '.css', '.js', '.mjs', '.json', '.xml', '.txt', '.svg', '.md', '.webmanifest']);
/** Types where a dotted word such as ".local" is far more likely to be a hostname than a property access. */
const PROSE = new Set(['.html', '.xml', '.txt', '.json', '.md', '.svg', '.webmanifest']);
const MAX_SCAN_BYTES = 8 * 1024 * 1024;

/**
 * Leak patterns. `prose` limits a pattern to the file types above. `vendor: false` skips Pagefind's own scripts, which are not ours to
 * edit. Hostname patterns include the dot-separated shape so a sentence that merely mentions the word does not match.
 */
export const LEAK_PATTERNS = [
  { name: 'source map reference', re: /[#@]\s*sourceMappingURL\s*=/ },
  { name: 'internal hostname', re: /\b(?:[a-z0-9-]+\.)*(?:focuscell|developerdojo)\.(?:org|com|net|io)\b/i },
  { name: 'internal registry hostname', re: /\bharbor\.[a-z0-9-]+\.[a-z]{2,}\b/i },
  { name: 'Ziti overlay hostname', re: /\b[a-z0-9-]+\.ziti(?:\.[a-z]{2,})?\b/i },
  { name: 'internal top-level domain', re: /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:internal|lan|cluster\.local)\b/i, prose: true },
  { name: 'loopback or wildcard address', re: /(?:\/\/|@)localhost\b|\blocalhost:\d+|\b127\.0\.0\.1\b|\b0\.0\.0\.0\b/, vendor: false },
  { name: 'private network address', re: /\b(?:10\.\d{1,3}|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b/, prose: true },
  { name: 'build or home directory path', re: /\/(?:home|Users)\/[A-Za-z][\w.-]*\/|\/builds\/[\w.-]+\/|[A-Z]:\\Users\\/, vendor: false },
  { name: 'mock form endpoint', re: /\bexample\.test\b/ },
  { name: 'private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'AWS access key id', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: 'GitLab token', re: /\bglpat-[A-Za-z0-9_-]{20,}\b/ },
  { name: 'Slack token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: 'JSON web token', re: /\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/ },
];

const SECRET_NAMES = new Set(['private key block', 'AWS access key id', 'GitHub token', 'GitLab token', 'Slack token', 'JSON web token']);

/** A short, safe excerpt of a match. Credential-shaped matches are cut to six characters so the log never carries the value. */
function excerpt(name, text) {
  if (SECRET_NAMES.has(name)) return `${text.slice(0, 6)}...`;
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

function extensionIssue(rel) {
  const ext = extname(rel).toLowerCase();
  if (ext === '.map') return 'source map in the published output';
  if (ALLOWED_EXTENSIONS.has(ext)) return null;
  const scope = SCOPED_EXTENSIONS[ext];
  if (scope !== undefined) {
    return scope.some((prefix) => rel.startsWith(prefix)) ? null : `${ext} files are published only under ${scope.join(', ')}`;
  }
  return `file type "${ext === '' ? '(none)' : ext}" is not on the publish allowlist`;
}

/** A file at the top of dist must be one of the known names. A source map keeps its own message. */
function topLevelFileIssue(rel) {
  if (extname(rel).toLowerCase() === '.map') return 'source map in the published output';
  return TOP_LEVEL_FILES.some((re) => re.test(rel)) ? null : `top-level file "${rel}" is not on the publish allowlist`;
}

/** Structure checks over the list of dist-relative file paths: forbidden names, hidden entries, allowlists, top-level shape. */
export function auditStructure(distDir, rels) {
  const findings = [];
  const topFolders = new Map();
  for (const rel of rels) {
    const segments = rel.split('/');
    const where = `${distDir}/${rel}`;
    const forbidden = segments.find((segment, index) => FORBIDDEN_ANYWHERE.includes(segment) || (index === 0 && FORBIDDEN_TOP_LEVEL.includes(segment)));
    if (forbidden !== undefined) {
      findings.push({ level: 'error', where: `${distDir}/${segments.slice(0, segments.indexOf(forbidden) + 1).join('/')}`, message: 'repository-internal path present in the published output' });
      continue;
    }
    const hidden = segments.find((segment) => segment.startsWith('.') && !ALLOWED_HIDDEN.has(segment));
    if (hidden !== undefined) {
      findings.push({ level: 'error', where, message: `hidden entry "${hidden}" in the published output (only .well-known may be hidden)` });
      continue;
    }
    const issue = segments.length === 1 ? topLevelFileIssue(rel) : extensionIssue(rel);
    if (issue !== null) findings.push({ level: 'error', where, message: issue });
    if (segments.length > 1) {
      const folder = segments[0];
      const entry = topFolders.get(folder) ?? { hasIndex: false };
      if (segments[segments.length - 1] === 'index.html') entry.hasIndex = true;
      topFolders.set(folder, entry);
    }
  }
  for (const [folder, entry] of topFolders) {
    if (!ASSET_FOLDERS.has(folder) && !entry.hasIndex && !FORBIDDEN_TOP_LEVEL.includes(folder) && !FORBIDDEN_ANYWHERE.includes(folder) && !folder.startsWith('.')) {
      findings.push({ level: 'error', where: `${distDir}/${folder}`, message: 'top-level folder is neither a known asset folder nor a route folder (no index.html)' });
    }
  }
  return findings;
}

/** Scans one text file for leak patterns. Returns the findings, at most one per pattern. */
export function scanText(where, rel, text) {
  const ext = extname(rel).toLowerCase();
  const vendor = rel.startsWith('pagefind/');
  const findings = [];
  for (const pattern of LEAK_PATTERNS) {
    if (pattern.prose === true && !PROSE.has(ext)) continue;
    if (pattern.vendor === false && vendor) continue;
    const match = pattern.re.exec(text);
    if (match !== null) findings.push({ level: 'error', where, message: `${pattern.name}: ${excerpt(pattern.name, match[0])}` });
  }
  return findings;
}

function auditCname({ distDir, cnameFile, cnameInDist, read, exists }) {
  const findings = [];
  if (!exists(cnameFile)) findings.push({ level: 'error', where: cnameFile, message: 'CNAME file is missing' });
  else {
    const value = read(cnameFile).trim();
    if (value !== EXPECTED_CNAME) findings.push({ level: 'error', where: cnameFile, message: `CNAME is "${value}", expected "${EXPECTED_CNAME}"` });
  }
  const distCname = join(distDir, 'CNAME');
  if (exists(distCname)) {
    const value = read(distCname).trim();
    if (value !== EXPECTED_CNAME) findings.push({ level: 'error', where: distCname, message: `dist CNAME is "${value}", expected "${EXPECTED_CNAME}"` });
  } else if (cnameInDist) {
    findings.push({ level: 'error', where: distCname, message: 'dist/CNAME is missing from the output that will be published' });
  }
  return findings;
}

export function auditDist({ distDir, cnameFile, cnameInDist = false, read = (p) => readFileSync(p, 'utf8'), exists = existsSync }) {
  const findings = auditCname({ distDir, cnameFile, cnameInDist, read, exists });
  for (const required of ['index.html', '404.html']) {
    if (!exists(join(distDir, required))) findings.push({ level: 'error', where: `${distDir}/${required}`, message: 'required file missing from the build output' });
  }
  if (!exists(distDir)) return findings;
  const files = walkFiles(distDir);
  const rels = files.map((file) => distRel(distDir, file));
  findings.push(...auditStructure(distDir, rels));
  files.forEach((file, index) => {
    const rel = rels[index];
    if (!SCANNED.has(extname(rel).toLowerCase())) return;
    if (statSync(file).size > MAX_SCAN_BYTES) {
      findings.push({ level: 'error', where: `${distDir}/${rel}`, message: `text file is larger than ${MAX_SCAN_BYTES} bytes and was not scanned` });
      return;
    }
    findings.push(...scanText(`${distDir}/${rel}`, rel, read(file)));
  });
  return findings;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2), { dist: 'dist', cname: 'CNAME' });
  process.exit(report('audit-dist', auditDist({ distDir: args.dist, cnameFile: args.cname, cnameInDist: args['cname-in-dist'] === true || args['cname-in-dist'] === 'true' })));
}
