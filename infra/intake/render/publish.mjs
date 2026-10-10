/**
 * Publishes the rendered briefs to the private `briefs` container with the Azure CLI, authenticated as the pipeline's
 * federated identity (`--auth-mode login`); no key or SAS is involved.
 *
 *   node render/publish.mjs --out render/out --account <storage account> [--container briefs]
 *
 * Versions are immutable. Each uploaded blob carries the sha256 of its content in metadata. A version that is already
 * published with the same content is skipped; the same version with different content fails and tells the author to bump
 * the version, because readers hold links to it. The registry (`briefs.json`) is written last, so a brief appears in it
 * only after its files exist.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const TYPES = { '.html': 'text/html; charset=utf-8', '.pdf': 'application/pdf', '.json': 'application/json' };
const CACHE = 'private, no-store';

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

/** The uploads for an --out folder: versioned files first (immutable), the registry last. */
export function uploadPlan(outDir) {
  const files = [...walk(join(outDir, 'briefs'))].sort().map((path) => {
    const blob = relative(outDir, path).split('\\').join('/');
    const extension = blob.slice(blob.lastIndexOf('.'));
    if (!(extension in TYPES)) throw new Error(`unexpected file in the render output: ${blob}`);
    return { file: path, blob, contentType: TYPES[extension], sha256: createHash('sha256').update(readFileSync(path)).digest('hex'), immutable: true };
  });
  const registry = join(outDir, 'briefs.json');
  const registryBytes = readFileSync(registry);
  return [...files, { file: registry, blob: 'briefs.json', contentType: TYPES['.json'], sha256: createHash('sha256').update(registryBytes).digest('hex'), immutable: false }];
}

function azure(account, container) {
  return ['--auth-mode', 'login', '--account-name', account, '--container-name', container, '--only-show-errors'];
}

/**
 * `run(args)` executes `az` and returns `{ status, stdout, stderr }`; replaced in tests. Returns what was uploaded and skipped.
 * A versioned blob is considered one unit with its sibling: an html that matches means the version is already published.
 */
export function publish({ outDir, account, container = 'briefs', run, log }) {
  const plan = uploadPlan(outDir);
  const uploaded = [];
  const skipped = [];
  const published = new Set();

  for (const item of plan) {
    if (item.immutable) {
      const show = run(['storage', 'blob', 'show', ...azure(account, container), '--name', item.blob, '--query', 'metadata.sha256', '-o', 'tsv']);
      if (show.status === 0) {
        const existing = show.stdout.trim();
        // PDFs are not byte-stable between renders, so a version is judged by its html, which is.
        if (item.blob.endsWith('.html') && existing !== item.sha256) {
          throw new Error(`${item.blob} is already published with different content; bump the version in the brief's front matter`);
        }
        skipped.push(item.blob);
        published.add(item.blob);
        log(`kept    ${item.blob}`);
        continue;
      }
      if (!/BlobNotFound|does not exist|ResourceNotFound/i.test(show.stderr)) throw new Error(`could not check ${item.blob}: ${show.stderr.trim().split('\n').pop() ?? 'unknown error'}`);
    }
    const upload = run([
      'storage', 'blob', 'upload', ...azure(account, container), '--name', item.blob, '--file', item.file, '--content-type', item.contentType,
      '--content-cache-control', CACHE, '--metadata', `sha256=${item.sha256}`, '--overwrite', item.immutable ? 'false' : 'true',
    ]);
    if (upload.status !== 0) throw new Error(`upload of ${item.blob} failed: ${upload.stderr.trim().split('\n').pop() ?? 'unknown error'}`);
    uploaded.push(item.blob);
    log(`uploaded ${item.blob}`);
  }
  return { uploaded, skipped };
}

function runAz(args) {
  const result = spawnSync('az', args, { encoding: 'utf8' });
  if (result.error !== undefined) throw new Error(`the Azure CLI did not run: ${result.error.message}`);
  return { status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

if (import.meta.main) {
  try {
    const argv = process.argv.slice(2);
    const value = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
    const outDir = value('--out', 'render/out');
    const account = value('--account', process.env.STORAGE_ACCOUNT ?? '');
    if (account === '') throw new Error('--account (or STORAGE_ACCOUNT) is required');
    const result = publish({ outDir, account, container: value('--container', 'briefs'), run: runAz, log: (line) => console.log(line) });
    console.log(`published: ${result.uploaded.length} uploaded, ${result.skipped.length} already present`);
  } catch (error) {
    console.error(`publish failed: ${error.message}`);
    process.exit(1);
  }
}
