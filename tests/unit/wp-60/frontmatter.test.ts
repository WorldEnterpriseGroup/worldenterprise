import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { parse } from 'yaml';
import { listCollectionFiles } from '../../../src/lib/content-files.ts';
import { schemas } from '../../../src/lib/content-schemas.ts';

/**
 * Every Markdown and MDX file of every collection parses under the schema that `src/content.config.ts` binds to it, as plain Node.
 * The build proves the same, but only in the build job: this brings the failure to the unit stage, before a build is spent on it.
 */
const root = new URL('../../../', import.meta.url).pathname;

type FileCollection = 'pages' | 'services' | 'playbooks' | 'guides' | 'insights' | 'research' | 'library' | 'briefs' | 'people' | 'events' | 'portfolio';
const COLLECTIONS: readonly FileCollection[] = ['pages', 'services', 'playbooks', 'guides', 'insights', 'research', 'library', 'briefs', 'people', 'events', 'portfolio'];

function frontmatter(path: string): unknown {
  const raw = readFileSync(path, 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  if (match?.[1] === undefined) throw new Error(`${path} has no frontmatter block.`);
  try {
    return parse(match[1]);
  } catch (error) {
    throw new Error(`${path}: frontmatter is not valid YAML: ${(error as Error).message}`);
  }
}

for (const collection of COLLECTIONS) {
  test(`${collection}: every file parses under its schema`, () => {
    for (const rel of listCollectionFiles(root, collection)) {
      const file = join(root, 'src', 'content', collection, rel);
      const result = schemas[collection].safeParse(frontmatter(file));
      assert.ok(result.success, `${collection}/${rel}: ${result.success ? '' : result.error.message}`);
    }
  });
}
