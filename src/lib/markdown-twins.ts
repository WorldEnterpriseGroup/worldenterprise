import { site } from '../data/site.ts';
import { buildAbsolute } from './url-core.ts';

/**
 * Markdown twins (docs/wave7-contracts.md, section 2). A twin is the same text as a page, as plain Markdown, for crawlers and
 * answer engines. This module is pure, free of Astro globals, so `node --test` loads it. Choosing which entries have a twin
 * (collections, route state) happens in src/components/geo/twin-sources.ts, which feeds the builders here.
 *
 * Rules a twin keeps:
 * - the first heading equals the page H1, and the canonical URL is the page's;
 * - the body is plain Markdown: no imports, no JSX, no raw HTML, no expressions (lintMarkdown fails otherwise, and the
 *   entry gets no twin rather than a broken one);
 * - a statement the denylist requires on the page route (the no-funding sentence, the Introductions disclaimer) is repeated
 *   at the end, because on the page it can come from a component that a twin never renders.
 */

/** The twin URL path of a page route: /insights/x/ is /insights/x.md, / is /index.md. */
export function twinPath(route: string): string {
  if (route === '/') return '/index.md';
  return `${route.replace(/\/+$/, '')}.md`;
}

/** The page route that a twin path stands for, or null when the path is not a twin path. */
export function routeOfTwin(path: string): string | null {
  if (!path.endsWith('.md')) return null;
  const stem = path.slice(0, -'.md'.length);
  if (stem === '/index' || stem === 'index') return '/';
  const trimmed = stem.replace(/^\/+/, '');
  return trimmed === '' ? null : `/${trimmed}/`;
}

/** The absolute URL of a twin. */
export function twinUrl(route: string): string {
  return buildAbsolute(twinPath(route), site.origin);
}

