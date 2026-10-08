import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { pageTitle } from '../../../src/data/site.ts';
import { TITLE_MAX } from '../../../src/lib/seo.ts';

const ROOT = new URL('../../../', import.meta.url).pathname;

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? files(full) : /\.mdx?$/.test(entry.name) ? [full] : [];
  });
}

function field(source: string, key: string): string | undefined {
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source)?.[1] ?? '';
  const raw = new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm').exec(block)?.[1];
  return raw?.replace(/^["']|["']$/g, '');
}

// Collections whose frontmatter title feeds the document title unchanged. A title that cannot fit needs a seoTitle.
const COLLECTIONS = ['insights', 'pages', 'guides', 'playbooks', 'library'] as const;

for (const collection of COLLECTIONS) {
  test(`${collection}: every document title fits in ${TITLE_MAX} characters, with a seoTitle where the heading is too long`, () => {
    const tooLong: string[] = [];
    for (const file of files(join(ROOT, 'src', 'content', collection))) {
      const source = readFileSync(file, 'utf8');
      const title = field(source, 'title');
      if (title === undefined) continue;
      const effective = pageTitle(field(source, 'seoTitle') ?? title);
      if (effective.length > TITLE_MAX) tooLong.push(`${file.slice(ROOT.length)}: ${effective.length} characters`);
    }
    assert.deepEqual(tooLong, []);
  });
}
