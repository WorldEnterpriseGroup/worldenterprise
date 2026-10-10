#!/usr/bin/env node
// Rebuild the assembled prompts and hashes of every scripts/photo/prompts/<id>.json from its hand-authored parts, or check them.
//   node scripts/photo/build-prompts.mjs           rewrite prompts + promptSha256 in each file
//   node scripts/photo/build-prompts.mjs --check   lint the parts, compare stored text and hashes, exit 1 on any problem
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PHOTO_DIR, loadExtract, parseArgs, rasterSlots, readJson } from './lib/common.mjs';
import { buildPrompts, hashPrompts, lintAssembled, lintParts } from './lib/prompt.mjs';

const PROMPT_DIR = join(PHOTO_DIR, 'prompts');

export function loadPromptFiles(dir = PROMPT_DIR) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => readJson(join(dir, name)));
}

/** Problems across the whole prompt set: one file per raster slot, authored parts clean, stored text current. */
export function checkAll(files, extract) {
  const problems = [];
  const slots = rasterSlots(extract);
  const ids = new Set(files.map((file) => file.id));
  for (const slot of slots) if (!ids.has(slot.id)) problems.push(`${slot.id}: no prompt file`);
  for (const file of files) {
    const slot = slots.find((candidate) => candidate.id === file.id);
    if (!slot) {
      problems.push(`${file.id}: not a raster slot of the shotlist extract`);
      continue;
    }
    if (file.people !== slot.people) problems.push(`${file.id}: people class "${file.people}" differs from the shotlist "${slot.people}"`);
    problems.push(...lintParts(file), ...lintAssembled(file));
  }
  return problems;
}

function main() {
  const args = parseArgs(process.argv.slice(2), { booleans: ['check'] });
  const files = loadPromptFiles();
  const extract = loadExtract();
  if (args.check) {
    const problems = checkAll(files, extract);
    if (problems.length > 0) {
      console.error(problems.join('\n'));
      process.exit(1);
    }
    console.log(`${files.length} prompt files OK`);
    return;
  }
  for (const file of files) {
    file.prompts = buildPrompts(file);
    file.promptSha256 = hashPrompts(file.prompts);
    writeFileSync(join(PROMPT_DIR, `${file.id}.json`), `${JSON.stringify(file, null, 2)}\n`);
  }
  console.log(`rebuilt ${files.length} prompt files`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) main();