/** The `[...path]` parameter that produces a twin: insights/x for /insights/x.md. */
export function twinParam(route: string): string {
  return twinPath(route).replace(/^\//, '').replace(/\.md$/, '');
}

/** Removes a leading YAML frontmatter block, if any. */
export function stripFrontmatter(raw: string): string {
  return raw.replace(/^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

/** Replaces fenced and inline code with blanks, so code samples may hold braces and angle brackets. */
function withoutCode(markdown: string): string {
  return markdown.replace(/^(```|~~~)[\s\S]*?^\1[^\n]*$/gm, '').replace(/`[^`\n]*`/g, '');
}

/**
 * The JSX-leak lint. Returns one message per problem; an empty list means the text is plain Markdown. It rejects frontmatter
 * left in the text, import and export statements, any HTML or JSX tag or comment, and any brace (a JSX or MDX expression).
 * Autolinks such as <https://example.org> are Markdown and pass.
 */
export function lintMarkdown(markdown: string): readonly string[] {
  const problems: string[] = [];
  if (/^﻿?---\r?\n/.test(markdown)) problems.push('frontmatter remains in the text');
  const text = withoutCode(markdown);
  if (/^\s*(?:import|export)\s/m.test(text)) problems.push('an import or export statement remains');
  const tag = /<\/?[A-Za-z][\w.:-]*(?:\s[^<>]*)?\/?>/.exec(text);
  if (tag !== null) problems.push(`a tag remains: ${tag[0].slice(0, 60)}`);
  if (/<!--/.test(text)) problems.push('an HTML or MDX comment remains');
  const brace = /[{}]/.exec(text);
  if (brace !== null) problems.push('a brace remains, which marks an unresolved expression');
  return problems;
}

/** True when the text is plain Markdown. */
export function isPlainMarkdown(markdown: string): boolean {
  return lintMarkdown(markdown).length === 0;
}

/** Rewrites root-relative Markdown links to absolute production URLs, so a twin read outside the site still resolves. */
export function absolutizeLinks(markdown: string): string {
  return markdown.replace(/\]\((\/(?!\/)[^)\s]*)((?:\s+"[^"]*")?)\)/g, (_all, path: string, title: string) => `](${buildAbsolute(path, site.origin)}${title})`);
}

/** The fields of a required-text rule that a twin needs (claims-denylist.json, `required`). */
export interface RequiredRuleLike {
  readonly text: string;
  readonly routes: readonly string[] | '*';
  readonly whenMatches?: string;
  readonly when?: string;
}

/**
 * The statements a twin of `route` must repeat: every required text whose route list names the route, plus the texts that a rule
 * asks for on any page whose content matches its trigger (the Introductions disclaimer wherever the add-on is named).
 * Order and duplicates follow the first appearance in the rules.
 */
export function requiredStatements(route: string, body: string, rules: readonly RequiredRuleLike[]): readonly string[] {
  const found: string[] = [];
  for (const rule of rules) {
    if (rule.when !== undefined) continue;
    const named = rule.routes !== '*' && rule.routes.includes(route);
    const triggered = rule.routes === '*' && rule.whenMatches !== undefined && new RegExp(rule.whenMatches, 'i').test(body);
    if ((named || triggered) && !found.includes(rule.text) && !body.includes(rule.text)) found.push(rule.text);
  }
  return found;
}

export interface TwinSource {
  /** Page route with a trailing slash, for example /insights/x/. */
  readonly route: string;
  /** The page H1, verbatim. */
  readonly title: string;
  /** The line under the H1, if the page has one. */
  readonly lead?: string | undefined;
  readonly updated?: Date | undefined;
  /** Plain Markdown. Headings start at level two. */
  readonly body: string;
  /** Statements to repeat at the end (see requiredStatements). */
  readonly statements?: readonly string[] | undefined;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Renders a twin: the H1, the lead, the canonical URL, the update date, the body and the repeated statements. */
export function renderTwin(source: TwinSource): string {
  const lines: string[] = [`# ${source.title}`, ''];
  if (source.lead !== undefined && source.lead !== '') lines.push(source.lead, '');
  lines.push(`Canonical URL: ${buildAbsolute(source.route, site.origin)}`);
  if (source.updated !== undefined) lines.push(`Last updated: ${isoDay(source.updated)}`);
  lines.push(`Publisher: ${site.name}, run by ${site.legalName}`, '');
  lines.push(absolutizeLinks(source.body.trim()), '');
  const statements = source.statements ?? [];
  if (statements.length > 0) {
    lines.push('## Statements that apply to this page', '', ...statements.flatMap((s) => [s, '']));
  }
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}

/** Everything a caller needs to judge a rendered twin: the text, and the lint result. */
export interface RenderedTwin {
  readonly route: string;
  readonly markdown: string;
  readonly problems: readonly string[];
}

/** Renders a twin and lints the result. A twin with problems must not be emitted. */
export function buildTwin(source: TwinSource): RenderedTwin {
  const markdown = renderTwin(source);
  const problems = lintMarkdown(markdown.replace(/^Canonical URL: .*$/m, '').replace(/^Publisher: .*$/m, ''));
  return { route: source.route, markdown, problems };
}

export interface ServiceTwinData {
  readonly summary: string;
  readonly covers: readonly string[];
  readonly artifacts: readonly { readonly name: string; readonly purpose: string }[];
  readonly doesNotCover: readonly string[];
}

const bullets = (items: readonly string[]): string => items.map((item) => `- ${item}`).join('\n');

/** Body of a service line twin, from the same frontmatter fields the page renders (covers, artifacts, what it does not cover). */
export function serviceTwinBody(data: ServiceTwinData): string {
  const parts = ['## What this line covers', '', bullets(data.covers)];
  if (data.artifacts.length > 0) {
    parts.push('', '## What you receive', '', bullets(data.artifacts.map((a) => `${a.name}: ${a.purpose}`)));
  }
  parts.push('', '## What this line does not cover', '', bullets(data.doesNotCover));
  return parts.join('\n');
}

export interface PlaybookTwinData {
  readonly steps: readonly { readonly title: string; readonly body: string }[];
  readonly artifacts: readonly string[];
}

/** Body of a playbook twin: the numbered steps, then what the reader has at the end. */
export function playbookTwinBody(data: PlaybookTwinData): string {
  const steps = data.steps.map((step, index) => `${index + 1}. **${step.title}.** ${step.body}`).join('\n');
  const parts = ['## The steps', '', steps];
  if (data.artifacts.length > 0) parts.push('', '## What you will have at the end', '', bullets(data.artifacts));
  return parts.join('\n');
}

export interface FaqTwinItem {
  readonly question: string;
  readonly answer: string;
  readonly group: string;
}

/** Body of the FAQ twin: one section per group in first-seen order, one level-three heading per question. */
export function faqTwinBody(items: readonly FaqTwinItem[]): string {
  const groups = new Map<string, FaqTwinItem[]>();
  for (const item of items) groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
  return [...groups]
    .map(([group, list]) => [`## ${group}`, '', ...list.flatMap((i) => [`### ${i.question}`, '', i.answer, ''])].join('\n'))
    .join('\n');
}

export interface GlossaryTwinItem {
  readonly term: string;
  readonly definition: string;
  readonly group: string;
}

/** Body of the glossary twin: one section per group, one definition-style line per term. */
export function glossaryTwinBody(items: readonly GlossaryTwinItem[]): string {
  const groups = new Map<string, GlossaryTwinItem[]>();
  for (const item of items) groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
  return [...groups].map(([group, list]) => [`## ${group}`, '', ...list.map((i) => `- **${i.term}.** ${i.definition}`), ''].join('\n')).join('\n');
}

export interface SourceLike {
  readonly title: string;
  readonly publisher: string;
  readonly url: string;
}

/** A sources list as Markdown: title, publisher and address, in the order the page lists them. */
export function sourcesBody(sources: readonly SourceLike[]): string {
  if (sources.length === 0) return '';
  return ['## Sources', '', ...sources.map((s) => `- ${s.title}. ${s.publisher}. <${s.url}>`)].join('\n');
}
