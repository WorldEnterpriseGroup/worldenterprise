#!/usr/bin/env node
// Static accessibility audit over dist: the structural WCAG 2.2 AA checks that need no browser. It complements axe (which
// runs in Playwright against the rendered page) and is fast enough to gate every branch.
//   page:    html lang, non-empty title, viewport meta without zoom lock, exactly one h1, no skipped heading levels,
//            one <main id="main">, skip link first, unique ids, no positive tabindex
//   names:   links, buttons, form controls, iframes and images in links have an accessible name; no "click here" links
//   refs:    for, aria-labelledby, aria-describedby, aria-controls and popovertarget point at ids that exist
//   forms:   every visible control is labelled; tables have header cells
// Usage: node scripts/audit-a11y.mjs [--dist dist] [--json reports/a11y-static.json]
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { collectIds, isDevRoute, metaContent, parseArgs, parseAttrs, readPages, report, startTags, stripNonMarkup, textOf } from './lib/html.mjs';

const VAGUE_LINK = /^(?:click here|here|this link|link|more|read this)$/i;
const NON_LABELLED = new Set(['hidden', 'submit', 'button', 'reset', 'image']);

/** Elements with their inner HTML: [{ attrs, inner, index }]. Does not nest-match the same tag, which links and buttons never do. */
function elements(doc, tag) {
  const re = new RegExp(`<${tag}(?=[\\s>])((?:"[^"]*"|'[^']*'|[^'">])*)>([\\s\\S]*?)</${tag}>`, 'gi');
  const out = [];
  for (let m = re.exec(doc); m !== null; m = re.exec(doc)) out.push({ attrs: parseAttrs(m[1]), inner: m[2], index: m.index });
  return out;
}

/** Accessible name of an element from aria-label, aria-labelledby, text, or an image alt inside. */
function nameOf(el, idText) {
  const label = (el.attrs['aria-label'] ?? '').trim();
  if (label !== '') return label;
  const by = el.attrs['aria-labelledby'];
  if (by !== undefined) {
    const joined = by.split(/\s+/).map((id) => idText.get(id) ?? '').join(' ').trim();
    if (joined !== '') return joined;
  }
  const text = textOf(el.inner.replace(/<svg\b[\s\S]*?<\/svg>/gi, (svg) => {
    const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(svg);
    return title ? title[1] : '';
  }));
  if (text !== '') return text;
  for (const img of startTags(el.inner, 'img')) if ((img.attrs.alt ?? '').trim() !== '') return img.attrs.alt.trim();
  if ((el.attrs.title ?? '').trim() !== '') return el.attrs.title.trim();
  return '';
}

