#!/usr/bin/env node
// Deploy-integrity gate shared by GitLab (audit:dist) and GitHub Actions (pages.yml). It runs on the exact dist that gets published.
//   CNAME:     the repository CNAME is exactly "worldenterprise.org" (SAGE-PLAN 2: never modified). With --cname-in-dist, dist/CNAME must
//              exist and match too (the GitHub workflow copies it in before this gate runs); without the flag it is checked only if present.
//   Allowlist: every file under dist has an extension that is meant to be published, and every top-level entry is a known file, a known
//              asset folder or a route folder (one that holds an index.html). Nothing is allowed because nobody thought of it.
//              Wave 7: llms.txt and llms-full.txt are known top-level files, and a .md file outside library/ is a Markdown twin, allowed
//              only when the page it mirrors was built (insights/x.md needs insights/x/index.html).
//   Forbidden: no repository-internal path (.git, .github, .plan, CLAUDE.md, package.json ...) at any depth, no scripts, tests or docs
//              folder at the top level, and no dotfile or hidden folder other than .well-known.
//   Leaks:     no source maps (file or sourceMappingURL), no internal hostname, private address, build path or credential-shaped string
//              in any text file. Patterns name hostnames and tokens, never bare words, so prose about the topic cannot trip them.
//   Privacy:   no personal data by shape (WP-108): no email outside the allowlist, no tel: link or phone number, no LinkedIn or X/Twitter
//              profile URL, in any page, Markdown twin, llms*.txt, xml/rss, JSON-LD, script or decoded Pagefind fragment. Pagefind's own
//              scripts carry vendor translator credits with emails and are exempt by file name (PRIVACY_VENDOR_FILES), not by pattern.
//              Findings carry a masked excerpt, so a CI log never becomes a second copy of the data. `--self-test` plants a sentinel in a
//              page, a Markdown twin and a Pagefind fragment and fails unless each one is found.
//   Shape:     dist/index.html and dist/404.html exist.
// Usage: node scripts/lib/audit-dist.mjs [--dist dist] [--cname CNAME] [--cname-in-dist] | --self-test
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { decodeFragment } from './gated-briefs.mjs';
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
  // Self-hosted video (WP-22): AV1 WebM, H.264 MP4 and their WebVTT captions, emitted to _astro/ by the media components.
  '.mp4', '.webm', '.vtt',
]);
/**
 * Extensions that are allowed only below a folder: the library templates are published as Markdown downloads. A `.md` file elsewhere is a
 * Markdown twin (wave 7) and is allowed only beside the page it mirrors; see twinPage.
 */
export const SCOPED_EXTENSIONS = { '.md': ['library/'] };

/** Top-level files. Everything else at the top of dist must be a folder. */
export const TOP_LEVEL_FILES = [/^index\.html$/, /^404\.html$/, /^robots\.txt$/, /^llms(?:-full)?\.txt$/, /^rss\.xml$/, /^sitemap(?:-index|-\d+)\.xml$/, /^favicon\.(?:svg|ico)$/, /^apple-touch-icon(?:-\d+x\d+)?\.png$/, /^CNAME$/, /^manifest\.webmanifest$/];
/** Top-level folders that hold assets rather than pages. Any other folder must hold an index.html. */
export const ASSET_FOLDERS = new Set(['_astro', 'pagefind', 'press', '.well-known']);

/** Text file types the leak scan reads. Fonts, images and Pagefind index files are binary and skipped. */
const SCANNED = new Set(['.html', '.css', '.js', '.mjs', '.json', '.xml', '.txt', '.svg', '.md', '.webmanifest']);
/** Types where a dotted word such as ".local" is far more likely to be a hostname than a property access. */
const PROSE = new Set(['.html', '.xml', '.txt', '.json', '.md', '.svg', '.webmanifest']);
const MAX_SCAN_BYTES = 8 * 1024 * 1024;
const FRAGMENT_EXTENSION = '.pf_fragment';

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

/** Mail domains a page may show. Only the two WE addresses (hello@, apply@) exist on the first; the others are reserved for examples. */
export const EMAIL_ALLOWED_DOMAINS = new Set(['worldenterprise.org', 'example.org', 'example.com', 'example.test']);
/** Pagefind's own scripts carry translator credits with emails (for example the Danish translation). Exempt by file, never by pattern. */
export const PRIVACY_VENDOR_FILES = new Set(['pagefind/pagefind-ui.js', 'pagefind/pagefind-component-ui.js', 'pagefind/pagefind-modular-ui.js', 'pagefind/pagefind-highlight.js']);
/** File types where a phone number can be prose. CSS, scripts and SVG path data hold digit runs that only look like numbers. */
const PHONE_TYPES = new Set(['.html', '.xml', '.txt', '.json', '.md', '.webmanifest']);

