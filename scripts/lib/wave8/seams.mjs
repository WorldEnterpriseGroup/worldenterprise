#!/usr/bin/env node
// Wave 8 seams check (#49 scope item 1, plan WP-99). A seam is a cross-package link that only makes sense once every package has merged:
// articles to briefs, tools, playbooks and templates; playbooks to their closing bands; /insights/ to the 14 desks; the home audience
// strip to live routes; the founder segment pages to their reading paths. Each check reads the working tree from disk (no build, no
// `astro:content`) with the same route logic the build uses (src/data/cta/live.ts, computeRouteState), so a seam that is dead here is
// dead in the build, and the answer is the same under `node --test` and in CI.
//
// A finding is a hard failure: the CLI exits 1 and the unit test (tests/unit/wp-99/seams.test.ts) fails. A seam fix is a one-line edit to
// the merged file under a registered ownership exception, limited to links and navigation text.
// Usage: node scripts/lib/wave8/seams.mjs [--root .] [--json reports/seams.json]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from 'yaml';
import { resolveCta, resolveMidCta } from '../../../src/data/cta/index.ts';
import { AUDIENCE_LINKS } from '../../../src/data/cta/audiences.ts';
import { routeContextFromDisk, isDraftFile } from '../../../src/data/cta/live.ts';
import { DESKS, deskPath } from '../../../src/data/desks.ts';
import { BRIEFS, SEGMENTS, SEGMENT_SLUGS } from '../../../src/data/families.ts';
import { computeRouteState } from '../../../src/lib/route-core.ts';
import { listCollectionFiles } from '../../../src/lib/content-files.ts';

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const MARKDOWN_LINK = /\]\((\/[^)\s]*)\)/g;
const ATTRIBUTE_LINK = /\b(?:href|path|to)=["'](\/[^"']*)["']/g;

/** @typedef {{ check: string, file: string, message: string }} Finding */
/** @typedef {{ id: string, title: string, examined: number, findings: Finding[], notes: string[] }} CheckResult */

/** Splits a content file into its parsed frontmatter and body. A file with no frontmatter block is an error, never an empty entry. */
function readEntry(root, collection, rel) {
  const file = join(root, 'src', 'content', collection, rel);
  const raw = readFileSync(file, 'utf8');
  const match = FRONTMATTER.exec(raw);
  if (match === null) throw new Error(`${file} has no frontmatter block.`);
  let data;
  try {
    data = parse(match[1]);
  } catch (error) {
    throw new Error(`${file}: frontmatter is not valid YAML: ${error instanceof Error ? error.message : String(error)}`);
  }
  return { id: rel.replace(/\.mdx?$/, ''), file: `src/content/${collection}/${rel}`, data: data ?? {}, body: match[2], draft: isDraftFile(raw) };
}

/** Published (non-draft) entries of a collection. */
function published(root, collection) {
  return listCollectionFiles(root, collection)
    .map((rel) => readEntry(root, collection, rel))
    .filter((entry) => !entry.draft);
}

