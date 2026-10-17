import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { watch } from '../../support/page-guards.ts';
import { frontMatterScalar, normalize, proseOf, readBrief, splitFrontMatter } from '../../../../scripts/lib/gated-briefs.mjs';

// WP-79: the squeeze pages of the second set of gated founder briefs. Each page is built by WP-63's system (src/pages/briefs/[id].astro) from
// the open abstract, so what is asserted here is that the system renders these three briefs and that none of the gated text reaches a page.
//
// The text of a brief is read from infra/intake/briefs/ at run time and is never copied into this file, so this spec holds none of it. Locators
// are scoped to `main`: the header mega menu carries hidden brief links that are not part of the squeeze page.

const IDS = ['first-100-customers', 'pre-seed-evidence-pack', 'first-hires'] as const;
const FORM = 'form[data-intake-form]';
/** The shared-run length of the repository's abstract rule (scripts/lib/gated-briefs.mjs, ABSTRACT_RUN_WORDS). */
const RUN_WORDS = 10;

interface Abstract {
  readonly title: string;
  readonly outline: readonly string[];
  readonly paragraphs: readonly string[];
}

const root = process.cwd();

/** The open abstract of a brief: its title, its outline titles in order and its paragraphs. */
function readAbstract(id: string): Abstract {
  const { raw, body } = splitFrontMatter(readFileSync(join(root, 'src/content/briefs', `${id}.md`), 'utf8')) as { raw: string; body: string };
  const title = frontMatterScalar(raw, 'title') as string | null;
  if (title === null) throw new Error(`${id}: the abstract has no title`);
  const lines = raw.split(/\r?\n/);
  const start = lines.findIndex((line) => /^outline:\s*$/.test(line));
  if (start === -1) throw new Error(`${id}: the abstract has no block outline`);
  const outline: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item === null) break;
    outline.push((item[1] ?? '').trim().replace(/^"(.*)"$/, '$1'));
  }
  const paragraphs = body.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p !== '');
  return { title, outline, paragraphs };
}

/** Lower-cased word tokens, curly quotes folded, so a run is compared the same way on both sides. */
const tokens = (text: string): string[] => normalize(text).match(/[a-z0-9']+/g) ?? [];

function runsOf(words: readonly string[], length: number): Map<string, number> {
  const runs = new Map<string, number>();
  for (let i = 0; i + length <= words.length; i += 1) runs.set(words.slice(i, i + length).join(' '), i);
  return runs;
}

for (const id of IDS) {
  const route = `/briefs/${id}/`;
  const abstract = readAbstract(id);
  const brief = readBrief(join(root, 'infra/intake/briefs', `${id}.md`), readFileSync(join(root, 'infra/intake/briefs', `${id}.md`), 'utf8')) as {
    sentinel: string | null;
    probes: { position: number; text: string }[];
    body: string;
    errors: string[];
  };

  test.describe(id, () => {
    test('the gated brief is readable by the spec, so the absence checks below have text to look for', () => {
      expect(brief.errors, 'the brief must be auditable').toEqual([]);
      expect(brief.sentinel, 'the brief carries a sentinel').not.toBeNull();
      expect(brief.probes.length, 'the brief yields probe sentences').toBeGreaterThan(0);
    });

    test('the squeeze page is built by the brief system: one h1 with the abstract title, the request panel and the form for this brief', async ({ page, baseURL }) => {
      const seen = watch(page, baseURL ?? '', []);
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      const main = page.locator('main');
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).toContainText(abstract.title);
      const panel = main.locator('[data-brief-request]');
      await expect(panel).toHaveCount(1);
      await expect(panel).toHaveAttribute('data-mode', /^(disabled|endpoint)$/);
      const form = main.locator(FORM);
      await expect(form).toHaveCount(1);
      await expect(form).toHaveAttribute('data-kind', 'brief-request');
      await expect(form.locator('input[name="briefId"]')).toHaveValue(id);
      expect(seen.consoleErrors).toEqual([]);
      expect(seen.pageErrors).toEqual([]);
      expect(seen.thirdParty).toEqual([]);
    });

    test('the abstract is visible and the outline lists the sections of the brief in order', async ({ page }) => {
      await page.goto(route);
      const main = page.locator('main');
      await expect(main.locator('p').filter({ hasText: abstract.paragraphs[0] ?? '' }).first()).toBeVisible();
      const text = normalize(await main.innerText());
      for (const paragraph of abstract.paragraphs) {
        expect(text, 'every paragraph of the abstract is on the page').toContain(normalize(paragraph));
      }
      const items = main.locator('#outline li');
      await expect(items).toHaveText([...abstract.outline]);
      const headings = [...brief.body.matchAll(/^##[ \t]+(.+?)[ \t]*$/gm)].map((m) => m[1] ?? '');
      expect([...abstract.outline], 'the outline is the H2 titles of the brief').toEqual(headings);
    });

    test('the request form is labelled: name, email and consent each have an accessible name, and the form has a legend', async ({ page }) => {
      await page.goto(route);
      const form = page.locator('main').locator(FORM);
      await expect(form.getByLabel('Your name')).toBeVisible();
      await expect(form.getByLabel('Email address')).toBeVisible();
      await expect(form.locator('[name="consent"]')).toHaveAccessibleName(/\S/);
      await expect(form.locator('fieldset > legend').first()).toContainText('Request the brief');
      const controls = form.locator('input:not([type="hidden"]), select, textarea').filter({ visible: true });
      const count = await controls.count();
      expect(count, 'the form has visible controls').toBeGreaterThan(2);
      for (let i = 0; i < count; i += 1) {
        const control = controls.nth(i);
        // The honeypot is the one control that is not for a person; it is hidden from the accessibility tree and may carry no name.
        if (await control.evaluate((el) => el.closest('[aria-hidden="true"]') !== null)) continue;
        await expect(control).toHaveAccessibleName(/\S/);
      }
    });

    test('none of the gated text is on the page: no sentinel, no probe sentence and no ten-word run of the brief', async ({ page }) => {
      await page.goto(route);
      const main = page.locator('main');
      // textContent takes in text the page hides as well as text it shows.
      const content = (await main.textContent()) ?? '';
      const pageText = normalize(content);
      expect(pageText, 'the sentinel is not on the page').not.toContain(normalize(brief.sentinel ?? '\u0000'));
      for (const probe of brief.probes) expect(pageText, `the probe at ${probe.position} percent is not on the page`).not.toContain(normalize(probe.text));
      const pageRuns = runsOf(tokens(content), RUN_WORDS);
      const shared = [...runsOf(tokens(proseOf(brief.body)), RUN_WORDS).keys()].filter((run) => pageRuns.has(run));
      expect(shared, `ten-word runs of the brief found on the page: ${shared.slice(0, 3).join(' | ')}`).toEqual([]);
    });

    test('the page is an abstract, an outline and a form, and the brief text is not in the document as markup either', async ({ page }) => {
      await page.goto(route);
      const words = (await page.locator('main').innerText()).split(/\s+/).filter(Boolean).length;
      expect(words, 'a squeeze page is an abstract, an outline and a form, never the brief').toBeLessThan(1500);
      const html = normalize(await page.content());
      expect(html, 'the sentinel is not in the document source').not.toContain(normalize(brief.sentinel ?? '\u0000'));
      for (const probe of brief.probes) expect(html, `the probe at ${probe.position} percent is not in the document source`).not.toContain(normalize(probe.text));
    });
  });
}
