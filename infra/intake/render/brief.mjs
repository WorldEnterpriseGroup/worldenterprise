/**
 * Parses a gated brief (`infra/intake/briefs/<id>.md`), renders it to one self-contained HTML document, and builds the
 * registry the Function reads. Pure functions over strings: the file system and the browser live in render.mjs.
 */

import { escapeHtml, renderMarkdown } from './markdown.mjs';

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const VERSION = /^[0-9]+(\.[0-9]+){0,2}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class BriefError extends Error {
  constructor(file, problem) {
    super(`${file}: ${problem}`);
    this.name = 'BriefError';
  }
}

function unquote(raw) {
  const value = raw.trim();
  const quoted = /^"((?:[^"\\]|\\.)*)"\s*(?:#.*)?$/.exec(value) ?? /^'((?:[^']|'')*)'\s*(?:#.*)?$/.exec(value);
  if (quoted !== null) return value.startsWith('"') ? quoted[1].replace(/\\(["\\])/g, '$1') : quoted[1].replaceAll("''", "'");
  return value.replace(/\s+#.*$/, '');
}

/** Splits `{ a: 1, b: "x, y" }` on its top-level commas, honoring quotes. */
function splitFlow(inner) {
  const parts = [];
  let current = '';
  let quote = '';
  for (const char of inner) {
    if (quote !== '') {
      current += char;
      if (char === quote) quote = '';
    } else if (char === '"' || char === "'") {
      quote = char;
      current += char;
    } else if (char === ',') {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts;
}

function keyValue(text, file) {
  const at = text.indexOf(':');
  if (at < 1) throw new BriefError(file, `front matter line is not "key: value": ${text.slice(0, 40)}`);
  return [text.slice(0, at).trim(), unquote(text.slice(at + 1))];
}

/** The subset of YAML a brief's front matter uses: scalars, plus a `sources` list as flow maps or block maps. */
export function parseFrontMatter(block, file) {
  const data = {};
  const sources = [];
  let inSources = false;
  let current = null;
  for (const line of block.split('\n')) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    if (/^sources:\s*$/.test(line)) {
      inSources = true;
      continue;
    }
    if (inSources && /^\s+-\s/.test(line)) {
      const entry = line.replace(/^\s+-\s+/, '');
      current = {};
      sources.push(current);
      if (entry.startsWith('{')) {
        if (!entry.trimEnd().endsWith('}')) throw new BriefError(file, 'a flow-style source must close on its own line');
        for (const part of splitFlow(entry.trim().slice(1, -1))) {
          const [key, value] = keyValue(part, file);
          current[key] = value;
        }
        current = null;
      } else {
        const [key, value] = keyValue(entry, file);
        current[key] = value;
      }
    } else if (inSources && current !== null && /^\s{2,}\S/.test(line)) {
      const [key, value] = keyValue(line, file);
      current[key] = value;
    } else {
      inSources = false;
      current = null;
      const [key, value] = keyValue(line, file);
      data[key] = value;
    }
  }
  return { data, sources };
}

function normalize(text) {
  return text.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Reads and validates one brief. `fileName` is the base name, so the id can be checked against it. */
export function parseBrief(fileName, text) {
  const normalized = text.replace(/\r\n?/g, '\n');
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(normalized);
  if (match === null) throw new BriefError(fileName, 'missing front matter');
  const { data, sources } = parseFrontMatter(match[1], fileName);
  const body = match[2].trim();

  const id = data.id ?? '';
  if (!ID.test(id)) throw new BriefError(fileName, 'id must be a lower-case slug');
  if (`${id}.md` !== fileName) throw new BriefError(fileName, `id "${id}" must equal the file name`);
  if ((data.title ?? '') === '') throw new BriefError(fileName, 'title is required');
  if (!VERSION.test(data.version ?? '')) throw new BriefError(fileName, 'version must be numeric, such as 1 or 1.0');
  if (!DATE.test(data.updated ?? '')) throw new BriefError(fileName, 'updated must be YYYY-MM-DD');
  const sentinel = data.sentinel ?? '';
  if (sentinel.split(/\s+/).filter(Boolean).length < 12) throw new BriefError(fileName, 'sentinel must be a sentence of at least 12 words');
  if (!normalize(body).includes(normalize(sentinel))) throw new BriefError(fileName, 'sentinel does not appear verbatim in the body');
  if (body === '') throw new BriefError(fileName, 'the body is empty');
  for (const source of sources) {
    if (!/^https:\/\/\S+$/.test(source.url ?? '')) throw new BriefError(fileName, `source ${source.id ?? '?'} needs an https url`);
    if ((source.title ?? '') === '') throw new BriefError(fileName, `source ${source.id ?? '?'} needs a title`);
  }
  return { id, title: data.title, version: data.version, updated: data.updated, sentinel, sources, body };
}

const STYLE = `
:root { color-scheme: light; --ink: #14213d; --muted: #4a5568; --rule: #c9d1dc; --accent: #0b4f8a; }
* { box-sizing: border-box; }
body { margin: 0; background: #fff; color: var(--ink); font: 11pt/1.6 Georgia, "Times New Roman", serif; }
main { max-width: 42rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
header { border-bottom: 2px solid var(--ink); margin-bottom: 1.5rem; padding-bottom: 1rem; }
.kicker { margin: 0 0 .5rem; font: 600 .8rem/1.2 system-ui, sans-serif; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
h1 { margin: 0 0 .5rem; font-size: 2rem; line-height: 1.2; }
.meta { margin: 0; color: var(--muted); font: .9rem/1.4 system-ui, sans-serif; }
h2 { margin: 2rem 0 .5rem; font-size: 1.35rem; line-height: 1.3; break-after: avoid; }
h3, h4, h5, h6 { margin: 1.5rem 0 .4rem; font-size: 1.1rem; break-after: avoid; }
p, ul, ol, blockquote, .table-wrap, pre { margin: 0 0 1rem; }
a { color: var(--accent); }
blockquote { border-left: 3px solid var(--rule); padding-left: 1rem; color: var(--muted); }
.table-wrap { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font: .9rem/1.4 system-ui, sans-serif; }
th, td { border: 1px solid var(--rule); padding: .4rem .6rem; text-align: left; vertical-align: top; }
th { background: #f1f4f8; }
pre { background: #f1f4f8; padding: .75rem; overflow-x: auto; font-size: .85rem; }
code { font-family: ui-monospace, "SFMono-Regular", Menlo, monospace; font-size: .9em; }
nav.contents { margin: 0 0 1.5rem; font: .95rem/1.5 system-ui, sans-serif; }
nav.contents h2 { margin: 0 0 .25rem; font-size: 1rem; }
nav.contents ol { margin: 0; padding-left: 1.25rem; }
.sources { font: .85rem/1.5 system-ui, sans-serif; }
.sources li { margin-bottom: .4rem; overflow-wrap: anywhere; }
footer { margin-top: 3rem; border-top: 1px solid var(--rule); padding-top: .75rem; color: var(--muted); font: .8rem/1.4 system-ui, sans-serif; }
@media print { main { max-width: none; padding: 0; } a { color: inherit; text-decoration: none; } h2, h3, table, pre, blockquote { break-inside: avoid; } }
@page { size: Letter; margin: 0.9in; }
`;

function sourceItem(source) {
  const parts = [source.publisher ? `${escapeHtml(source.publisher)}. ` : '', `<a href="${escapeHtml(source.url)}">${escapeHtml(source.title)}</a>`, source.accessed ? `. Accessed ${escapeHtml(source.accessed)}.` : ''];
  return `<li>${parts.join('')}</li>`;
}

/** One self-contained document: inline CSS, no scripts, no external requests, and an explicit noindex. */
export function renderHtml(brief) {
  const headings = [];
  const body = renderMarkdown(brief.body, { headings });
  const contents = headings.length >= 3
    ? `<nav class="contents" aria-label="Contents"><h2>Contents</h2><ol>${headings.map((heading) => `<li><a href="#${heading.id}">${escapeHtml(heading.text)}</a></li>`).join('')}</ol></nav>`
    : '';
  const sources = brief.sources.length > 0 ? `<section class="sources" aria-labelledby="sources-heading"><h2 id="sources-heading">Sources</h2><ol>${brief.sources.map(sourceItem).join('')}</ol></section>` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<title>${escapeHtml(brief.title)} - World Enterprise</title>
<style>${STYLE}</style>
</head>
<body>
<main id="main">
<header>
<p class="kicker">World Enterprise brief</p>
<h1>${escapeHtml(brief.title)}</h1>
<p class="meta">Version ${escapeHtml(brief.version)}. Updated ${escapeHtml(brief.updated)}.</p>
</header>
${contents}
${body}
${sources}
<footer>World Enterprise. Version ${escapeHtml(brief.version)}, updated ${escapeHtml(brief.updated)}.</footer>
</main>
</body>
</html>
`;
}

/** The blob names of a brief's rendered files, inside the briefs container. */
export function blobPaths(brief) {
  const prefix = `briefs/${brief.id}/v${brief.version}/`;
  return { html: `${prefix}${brief.id}.html`, pdf: `${prefix}${brief.id}.pdf` };
}

/** The registry the Function reads (`parseRegistry` in src/azure/blob.ts is its reader). Sorted by id, ids unique. */
export function buildRegistry(briefs) {
  const seen = new Set();
  for (const brief of briefs) {
    if (seen.has(brief.id)) throw new BriefError(`${brief.id}.md`, 'duplicate brief id');
    seen.add(brief.id);
  }
  const entries = [...briefs].sort((a, b) => a.id.localeCompare(b.id)).map((brief) => {
    const paths = blobPaths(brief);
    return { id: brief.id, title: brief.title, version: brief.version, pdfPath: paths.pdf, htmlPath: paths.html };
  });
  return { version: 1, briefs: entries };
}
