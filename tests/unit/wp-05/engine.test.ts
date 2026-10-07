import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { routes } from '../../../src/data/routes.ts';
import { PLAYBOOK_TITLES, SERVICE_PATHS, TEMPLATE_TITLES, pickRelated, seedFrom } from '../../../src/components/insights/related.ts';

const ledger = new Set(routes.map((r) => r.path));

test('every related target is a ledger route', () => {
  for (const s of Object.values(SERVICE_PATHS)) assert.ok(ledger.has(s.path), s.path);
  for (const slug of Object.keys(PLAYBOOK_TITLES)) assert.ok(ledger.has(`/playbooks/${slug}/`), slug);
  for (const slug of Object.keys(TEMPLATE_TITLES)) assert.ok(ledger.has(`/library/${slug}/`), slug);
});

test('pickRelated drops routes that are not live and rejects unknown slugs', () => {
  const refs = { services: ['B'] as const, playbook: 'build-and-ship-v1', template: 'mvp-cut-line-worksheet' };
  assert.equal(pickRelated({ services: [...refs.services], playbook: refs.playbook, template: refs.template }, () => true).length, 3);
  assert.equal(pickRelated({ services: [...refs.services], playbook: refs.playbook }, (p) => p.startsWith('/services/')).length, 1);
  assert.throws(() => pickRelated({ services: [], playbook: 'nope' }, () => true), /Unknown relatedPlaybook/);
  assert.throws(() => pickRelated({ services: [], template: 'nope' }, () => true), /Unknown relatedTemplate/);
});

test('cover seed is deterministic and distinguishes slugs', () => {
  assert.equal(seedFrom('dream:a'), seedFrom('dream:a'));
  assert.notEqual(seedFrom('dream:a'), seedFrom('dream:b'));
});

test('editor introductions are 120 to 200 words', () => {
  for (const name of ['topic-dream', 'topic-build']) {
    const raw = readFileSync(new URL(`../../../src/content/pages/insights/${name}.mdx`, import.meta.url), 'utf8');
    const body = raw.split(/^---$/m)[2] ?? '';
    const words = body.split(/\s+/).filter(Boolean).length;
    assert.ok(words >= 120 && words <= 200, `${name} has ${words} words`);
  }
});
