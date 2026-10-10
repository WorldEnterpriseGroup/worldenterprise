/**
 * Renders the gated briefs to HTML and PDF and writes the registry the Function reads.
 *
 *   node render/render.mjs --briefs briefs --out render/out [--no-pdf]
 *   node render/render.mjs --self-test [--no-pdf]
 *
 * Plain JavaScript that runs in the Playwright image with no install: the PDF comes from the image's own Chromium
 * (`--print-to-pdf`). Output layout, relative to --out:
 *
 *   briefs/<id>/v<version>/<id>.html
 *   briefs/<id>/v<version>/<id>.pdf
 *   briefs.json
 *
 * The same names are the blob names in the private `briefs` container (publish.mjs uploads them as they are). No brief
 * text is printed to the log; only ids, versions and sizes.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { blobPaths, BriefError, buildRegistry, parseBrief, renderHtml } from './brief.mjs';
import { findChromium, printArgs } from './chromium.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PDF_TIMEOUT_MS = 60_000;
const MIN_PDF_BYTES = 1024;

function parseArgs(argv) {
  const options = { briefs: 'briefs', out: join(HERE, 'out'), pdf: true, selfTest: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--briefs') options.briefs = argv[++index];
    else if (arg === '--out') options.out = argv[++index];
    else if (arg === '--no-pdf') options.pdf = false;
    else if (arg === '--self-test') options.selfTest = true;
    else throw new Error(`unknown argument ${arg}`);
  }
  return options;
}

function printPdf(chromium, htmlPath, pdfPath) {
  const profileDir = mkdtempSync(join(tmpdir(), 'brief-profile-'));
  try {
    const result = spawnSync(chromium, printArgs({ htmlPath: resolve(htmlPath), pdfPath: resolve(pdfPath), profileDir }), { timeout: PDF_TIMEOUT_MS, encoding: 'utf8' });
    if (result.error !== undefined) throw new Error(`the browser did not run: ${result.error.message}`);
    if (result.status !== 0) throw new Error(`the browser exited with status ${result.status}: ${(result.stderr ?? '').split('\n').slice(-3).join(' ').slice(0, 300)}`);
  } finally {
    rmSync(profileDir, { recursive: true, force: true });
  }
  const header = readFileSync(pdfPath).subarray(0, 5).toString('latin1');
  if (header !== '%PDF-' || statSync(pdfPath).size < MIN_PDF_BYTES) throw new Error('the browser wrote no valid PDF');
}

/** Renders every `*.md` in `briefsDir` into `outDir`. Returns the briefs, so callers can report them. */
export function renderAll({ briefsDir, outDir, pdf, log }) {
  let files;
  try {
    files = readdirSync(briefsDir).filter((name) => name.endsWith('.md')).sort();
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const chromium = pdf ? findChromium() : null;
  if (pdf && chromium === null) throw new Error('no Chromium found; run in the Playwright image, set CHROME_BIN, or pass --no-pdf');

  const briefs = files.map((name) => parseBrief(name, readFileSync(join(briefsDir, name), 'utf8')));
  const registry = buildRegistry(briefs);
  for (const brief of briefs) {
    const paths = blobPaths(brief);
    const htmlPath = join(outDir, paths.html);
    mkdirSync(dirname(htmlPath), { recursive: true });
    writeFileSync(htmlPath, renderHtml(brief));
    if (pdf) printPdf(chromium, htmlPath, join(outDir, paths.pdf));
    log(`rendered ${brief.id} v${brief.version}${pdf ? ' (html, pdf)' : ' (html)'}`);
  }
  if (briefs.length > 0) writeFileSync(join(outDir, 'briefs.json'), `${JSON.stringify(registry, null, 2)}\n`);
  return briefs;
}

/** Renders the fixture and checks what the Function and a reader depend on. */
function selfTest(pdf) {
  const work = mkdtempSync(join(tmpdir(), 'brief-selftest-'));
  try {
    const briefs = renderAll({ briefsDir: join(HERE, 'fixtures'), outDir: work, pdf, log: (line) => console.log(line) });
    if (briefs.length !== 1) throw new Error('the fixture did not render');
    const [brief] = briefs;
    const paths = blobPaths(brief);
    const html = readFileSync(join(work, paths.html), 'utf8');
    const checks = [
      ['the sentinel survives in the html', html.includes(brief.sentinel)],
      ['the title is the one h1', (html.match(/<h1[ >]/g) ?? []).length === 1],
      ['raw html in the body is escaped', !html.includes('<script') && html.includes('&lt;script&gt;')],
      ['the page is marked noindex', html.includes('name="robots" content="noindex')],
      ['the page makes no external request', !/(src|href)="https?:\/\/[^"]*\.(js|css|woff2?|png|jpe?g|svg)"/i.test(html) && !html.includes('@import')],
      ['both source styles render', html.includes('Example source, with a comma in the title') && html.includes('Block style source')],
      ['a table renders', html.includes('<table>') && html.includes('<th>Column</th>')],
    ];
    const registry = JSON.parse(readFileSync(join(work, 'briefs.json'), 'utf8'));
    const entry = registry.briefs?.[0];
    checks.push(['the registry names the blobs', registry.version === 1 && entry?.htmlPath === paths.html && entry?.pdfPath === paths.pdf]);
    const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
    if (failed.length > 0) throw new Error(`self-test failed: ${failed.join('; ')}`);
    console.log(`self-test ok: ${checks.length} checks${pdf ? ', pdf printed' : ', pdf skipped'}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.selfTest) {
      selfTest(options.pdf);
    } else {
      const briefs = renderAll({ briefsDir: options.briefs, outDir: options.out, pdf: options.pdf, log: (line) => console.log(line) });
      console.log(briefs.length === 0 ? 'no briefs to render' : `rendered ${briefs.length} brief(s) into ${options.out}`);
    }
  } catch (error) {
    console.error(error instanceof BriefError ? `invalid brief: ${error.message}` : `render failed: ${error.message}`);
    process.exit(1);
  }
}
