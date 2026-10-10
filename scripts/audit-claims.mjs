#!/usr/bin/env node
// Scans built output for claims the ladder forbids and for text that must be present
// (claims-denylist.json). Visible text, alt text, meta tags and JSON-LD are checked in .html and .xml files; .txt and .md files
// (robots.txt, llms.txt, llms-full.txt and the Markdown twins, wave 7) are scanned as plain text with link addresses removed.
//
// Four kinds of rule, all in claims-denylist.json:
//   rules / contextRules  Wording that must not appear. A context rule may be switched off by a flag
//                         (disabledByFlag), skipped on named routes (allowPaths), skipped inside elements
//                         marked data-claim-allow="<rule id>" or "*" (markerAllowed), or skipped inside
//                         data-generic-definition elements (genericDefinitionAllowed, SAFE terms only).
//   required              Text that must be visible on the listed routes, or on every page ("*"), optionally
//                         only when the photo manifest has a generated image (when: "generatedImages") or only
//                         on pages whose <main> text matches a pattern (whenMatches, with whenFlags, default "i").
//                         A rule with "ifBuilt": true skips a listed route that is not built, so a wave 7 page can be
//                         required before it exists and is held to the rule from the day it is built.
//   manifestRules        Checks on src/assets/photo/manifest.json, for example alt text of generated images.
//
// Usage: node scripts/audit-claims.mjs [dist-dir] [--manifest <file>] [--denylist <file>] | --self-test
// Dependency-free on purpose: the CI audit job runs it without npm ci. It reads src/data/flags.ts through
// Node's built-in type stripping, as scripts/audit-contrast.mjs does for src/lib/contrast.ts.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { flags as siteFlags } from '../src/data/flags.ts';

export const DEFAULT_DENYLIST = new URL('../claims-denylist.json', import.meta.url);
export const DEFAULT_MANIFEST = new URL('../src/assets/photo/manifest.json', import.meta.url);

/** The only values `when` may take in a required rule. */
const WHEN_CONDITIONS = new Set(['generatedImages']);
const VOID_ELEMENTS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', mdash: '—', ndash: '–', hellip: '…' };

function fail(message) {
  throw new Error(`claims-denylist: ${message}`);
}

function ensureString(value, where) {
  if (typeof value !== 'string' || value === '') fail(`${where} must be a non-empty string`);
  return value;
}

/** Adds the global flag without duplicating it. */
function globalFlags(flags) {
  return [...new Set(`${flags ?? ''}g`)].join('');
}

