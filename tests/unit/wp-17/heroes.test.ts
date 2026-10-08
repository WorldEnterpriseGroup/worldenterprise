import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { APPLY, COMPOSE_TEAM, HOW_IT_WORKS, TALK_TO_WE, jumpTo } from '../../../src/components/hero/ctas.ts';

const ROOT = new URL('../../../', import.meta.url).pathname;
const read = (path: string): string => readFileSync(`${ROOT}${path}`, 'utf8');

function listFiles(dir: string, extension: string): string[] {
  return readdirSync(`${ROOT}${dir}`, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(path, extension);
    return path.endsWith(extension) ? [path] : [];
  });
}

test('the shared actions use the labels of the header buttons and point at launched routes', () => {
  assert.deepEqual(APPLY, { label: 'Apply', href: '/apply/' });
  assert.deepEqual(TALK_TO_WE, { label: 'Talk to WE', href: '/contact/' });
  assert.deepEqual(COMPOSE_TEAM, { label: 'Compose your team', href: '/tools/team-composer/' });
  assert.deepEqual(HOW_IT_WORKS, { label: 'See how it works', href: '/program/how-it-works/' });
});

test('jumpTo builds an in-page link and never doubles the hash', () => {
  assert.deepEqual(jumpTo('Start composing', '#composer'), { label: 'Start composing', href: '#composer' });
  assert.deepEqual(jumpTo('Start composing', 'composer'), { label: 'Start composing', href: '#composer' });
});

test('each hero mode marks its section so the suites and the styles can tell them apart', () => {
  const modes: Array<[string, string]> = [
    ['HeroEditorial', 'editorial'],
    ['HeroConsole', 'console'],
    ['HeroArticle', 'article'],
    ['HeroCompact', 'compact'],
  ];
  for (const [component, mode] of modes) {
    const source = read(`src/components/hero/${component}.astro`);
    assert.match(source, new RegExp(`data-hero="${mode}"`), `${component} carries data-hero="${mode}"`);
    assert.match(source, /data-measure=\{measure\}/, `${component} reports its measure`);
  }
});

test('the actions render the primary first and mark both links for the e2e suite', () => {
  const source = read('src/components/hero/HeroActions.astro');
  assert.ok(source.indexOf('data-hero-action="primary"') < source.indexOf('data-hero-action="secondary"'), 'primary comes before secondary');
  assert.match(source, /btn--primary/, 'the primary is the filled button');
  assert.match(source, /href\(primary\.href\)/, 'links go through href()');
});

test('the editorial hero keeps the photo-pass image shape and reserves the media space', () => {
  const source = read('src/components/hero/HeroEditorial.astro');
  assert.match(source, /<img src=\{image\.src\.src\} width=\{image\.src\.width\} height=\{image\.src\.height\} alt=\{image\.alt\} fetchpriority="high" decoding="async" \/>/);
  assert.doesNotMatch(source, /loading="lazy"/, 'the first-viewport image is never lazy');
  assert.match(source, /photo\?: SlotId/, 'the hero takes an optional photo slot');
  const css = read('src/styles/hero.css');
  assert.match(css, /\.hero__media \.hero__frame\s*\{[^}]*aspect-ratio:\s*16 \/ 9/, 'the frame reserves a 16/9 box on a phone');
  assert.match(css, /aspect-ratio:\s*4 \/ 3/, 'the frame reserves a 4/3 box beside the copy');
});

test('PageHero opens the editorial hero for a photo or art and the compact hero otherwise', () => {
  const source = read('src/components/hero/PageHero.astro');
  assert.match(source, /const editorial = photo !== undefined \|\| art !== undefined;/);
  assert.match(source, /<HeroEditorial \{\.\.\.copy\} photo=\{photo\} art=\{art\}>/);
  assert.match(source, /<HeroCompact \{\.\.\.copy\}>/);
  assert.match(source, /Astro\.slots\.has\('actions'\)/, 'the actions slot is forwarded only when the page fills it');
});

test('only the page hero asks for high fetch priority, and only one image per page does', () => {
  const owners = listFiles('src', '.astro').filter((path) => /fetchpriority="high"/.test(read(path)));
  // The heroes, the photo pass image component (priority flag) and the head preload are the only places that name it.
  const allowed = [
    'src/components/hero/HeroAtlas.astro',
    'src/components/hero/HeroEditorial.astro',
    'src/components/home/HomeHero.astro',
    'src/components/media/AvifPicture.astro',
    'src/components/seo/SeoHead.astro',
  ];
  for (const path of owners) {
    assert.ok(allowed.includes(path), `${path} is a hero, the photo image component or the head preload`);
  }
  for (const hub of ['program/index', 'playbooks/index', 'fundability/index', 'apply/index', 'contact/index', 'trust/index', 'resources/index']) {
    assert.doesNotMatch(read(`src/pages/${hub}.astro`), /<img\b/, `${hub} lets the hero load the first image`);
  }
});

