#!/usr/bin/env node
// SEO audit over the built site (SAGE-PLAN 6.9). Node built-ins only. Run after `astro build`:
//
//   node scripts/audit-seo.mjs [--dist dist] [--sitemap=error|warn]
//
// Checks per page: title (length, suffix), meta description (length), canonical (single, absolute, self-referential),
// robots meta (noindex rules), one h1 and heading order inside <main>, Open Graph and Twitter tags, JSON-LD presence,
// html lang. Cross-page: unique titles and descriptions among indexable pages, and sitemap-0.xml membership.
// Exit code 1 on any error. Warnings (for example og:image absent while the OG slots are placeholders, FLAG-OG) never fail.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export const ORIGIN = 'https://worldenterprise.org';
export const TITLE_SUFFIX = 'World Enterprise Incubator';
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 160;

/** Directories under dist that hold no site pages. */
const SKIP_DIRS = new Set(['_astro', 'pagefind']);

/** Maps dist/foo/index.html to /foo/ and dist/404.html to /404.html. */
export function pathFromFile(relFile) {
  const norm = relFile.split(sep).join('/');
  if (norm === 'index.html') return '/';
  if (norm.endsWith('/index.html')) return `/${norm.slice(0, -'index.html'.length)}`;
  return `/${norm}`;
}

/** Lists every HTML file under dist as { path, html }. */
export function listBuiltPages(dist) {
  const pages = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const info = statSync(full);
      if (info.isDirectory()) {
        if (dir === dist && SKIP_DIRS.has(name)) continue;
        walk(full);
      } else if (name.endsWith('.html')) {
        pages.push({ path: pathFromFile(relative(dist, full)), html: readFileSync(full, 'utf8') });
      }
    }
  };
  walk(dist);
  return pages.sort((a, b) => a.path.localeCompare(b.path));
}

