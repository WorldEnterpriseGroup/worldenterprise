import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parse } from 'yaml';
import { INSIGHT_SLUGS } from '../../../src/data/routes.ts';
import { PLAYBOOK_TITLES, TEMPLATE_TITLES } from '../../../src/components/insights/related.ts';
import { splitFrontmatter, visibleWords } from './words.ts';

interface Source { id: string; title: string; publisher: string; url: string }
interface Front {
  title: string; description: string; topic: string; publishedDate: Date; author?: string; sources: Source[];
  noStatistics?: boolean; evidence?: string[]; relatedServices?: string[]; relatedPlaybook?: string; relatedTemplate?: string;
}

const root = new URL('../../../src/content/insights/', import.meta.url);
const OWNED: Record<string, readonly string[]> = { dream: INSIGHT_SLUGS.slice(0, 4), build: INSIGHT_SLUGS.slice(4, 9) };
const denylist = JSON.parse(readFileSync(new URL('../../../claims-denylist.json', import.meta.url), 'utf8')) as { rules: { id: string; pattern: string; flags: string }[] };
const banned = [/\bguarantee[sd]?\b/i, /\bpremier\b/i, /\bcertified\b/i, /\bsuccess[- ]fees?\b/i, /\btrusted by\b/i, /\btestimonials?\b/i, /!\s/u];
const emoji = /\p{Extended_Pictographic}/u;

for (const [desk, slugs] of Object.entries(OWNED)) {
  const files = readdirSync(new URL(`${desk}/`, root)).filter((f) => f.endsWith('.mdx')).sort();
  test(`${desk} desk has exactly the planned articles`, () => {
    assert.deepEqual(files.map((f) => f.replace(/\.mdx$/, '')).sort(), [...slugs].sort());
  });
  for (const file of files) {
    const raw = readFileSync(new URL(`${desk}/${file}`, root), 'utf8');
    const { front, body } = splitFrontmatter(raw);
    const data = parse(front) as Front;
    test(`${file}: frontmatter, sources and evidence`, () => {
      assert.equal(data.topic, desk);
      assert.ok(data.description.length >= 50 && data.description.length <= 160, `description length ${data.description.length}`);
      assert.ok(data.sources.length >= 2, 'at least two sources');
      const ids = data.sources.map((s) => s.id);
      assert.equal(new Set(ids).size, ids.length, 'unique source ids');
      for (const e of data.evidence ?? []) assert.ok(ids.includes(e), `evidence ${e} is not a listed source`);
      for (const s of data.sources) assert.match(s.url, /^https:\/\//);
      assert.ok(data.relatedServices && data.relatedServices.length >= 1, 'a related service line');
      assert.ok(data.relatedPlaybook !== undefined && data.relatedPlaybook in PLAYBOOK_TITLES, 'a valid playbook');
      assert.ok(data.relatedTemplate !== undefined && data.relatedTemplate in TEMPLATE_TITLES, 'a valid template');
    });
    test(`${file}: length, structure and claims`, () => {
      const { total } = visibleWords(body);
      assert.ok(total >= 1200 && total <= 1800, `${total} words`);
      assert.ok(/<DataTable|<CellTrail|<Steps/.test(body), 'a table or diagram');
      assert.ok(!/^#\s/m.test(body), 'no h1 in body');
      assert.ok(/^## What this article cannot tell you/m.test(body), 'states its limits');
      for (const re of banned) assert.ok(!re.test(body.replace(/Eric Ries/g, '')), `banned pattern ${re}`);
      assert.ok(!emoji.test(body), 'no emoji');
      for (const rule of denylist.rules) assert.ok(!new RegExp(rule.pattern, rule.flags).test(body), `denylist ${rule.id}`);
    });
  }
}
