import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { frontMatterList, frontMatterScalar, normalize, proseOf, readBrief, sentencesOf, splitFrontMatter } from '../../../../scripts/lib/gated-briefs.mjs';

// WP-80: the squeeze pages of the four audience briefs (investors, partners, corporate teams). For each brief the page renders, the open
// abstract is visible, the form presets the audience the abstract names, and nothing of the gated body is on the page. Every locator is
// scoped to `main`: the header mega menu carries hidden brief links, and a page-wide locator would find those.
//
// The body is read from infra/intake/briefs/ at run time and compared as normalized text, so no sentence of it is copied into this file.
// A failed comparison reports the brief and the probe label and never the sentence, so a CI log does not become a second copy of the body.

const BRIEFS = [
  { id: 'early-stage-diligence', audience: 'investor' },
  { id: 'ai-company-diligence', audience: 'investor' },
  { id: 'partnering-with-founders', audience: 'partner' },
  { id: 'corporate-spinouts', audience: 'corporate' },
] as const;

const root = new URL('../../../../', import.meta.url).pathname;
const read = (path: string): string => readFileSync(`${root}${path}`, 'utf8');
const route = (id: string): string => `/briefs/${id}/`;

interface Abstract {
  readonly title: string;
  readonly audience: readonly string[];
  readonly outline: readonly string[];
  /** The first sentence of the abstract body, as the reader sees it, normalized. */
  readonly opening: string;
}

/** The sentences of a markdown text, as plain strings. */
const sentenceTexts = (markdown: string): string[] => (sentencesOf(proseOf(markdown)) as { text: string }[]).map((s) => s.text);

/** The block list `key:` of a front matter, one string per `  - item` line. */
function blockList(raw: string, key: string): string[] {
  const lines = raw.split(/\r?\n/);
  const at = lines.findIndex((line) => line.startsWith(`${key}:`));
  if (at < 0) return [];
  const items: string[] = [];
  for (const line of lines.slice(at + 1)) {
    const match = /^\s+-\s+(.*)$/.exec(line);
    if (match === null) break;
    items.push((match[1] ?? '').trim().replace(/^["']|["']$/g, ''));
  }
  return items;
}

function abstractOf(id: string): Abstract {
  const { raw, body } = splitFrontMatter(read(`src/content/briefs/${id}.md`)) as { raw: string; body: string };
  const first = sentenceTexts(body)[0];
  if (first === undefined) throw new Error(`src/content/briefs/${id}.md has no abstract sentence`);
  return {
    title: (frontMatterScalar(raw, 'title') as string | null) ?? '',
    audience: (frontMatterList(raw, 'audience') as string[] | null) ?? [],
    outline: blockList(raw, 'outline'),
    opening: normalize(first),
  };
}

interface Needle {
  readonly label: string;
  readonly text: string;
}

/**
 * What of the body must be absent: the sentinel, the three probes the leak audit uses, and ten more sentences of twelve words or more
 * taken at even spacing through the body, so a pasted section is caught even when it misses the audit's own probes.
 */
function needlesOf(id: string): Needle[] {
  const text = read(`infra/intake/briefs/${id}.md`);
  const brief = readBrief(`${id}.md`, text) as { sentinel: string | null; probes: { position: number; text: string }[]; body: string; errors: string[] };
  if (brief.errors.length > 0) throw new Error(`${id}: the brief is not auditable: ${brief.errors.join('; ')}`);
  const needles: Needle[] = [];
  if (brief.sentinel !== null) needles.push({ label: 'sentinel', text: brief.sentinel });
  for (const probe of brief.probes) needles.push({ label: `probe at ${probe.position} percent`, text: probe.text });
  const long = sentenceTexts(brief.body).filter((s) => s.split(/\s+/).length >= 12);
  const step = Math.max(1, Math.floor(long.length / 10));
  for (let i = 0, n = 0; i < long.length && n < 10; i += step, n += 1) needles.push({ label: `sampled sentence ${n + 1}`, text: long[i] ?? '' });
  return needles.filter((n) => n.text.trim() !== '');
}

for (const brief of BRIEFS) {
  test.describe(`${brief.id}`, () => {
    const abstract = abstractOf(brief.id);

    test('the abstract names the audience the registry gives, and only that one', () => {
      expect(abstract.audience, `src/content/briefs/${brief.id}.md audience`).toEqual([brief.audience]);
    });

    test('the squeeze page renders with one heading and the abstract in view', async ({ page }) => {
      const response = await page.goto(route(brief.id));
      expect(response?.status()).toBe(200);
      const main = page.locator('main');
      await expect(main.locator('h1')).toHaveCount(1);
      await expect(main.locator('h1')).toBeVisible();
      const text = normalize(await main.innerText());
      expect(text.includes(abstract.opening), `${brief.id}: the opening sentence of the abstract is on the page`).toBe(true);
      // The outline is the abstract's list of section titles: the first and the last are on the page.
      expect(abstract.outline.length, `${brief.id}: the abstract has an outline`).toBeGreaterThan(0);
      for (const title of [abstract.outline[0], abstract.outline[abstract.outline.length - 1]]) {
        expect(text.includes(normalize(title ?? '')), `${brief.id}: outline title "${title}" is on the page`).toBe(true);
      }
    });

    test('the request form presets the audience of the abstract and offers no choice of it', async ({ page }) => {
      await page.goto(route(brief.id));
      const form = page.locator('main form[data-intake-form]').first();
      await expect(form).toBeVisible();
      const preset = form.locator('input[name="audience"]');
      await expect(preset, 'a brief with one audience carries it as a hidden field').toHaveCount(1);
      await expect(preset).toHaveValue(abstract.audience[0] ?? 'missing');
      await expect(form.locator('select[name="audience"]'), 'no audience select on a one-audience brief').toHaveCount(0);
      await expect(form.locator('input[name="briefId"]')).toHaveValue(brief.id);
    });

    test('none of the body is on the page', async ({ page }) => {
      await page.goto(route(brief.id));
      const text = normalize(await page.locator('main').innerText());
      const needles = needlesOf(brief.id);
      expect(needles.length, `${brief.id}: the body gave probes to look for`).toBeGreaterThanOrEqual(4);
      const leaked = needles.filter((n) => text.includes(normalize(n.text))).map((n) => n.label);
      expect(leaked, `${brief.id}: body text found on the squeeze page (by label)`).toEqual([]);
    });

    test('the page stays an abstract, an outline and a form, with no more words than that', async ({ page }) => {
      await page.goto(route(brief.id));
      const words = (await page.locator('main').innerText()).split(/\s+/).filter(Boolean).length;
      expect(words, `${brief.id}: a squeeze page is never the brief`).toBeLessThan(1500);
    });
  });
}