function decode(text) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Returns the attribute value of the first tag matching `tagPattern` that also has attribute `attr`. */
function attrOf(html, tagPattern, attr) {
  for (const match of html.matchAll(tagPattern)) {
    const found = new RegExp(`\\s${attr}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(match[0]);
    if (found) return decode(found[2] ?? found[3] ?? '');
  }
  return undefined;
}

export function metaContent(html, key, value) {
  const tags = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
  for (const tag of tags) {
    const k = new RegExp(`\\s${key}\\s*=\\s*("${value}"|'${value}')`, 'i');
    if (k.test(tag)) {
      const c = /\scontent\s*=\s*("([^"]*)"|'([^']*)')/i.exec(tag);
      return c ? decode(c[2] ?? c[3] ?? '') : '';
    }
  }
  return undefined;
}

export function canonicalLinks(html) {
  return [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((m) => m[0])
    .filter((tag) => /\srel\s*=\s*("canonical"|'canonical')/i.test(tag))
    .map((tag) => attrOf(tag, /<link\b[^>]*>/gi, 'href'));
}

export function titleOf(html) {
  const m = /<title>([\s\S]*?)<\/title>/i.exec(html);
  return m ? decode(m[1]).trim() : undefined;
}

/** Headings inside <main>, in document order. Site chrome (header, mega panels, footer) is outside the page outline. */
export function mainHeadings(html) {
  const start = html.search(/<main\b/i);
  if (start === -1) return undefined;
  const end = html.indexOf('</main>', start);
  const body = html
    .slice(start, end === -1 ? undefined : end)
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '');
  return [...body.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => ({
    level: Number(m[1]),
    text: decode(m[2].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim(),
  }));
}

/**
 * Whether a built page must carry noindex. `noindexPaths` is the set of ledger rows with indexable:false.
 * Fixtures and the styleguide are always noindex; preview builds are noindex everywhere.
 */
export function expectsNoindex(path, { noindexPaths, preview }) {
  if (preview) return true;
  if (noindexPaths.has(path)) return true;
  return path.startsWith('/styleguide/') || path.includes('/fixture-');
}

/** Audits one page and returns { errors, warnings }. */
export function auditPage({ path, html }, options) {
  const errors = [];
  const warnings = [];
  const err = (msg) => errors.push(`${path}: ${msg}`);
  const warn = (msg) => warnings.push(`${path}: ${msg}`);
  const noindex = expectsNoindex(path, options);

  if (!/<html\b[^>]*\slang\s*=\s*["']en/i.test(html)) err('missing <html lang="en">');

  const title = titleOf(html);
  if (title === undefined || title === '') {
    err('missing <title>');
  } else {
    if (title.length > TITLE_MAX) err(`title is ${title.length} characters (limit ${TITLE_MAX}): "${title}"`);
    const suffixed = title.endsWith(` | ${TITLE_SUFFIX}`);
    const brandOnly = path === '/' && title.startsWith(TITLE_SUFFIX);
    if (!suffixed && !brandOnly) err(`title must end with " | ${TITLE_SUFFIX}": "${title}"`);
  }

  const description = metaContent(html, 'name', 'description');
  if (description === undefined || description === '') err('missing meta description');
  else if (description.length > DESCRIPTION_MAX) err(`meta description is ${description.length} characters (limit ${DESCRIPTION_MAX})`);

  const canonicals = canonicalLinks(html);
  if (canonicals.length !== 1) {
    err(`expected exactly one canonical link, found ${canonicals.length}`);
  } else {
    const expected = `${ORIGIN}${path}`;
    if (canonicals[0] !== expected) err(`canonical is "${canonicals[0]}", expected "${expected}"`);
    if (path !== '/404.html' && !canonicals[0]?.endsWith('/')) err('canonical must end with a trailing slash');
  }

  const robots = metaContent(html, 'name', 'robots');
  if (robots === undefined) {
    err('missing robots meta');
  } else if (noindex && !/noindex/.test(robots)) {
    err(`robots is "${robots}", expected noindex`);
  } else if (!noindex && /noindex/.test(robots)) {
    err(`robots is "${robots}" but the route is indexable`);
  }

  const headings = mainHeadings(html);
  if (headings === undefined) {
    err('no <main> landmark');
  } else {
    const h1s = headings.filter((h) => h.level === 1);
    if (h1s.length !== 1) err(`expected exactly one h1 in <main>, found ${h1s.length}`);
    if (headings[0] !== undefined && headings[0].level !== 1) err(`first heading in <main> is h${headings[0].level}, expected h1`);
    let previous = 0;
    for (const h of headings) {
      if (previous !== 0 && h.level > previous + 1) err(`heading order skips from h${previous} to h${h.level} ("${h.text}")`);
      previous = h.level;
    }
  }

  for (const prop of ['og:title', 'og:description', 'og:url', 'og:type', 'og:site_name']) {
    if (metaContent(html, 'property', prop) === undefined) err(`missing ${prop}`);
  }
  if (metaContent(html, 'name', 'twitter:card') === undefined) err('missing twitter:card');
  if (canonicals.length === 1 && metaContent(html, 'property', 'og:url') !== canonicals[0]) err('og:url differs from the canonical');
  if (metaContent(html, 'property', 'og:title') !== title) err('og:title differs from <title>');
  const ogImage = metaContent(html, 'property', 'og:image');
  if (ogImage === undefined) {
    warn('no og:image (expected while the OG slots hold placeholders, FLAG-OG)');
  } else {
    if (!ogImage.startsWith('https://')) err(`og:image must be an absolute https URL: ${ogImage}`);
    if (!/\.avif(\?|$)/.test(ogImage)) err(`og:image must be AVIF (D-18): ${ogImage}`);
    if (metaContent(html, 'name', 'twitter:card') !== 'summary_large_image') err('og:image present but twitter:card is not summary_large_image');
  }

  if (!/<script\b[^>]*type\s*=\s*["']application\/ld\+json["']/i.test(html)) err('no JSON-LD block');

  return { errors, warnings };
}

/** Cross-page checks: unique titles and descriptions among indexable pages. */
export function auditUniqueness(pages, options) {
  const errors = [];
  const titles = new Map();
  const descriptions = new Map();
  for (const page of pages) {
    if (expectsNoindex(page.path, options)) continue;
    const title = titleOf(page.html);
    const description = metaContent(page.html, 'name', 'description');
    if (title !== undefined) titles.set(title, [...(titles.get(title) ?? []), page.path]);
    if (description !== undefined) descriptions.set(description, [...(descriptions.get(description) ?? []), page.path]);
  }
  for (const [text, paths] of titles) if (paths.length > 1) errors.push(`duplicate title "${text}" on ${paths.join(', ')}`);
  for (const [text, paths] of descriptions) {
    if (paths.length > 1) errors.push(`duplicate meta description on ${paths.join(', ')}: "${text.slice(0, 60)}..."`);
  }
  return errors;
}

/** Parses sitemap-0.xml into [{ path, lastmod }]. */
export function parseSitemap(xml) {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => {
    const loc = /<loc>([^<]+)<\/loc>/.exec(m[1])?.[1] ?? '';
    const lastmod = /<lastmod>([^<]+)<\/lastmod>/.exec(m[1])?.[1];
    return { path: loc.startsWith(ORIGIN) ? loc.slice(ORIGIN.length) : loc, loc, lastmod };
  });
}

/**
 * Sitemap rules: noindex routes are not listed, every indexable page is listed, lastmod (when present) is a valid date, and a page
 * that states its own modified date (article:modified_time, which is also its JSON-LD dateModified) has that same instant as its
 * lastmod. Search engines stop trusting a lastmod that a page contradicts.
 */
export function auditSitemap(pages, entries, options) {
  const errors = [];
  const listed = new Set(entries.map((e) => e.path));
  const htmlOf = new Map(pages.map((page) => [page.path, page.html]));
  for (const entry of entries) {
    if (!entry.loc.startsWith(`${ORIGIN}/`)) errors.push(`sitemap: ${entry.loc} is not an absolute production URL`);
    if (entry.lastmod !== undefined && Number.isNaN(Date.parse(entry.lastmod))) errors.push(`sitemap: ${entry.path} has an invalid lastmod "${entry.lastmod}"`);
    const modified = metaContent(htmlOf.get(entry.path) ?? '', 'property', 'article:modified_time');
    if (entry.lastmod !== undefined && modified !== undefined && Date.parse(entry.lastmod) !== Date.parse(modified)) {
      errors.push(`sitemap: ${entry.path} lastmod ${entry.lastmod} differs from the page's own article:modified_time ${modified}`);
    }
    if (expectsNoindex(entry.path, { ...options, preview: false })) errors.push(`sitemap: noindex route ${entry.path} is listed`);
  }
  for (const page of pages) {
    if (expectsNoindex(page.path, { ...options, preview: false })) continue;
    if (!listed.has(page.path)) errors.push(`sitemap: indexable page ${page.path} is missing`);
  }
  return errors;
}