/** Normalised internal link targets of a body: the path only (no query or fragment), with a trailing slash unless it names a file. */
export function internalLinks(body) {
  const found = new Set();
  for (const re of [MARKDOWN_LINK, ATTRIBUTE_LINK]) {
    for (const match of body.matchAll(re)) {
      const raw = match[1];
      if (raw.startsWith('//')) continue;
      const path = raw.split(/[?#]/)[0];
      if (path === '') continue;
      found.add(/\.[a-z0-9]+$/i.test(path) || path.endsWith('/') ? path : `${path}/`);
    }
  }
  return [...found].sort();
}

const lastSegment = (id) => id.split('/').at(-1) ?? id;

/** The route a published entry serves, per collection. */
function entryRoute(collection, entry) {
  return `/${collection}/${lastSegment(entry.id)}/`;
}

function result(id, title) {
  return { id, title, examined: 0, findings: [], notes: [] };
}

function finding(check, file, message) {
  return { check: check.id, file, message };
}

/**
 * Seam 1: articles to briefs, tools, playbooks, templates and each other. Every internal link in an article body, every `related` slug,
 * `relatedPlaybook` and `relatedTemplate` must be a live route or a published entry, so no article carries a link the build drops.
 */
function articleSeams(ctx) {
  const check = result('articles-to-reference', 'Articles link only to live briefs, tools, playbooks, templates and articles');
  const articles = published(ctx.root, 'insights');
  const slugs = new Set(articles.map((a) => lastSegment(a.id)));
  const playbooks = new Set(published(ctx.root, 'playbooks').map((e) => lastSegment(e.id)));
  const library = new Set(published(ctx.root, 'library').map((e) => lastSegment(e.id)));
  let toBriefs = 0;
  let toTools = 0;
  for (const article of articles) {
    check.examined += 1;
    for (const slug of article.data.related ?? []) {
      if (!slugs.has(slug)) check.findings.push(finding(check, article.file, `related "${slug}" is not a published article`));
    }
    const playbook = article.data.relatedPlaybook;
    if (playbook !== undefined && !playbooks.has(playbook)) check.findings.push(finding(check, article.file, `relatedPlaybook "${playbook}" is not a published playbook`));
    const template = article.data.relatedTemplate;
    if (template !== undefined && !library.has(template)) check.findings.push(finding(check, article.file, `relatedTemplate "${template}" is not a published library entry`));
    for (const link of internalLinks(article.body)) {
      if (link.startsWith('/briefs/')) toBriefs += 1;
      if (link.startsWith('/tools/')) toTools += 1;
      if (!ctx.isReachable(link)) check.findings.push(finding(check, article.file, `link ${link} is not a live route`));
    }
  }
  check.notes.push(`${articles.length} articles; ${toBriefs} links to /briefs/ and ${toTools} links to /tools/ in article bodies`);
  return check;
}

/**
 * Seam 2: playbooks to briefs through the end bands. The closing band a playbook resolves to (primary, secondary, mid-body) must point
 * only at live routes and have a live primary. Whether the band reaches a brief is reported as a note: the default map gives playbooks
 * Apply and the tools hub, and the briefs hub is one step away from /playbooks/.
 */
function playbookSeams(ctx) {
  const check = result('playbooks-to-end-bands', 'Playbook closing bands resolve to live routes');
  const playbooks = published(ctx.root, 'playbooks');
  let reachBrief = 0;
  for (const playbook of playbooks) {
    check.examined += 1;
    const path = entryRoute('playbooks', playbook);
    if (!ctx.isLive(path)) {
      check.findings.push(finding(check, playbook.file, `${path} is not a live route`));
      continue;
    }
    const input = { path, collection: 'playbooks', ...(playbook.data.cta !== undefined ? { frontmatterCta: playbook.data.cta } : {}) };
    const end = resolveCta(input, ctx.isLive);
    if (end === null) {
      check.findings.push(finding(check, playbook.file, 'the end band has no live primary action'));
      continue;
    }
    const mid = resolveMidCta(input, ctx.isLive);
    const hrefs = [end.primary.href, end.secondary?.href, mid?.primary.href].filter((h) => h !== undefined);
    for (const href of hrefs) {
      if (!ctx.isLive(href)) check.findings.push(finding(check, playbook.file, `band target ${href} is not a live route`));
    }
    if (hrefs.some((h) => h.startsWith('/briefs/'))) reachBrief += 1;
    for (const slug of playbook.data.relatedLibrary ?? []) {
      if (!ctx.isLive(`/library/${slug}/`)) check.findings.push(finding(check, playbook.file, `relatedLibrary "${slug}" is not a live library page`));
    }
  }
  check.notes.push(`${playbooks.length} playbooks; ${reachBrief} of them close on a band that names a brief`);
  return check;
}

/** Seam 3: /insights/ to the 14 desks. Every desk has a live topic page and at least one published article; every article sits on a real desk. */
function deskSeams(ctx) {
  const check = result('insights-to-desks', '/insights/ reaches every desk, and every desk has articles');
  const articles = published(ctx.root, 'insights');
  const perDesk = new Map(DESKS.map((id) => [id, 0]));
  if (!ctx.isLive('/insights/')) check.findings.push(finding(check, 'src/pages/insights/index.astro', '/insights/ is not a live route'));
  const index = join(ctx.root, 'src/pages/insights/index.astro');
  if (!existsSync(index) || !/DESK_DEFINITIONS|DESKS|deskPath/.test(readFileSync(index, 'utf8'))) {
    check.findings.push(finding(check, 'src/pages/insights/index.astro', 'the /insights/ page does not derive its desk list from the desk registry'));
  }
  for (const article of articles) {
    const desk = article.data.topic;
    const folder = article.id.split('/')[0];
    if (!perDesk.has(desk)) check.findings.push(finding(check, article.file, `topic "${desk}" is not a desk`));
    else perDesk.set(desk, (perDesk.get(desk) ?? 0) + 1);
    if (folder !== desk) check.findings.push(finding(check, article.file, `sits in the "${folder}" folder but its topic is "${desk}"`));
  }
  for (const id of DESKS) {
    check.examined += 1;
    if (!ctx.isLive(deskPath(id))) check.findings.push(finding(check, 'src/data/desks.ts', `desk "${id}" has no live topic page at ${deskPath(id)}`));
    if ((perDesk.get(id) ?? 0) === 0) check.findings.push(finding(check, 'src/data/desks.ts', `desk "${id}" has no published article`));
  }
  check.notes.push(`${articles.length} articles on ${DESKS.length} desks: ${DESKS.map((id) => `${id} ${perDesk.get(id)}`).join(', ')}`);
  return check;
}

/** Seam 4: the home audience strip. All four doors are live, and the home page renders the strip. */
function audienceSeams(ctx) {
  const check = result('home-audience-strip', 'The home audience strip points at live routes');
  const home = join(ctx.root, 'src/pages/index.astro');
  if (!existsSync(home) || !/HomeAudience/.test(readFileSync(home, 'utf8'))) {
    check.findings.push(finding(check, 'src/pages/index.astro', 'the home page does not render the audience strip'));
  }
  for (const link of AUDIENCE_LINKS) {
    check.examined += 1;
    if (!ctx.isLive(link.href)) check.findings.push(finding(check, 'src/data/cta/audiences.ts', `the "${link.label}" door points at ${link.href}, which is not a live route`));
  }
  return check;
}

/** Seam 5: segment pages to their reading paths. Each segment is live, has a reading path, and names a live brief; no article names an unknown segment. */
function segmentSeams(ctx) {
  const check = result('segments-to-reading-paths', 'Every founder segment page has a reading path and live actions');
  const articles = published(ctx.root, 'insights');
  const pages = new Map(published(ctx.root, 'pages').map((p) => [p.id, p]));
  for (const article of articles) {
    for (const segment of article.data.segments ?? []) {
      if (!SEGMENT_SLUGS.includes(segment)) check.findings.push(finding(check, article.file, `segments names "${segment}", which is not a founder segment`));
    }
  }
  for (const segment of SEGMENTS.entries) {
    if (!segment.launch) {
      check.notes.push(`${segment.slug} is cut (launch: false)`);
      continue;
    }
    check.examined += 1;
    const file = `src/content/pages/founders/${segment.slug}.mdx`;
    if (!ctx.isLive(segment.path)) {
      check.findings.push(finding(check, file, `${segment.path} is not a live route`));
      continue;
    }
    const reading = articles.filter((a) => (a.data.segments ?? []).includes(segment.slug));
    for (const article of reading) {
      if (!ctx.isLive(entryRoute('insights', article))) check.findings.push(finding(check, article.file, `reading path of ${segment.slug} lists ${entryRoute('insights', article)}, which is not live`));
    }
    if (reading.length === 0) check.findings.push(finding(check, file, `no published article lists "${segment.slug}" in its segments, so the reading path is empty`));
    const brief = pages.get(`founders/${segment.slug}`)?.data.cta?.briefId;
    if (brief !== undefined && !ctx.isLive(`/briefs/${brief}/`)) check.findings.push(finding(check, file, `cta.briefId "${brief}" is not a live brief`));
    check.notes.push(`${segment.slug}: ${reading.length} articles`);
  }
  return check;
}

/** Seam 6: the briefs hub and its eleven squeeze pages exist for every launched registry entry, and each brief maps to live desks. */
function briefSeams(ctx) {
  const check = result('briefs-to-desks', 'Every launched brief has a live page and live desks');
  const liveEntries = new Set(published(ctx.root, 'briefs').map((b) => b.id));
  if (!ctx.isLive('/briefs/')) check.findings.push(finding(check, 'src/pages/briefs/index.astro', '/briefs/ is not a live route'));
  for (const brief of BRIEFS.entries) {
    if (!brief.launch) continue;
    check.examined += 1;
    if (!liveEntries.has(brief.slug)) check.findings.push(finding(check, `src/content/briefs/${brief.slug}.md`, 'no published brief file for a launched registry entry'));
    if (!ctx.isLive(brief.path)) check.findings.push(finding(check, 'src/data/families.ts', `${brief.path} is not a live route`));
    for (const desk of brief.desks) {
      if (!ctx.isLive(deskPath(desk))) check.findings.push(finding(check, 'src/data/families.ts', `brief ${brief.slug} names desk "${desk}", which has no live page`));
    }
  }
  return check;
}

/**
 * Runs every seam check against the repository at `root`.
 * @returns {{ root: string, ok: boolean, checks: CheckResult[], findings: Finding[] }}
 */
export function checkSeams(root = process.cwd()) {
  const state = computeRouteState(routeContextFromDisk(root));
  const publicFiles = (path) => existsSync(join(root, 'public', path));
  const ctx = {
    root,
    isLive: (path) => state.isLive(path),
    // A link in a body may also name a static file under public/ or a launched machine route (both are in `live`).
    isReachable: (path) => state.isLive(path) || (/\.[a-z0-9]+$/i.test(path) && publicFiles(path.slice(1))),
  };
  const checks = [articleSeams(ctx), playbookSeams(ctx), deskSeams(ctx), audienceSeams(ctx), segmentSeams(ctx), briefSeams(ctx)];
  const findings = checks.flatMap((c) => c.findings);
  return { root, ok: findings.length === 0, checks, findings };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2);
  const arg = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
  const root = arg('--root', process.cwd());
  const out = arg('--json', undefined);
  const report = checkSeams(root);
  for (const check of report.checks) {
    console.log(`${check.findings.length === 0 ? 'ok  ' : 'FAIL'} ${check.id}: ${check.title} (${check.examined} examined)`);
    for (const note of check.notes) console.log(`       ${note}`);
    for (const f of check.findings) console.error(`FAIL  ${f.file}: ${f.message}`);
  }
  if (out !== undefined) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(report.ok ? 'seams: every cross-package seam resolves' : `seams: ${report.findings.length} dead seams`);
  process.exit(report.ok ? 0 : 1);
}