test('the old page header is gone: no page or layout renders .page-header', () => {
  for (const path of [...listFiles('src/pages', '.astro'), ...listFiles('src/layouts', '.astro'), ...listFiles('src/components', '.astro')]) {
    assert.doesNotMatch(read(path), /class="[^"]*\bpage-header\b/, `${path} has no .page-header markup`);
  }
  assert.doesNotMatch(read('src/styles/components.css'), /\.page-header\b/, 'the old rules are removed');
});

test('every template layout opens with a hero component', () => {
  const heroes: Record<string, RegExp> = {
    HubLayout: /<HeroConsole[\s\S]*<PageHero/,
    StageLayout: /<PageHero/,
    ServiceLayout: /<PageHero/,
    PlaybookLayout: /<PageHero/,
    GuideLayout: /<PageHero/,
    ArticleHub: /<PageHero/,
    TemplateLayout: /<PageHero/,
    ToolLayout: /<PageHero/,
    FormLayout: /<PageHero/,
    ReferenceLayout: /<PageHero/,
    LegalLayout: /<PageHero/,
    MarketingLayout: /<PageHero/,
    ArticleLayout: /<HeroArticle/,
    BriefLayout: /<HeroArticle/,
  };
  for (const [layout, pattern] of Object.entries(heroes)) {
    assert.match(read(`src/layouts/${layout}.astro`), pattern, `${layout} opens with its hero`);
  }
});

test('hubs, stages, services and playbooks default to a primary action', () => {
  assert.match(read('src/layouts/HubLayout.astro'), /primary = APPLY/);
  assert.match(read('src/layouts/StageLayout.astro'), /primary = APPLY/);
  const service = read('src/layouts/ServiceLayout.astro');
  assert.match(service, /primary = APPLY, secondary = COMPOSE_TEAM/);
  assert.match(read('src/layouts/PlaybookLayout.astro'), /jumpTo\('Read the steps'/);
});

test('the services hub and the network hub open on the console hero with a panel', () => {
  for (const path of ['src/pages/services/index.astro', 'src/pages/network/index.astro']) {
    const source = read(path);
    assert.match(source, /hero="console"/, `${path} is a console hero`);
    assert.match(source, /slot="panel"/, `${path} fills the panel`);
  }
});

test('templates put the Markdown download in the hero', () => {
  const source = read('src/layouts/TemplateLayout.astro');
  assert.match(source, /download: true/);
  assert.match(source, /primary=\{primary \?\? download\}/);
});

test('the article layouts put the byline and topic into the article hero', () => {
  const article = read('src/layouts/ArticleLayout.astro');
  assert.match(article, /<HeroArticle/);
  assert.match(article, /slot="meta"/);
  assert.match(read('src/layouts/BriefLayout.astro'), /eyebrow="Research brief"/);
});

test('the FAQ page uses the shared FaqList with one accordion group per heading', () => {
  const page = read('src/pages/faq/index.astro');
  assert.match(page, /import FaqList from '..\/..\/components\/cards\/FaqList\.astro'/);
  assert.match(page, /name=\{`faq-\$\{g\.slug\}`\}/, 'the details name is scoped to the group');
  assert.match(page, /anchorId\('faq', item\.id\)/, 'each answer keeps its anchor id');
  assert.match(page, /faqPageNode\('\/faq\/', items\)/, 'the FAQ JSON-LD is still built from the full list');
  assert.throws(() => read('src/components/reference/FaqGroups.astro'), /ENOENT/, 'the private copy is removed');
  const list = read('src/components/cards/FaqList.astro');
  assert.match(list, /id=\{i\.id\}/, 'the list passes the id through');
  assert.match(read('src/components/ui/Faq.astro'), /<details class="faq" name=\{name\} id=\{id\}>/);
});

test('the services schema takes an optional artifacts list and the layout renders it before the body', () => {
  const config = read('src/content.config.ts');
  assert.match(config, /artifacts: z\.array\(z\.strictObject\(\{ name: z\.string\(\)\.min\(1\), purpose: z\.string\(\)\.min\(1\) \}\)\)\.default\(\[\]\)/);
  const layout = read('src/layouts/ServiceLayout.astro');
  assert.match(layout, /artifacts\.length > 0/);
  assert.ok(layout.indexOf('What you receive') < layout.indexOf('<slot />'), 'the table comes before the page body');
  assert.match(read('src/pages/services/[slug].astro'), /artifacts=\{data\.artifacts\}/);
});

test('a service entry that lists artifacts does not also carry its own "What you receive" section', () => {
  for (const path of listFiles('src/content/services', '.mdx')) {
    const source = read(path);
    const frontmatter = /^---\n([\s\S]*?)\n---/.exec(source)?.[1] ?? '';
    if (/^artifacts:/m.test(frontmatter)) {
      assert.doesNotMatch(source.slice(source.indexOf('\n---', 4)), /^## What you receive/m, `${path} shows the artifacts once`);
    }
  }
});