export async function loadNoindexPaths() {
  const { routes } = await import(pathToFileURL(join(process.cwd(), 'src/data/routes.ts')).href);
  return new Set(routes.filter((r) => !r.indexable).map((r) => r.path));
}

async function main() {
  const args = process.argv.slice(2);
  const distIndex = args.indexOf('--dist');
  const dist = distIndex === -1 ? 'dist' : args[distIndex + 1];
  const sitemapMode = args.find((a) => a.startsWith('--sitemap='))?.split('=')[1] ?? 'error';
  if (!dist || !existsSync(dist)) {
    console.error(`audit-seo: dist directory not found: ${dist}`);
    process.exit(2);
  }
  let noindexPaths;
  try {
    noindexPaths = await loadNoindexPaths();
  } catch (error) {
    console.error(`audit-seo: could not load the route ledger from src/data/routes.ts: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }
  const options = { noindexPaths, preview: process.env.PUBLIC_PREVIEW === '1' };
  const pages = listBuiltPages(dist);
  const errors = [];
  const warnings = [];
  for (const page of pages) {
    const result = auditPage(page, options);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }
  errors.push(...auditUniqueness(pages, options));

  const sitemapFile = join(dist, 'sitemap-0.xml');
  if (!existsSync(sitemapFile)) {
    errors.push('sitemap-0.xml is missing from dist');
  } else {
    const problems = auditSitemap(pages, parseSitemap(readFileSync(sitemapFile, 'utf8')), options);
    (sitemapMode === 'warn' ? warnings : errors).push(...problems);
  }
  for (const file of ['robots.txt', 'sitemap-index.xml', 'rss.xml']) {
    if (!existsSync(join(dist, file))) errors.push(`${file} is missing from dist`);
  }

  const ogWarnings = warnings.filter((w) => w.includes('no og:image'));
  const otherWarnings = warnings.filter((w) => !w.includes('no og:image'));
  for (const w of otherWarnings) console.warn(`WARN  ${w}`);
  if (ogWarnings.length > 0) console.warn(`WARN  ${ogWarnings.length} page(s) have no og:image (FLAG-OG: OG slots still hold placeholders)`);
  for (const e of errors) console.error(`ERROR ${e}`);
  console.log(`audit-seo: ${pages.length} pages, ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(errors.length > 0 ? 1 : 0);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
