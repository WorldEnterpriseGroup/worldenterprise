// The gated-brief leak check (docs/wave8-contracts.md, section 5.3). A gated brief is the full text behind a form; its source lives in
// infra/intake/briefs/<briefId>.md and must never reach dist. This file holds the logic; scripts/audit-gated-briefs.mjs is the CLI.
// Node built-ins only, so the CI audit job runs it without npm ci.
//
// What is searched for: the brief's `sentinel` (one distinctive sentence of the author's choosing) and three probe sentences picked
// from the body by a fixed rule, so a leak of a paragraph is found even when the author's sentinel was lost in an edit. What is searched:
// every text file of dist, and the decoded content of every Pagefind fragment (gzip, so a raw search finds nothing either way).
// A finding names the brief, the probe and the file. It never prints the sentence, so a CI log does not become a second copy.
import { gunzipSync, gzipSync } from 'node:zlib';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';

/** A sentinel and a probe must run at least this many words, so a common phrase cannot stand in for the brief. */
export const MIN_PROBE_WORDS = 12;
/** The abstract may not share a run of this many words with the brief (contracts section 5.2). */
export const ABSTRACT_RUN_WORDS = 10;
/** Positions of the body, as fractions, from which one probe each is taken. */
export const PROBE_POSITIONS = [0.25, 0.5, 0.75];
/** Files of dist that can carry readable text. A Pagefind fragment is handled apart (`.pf_fragment`). */
export const TEXT_EXTENSIONS = new Set(['.html', '.xml', '.txt', '.md', '.json', '.js', '.mjs', '.css', '.svg', '.webmanifest', '.csv']);
const FRAGMENT_EXTENSION = '.pf_fragment';
/** Every Pagefind fragment starts with these 12 bytes before its JSON payload. */
const FRAGMENT_PREFIX = 'pagefind_dcd';

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', mdash: '—', ndash: '–', hellip: '…' };

/** Lower case, curly quotes and dashes folded, whitespace collapsed. Both sides of every comparison go through this. */
export function normalize(text) {
  return text
    .normalize('NFKC')
    .replace(/[‘’‚‛′`´]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐‑‒–—―]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Decodes the character references a built page uses, so a sentence broken by `&#39;` or `&amp;` is still found. */
export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, body) => {
    const lower = body.toLowerCase();
    if (lower.startsWith('#x')) return safeFromCodePoint(Number.parseInt(lower.slice(2), 16), whole);
    if (lower.startsWith('#')) return safeFromCodePoint(Number.parseInt(lower.slice(1), 10), whole);
    return NAMED_ENTITIES[lower] ?? whole;
  });
}

function safeFromCodePoint(code, fallback) {
  return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : fallback;
}

/** Visible-ish text of a markup file: tags become spaces, so a sentence split by `<em>` or `<a>` joins up. */
export function stripMarkup(text) {
  return decodeEntities(text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '));
}

/** Every string inside a JSON document, joined with newlines, so escaped quotes and \\u sequences are searched as the reader sees them. */
export function jsonStrings(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  const out = [];
  const visit = (node) => {
    if (typeof node === 'string') out.push(node);
    else if (Array.isArray(node)) node.forEach(visit);
    else if (node !== null && typeof node === 'object') Object.values(node).forEach(visit);
  };
  visit(value);
  return out.join('\n');
}

/**
 * The variants of one file's text that are searched: the raw text, the markup-stripped text for markup, and the decoded strings for
 * JSON. Each is normalized. A leak is a leak in any of them.
 */
export function searchViews(text, extension) {
  const views = [normalize(text)];
  if (extension === '.html' || extension === '.xml' || extension === '.svg') views.push(normalize(stripMarkup(text)));
  else views.push(normalize(decodeEntities(text)));
  if (extension === '.json' || extension === '.webmanifest') {
    const strings = jsonStrings(text);
    if (strings !== null) views.push(normalize(stripMarkup(strings)));
  }
  return [...new Set(views)];
}

/** Decodes one Pagefind fragment to its text: gunzip, drop the 12-byte prefix, read the JSON `content` (and `meta` values). */
export function decodeFragment(buffer) {
  const raw = gunzipSync(buffer).toString('utf8');
  const payload = raw.startsWith(FRAGMENT_PREFIX) ? raw.slice(FRAGMENT_PREFIX.length) : raw;
  let doc;
  try {
    doc = JSON.parse(payload);
  } catch (error) {
    throw new Error(`a Pagefind fragment is not JSON after its prefix: ${error instanceof Error ? error.message : String(error)}`);
  }
  const parts = [typeof doc.content === 'string' ? doc.content : ''];
  if (doc.meta !== null && typeof doc.meta === 'object') for (const value of Object.values(doc.meta)) if (typeof value === 'string') parts.push(value);
  return parts.join('\n');
}

// ---- reading a brief -----------------------------------------------------------------------------------------------------------

/** Splits `---` front matter from the body. Returns { raw, body } with raw '' when there is none. */
export function splitFrontMatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  return match ? { raw: match[1], body: match[2] } : { raw: '', body: text };
}