function compileRegex(pattern, flags, where) {
  try {
    return new RegExp(pattern, flags);
  } catch (error) {
    return fail(`${where} has an invalid pattern: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Validates and compiles one scan rule (rules and contextRules share a shape). */
export function compileRule(rule) {
  const id = ensureString(rule?.id, 'a rule id');
  const where = `rule ${id}`;
  ensureString(rule.pattern, `${where} pattern`);
  const allowPaths = rule.allowPaths ?? [];
  if (!Array.isArray(allowPaths)) fail(`${where} allowPaths must be an array`);
  return {
    ...rule,
    regex: compileRegex(rule.pattern, globalFlags(rule.flags), where),
    allow: allowPaths.map((p) => compileRegex(ensureString(p, `${where} allowPaths entry`), '', where)),
  };
}

function compileRequired(rule) {
  const id = ensureString(rule?.id, 'a required rule id');
  const where = `required rule ${id}`;
  ensureString(rule.text, `${where} text`);
  if (rule.routes !== '*' && !(Array.isArray(rule.routes) && rule.routes.length > 0 && rule.routes.every((r) => typeof r === 'string' && r.startsWith('/')))) {
    fail(`${where} routes must be "*" or a non-empty array of routes that start with "/"`);
  }
  if (rule.when !== undefined && !WHEN_CONDITIONS.has(rule.when)) fail(`${where} has an unknown "when": ${String(rule.when)}`);
  if (rule.ifBuilt !== undefined && typeof rule.ifBuilt !== 'boolean') fail(`${where} ifBuilt must be a boolean`);
  if (rule.ifBuilt === true && rule.routes === '*') fail(`${where} ifBuilt applies to a list of routes, not "*"`);
  if (rule.whenMatches === undefined) return rule;
  ensureString(rule.whenMatches, `${where} whenMatches`);
  return { ...rule, trigger: compileRegex(rule.whenMatches, (rule.whenFlags ?? 'i').replace(/[gy]/g, ''), where) };
}

function compileManifestRule(rule) {
  const id = ensureString(rule?.id, 'a manifest rule id');
  const where = `manifest rule ${id}`;
  ensureString(rule.pattern, `${where} pattern`);
  return { ...rule, field: rule.field ?? 'alt', appliesTo: rule.appliesTo ?? {}, regex: compileRegex(rule.pattern, (rule.flags ?? '').replace(/g/g, ''), where) };
}

/** Parses a denylist document into compiled rule sets. Throws a descriptive Error on a malformed rule. */
export function parseDenylist(document) {
  const list = (key) => {
    const value = document[key] ?? [];
    if (!Array.isArray(value)) fail(`"${key}" must be an array`);
    return value;
  };
  const rules = list('rules').map(compileRule);
  const contextRules = list('contextRules').map(compileRule);
  const required = list('required').map(compileRequired);
  const manifestRules = list('manifestRules').map(compileManifestRule);
  const ids = [...rules, ...contextRules, ...required, ...manifestRules].map((r) => r.id);
  const duplicate = ids.find((id, i) => ids.indexOf(id) !== i);
  if (duplicate !== undefined) fail(`rule id ${duplicate} is used twice`);
  return { rules, contextRules, scanRules: [...rules, ...contextRules], required, manifestRules };
}

export function loadDenylist(source = DEFAULT_DENYLIST) {
  return parseDenylist(JSON.parse(readFileSync(source, 'utf8')));
}

/** True when the named flag is on. Accepts a dotted path such as "seatPrice.published". */
export function flagIsOn(flagValues, name) {
  const value = name.split('.').reduce((node, key) => (node !== null && typeof node === 'object' ? node[key] : undefined), flagValues);
  return value === true;
}

/** Route of a built file, relative to the dist directory: "a/b/index.html" is "/a/b/", "404.html" is "/404.html". */
export function routeOf(relativePath) {
  const path = relativePath.split(sep).join('/');
  if (path === 'index.html') return '/';
  if (path.endsWith('/index.html')) return `/${path.slice(0, -'index.html'.length)}`;
  return `/${path}`;
}

/**
 * Route that a built text file stands for. A Markdown twin (insights/x.md) stands for its page (/insights/x/), so a rule that is
 * allowed on a page is allowed on its twin; index.md is the home page. Other files (llms.txt, robots.txt) are their own route.
 */
export function textRouteOf(relativePath) {
  const path = relativePath.split(sep).join('/');
  if (path === 'index.md') return '/';
  if (path.endsWith('.md') && !path.startsWith('library/')) return `/${path.slice(0, -'.md'.length)}/`;
  return `/${path}`;
}

/** Reduces a plain-text or Markdown file to its words: link addresses and bare URLs go, because a slug is not copy. */
export function plainText(text) {
  return text
    .replace(/\]\([^)\s]*(?:\s+"[^"]*")?\)/g, ']')
    .replace(/<?\bhttps?:\/\/[^\s<>)\]]+>?/gi, ' ')
    .replace(/\s+/g, ' ');
}

export function decodeEntities(text) {
  return text.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (whole, dec, hex, name) => {
    if (dec !== undefined || hex !== undefined) {
      const code = dec !== undefined ? Number.parseInt(dec, 10) : Number.parseInt(hex, 16);
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[name.toLowerCase()] ?? whole;
  });
}

/**
 * Removes every element whose opening tag satisfies `matches`, with its content. A void element loses only
 * its tag. The spliced gap is a space so the words either side do not run together.
 */
export function stripElements(html, matches) {
  let out = html;
  const open = /<([a-z][a-z0-9-]*)\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
  let from = 0;
  for (;;) {
    open.lastIndex = from;
    const m = open.exec(out);
    if (m === null) break;
    if (!matches(m[0])) {
      from = m.index + m[0].length;
      continue;
    }
    const tag = m[1].toLowerCase();
    let end = m.index + m[0].length;
    if (!VOID_ELEMENTS.has(tag) && !m[0].endsWith('/>')) {
      const tokens = new RegExp(`<(/?)${tag}\\b(?:"[^"]*"|'[^']*'|[^'">])*>`, 'gi');
      tokens.lastIndex = m.index;
      let depth = 0;
      end = out.length;
      for (let t = tokens.exec(out); t !== null; t = tokens.exec(out)) {
        if (t[0].endsWith('/>')) continue;
        depth += t[1] === '/' ? -1 : 1;
        if (depth === 0) {
          end = t.index + t[0].length;
          break;
        }
      }
    }
    out = `${out.slice(0, m.index)} ${out.slice(end)}`;
    from = m.index;
  }
  return out;
}

/** Removes whole elements that carry the data-generic-definition attribute. */
export function stripGenericDefinitions(html) {
  if (!/data-generic-definition/i.test(html)) return html;
  return stripElements(html, (tag) => /\bdata-generic-definition\b/i.test(tag));
}

const CLAIM_ALLOW = /\bdata-claim-allow\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;

/** Removes elements marked data-claim-allow with this rule id, or with "*". The value is a list separated by spaces or commas. */
export function stripClaimAllowed(html, ruleId) {
  if (!/data-claim-allow/i.test(html)) return html;
  return stripElements(html, (tag) => {
    const m = CLAIM_ALLOW.exec(tag);
    if (m === null) return false;
    const tokens = (m[1] ?? m[2] ?? m[3] ?? '').split(/[\s,]+/).filter(Boolean);
    return tokens.includes('*') || tokens.includes(ruleId);
  });
}

/** Reduces markup to the strings a reader or crawler can see. */
export function visibleText(html) {
  const jsonLd = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const attrs = [...html.matchAll(/\b(?:alt|content|aria-label|title)="([^"]*)"/gi)].map((m) => m[1]);
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities([body, ...attrs, ...jsonLd].join('\n')).replace(/\s+/g, ' ');
}

/** The text a reader sees on the page: no attributes, no scripts, no JSON-LD. Used by the required-text check. */
export function bodyText(html) {
  const body = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(body).replace(/\s+/g, ' ').trim();
}

/** The text inside <main> (the page body when there is no <main>). Navigation and footer text never counts. */
export function mainText(html) {
  const m = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html);
  return bodyText(m === null ? html : m[1]);
}

function comparable(text) {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function snippet(text, index, length) {
  return text.slice(Math.max(0, index - 40), index + length + 40).trim();
}

const DEFAULT_SET = loadDenylist();

/**
 * Scans one page. Options: `route` (default "/"), `rules` (compiled rules, default every scan rule in
 * claims-denylist.json), `flagValues` (default the real flags) and `plain` (true for a .txt or .md file: there is no markup to strip
 * and no data-claim-allow marker to honor). Returns one hit per rule at most.
 */
export function scan(html, options = {}) {
  const route = options.route ?? '/';
  const rules = options.rules ?? DEFAULT_SET.scanRules;
  const flagValues = options.flagValues ?? siteFlags;
  const hits = [];
  let strict;
  let relaxed;
  const plain = options.plain === true ? plainText(html) : null;
  for (const rule of rules) {
    if (typeof rule.disabledByFlag === 'string' && flagIsOn(flagValues, rule.disabledByFlag)) continue;
    if (rule.allow.some((re) => re.test(route))) continue;
    if (plain !== null) {
      rule.regex.lastIndex = 0;
      const found = rule.regex.exec(plain);
      if (found) hits.push({ rule: rule.id, claim: rule.claim, match: found[0], context: snippet(plain, found.index, found[0].length) });
      continue;
    }
    let source = html;
    if (rule.genericDefinitionAllowed) {
      relaxed ??= stripGenericDefinitions(html);
      source = relaxed;
    }
    if (rule.markerAllowed) source = stripClaimAllowed(source, rule.id);
    let text;
    if (source === html) {
      strict ??= visibleText(html);
      text = strict;
    } else text = visibleText(source);
    rule.regex.lastIndex = 0;
    const m = rule.regex.exec(text);
    if (m) hits.push({ rule: rule.id, claim: rule.claim, match: m[0], context: snippet(text, m.index, m[0].length) });
  }
  return hits;
}

/** True when any slot in the photo manifest is image-model output. Mirrors src/lib/photo-disclosure.ts. */
export function hasGeneratedImages(manifest) {
  return Array.isArray(manifest?.slots) && manifest.slots.some((slot) => slot?.source === 'generated');
}

/**
 * Checks the required-text rules. `pages` is [{ route, html, isHtml, plain }]; `options.generatedImages` says whether the
 * photo manifest has a generated image. Returns findings, one per page and rule that lacks the text.
 */
export function checkRequired(pages, required, options = {}) {
  const findings = [];
  const htmlPages = pages.filter((p) => p.isHtml !== false);
  for (const rule of required) {
    if (rule.when === 'generatedImages' && options.generatedImages !== true) continue;
    const needle = comparable(rule.text);
    // A listed route may be a built text file (/llms.txt); a Markdown twin never shadows the page of the same route.
    const find = (route) => htmlPages.find((p) => p.route === route) ?? pages.find((p) => p.route === route && p.plain === true) ?? { route, missing: true };
    const targets = rule.routes === '*' ? htmlPages : rule.routes.map(find);
    for (const page of targets) {
      if (rule.trigger !== undefined) {
        // A conditional rule judges the <main> text only: the trigger and the required text must both be in the content.
        if (page.missing === true) continue;
        const main = mainText(page.html);
        rule.trigger.lastIndex = 0;
        if (!rule.trigger.test(main)) continue;
        if (!comparable(main).includes(needle)) {
          findings.push({ rule: rule.id, claim: rule.claim, route: page.route, message: `this page names "${rule.whenMatches}" but its main content lacks the required text: "${rule.text}"` });
        }
      } else if (page.missing === true) {
        if (rule.ifBuilt === true) continue;
        findings.push({ rule: rule.id, claim: rule.claim, route: page.route, message: `required route ${page.route} was not built, so "${rule.text}" cannot be shown there` });
      } else if (!comparable(bodyText(page.html)).includes(needle)) {
        findings.push({ rule: rule.id, claim: rule.claim, route: page.route, message: `required text is missing: "${rule.text}"` });
      }
    }
  }
  return findings;
}

/** Applies the manifest rules to the slots they select. Returns findings, one per slot and rule. */
export function checkManifest(manifest, manifestRules) {
  const findings = [];
  const slots = Array.isArray(manifest?.slots) ? manifest.slots : [];
  for (const rule of manifestRules) {
    for (const slot of slots) {
      if (!Object.entries(rule.appliesTo).every(([key, value]) => slot?.[key] === value)) continue;
      const value = slot[rule.field];
      if (typeof value !== 'string' || value.trim() === '') {
        findings.push({ rule: rule.id, claim: rule.claim, slot: slot.id, message: `slot ${slot.id} has no ${rule.field}` });
        continue;
      }
      const m = rule.regex.exec(value);
      if (m) findings.push({ rule: rule.id, claim: rule.claim, slot: slot.id, message: `slot ${slot.id} ${rule.field} matched "${m[0]}": ${value}` });
    }
  }
  return findings;
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== 'pagefind' && name !== '_astro') yield* walk(p);
    } else if (/\.(html|xml|txt|md)$/.test(name)) yield p;
  }
}

/**
 * Audits a built site. Returns { files, findings } where each finding has a `where` and a `message`.
 * Reads the files itself so a test can point it at a small temporary dist.
 */
export function auditDist(dist, options = {}) {
  const set = options.set ?? DEFAULT_SET;
  const manifest = options.manifest ?? JSON.parse(readFileSync(DEFAULT_MANIFEST, 'utf8'));
  const files = [...walk(dist)];
  const pages = files.map((file) => {
    const rel = relative(dist, file);
    const plain = file.endsWith('.txt') || file.endsWith('.md');
    return { file, route: plain ? textRouteOf(rel) : routeOf(rel), html: readFileSync(file, 'utf8'), isHtml: file.endsWith('.html'), plain };
  });
  const findings = [];
  for (const page of pages) {
    for (const hit of scan(page.html, { route: page.route, rules: set.scanRules, flagValues: options.flagValues, plain: page.plain })) {
      findings.push({ where: page.file, rule: hit.rule, message: `${hit.rule} (${hit.claim}) matched "${hit.match}" in: ${hit.context}` });
    }
  }
  const generatedImages = hasGeneratedImages(manifest);
  for (const f of checkRequired(pages, set.required, { generatedImages })) {
    findings.push({ where: f.route, rule: f.rule, message: `${f.rule} (${f.claim}) ${f.message}` });
  }
  for (const f of checkManifest(manifest, set.manifestRules)) {
    findings.push({ where: 'src/assets/photo/manifest.json', rule: f.rule, message: `${f.rule} (${f.claim}) ${f.message}` });
  }
  return { files: files.length, findings };
}

function selfTest() {
  const set = DEFAULT_SET;
  const off = {};
  const pbcOn = { pbcWording: true };
  const photoLine = set.required.find((r) => r.id === 'R-photo-disclosure')?.text ?? '';
  const disclaimer = set.required.find((r) => r.id === 'R-C05-no-funding-disclaimer');
  const introDisclaimer = set.required.find((r) => r.id === 'R-C14-intro-disclaimer')?.text ?? '';
  const hit = (html, route = '/', flagValues = off) => scan(html, { route, flagValues }).map((h) => h.rule);
  const missing = (route, html, generatedImages) =>
    checkRequired([{ route, html, isHtml: true }], set.required, { generatedImages })
      .filter((f) => f.route === route)
      .map((f) => f.rule);
  const seeded = [
    ['a priced seat is caught', () => hit('<p>Seats from $49 per seat</p>').includes('C-06-currency-per-seat')],
    ['a success fee is caught', () => hit('<p>There is no success fee.</p>').includes('C-08-success-fee')],
    ['a SAFE term is caught outside a definition', () => hit('<p>Investors may get a valuation cap.</p>').includes('C-08-valuation-cap')],
    ['a SAFE term inside a definition is allowed', () => !hit('<dl data-generic-definition><dt>Term</dt><dd>A valuation cap limits conversion price.</dd></dl>').includes('C-08-valuation-cap')],
    ['seeded text in alt is caught', () => hit('<img alt="$99 per seat" src="x">').includes('C-06-currency-per-seat')],
    ['clean copy passes', () => hit('<p>Dedicated team seats, steered by WE.</p>').length === 0],
    ['PBC wording is caught while the flag is off', () => hit('<p>A public benefit corporation.</p>').includes('C-18-pbc')],
    ['PBC wording passes once the flag is on', () => !hit('<p>A public benefit corporation.</p>', '/', pbcOn).includes('C-18-pbc')],
    ['"fundable company" as an outcome is caught', () => hit('<p>From idea to a fundable company.</p>').includes('C-05-fundable-outcome')],
    ['a peer-sessions claim is caught', () => hit('<p>Join peer sessions.</p>', '/services/digital-incubation/').includes('C-13-peers')],
    ['the FAQ path may name an accelerator', () => !hit('<p>Is WE an accelerator?</p>', '/faq/').includes('C-13-peers')],
    ['a marked element may name a cohort', () => !hit('<p>WE has <span data-claim-allow="C-13-peers">no cohort</span>.</p>').includes('C-13-peers')],
    ['a marker for another rule does not help', () => hit('<p><span data-claim-allow="C-21-phrase">a cohort</span></p>').includes('C-13-peers')],
    ['first-person peer wording is caught', () => hit('<p>Our mentors review every plan.</p>').includes('W8-C13-own-peers') && hit('<p>WE runs a cohort twice a year.</p>').includes('W8-C13-own-peers')],
    ['a marker cannot exempt first-person peer wording, and the FAQ path is not exempt', () => hit('<p><span data-claim-allow="*">Our cohort starts soon.</span></p>').includes('W8-C13-own-peers') && hit('<p>Our cohort starts soon.</p>', '/faq/').includes('W8-C13-own-peers')],
    ['a denial of peers is not first-person peer wording', () => !hit('<p>WE has no mentors and runs no cohort.</p>').includes('W8-C13-own-peers')],
    ['the C-21 phrase is allowed on the dedicated-teams page only', () => !hit('<h2>Two companies, one objective</h2>', '/program/dedicated-teams/').includes('C-21-phrase') && hit('<h2>Two companies, one objective</h2>', '/pricing/').includes('C-21-phrase')],
    ['UK spelling is caught', () => hit('<p>A programme for your organisation.</p>').includes('Q-spelling')],
    ['a missing disclaimer is caught', () => disclaimer !== undefined && missing('/pricing/', '<main><p>Pricing.</p></main>', false).includes('R-C05-no-funding-disclaimer')],
    ['a present disclaimer passes', () => !missing('/pricing/', '<main><p>WE makes no promise of funding. This helps.</p></main>', false).includes('R-C05-no-funding-disclaimer')],
    ['the photo line is not required without a generated image', () => !missing('/about/', '<footer>none</footer>', false).includes('R-photo-disclosure')],
    ['the photo line is required with a generated image', () => missing('/about/', '<footer>none</footer>', true).includes('R-photo-disclosure')],
    ['the photo line passes when present', () => !missing('/about/', `<footer><p>${photoLine}</p></footer>`, true).includes('R-photo-disclosure')],
    ['a guaranteed-meetings claim is caught', () => hit('<p>WE guarantees introductions to investors.</p>').includes('C-14-guaranteed-meetings')],
    ['a negated meetings promise passes', () => !hit('<p>WE cannot promise a meeting or funding.</p>').includes('C-14-guaranteed-meetings')],
    ['a success-based introduction fee is caught', () => hit('<p>A finder\'s fee is due when the round closes.</p>').includes('C-14-success-based')],
    ['the verbatim introductions disclaimer passes every rule', () => hit(`<p>${introDisclaimer}</p>`).length === 0],
    ['an investor network claim is caught', () => hit('<p>Join our investor network.</p>').includes('C-14-investor-network')],
    ['a page that names Investor Introductions without the disclaimer is caught', () => missing('/insights/x/', '<main><p>Investor Introductions is an add-on.</p></main>', false).includes('R-C14-intro-disclaimer-wherever-named')],
    ['a page that names Investor Introductions with the disclaimer passes', () => !missing('/insights/x/', `<main><p>Investor Introductions is an add-on.</p><p>${introDisclaimer}</p></main>`, false).includes('R-C14-intro-disclaimer-wherever-named')],
    ['a mention outside <main> does not trigger the disclaimer rule', () => !missing('/about/', '<nav>Investor Introductions</nav><main><p>About.</p></main>', false).includes('R-C14-intro-disclaimer-wherever-named')],
    ['a "no fee" claim is caught', () => hit('<p>There is no fee to apply.</p>').includes('W7-C09-no-fee')],
    ['"no fee or stake tied to any investment" is not a no-fee claim', () => !hit('<p>WE takes no fee or stake tied to any investment.</p>').includes('W7-C09-no-fee')],
    ['a no-equity claim is caught', () => hit('<p>We take no equity, so it is non-dilutive.</p>').includes('W7-C09-no-equity')],
    ['the verbatim disclaimer is not a no-equity claim', () => !hit(`<p>${introDisclaimer}</p>`).includes('W7-C09-no-equity')],
    ['a free-of-charge claim is caught', () => hit('<p>The first call is free of charge.</p>').includes('W7-C09-free-of-charge')],
    ['a response-time promise is caught', () => hit('<p>We reply within 24 hours.</p>').includes('W7-response-time') && hit('<p>Expect an answer within two business days.</p>').includes('W7-response-time')],
    ['a window that is not a response time passes', () => !hit('<p>Complete the sketch within one session.</p>').includes('W7-response-time')],
    ['advice to a founder about their own response time passes', () => !hit('<p>Choose a response expectation you can meet, such as “within one working day”.</p>').includes('W7-response-time')],
    ['"costs nothing" as a general remark passes', () => !hit('<p>Praise costs nothing. It contains no cost figures.</p>').includes('W7-C09-free-of-charge')],
    ['an application count is caught', () => hit('<p>We reviewed 1,200 applications.</p>').includes('W7-application-counts') && hit('<p>Our acceptance rate is low.</p>').includes('W7-application-counts')],
    ['a seat count tied to a package is caught', () => hit('<p>Launch includes 3 seats.</p>').includes('W7-package-seat-count') && hit('<p>Two seats in Studio.</p>').includes('W7-package-seat-count')],
    ['a package name beside seats without a count passes', () => !hit('<p>Studio is an embedded team. Seats are the unit of work.</p>').includes('W7-package-seat-count')],
    ['a plain-text file is scanned', () => scan('Pricing: no fee to apply.', { route: '/llms.txt', plain: true }).map((h) => h.rule).includes('W7-C09-no-fee')],
    ['a link address in a Markdown twin is not copy', () => scan('[Free of charge](https://example.org/no-fee/) page', { route: '/x/', plain: true, rules: set.scanRules }).map((h) => h.rule).includes('W7-C09-no-fee') === false],
    ['the verbatim disclaimer passes in plain text', () => scan(introDisclaimer, { route: '/llms.txt', plain: true }).length === 0],
    ['a marker cannot exempt a plain-text file', () => scan('<span data-claim-allow="*">no fee</span>', { route: '/llms.txt', plain: true }).map((h) => h.rule).includes('W7-C09-no-fee')],
    ['an ifBuilt rule skips a route that is not built', () => checkRequired([], set.required.filter((r) => r.id === 'R-W7-C05-no-funding-disclaimer'), {}).length === 0],
    ['an ifBuilt rule holds a built text file to the text', () => checkRequired([{ route: '/llms.txt', html: 'WE offers a lot.', isHtml: false, plain: true }], set.required.filter((r) => r.id === 'R-W7-C05-no-funding-disclaimer'), {}).length === 1],
    ['an ifBuilt rule passes a text file that has the text', () => checkRequired([{ route: '/llms.txt', html: 'WE makes no promise of funding.', isHtml: false, plain: true }], set.required.filter((r) => r.id === 'R-W7-C05-no-funding-disclaimer'), {}).length === 0],
    [
      'a Markdown twin does not stand in for its page in a required text',
      () => {
        const pages = [
          { route: '/pricing/', html: '<main><p>Pricing.</p></main>', isHtml: true },
          { route: '/pricing/', html: 'WE makes no promise of funding.', isHtml: false, plain: true },
        ];
        return checkRequired(pages, set.required.filter((r) => r.id === 'R-C05-no-funding-disclaimer'), {}).some((f) => f.route === '/pricing/');
      },
    ],
    ['a Markdown twin stands for its page route', () => textRouteOf('insights/x.md') === '/insights/x/' && textRouteOf('index.md') === '/' && textRouteOf('llms.txt') === '/llms.txt'],
    ['an identity word in a generated image alt is caught', () => checkManifest({ slots: [{ id: 'x', source: 'generated', alt: 'A founder at a desk' }] }, set.manifestRules).length === 1],
    ['an activity alt on a generated image passes', () => checkManifest({ slots: [{ id: 'x', source: 'generated', alt: 'Two hands arranging index cards on a desk' }] }, set.manifestRules).length === 0],
  ];
  let failed = 0;
  for (const [label, run] of seeded) {
    if (run() !== true) {
      failed += 1;
      console.error(`self-test FAIL: ${label}`);
    } else console.log(`self-test ok: ${label}`);
  }
  process.exit(failed === 0 ? 0 : 1);
}

function parseCli(argv) {
  const cli = { dist: 'dist', manifest: DEFAULT_MANIFEST, denylist: DEFAULT_DENYLIST, selfTest: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--self-test') cli.selfTest = true;
    else if (arg === '--manifest' || arg === '--denylist') {
      const value = argv[i + 1];
      if (value === undefined) throw new Error(`${arg} needs a file path`);
      cli[arg.slice(2)] = value;
      i += 1;
    } else if (arg.startsWith('--')) throw new Error(`unknown option ${arg}`);
    else cli.dist = arg;
  }
  return cli;
}

function main() {
  let cli;
  try {
    cli = parseCli(process.argv.slice(2));
  } catch (error) {
    console.error(`audit-claims: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }
  if (cli.selfTest) selfTest();
  let result;
  try {
    const set = loadDenylist(cli.denylist);
    const manifest = JSON.parse(readFileSync(cli.manifest, 'utf8'));
    result = auditDist(cli.dist, { set, manifest });
  } catch (error) {
    console.error(`audit-claims: cannot audit ${cli.dist}: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }
  for (const finding of result.findings) console.error(`FAIL  ${finding.where}: ${finding.message}`);
  console.log(`audit-claims: ${result.files} files scanned, ${result.findings.length} findings`);
  process.exit(result.findings.length === 0 ? 0 : 1);
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) main();