const EMAIL_RE = /[A-Za-z0-9][A-Za-z0-9._%+-]*@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}/g;
const ENCODED_AT = /&#0*64;|&#x0*40;|&commat;|%40/gi;
/** An international number, a North American number (area code and exchange start 2 to 9, so "120 100 2026" is not one) or a trunk-prefixed national number. */
const PHONE_RES = [
  /(?<![\w.+/#=-])\+\d{1,3}(?:[\s.-]?\(?\d{1,4}\)?){2,5}(?![\d-])/g,
  /(?<![\w.+/#=-])(?:\([2-9]\d{2}\)[\s.-]?|[2-9]\d{2}[\s.-])[2-9]\d{2}[\s.-]\d{4}(?![\w-]|\.\d)/g,
  /(?<![\w.+/#=-])0\d{2,4}[\s-]\d{3,4}[\s-]\d{3,4}(?![\w-]|\.\d)/g,
];
const TEL_LINK_RE = /(?<![\w-])(?:tel|callto|sms):\s*[+\d(%]|\bwa\.me\/\+?\d/gi;
const LINKEDIN_RE = /\blinkedin\.com\/(?:in|pub)\/[^\s"'<>)]+/gi;
const X_PROFILE_RE = /(?<![\w.-])(?:twitter|x)\.com\/(?!intent\b|share\b|home\b|i\/|search\b|hashtag\b|login\b|explore\b|settings\b|privacy\b|tos\b)@?[A-Za-z0-9_]{1,15}(?![\w.-]*\.[a-z]{2,})\b/gi;

/** Blanks what only looks like a number: stylesheets, scripts (JSON-LD stays) and the numeric attributes of SVG shapes. */
function proseView(text) {
  return text
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script\b(?![^>]*ld\+json)[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/\s(?:d|points|path|values|keyTimes|keySplines|transform|viewBox|stroke-dasharray)\s*=\s*(?:"[^"]*"|'[^']*')/g, ' ');
}

function maskEmail(text) {
  const at = text.lastIndexOf('@');
  return `${text[0]}***@${text.slice(at + 1)}`;
}

const SECRET_NAMES = new Set(['private key block', 'AWS access key id', 'GitHub token', 'GitLab token', 'Slack token', 'JSON web token']);

/** A short, safe excerpt of a match. Credential-shaped matches are cut to six characters so the log never carries the value. */
function excerpt(name, text) {
  if (SECRET_NAMES.has(name)) return `${text.slice(0, 6)}...`;
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

/** The page a Markdown twin mirrors: "insights/x.md" mirrors "insights/x/index.html" and "index.md" mirrors "index.html". */
export function twinPage(rel) {
  return rel === 'index.md' ? 'index.html' : `${rel.slice(0, -'.md'.length)}/index.html`;
}

function extensionIssue(rel, present) {
  const ext = extname(rel).toLowerCase();
  if (ext === '.map') return 'source map in the published output';
  if (ALLOWED_EXTENSIONS.has(ext)) return null;
  const scope = SCOPED_EXTENSIONS[ext];
  if (scope !== undefined) {
    if (scope.some((prefix) => rel.startsWith(prefix))) return null;
    if (ext === '.md' && present.has(twinPage(rel))) return null;
    return `${ext} files are published only under ${scope.join(', ')}${ext === '.md' ? `, or beside the page they mirror (${twinPage(rel)})` : ''}`;
  }
  return `file type "${ext === '' ? '(none)' : ext}" is not on the publish allowlist`;
}

/** A file at the top of dist must be one of the known names, or a Markdown twin of a built page. A source map keeps its own message. */
function topLevelFileIssue(rel, present) {
  const ext = extname(rel).toLowerCase();
  if (ext === '.map') return 'source map in the published output';
  if (ext === '.md' && present.has(twinPage(rel))) return null;
  return TOP_LEVEL_FILES.some((re) => re.test(rel)) ? null : `top-level file "${rel}" is not on the publish allowlist`;
}

/** Structure checks over the list of dist-relative file paths: forbidden names, hidden entries, allowlists, top-level shape. */
export function auditStructure(distDir, rels) {
  const findings = [];
  const topFolders = new Map();
  const present = new Set(rels);
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
    const issue = segments.length === 1 ? topLevelFileIssue(rel, present) : extensionIssue(rel, present);
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

/** The first few distinct masked matches of a pattern, so one noisy file does not bury the log. */
function distinct(text, re, accept, mask) {
  const found = new Set();
  for (const match of text.matchAll(re)) {
    if (accept(match[0])) found.add(mask(match[0]));
    if (found.size === 3) break;
  }
  return [...found];
}

/**
 * Scans one text file, or one decoded Pagefind fragment, for personal data by shape (WP-108). `rel` is the dist-relative path: it picks the
 * file type and the vendor exemption. Returns the findings, with masked excerpts.
 */
export function scanPrivacy(where, rel, text) {
  if (PRIVACY_VENDOR_FILES.has(rel)) return [];
  const ext = extname(rel).toLowerCase();
  const findings = [];
  const add = (name, shown) => findings.push({ level: 'error', where, message: `${name}: ${shown}` });
  const plain = text.replace(ENCODED_AT, '@');
  for (const shown of distinct(plain, EMAIL_RE, (email) => !EMAIL_ALLOWED_DOMAINS.has(email.slice(email.lastIndexOf('@') + 1).toLowerCase()), maskEmail)) {
    add('email address outside the allowlist', shown);
  }
  for (const shown of distinct(plain, TEL_LINK_RE, () => true, (link) => `${link.slice(0, link.indexOf(':') + 1).toLowerCase()}***`)) add('telephone link', shown);
  for (const shown of distinct(plain, LINKEDIN_RE, () => true, () => 'linkedin.com/in/***')) add('LinkedIn profile URL', shown);
  for (const shown of distinct(plain, X_PROFILE_RE, () => true, (url) => `${url.slice(0, url.indexOf('/'))}/***`)) add('X or Twitter profile URL', shown);
  if (PHONE_TYPES.has(ext) || ext === FRAGMENT_EXTENSION) {
    const prose = ext === '.html' ? proseView(plain) : plain;
    const digits = (value) => value.replace(/\D/g, '').length;
    for (const re of PHONE_RES) {
      for (const shown of distinct(prose, re, (number) => digits(number) >= 8 && digits(number) <= 15, (number) => number.replace(/\d/g, '*'))) add('phone number', shown);
    }
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
    if (extname(rel).toLowerCase() === FRAGMENT_EXTENSION) {
      try {
        findings.push(...scanPrivacy(`${distDir}/${rel}`, rel, decodeFragment(readFileSync(file))));
      } catch (error) {
        findings.push({ level: 'error', where: `${distDir}/${rel}`, message: `Pagefind fragment could not be decoded for the privacy scan: ${error instanceof Error ? error.message : String(error)}` });
      }
      return;
    }
    if (!SCANNED.has(extname(rel).toLowerCase())) return;
    if (statSync(file).size > MAX_SCAN_BYTES) {
      findings.push({ level: 'error', where: `${distDir}/${rel}`, message: `text file is larger than ${MAX_SCAN_BYTES} bytes and was not scanned` });
      return;
    }
    const text = read(file);
    findings.push(...scanText(`${distDir}/${rel}`, rel, text), ...scanPrivacy(`${distDir}/${rel}`, rel, text));
  });
  return findings;
}

// ---- the self-test -------------------------------------------------------------------------------------------------------------

const SENTINEL_EMAIL = 'sentinel-client@leak.invalid';
const SENTINEL_PHONE = '+1 555 0100';

function fragmentOf(text) {
  return gzipSync(Buffer.from(`pagefind_dcd${JSON.stringify({ url: '/x/', content: text, meta: { title: 'x' } })}`));
}

/**
 * What a real build holds that must never trip the privacy scan: the two WE addresses, example domains, a vendor credit in Pagefind's own
 * script, versions, dates, ISO numbers, a timestamp offset, SVG path data and a number inside a stylesheet.
 */
const CLEAN_PAGE = [
  '<main><p>Write to hello@worldenterprise.org or apply@worldenterprise.org. Use you@example.org in a form hint.</p>',
  '<p>Version 1.2.3, updated 2026-10-17T12:00:00+00:00. ISO 27001:2022 and ISO/IEC 42001 are standards, not numbers to dial.</p>',
  '<p>Rated 4.5 of 5 on 120 100 2026 reviews, 3 2 1 steps.</p>',
  '<svg viewBox="0 0 120 120"><path d="M10 20 30.456.789.1234 L 100 200.555.666.7777"/></svg><style>a{margin:0 555 123 4567}</style></main>',
  '<script type="application/ld+json">{"@type":"Organization","email":"hello@worldenterprise.org","address":{"addressLocality":"Lewes","addressRegion":"DE"}}</script>',
].join('');

function plantDist(root, plant) {
  mkdirSync(join(root, 'dist', 'pagefind', 'fragment'), { recursive: true });
  mkdirSync(join(root, 'dist', 'insights', 'x'), { recursive: true });
  writeFileSync(join(root, 'CNAME'), `${EXPECTED_CNAME}\n`);
  writeFileSync(join(root, 'dist', 'index.html'), `<main>${plant.page ?? CLEAN_PAGE}</main>`);
  writeFileSync(join(root, 'dist', '404.html'), '<main>Not found.</main>');
  writeFileSync(join(root, 'dist', 'insights', 'x', 'index.html'), '<main><p>An unrelated page.</p></main>');
  writeFileSync(join(root, 'dist', 'insights', 'x.md'), plant.md ?? 'An unrelated twin. Write to hello@worldenterprise.org.\n');
  writeFileSync(join(root, 'dist', 'llms.txt'), plant.llms ?? '# WE\n');
  writeFileSync(join(root, 'dist', 'pagefind', 'fragment', 'en_aaaa.pf_fragment'), fragmentOf(plant.fragment ?? 'An unrelated page about something else.'));
  writeFileSync(join(root, 'dist', 'pagefind', 'pagefind-ui.js'), 'var credits="Danish translation by dr@jones.dk";');
  writeFileSync(join(root, 'dist', 'pagefind', 'pagefind-other.js'), plant.script ?? 'var a=1;');
}

/**
 * Proves the privacy scan can fail. Builds temporary dists: a clean one with every known false-positive shape passes; a sentinel email, a
 * sentinel phone number, a tel: link and LinkedIn and X profile URLs are each found in a page, a Markdown twin and a decoded Pagefind
 * fragment; an email outside the vendor file is found in a script; an encoded email is found; no finding carries the sentinel. Returns [{ label, ok }].
 */
export function selfTest() {
  const results = [];
  const check = (label, ok) => results.push({ label, ok: ok === true });
  const base = mkdtempSync(join(tmpdir(), 'audit-dist-'));
  try {
    const run = (name, plant) => {
      const root = join(base, name);
      plantDist(root, plant);
      return auditDist({ distDir: join(root, 'dist'), cnameFile: join(root, 'CNAME') }).filter((f) => f.level === 'error');
    };
    const found = (findings, file, pattern) => findings.some((f) => f.where.endsWith(file) && pattern.test(f.message));
    const clean = run('clean', {});
    check('a clean dist passes: WE and example addresses, a vendor credit, versions, dates, ISO numbers and SVG path data are not findings', clean.length === 0);
    const shapes = [
      ['an email', SENTINEL_EMAIL, /email address/],
      ['a phone number', `Call ${SENTINEL_PHONE} today`, /phone number/],
      ['a national phone number', 'Call (555) 210-0100 today', /phone number/],
      ['a tel: link', '<a href="tel:+15550100">Call</a>', /telephone link/],
      ['a LinkedIn profile URL', 'https://www.linkedin.com/in/sentinel-client', /LinkedIn/],
      ['an X profile URL', 'https://x.com/sentinel_client', /X or Twitter/],
    ];
    for (const [label, text, pattern] of shapes) {
      check(`${label} in a page is found`, found(run('page', { page: `${CLEAN_PAGE}<p>${text}</p>` }), 'index.html', pattern));
      check(`${label} in a Markdown twin is found`, found(run('md', { md: `Intro.\n\n${text}\n` }), 'x.md', pattern));
      check(`${label} in a Pagefind fragment is found`, found(run('fragment', { fragment: `Before. ${text} After.` }), '.pf_fragment', pattern));
    }
    check('an email in llms.txt is found', found(run('llms', { llms: `# WE\n${SENTINEL_EMAIL}\n` }), 'llms.txt', /email address/));
    check('an email in JSON-LD is found', found(run('jsonld', { page: `${CLEAN_PAGE}<script type="application/ld+json">{"email":"${SENTINEL_EMAIL}"}</script>` }), 'index.html', /email address/));
    check('an email in a script that is not a Pagefind vendor file is found', found(run('script', { script: `var c="${SENTINEL_EMAIL}";` }), 'pagefind-other.js', /email address/));
    check('an email written as an entity is found', found(run('entity', { page: `${CLEAN_PAGE}<p>sentinel-client&#64;leak.invalid</p>` }), 'index.html', /email address/));
    const planted = run('masked', { page: `${CLEAN_PAGE}<p>${SENTINEL_EMAIL} ${SENTINEL_PHONE}</p>` });
    check('a finding never carries the email or the number', planted.length > 0 && planted.every((f) => !f.message.includes('sentinel-client') && !f.message.includes('0100')));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
  return results;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2), { dist: 'dist', cname: 'CNAME' });
  if (args['self-test'] === true) {
    const results = selfTest();
    for (const r of results) (r.ok ? console.log : console.error)(`self-test ${r.ok ? 'ok' : 'FAIL'}: ${r.label}`);
    process.exit(results.every((r) => r.ok) ? 0 : 1);
  }
  process.exit(report('audit-dist', auditDist({ distDir: args.dist, cnameFile: args.cname, cnameInDist: args['cname-in-dist'] === true || args['cname-in-dist'] === 'true' })));
}