/** Reads one top-level scalar of the front matter (`key: value` or `key: "value"`). Null when absent. Nested keys are not read. */
export function frontMatterScalar(raw, key) {
  const match = new RegExp(`^${key}:[ \\t]*(.*)$`, 'm').exec(raw);
  if (!match) return null;
  let value = match[1].trim();
  if (value === '') return null;
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.length >= 2) {
    const close = value.lastIndexOf(quote);
    value = close > 0 ? value.slice(1, close) : value.slice(1);
    if (quote === '"') value = value.replace(/\\(["\\])/g, '$1');
    else value = value.replace(/''/g, "'");
  } else value = value.replace(/\s+#.*$/, '');
  return value;
}

/** Reads a flow list (`audience: [startup, investor]`). Null when absent or not a flow list. */
export function frontMatterList(raw, key) {
  const value = frontMatterScalar(raw, key);
  if (value === null || !/^\[.*\]$/.test(value)) return null;
  return value.slice(1, -1).split(',').map((item) => item.trim().replace(/^["']|["']$/g, '')).filter((item) => item !== '');
}

/** Markdown to plain prose: links keep their text, emphasis and code marks go, headings and list markers go, tables and code blocks go. */
export function proseOf(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s*\|.*\|\s*$/gm, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+.*$/gm, ' ')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, '')
    .replace(/(\*\*|__|\*|_)(\S(?:[\s\S]*?\S)?)\1/g, '$2')
    .replace(/[ \t]+/g, ' ');
}

/** Sentences of a prose text with their start offsets: [{ text, start, words }]. A paragraph end ends a sentence too. */
export function sentencesOf(prose) {
  const out = [];
  const pattern = /[^\n]+/g;
  for (let line = pattern.exec(prose); line !== null; line = pattern.exec(prose)) {
    const parts = line[0].split(/(?<=[.!?]["')\]”’]?)\s+(?=["'(\[“‘]?[A-Z0-9])/);
    let cursor = line.index;
    for (const part of parts) {
      const at = prose.indexOf(part, cursor);
      const text = part.trim();
      if (text !== '') out.push({ text, start: at, words: text.split(/\s+/).length });
      cursor = at + part.length;
    }
  }
  return out;
}

/**
 * The probes of a body, chosen by a fixed rule: for each position (25, 50 and 75 percent of the prose), the longest sentence of at
 * least MIN_PROBE_WORDS words that starts within an eighth of the body either side of the position (the first of equals); when the
 * window holds none, the nearest qualifying sentence. Duplicates are dropped. Returns [{ position, text }].
 */
export function pickProbes(body) {
  const prose = proseOf(body);
  const all = sentencesOf(prose).filter((s) => s.words >= MIN_PROBE_WORDS);
  if (all.length === 0) return [];
  const total = prose.length;
  const seen = new Set();
  const probes = [];
  for (const position of PROBE_POSITIONS) {
    const centre = position * total;
    const window = all.filter((s) => Math.abs(s.start - centre) <= total / 8);
    let pick;
    if (window.length > 0) pick = window.reduce((best, s) => (s.words > best.words ? s : best));
    else pick = all.reduce((best, s) => (Math.abs(s.start - centre) < Math.abs(best.start - centre) ? s : best));
    const key = normalize(pick.text);
    if (seen.has(key)) continue;
    seen.add(key);
    probes.push({ position: Math.round(position * 100), text: pick.text });
  }
  return probes;
}

/**
 * Reads one brief file. Returns { id, file, sentinel, probes, errors } where `errors` lists what makes the brief unauditable: an id that
 * is not the file name, no sentinel, a sentinel under MIN_PROBE_WORDS words, or a sentinel that is not in the body.
 */
export function readBrief(file, text) {
  const { raw, body } = splitFrontMatter(text);
  const name = file.split(/[\\/]/).pop()?.replace(/\.md$/, '') ?? file;
  const errors = [];
  const id = frontMatterScalar(raw, 'id');
  if (id !== name) errors.push(`front matter id "${id ?? ''}" is not the file name "${name}"`);
  const sentinel = frontMatterScalar(raw, 'sentinel');
  if (sentinel === null) errors.push('front matter has no sentinel');
  else {
    if (sentinel.split(/\s+/).length < MIN_PROBE_WORDS) errors.push(`the sentinel has fewer than ${MIN_PROBE_WORDS} words`);
    if (!normalize(proseOf(body)).includes(normalize(sentinel))) errors.push('the sentinel does not appear verbatim in the body');
  }
  const probes = pickProbes(body);
  if (probes.length === 0) errors.push(`the body has no sentence of ${MIN_PROBE_WORDS} words or more to probe with`);
  return { id: name, file, sentinel, probes, body, audience: frontMatterList(raw, 'audience'), errors };
}

/** Reads every `<dir>/*.md`. Returns [] when the directory does not exist. */
export function readBriefs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => readBrief(join(dir, name), readFileSync(join(dir, name), 'utf8')));
}

// ---- searching a tree ----------------------------------------------------------------------------------------------------------

function* walk(root) {
  for (const name of readdirSync(root).sort()) {
    const full = join(root, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (name === 'node_modules' || name === '.git') continue;
      yield* walk(full);
    } else yield full;
  }
}

const extensionOf = (file) => {
  const dot = file.lastIndexOf('.');
  return dot < 0 ? '' : file.slice(dot).toLowerCase();
};

/**
 * Searches a tree for every needle. `needles` is [{ briefId, label, text }]. Returns { files, fragments, findings } where each finding is
 * { briefId, label, where }; `where` is a path relative to the root, and a Pagefind fragment is named by its own path. A file that cannot
 * be decoded is a finding of its own (label "unreadable"), because a fragment that cannot be read is a fragment that was not checked.
 */
export function searchTree(root, needles) {
  const wanted = needles.map((n) => ({ ...n, key: normalize(n.text) }));
  const findings = [];
  let files = 0;
  let fragments = 0;
  const report = (needle, where) => findings.push({ briefId: needle.briefId, label: needle.label, where });
  for (const file of walk(root)) {
    const rel = relative(root, file).split(sep).join('/');
    const extension = extensionOf(file);
    if (extension === FRAGMENT_EXTENSION) {
      fragments += 1;
      files += 1;
      let views;
      try {
        views = searchViews(decodeFragment(readFileSync(file)), '.json');
      } catch (error) {
        findings.push({ briefId: '*', label: 'unreadable', where: `${rel}: ${error instanceof Error ? error.message : String(error)}` });
        continue;
      }
      for (const needle of wanted) if (views.some((view) => view.includes(needle.key))) report(needle, rel);
      continue;
    }
    if (!TEXT_EXTENSIONS.has(extension)) continue;
    files += 1;
    const views = searchViews(readFileSync(file, 'utf8'), extension);
    for (const needle of wanted) if (views.some((view) => view.includes(needle.key))) report(needle, rel);
  }
  return { files, fragments, findings };
}

/** The needles of a set of briefs: the sentinel and the probes, labelled so a finding says which one leaked and never what it says. */
export function needlesOf(briefs) {
  return briefs.flatMap((brief) => [
    ...(brief.sentinel === null ? [] : [{ briefId: brief.id, label: 'sentinel', text: brief.sentinel }]),
    ...brief.probes.map((probe) => ({ briefId: brief.id, label: `probe at ${probe.position} percent`, text: probe.text })),
  ]);
}

/** Pagefind must have been built, or an empty search proves nothing: the entry file and at least one fragment exist. */
export function checkIndexExists(dist) {
  const problems = [];
  const entry = join(dist, 'pagefind', 'pagefind-entry.json');
  if (!existsSync(entry)) problems.push('pagefind/pagefind-entry.json does not exist, so the search index was not built and its fragments were not checked');
  const fragmentDir = join(dist, 'pagefind', 'fragment');
  const count = existsSync(fragmentDir) ? readdirSync(fragmentDir).filter((n) => n.endsWith(FRAGMENT_EXTENSION)).length : 0;
  if (count === 0) problems.push('pagefind/fragment holds no .pf_fragment file, so the search index has no content to check');
  return problems;
}

// ---- the open abstract ---------------------------------------------------------------------------------------------------------

/** Words of a text as the abstract check sees them: lower case, apostrophes folded, punctuation dropped. */
export function wordsOf(text) {
  return normalize(text)
    .replace(/[^\p{L}\p{N}'\s-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w !== '');
}

/** The first run of `length` words that the two texts share, as a position in the first, or -1. Never returns the words. */
export function sharedRun(first, second, length = ABSTRACT_RUN_WORDS) {
  const a = wordsOf(first);
  const b = wordsOf(second);
  if (a.length < length || b.length < length) return -1;
  const grams = new Set();
  for (let i = 0; i + length <= b.length; i += 1) grams.add(b.slice(i, i + length).join(' '));
  for (let i = 0; i + length <= a.length; i += 1) if (grams.has(a.slice(i, i + length).join(' '))) return i;
  return -1;
}

/** Compares each open abstract `<dir>/<id>.md` with the body of its brief. Returns findings; a brief with no abstract yet has none. */
export function checkAbstracts(briefs, abstractsDir) {
  const findings = [];
  for (const brief of briefs) {
    const file = join(abstractsDir, `${brief.id}.md`);
    if (!existsSync(file)) continue;
    const abstract = splitFrontMatter(readFileSync(file, 'utf8')).body;
    const at = sharedRun(abstract, proseOf(brief.body));
    if (at >= 0) findings.push({ briefId: brief.id, label: `abstract shares ${ABSTRACT_RUN_WORDS} words with the brief`, where: `${file} (word ${at + 1})` });
    const words = wordsOf(abstract).length;
    if (words > 300) findings.push({ briefId: brief.id, label: 'abstract is longer than 300 words', where: `${file} (${words} words)` });
  }
  return findings;
}

// ---- the audit -----------------------------------------------------------------------------------------------------------------

/**
 * Runs the whole audit. Options: `dist`, `briefsDir`, `also` (other trees that must not hold a sentinel, such as src and docs) and
 * `abstractsDir`. Returns { briefs, findings, problems }: `findings` are leaks and `problems` are what made the audit unable to
 * conclude (a brief that cannot be probed, no search index). Either one fails the audit.
 */
export function auditBriefs({ dist, briefsDir, also = [], abstractsDir }) {
  const briefs = readBriefs(briefsDir);
  const problems = [];
  for (const brief of briefs) for (const error of brief.errors) problems.push(`${brief.file}: ${error}`);
  if (briefs.length === 0) return { briefs, findings: [], problems, files: 0, fragments: 0 };
  const usable = briefs.filter((b) => b.errors.length === 0);
  const needles = needlesOf(usable);
  const result = searchTree(dist, needles);
  problems.push(...checkIndexExists(dist));
  const findings = result.findings.map((f) => ({ ...f, where: `${dist}/${f.where}` }));
  for (const tree of also) {
    if (!existsSync(tree)) continue;
    // Only the sentinels go into the source trees: a probe is an ordinary sentence of the body that tests and notes may quote.
    const sentinels = needles.filter((n) => n.label === 'sentinel');
    for (const f of searchTree(tree, sentinels).findings) findings.push({ ...f, where: `${tree}/${f.where}` });
  }
  if (abstractsDir !== undefined) findings.push(...checkAbstracts(usable, abstractsDir));
  return { briefs, findings, problems, files: result.files, fragments: result.fragments };
}

// ---- the self-test -------------------------------------------------------------------------------------------------------------

const SELF_SENTINEL = 'The harbour ledger of an idle workshop records every lantern that was lit before the first frost arrived.';

function selfBrief(sentinel = SELF_SENTINEL) {
  const filler = (n) => `Paragraph ${n} describes a plain subject in short words and has no tie to any other text of this fixture at all, which is the point.`;
  const lines = [];
  for (let i = 1; i <= 30; i += 1) lines.push(i === 15 ? sentinel : filler(i), '');
  return ['---', 'id: self-brief', 'title: Self test', 'version: "1.0"', 'audience: [startup]', `sentinel: "${sentinel}"`, '---', '', '## A section', '', ...lines].join('\n');
}

function fragmentOf(text) {
  return gzipSync(Buffer.from(`${FRAGMENT_PREFIX}${JSON.stringify({ url: '/x/', content: text, meta: { title: 'x' } })}`));
}

function plantDist(root, { plant }) {
  mkdirSync(join(root, 'pagefind', 'fragment'), { recursive: true });
  mkdirSync(join(root, 'insights', 'x'), { recursive: true });
  writeFileSync(join(root, 'pagefind', 'pagefind-entry.json'), JSON.stringify({ version: '1.5.2', languages: {} }));
  writeFileSync(join(root, 'pagefind', 'fragment', 'en_aaaa.pf_fragment'), fragmentOf(plant.fragment ?? 'An unrelated page about something else.'));
  writeFileSync(join(root, 'insights', 'x', 'index.html'), `<main><p>${plant.html ?? 'An unrelated page.'}</p></main>`);
  writeFileSync(join(root, 'insights', 'x.md'), plant.md ?? 'An unrelated twin.');
  writeFileSync(join(root, 'llms-full.txt'), plant.llms ?? 'An unrelated index.');
}

/**
 * Proves the audit can fail. Builds temporary dists and checks: a clean one passes; the sentinel planted in an HTML page (with its
 * apostrophe-free text split by markup and encoded), in a Markdown twin, in llms-full.txt and in a gzip fragment is found in each; a
 * dist with no Pagefind index is a problem; a brief whose sentinel is not in its body is a problem. Returns [{ label, ok }].
 */
export function selfTest() {
  const results = [];
  const check = (label, ok) => results.push({ label, ok: ok === true });
  const base = mkdtempSync(join(tmpdir(), 'gated-briefs-'));
  try {
    const briefsDir = join(base, 'briefs');
    mkdirSync(briefsDir, { recursive: true });
    writeFileSync(join(briefsDir, 'self-brief.md'), selfBrief());
    const run = (name, plant) => {
      const dist = join(base, name);
      plantDist(dist, { plant });
      return auditBriefs({ dist, briefsDir });
    };
    const clean = run('clean', {});
    check('a clean dist passes with no finding and no problem', clean.findings.length === 0 && clean.problems.length === 0);
    check('the brief yields a sentinel and three probes', clean.briefs[0]?.probes.length === 3 && clean.briefs[0]?.errors.length === 0);
    const folded = SELF_SENTINEL.replace('harbour', 'har&#98;our').replace(/lantern/, '<em>lantern</em>').toUpperCase().replace(/ /g, '  ');
    const html = run('html', { html: folded.toLowerCase() });
    check('the sentinel in an HTML page is found, through markup, entities, case and spacing', html.findings.some((f) => f.label === 'sentinel' && f.where.endsWith('insights/x/index.html')));
    const md = run('md', { md: `Intro.\n\n${SELF_SENTINEL.replace(/'/g, '’')}\n` });
    check('the sentinel in a Markdown twin is found', md.findings.some((f) => f.label === 'sentinel' && f.where.endsWith('insights/x.md')));
    const llms = run('llms', { llms: `# WE\n\n${SELF_SENTINEL}\n` });
    check('the sentinel in llms-full.txt is found', llms.findings.some((f) => f.label === 'sentinel' && f.where.endsWith('llms-full.txt')));
    const fragment = run('fragment', { fragment: `Before. ${SELF_SENTINEL} After.` });
    check('the sentinel in a gzip Pagefind fragment is found', fragment.findings.some((f) => f.label === 'sentinel' && f.where.endsWith('.pf_fragment')));
    const probeText = clean.briefs[0]?.probes[1]?.text ?? '';
    const probe = run('probe', { html: probeText });
    check('a probe sentence in a page is found even when the sentinel is not', probe.findings.some((f) => f.label.startsWith('probe') && f.where.endsWith('index.html')) && !probe.findings.some((f) => f.label === 'sentinel'));
    check('a finding never carries the sentence', [html, md, llms, fragment, probe].every((r) => r.findings.every((f) => !normalize(JSON.stringify(f)).includes(normalize(SELF_SENTINEL).slice(0, 40)))));
    const noIndex = join(base, 'noindex');
    mkdirSync(noIndex, { recursive: true });
    writeFileSync(join(noIndex, 'index.html'), '<main>Nothing.</main>');
    check('a dist with no Pagefind index is a problem, so an unbuilt index cannot pass', auditBriefs({ dist: noIndex, briefsDir }).problems.some((p) => p.includes('pagefind-entry.json')));
    const badDir = join(base, 'bad');
    mkdirSync(badDir, { recursive: true });
    writeFileSync(join(badDir, 'self-brief.md'), selfBrief().replace(/^sentinel: .*$/m, 'sentinel: "A sentence that is long enough to count but is not in the body of this brief at all."'));
    check('a sentinel that is not in the body is a problem', auditBriefs({ dist: join(base, 'clean'), briefsDir: badDir }).problems.some((p) => p.includes('does not appear verbatim')));
    const srcTree = join(base, 'src');
    mkdirSync(srcTree, { recursive: true });
    writeFileSync(join(srcTree, 'leak.md'), SELF_SENTINEL);
    check('a sentinel in src or docs is found', auditBriefs({ dist: join(base, 'clean'), briefsDir, also: [srcTree] }).findings.some((f) => f.where.endsWith('leak.md')));
    const abstractsDir = join(base, 'abstracts');
    mkdirSync(abstractsDir, { recursive: true });
    writeFileSync(join(abstractsDir, 'self-brief.md'), `---\ntitle: x\n---\nThis page says that ${SELF_SENTINEL.split(' ').slice(0, 11).join(' ')} and more.\n`);
    check('an abstract that shares ten words with the brief is found', auditBriefs({ dist: join(base, 'clean'), briefsDir, abstractsDir }).findings.some((f) => f.label.startsWith('abstract shares')));
    check('no brief means nothing to audit and no failure', auditBriefs({ dist: join(base, 'clean'), briefsDir: join(base, 'absent') }).problems.length === 0);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
  return results;
}
