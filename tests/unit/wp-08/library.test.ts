import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildMarkdownDownload, entrySlug, markdownPath, restoreTaskBoxes } from '../../../src/components/library/markdown.ts';
import { FUNDING_RELATED, relatedFor, RELATED_BY_TEMPLATE } from '../../../src/components/library/related.ts';
import { LIBRARY_SLUGS } from '../../../src/data/routes.ts';

const LIBRARY_DIR = new URL('../../../src/content/library/', import.meta.url);

test('task boxes written as escaped brackets are restored in the download', () => {
  assert.equal(restoreTaskBoxes('- \\[ \\] item'), '- [ ] item');
});

test('download has a title, instructions, body and a dated footer', () => {
  const md = buildMarkdownDownload({
    title: 'T',
    description: 'D',
    instructions: 'Do this.',
    body: '## Body\n\n- \\[ \\] one\n',
    updated: new Date('2026-10-06T00:00:00Z'),
  });
  assert.ok(md.startsWith('# T\n'));
  assert.ok(md.includes('> **How to use this.** Do this.'));
  assert.ok(md.includes('- [ ] one'));
  assert.ok(md.includes('Last updated 2026-10-06.'));
});

test('slug is the last id segment and the download path matches the route', () => {
  assert.equal(entrySlug('_fixtures/fixture-template'), 'fixture-template');
  assert.equal(markdownPath('one-page-problem-brief'), '/library/one-page-problem-brief.md');
});

test('there is one non-draft source file for every ledger library slug', () => {
  const files = new Set(readdirSync(LIBRARY_DIR).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')));
  for (const slug of LIBRARY_SLUGS) assert.ok(files.has(slug), `missing src/content/library/${slug}.md`);
  for (const slug of LIBRARY_SLUGS) {
    const text = readFileSync(new URL(`${slug}.md`, LIBRARY_DIR), 'utf8');
    assert.ok(!/^draft:\s*true/m.test(text), `${slug} is a draft`);
    const description = /^description:\s*(.+)$/m.exec(text)?.[1] ?? '';
    assert.ok(description.length >= 50 && description.length <= 160, `${slug} description is ${description.length} characters`);
    const title = /^title:\s*(.+)$/m.exec(text)?.[1] ?? '';
    assert.ok(title.length > 0 && title.length <= 31, `${slug} title "${title}" must fit the 60 character page title`);
  }
});

test('related links are filtered by route state', () => {
  assert.deepEqual(relatedFor('one-page-problem-brief', () => false), []);
  const all = relatedFor('one-page-problem-brief', () => true);
  assert.equal(all.length, RELATED_BY_TEMPLATE['one-page-problem-brief']?.length);
  assert.deepEqual(relatedFor('unknown-slug', () => true), []);
});

test('investor-facing templates carry the no-funding disclaimer', () => {
  assert.ok(FUNDING_RELATED.has('seed-data-room-checklist'));
  assert.ok(FUNDING_RELATED.has('weekly-investor-update-template'));
});

test('templates never contain denylisted wording', () => {
  const deny = JSON.parse(readFileSync(new URL('../../../claims-denylist.json', import.meta.url), 'utf8')) as {
    rules: { id: string; pattern: string; flags?: string }[];
  };
  for (const file of readdirSync(LIBRARY_DIR).filter((f) => f.endsWith('.md'))) {
    const text = readFileSync(new URL(file, LIBRARY_DIR), 'utf8');
    for (const rule of deny.rules) {
      assert.equal(new RegExp(rule.pattern, rule.flags ?? '').test(text), false, `${file} matches ${rule.id}`);
    }
  }
});
