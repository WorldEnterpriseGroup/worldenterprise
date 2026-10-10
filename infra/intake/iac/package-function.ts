/**
 * Packages the compiled Function for Flex Consumption deployment: `dist/function.zip`, containing host.json, package.json,
 * the compiled `dist/**`, the committed contract schema and the production dependencies. Run by `npm run build` after tsc,
 * and by the `intake:deploy` job. Run from `infra/intake`.
 *
 *   node iac/package-function.ts [--no-install]   (--no-install skips `npm ci` for a dry run of the layout)
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { createZip, type ZipEntry } from './zip.ts';

const root = process.cwd();
const stage = join(root, 'dist', 'package');
const schemaSource = join(root, '..', '..', 'docs', 'forms-contract.schema.json');

function fail(message: string): never {
  console.error(`package-function: ${message}`);
  process.exit(1);
}

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((item) => (item.isDirectory() ? walk(join(directory, item.name)) : [join(directory, item.name)]));
}

if (!existsSync(join(root, 'dist', 'functions.js'))) fail('dist/functions.js is missing; run tsc -p tsconfig.build.json first');
if (!existsSync(schemaSource)) fail('docs/forms-contract.schema.json is missing; the Function cannot start without the committed contract');

rmSync(stage, { recursive: true, force: true });
mkdirSync(join(stage, 'dist'), { recursive: true });

for (const item of readdirSync(join(root, 'dist'))) {
  if (item === 'package' || item.endsWith('.zip')) continue;
  cpSync(join(root, 'dist', item), join(stage, 'dist', item), { recursive: true });
}
cpSync(join(root, 'src', 'host.json'), join(stage, 'host.json'));
cpSync(schemaSource, join(stage, 'dist', 'service', 'forms-contract.schema.json'));

// The package.json and lockfile are copied unchanged so `npm ci` can verify them against each other; only production
// dependencies are installed, and install scripts never run.
cpSync(join(root, 'package.json'), join(stage, 'package.json'));
cpSync(join(root, 'package-lock.json'), join(stage, 'package-lock.json'));

if (!process.argv.includes('--no-install')) {
  execFileSync('npm', ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: stage, stdio: 'inherit' });
}
rmSync(join(stage, 'package-lock.json'), { force: true });

const entries: ZipEntry[] = walk(stage)
  .filter((file) => !file.includes(`${sep}node_modules${sep}.bin${sep}`) && statSync(file).isFile())
  .map((file) => ({ name: relative(stage, file).split(sep).join('/'), data: readFileSync(file) }));
const archive = createZip(entries);
writeFileSync(join(root, 'dist', 'function.zip'), archive);
console.log(`package-function: ${entries.length} files, ${archive.length} bytes, sha256 ${createHash('sha256').update(archive).digest('hex')}`);
