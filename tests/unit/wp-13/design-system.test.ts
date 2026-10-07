import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { auditCss, auditTree } from '../../../scripts/audit-tokens.mjs';
import { flower, hexPoints } from '../../../src/components/diagrams/hex.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** Every public component and layout shipped at G0. Additive-only: none may be renamed or removed before Wave 4. */
const PUBLIC = [
  'layout/Breadcrumbs', 'layout/Footer', 'layout/Header', 'layout/MegaNav', 'layout/MobileNav', 'layout/PageHeader', 'layout/SkipLink', 'layout/UtilityBar',
  'ui/Accordion', 'ui/Button', 'ui/Callout', 'ui/Card', 'ui/CellTrail', 'ui/Container', 'ui/CtaBand', 'ui/DataTable', 'ui/Eyebrow', 'ui/FactBand', 'ui/Faq', 'ui/Figure',
  'ui/Grid', 'ui/Hex', 'ui/HexAtlas', 'ui/HexIcon', 'ui/Meter', 'ui/Prose', 'ui/PullQuote', 'ui/ReadingProgress', 'ui/Rule', 'ui/Section', 'ui/Stack', 'ui/Steps',
  'ui/Tabs', 'ui/Tag', 'ui/Toc',
  'blocks/ContextualNext', 'blocks/EvidenceLedger', 'blocks/LimitsBlock', 'blocks/MethodologyBox', 'blocks/NoFundingDisclaimer', 'blocks/RelatedRail', 'blocks/SourcesList',
  'hero/HeroArticle', 'hero/HeroAtlas', 'hero/HeroCompact', 'hero/HeroConsole', 'hero/HeroEditorial',
  'cards/ArticleCard', 'cards/BriefCard', 'cards/FaqList', 'cards/PlaybookCard', 'cards/RoleCard', 'cards/ServiceCard', 'cards/TemplateCard',
  'diagrams/AltitudeDiagram', 'diagrams/SeatDiagram', 'diagrams/ServiceLinesStrip', 'diagrams/ConsolePanel', 'diagrams/RoadmapPanel', 'diagrams/RiskRegisterPanel',
  'diagrams/SeatRosterPanel', 'diagrams/WeeklyReviewPanel', 'diagrams/HexAtlasArt', 'motion/Reveal',
];
const LAYOUTS = [
  'ArticleHub', 'ArticleLayout', 'BaseLayout', 'BriefLayout', 'FormLayout', 'GuideLayout', 'HomeLayout', 'HubLayout', 'LegalLayout', 'MarketingLayout',
  'PlaybookLayout', 'ReferenceLayout', 'ServiceLayout', 'StageLayout', 'TemplateLayout', 'ToolLayout',
];

describe('public component surface', () => {
  for (const name of PUBLIC) {
    it(`${name} exists and renders a template`, () => {
      const path = join(root, 'src', 'components', `${name}.astro`);
      assert.ok(existsSync(path), `${path} is missing`);
      assert.ok(readFileSync(path, 'utf8').trim().length > 0, `${path} is empty`);
    });
  }
  for (const name of LAYOUTS) {
    it(`layout ${name} exists`, () => {
      assert.ok(existsSync(join(root, 'src', 'layouts', `${name}.astro`)));
    });
  }
});

describe('design tokens audit', () => {
  it('the design-system sources have no raw colours, stray !important or magic spacing', () => {
    const found = auditTree(root, /^src\/(styles|layouts|components\/(ui|hero|diagrams|motion|layout|nav|cards|blocks))\//);
    assert.deepEqual(found.map((v: { file: string; line: number; rule: string }) => `${v.file}:${v.line} ${v.rule}`), []);
  });

  it('flags a raw hex colour', () => {
    assert.equal(auditCss('x.css', '.a {\n  color: #fff;\n}').length, 1);
  });

  it('flags !important outside reduced motion and allows it inside', () => {
    assert.equal(auditCss('x.css', '.a {\n  display: none !important;\n}').length, 1);
    assert.equal(auditCss('x.css', '@media (prefers-reduced-motion: reduce) {\n  .a {\n    transition: none !important;\n  }\n}').length, 0);
  });

  it('flags magic spacing and accepts the scale', () => {
    assert.equal(auditCss('x.css', '.a {\n  padding: 13px;\n}').length, 1);
    assert.equal(auditCss('x.css', '.a {\n  padding: var(--sp-3) 0;\n  margin-inline: auto;\n}').length, 0);
  });

  it('allows system colours in forced-colors blocks', () => {
    assert.equal(auditCss('x.css', '@media (forced-colors: active) {\n  .a {\n    background: ButtonText;\n    color: red;\n  }\n}').length, 0);
  });
});

describe('layer order in component style blocks', () => {
  it('every <style> block that opens a layer first repeats the full layer order', () => {
    const ORDER = '@layer reset, tokens, base, layout, components, utilities, pages, print;';
    const dirs = ['diagrams', 'ui', 'hero', 'layout', 'cards', 'blocks', 'motion'];
    const bad: string[] = [];
    for (const d of dirs) {
      const base = join(root, 'src', 'components', d);
      for (const f of readdirSync(base).filter((n) => n.endsWith('.astro'))) {
        const text = readFileSync(join(base, f), 'utf8');
        for (const m of text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)) {
          const css = m[1] ?? '';
          if (/@layer\s+\w+\s*\{/.test(css) && !css.includes(ORDER)) bad.push(`${d}/${f}`);
        }
      }
    }
    assert.deepEqual(bad, []);
  });
});

describe('hex geometry', () => {
  it('emits six points for a hexagon', () => {
    assert.equal(hexPoints(0, 0, 10).split(' ').length, 6);
  });

  it('places six neighbours at equal distance from the centre cell', () => {
    const cells = flower(100, 100, 20, 0.1);
    assert.equal(cells.length, 7);
    const [centre, ...ring] = cells;
    const distances = ring.map((c) => Math.hypot(c.x - (centre?.x ?? 0), c.y - (centre?.y ?? 0)));
    for (const d of distances) assert.ok(Math.abs(d - (distances[0] ?? 0)) < 0.05);
  });
});

describe('motion and accessibility rules in the global styles', () => {
  const read = (f: string): string => readFileSync(join(root, 'src', 'styles', f), 'utf8');

  it('scroll-driven animation sits behind @supports and no-preference', () => {
    const m = read('motion.css');
    assert.match(m, /prefers-reduced-motion: no-preference[\s\S]*@supports \(animation-timeline: view\(\)\)/);
  });

  it('declares a forced-colors block and a print layer', () => {
    assert.match(read('base.css'), /forced-colors: active/);
    assert.match(read('print.css'), /@media print/);
  });
});