export function auditPage(page) {
  const findings = [];
  const where = isDevRoute(page.route) ? `${page.route} (dev)` : page.route;
  const err = (message) => findings.push({ level: 'error', where, message });
  const doc = stripNonMarkup(page.html);
  const bodyStart = doc.search(/<body[\s>]/i);
  const body = bodyStart === -1 ? doc : doc.slice(bodyStart);

  const htmlTag = startTags(doc, 'html')[0];
  if (htmlTag === undefined || !/^[a-z]{2}(?:-[A-Za-z0-9]+)*$/.test(htmlTag.attrs.lang ?? '')) err('html element has no valid lang attribute');
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(doc);
  if (title === null || textOf(title[1]) === '') err('empty or missing <title>');
  const viewport = metaContent(doc, 'viewport');
  if (viewport === null) err('missing viewport meta');
  else if (/user-scalable\s*=\s*(?:no|0)|maximum-scale\s*=\s*1(?:\.0)?\b/i.test(viewport)) err('viewport meta blocks zoom (WCAG 1.4.4)');

  const headings = [...body.matchAll(/<h([1-6])(?=[\s>])/gi)].map((m) => Number(m[1]));
  if (page.route !== '/404.html' || headings.length > 0) {
    const h1s = headings.filter((h) => h === 1).length;
    if (h1s !== 1) err(`expected one h1, found ${h1s}`);
  }
  for (let i = 1; i < headings.length; i += 1) {
    if (headings[i] > headings[i - 1] + 1) err(`heading level skips from h${headings[i - 1]} to h${headings[i]}`);
  }

  const mains = startTags(body, 'main');
  if (mains.length !== 1) err(`expected one <main>, found ${mains.length}`);
  else if (mains[0].attrs.id !== 'main') err('<main> has no id="main" for the skip link');
  const firstFocusable = startTags(body, 'a')[0];
  if (firstFocusable === undefined || !/\bskip-link\b/.test(firstFocusable.attrs.class ?? '') || firstFocusable.attrs.href !== '#main') {
    err('the first link on the page is not the skip link to #main');
  }

  const idList = collectIds(body);
  const idSet = new Set(idList);
  const seen = new Set();
  for (const id of idList) {
    if (seen.has(id)) err(`duplicate id "${id}"`);
    seen.add(id);
  }
  const all = [...body.matchAll(/<[a-z][a-z0-9-]*\s(?:"[^"]*"|'[^']*'|[^'">])*>/gi)];
  for (const m of all) {
    const a = parseAttrs(m[0].slice(m[0].search(/\s/) + 1, -1));
    if (a.tabindex !== undefined && Number(a.tabindex) > 0) err(`positive tabindex ${a.tabindex} breaks focus order`);
    for (const attr of ['aria-labelledby', 'aria-describedby', 'aria-controls', 'popovertarget']) {
      if (a[attr] === undefined) continue;
      for (const id of a[attr].split(/\s+/).filter(Boolean)) {
        if (!idSet.has(id)) err(`${attr}="${id}" points at no element on the page`);
      }
    }
  }

  const idText = new Map();
  for (const el of elements(body, '(?:span|p|h[1-6]|div|legend|label|strong|em)')) {
    if (el.attrs.id !== undefined) idText.set(el.attrs.id, textOf(el.inner));
  }

  for (const a of elements(body, 'a')) {
    if (a.attrs.href === undefined) continue;
    const name = nameOf(a, idText);
    if (name === '') err(`link to ${a.attrs.href} has no accessible name`);
    else if (VAGUE_LINK.test(name)) err(`link text "${name}" is not descriptive (${a.attrs.href})`);
  }
  for (const b of elements(body, 'button')) {
    if (nameOf(b, idText) === '') err('button has no accessible name');
  }
  for (const f of startTags(body, 'iframe')) if ((f.attrs.title ?? '') === '') err('iframe has no title');

  const labelFor = new Set(startTags(body, 'label').map((l) => l.attrs.for).filter(Boolean));
  const wrapped = elements(body, 'label').map((l) => l.inner);
  for (const tag of ['input', 'select', 'textarea']) {
    for (const c of startTags(body, tag)) {
      if (NON_LABELLED.has((c.attrs.type ?? '').toLowerCase())) continue;
      const hasName = (c.attrs['aria-label'] ?? '').trim() !== '' || c.attrs['aria-labelledby'] !== undefined || (c.attrs.id !== undefined && labelFor.has(c.attrs.id)) || wrapped.some((inner) => inner.includes(body.slice(c.index, c.end)));
      if (!hasName) err(`<${tag}${c.attrs.name ? ` name="${c.attrs.name}"` : ''}> has no label`);
    }
  }
  for (const t of elements(body, 'table')) {
    if (!/<th[\s>]/i.test(t.inner)) err('<table> has no header cells (th)');
  }
  return findings;
}

export function auditA11y(pages) {
  return pages.flatMap(auditPage);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2), { dist: 'dist', json: 'reports/a11y-static.json' });
  try {
    const pages = readPages(args.dist);
    const findings = auditA11y(pages);
    mkdirSync(dirname(args.json), { recursive: true });
    writeFileSync(args.json, `${JSON.stringify(findings, null, 2)}\n`);
    process.exit(report('audit-a11y', findings, `${pages.length} pages`));
  } catch (error) {
    console.error(`audit-a11y: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }
}
