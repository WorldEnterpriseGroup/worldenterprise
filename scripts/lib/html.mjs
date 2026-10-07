// Shared helpers for the dist audits. Node built-ins only, so audit jobs need no npm ci.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export const ORIGIN = 'https://worldenterprise.org';

/** Lists every file under `root` (absolute paths), depth first, sorted for stable output. */
export function walkFiles(root) {
  const out = [];
  const visit = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      const stat = statSync(full);
      if (stat.isDirectory()) visit(full);
      else out.push(full);
    }
  };
  visit(root);
  return out;
}

/** dist-relative posix path of an absolute file path. */
export function distRel(root, file) {
  return relative(root, file).split(sep).join('/');
}

/** Maps a dist-relative HTML file to the route it serves: foo/index.html is /foo/, 404.html stays a file route. */
export function routeOfHtml(rel) {
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'index.html'.length)}`;
  return `/${rel}`;
}

/** Whether a built route is a development fixture or the styleguide, which the ledger never lists. */
export function isDevRoute(route) {
  return route === '/styleguide/' || route.split('/').some((segment) => segment.startsWith('fixture-'));
}

/** Reads every built page: [{ route, file, html }]. Skips pagefind output and the asset folder. */
export function readPages(root) {
  if (!existsSync(root)) throw new Error(`dist directory not found: ${root}. Run the build first.`);
  const pages = [];
  for (const file of walkFiles(root)) {
    const rel = distRel(root, file);
    if (!rel.endsWith('.html')) continue;
    if (rel.startsWith('pagefind/') || rel.startsWith('_astro/')) continue;
    pages.push({ route: routeOfHtml(rel), file: rel, html: readFileSync(file, 'utf8') });
  }
  return pages;
}

const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

/** Parses the attribute text of a start tag. Boolean attributes map to the empty string. Names are lower-cased. */
export function parseAttrs(text) {
  const attrs = {};
  ATTR.lastIndex = 0;
  for (let m = ATTR.exec(text); m !== null; m = ATTR.exec(text)) {
    const name = m[1].toLowerCase();
    if (name in attrs) continue;
    attrs[name] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return attrs;
}

/** Removes script, style and comment content so that text in them is never mistaken for markup. */
export function stripNonMarkup(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '<script></script>')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '<style></style>');
}

/** Finds start tags by name: [{ tag, attrs, index, end }]. `end` is the offset just after the start tag. */
export function startTags(html, tag) {
  const re = new RegExp(`<${tag}(?=[\\s/>])((?:"[^"]*"|'[^']*'|[^'">])*)>`, 'gi');
  const found = [];
  for (let m = re.exec(html); m !== null; m = re.exec(html)) {
    found.push({ tag, attrs: parseAttrs(m[1].replace(/\/$/, '')), index: m.index, end: m.index + m[0].length });
  }
  return found;
}

/** Inner HTML of the first matching element after `from`. Does not handle nesting of the same tag, which these audits never need. */
export function innerHtml(html, tag, from) {
  const close = html.toLowerCase().indexOf(`</${tag}>`, from);
  return close === -1 ? '' : html.slice(from, close);
}

/** Visible text of a fragment, with tags removed and whitespace collapsed. */
export function textOf(fragment) {
  return fragment
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Collects `id` values in a page. */
export function collectIds(html) {
  const ids = [];
  const re = /<[a-z][a-z0-9-]*\s(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
  for (let m = re.exec(html); m !== null; m = re.exec(html)) {
    const attrs = parseAttrs(m[0].slice(m[0].search(/\s/) + 1, -1));
    if (attrs.id !== undefined && attrs.id !== '') ids.push(attrs.id);
  }
  return ids;
}

/** Reads the value of a meta tag by name or property, or null. */
export function metaContent(html, key) {
  for (const t of startTags(html, 'meta')) {
    if (t.attrs.name === key || t.attrs.property === key) return t.attrs.content ?? '';
  }
  return null;
}

/** Splits a srcset value into its URLs. */
export function srcsetUrls(value) {
  return value
    .split(',')
    .map((part) => part.trim().split(/\s+/)[0])
    .filter((u) => u !== undefined && u !== '');
}

/** Parses `--flag value` and `--flag=value` pairs, plus bare boolean flags. */
export function parseArgs(argv, defaults = {}) {
  const out = { ...defaults, _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      out._.push(arg);
      continue;
    }
    const eq = arg.indexOf('=');
    if (eq > -1) {
      out[arg.slice(2, eq)] = arg.slice(eq + 1);
    } else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) {
      out[arg.slice(2)] = argv[i + 1];
      i += 1;
    } else {
      out[arg.slice(2)] = true;
    }
  }
  return out;
}

/** Prints findings and returns the exit code. Errors fail; warnings are informational. */
export function report(name, findings, extra = '') {
  const seen = new Set();
  const unique = findings.filter((f) => {
    const key = `${f.level}|${f.where}|${f.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const errors = unique.filter((f) => f.level === 'error');
  const warnings = unique.filter((f) => f.level === 'warn');
  for (const f of errors) console.error(`FAIL  ${f.where}: ${f.message}`);
  for (const f of warnings) console.warn(`warn  ${f.where}: ${f.message}`);
  console.log(`${name}: ${errors.length} errors, ${warnings.length} warnings${extra === '' ? '' : `, ${extra}`}`);
  return errors.length === 0 ? 0 : 1;
}
