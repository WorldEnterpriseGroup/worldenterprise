# Wave 9 contracts: full-bleed layout, visuals, 1920 tests

Owner: WP-51 (issue #72), handed to WP-57 at close. Decisions W9-1 to W9-11 in `.astro-magazine/decisions.md`. Write sets: `.astro-magazine/plans/wave9/writesets.json`.

A wave 9 package builds on these names. A missing prop or utility is requested from WP-57 (or a WP-51 fix-forward); it is never added by editing a file another package holds.

## 1. Tokens (`src/styles/tokens.css`, WP-51)

| Token | Value | Use |
|---|---|---|
| `--content-max` | `110rem` (1760px) | The content frame. `--page-max` points to it, so every `.container` uses it. |
| `--page-max` | `var(--content-max)` | Kept for existing rules. |
| `--prose-max` | `46rem` | Reading column. Unchanged. |
| `--split-text` | `40rem` | Text column inside a `.split`. |
| `--gutter` | `clamp(1rem, 0.0769rem + 4.1026vw, 5rem)` | Side gutter: 16px up to 360, 60px at 1440, 80px at 1920. |
| `--band-pad` | fluid, 48px to about 128px | Vertical padding of a `.band`. Family templates audited by the WP-71 brand audit use `--sp-*` steps instead (see 6). |
| `--fs-lg` to `--fs-4xl`, `--space-*` | clamp from 360 to 1920 | The 360 and 1440 values are unchanged; the line continues to 1920 (h1 about 68px, display about 91px, section padding about 94px). `--fs-xs` to `--fs-lead` keep their 1440 ceiling. |
| `--color-band-deep-bg` | `var(--color-bg-inverse)` (blue-night) | Background of a dark galaxy band (W9-7). |
| `--color-band-deep-text`, `--color-band-deep-muted`, `--color-band-deep-link`, `--color-band-deep-accent` | white, mist, tint blue, amber | Text on a dark band. Contrast pairs are checked by `audit:contrast`. |
| `--color-band-deep-soft`, `--color-band-deep-line` | blue-deep, a mixed hairline | A panel inside a dark band (text pairs checked); decorative lines. |

Never name anything `container--wide` or `--page-wide` (`tests/unit/wp-16/layout-css.test.ts`).

## 2. Layout utilities (`src/styles/layout.css`, WP-51)

- `.container`: `min(100% - 2 * var(--gutter), var(--page-max))`, centred. 1760px at 1920.
- `.container--prose`: the 46rem reading column, for article bodies, legal text and guides only.
- `.band`: a full-bleed section with `--band-pad` vertical padding. Put a `.container` inside it. `overflow-x: clip`, so a `.bleed-media` child never adds a horizontal scroll. Tones: `.band--soft` (mist), `.band--tint-blue`, `.band--tint-sand`, `.band--tint-stone`, `.band--deep` (blue-night, a CSS starfield fallback). `.band--deep` re-points `--color-text`, `--color-text-muted`, `--color-link`, `--color-link-hover`, `--color-highlight-ink`, `--color-bg-soft`, `--color-border` and `--color-focus` to the deep tokens, so components inside read light on night blue with no dark rules of their own. A `.band--deep` never holds the logo. `.band` does not combine with `.section` spacing rules; use one or the other.
- `.split`: one column below 62rem, then `minmax(0, var(--split-text)) minmax(0, 1fr)`: text, then the visual with the rest of the frame (about 1056px at 1920). Gap `--space-block`, items centred. Children: `.split__text`, `.split__media`. Modifiers: `.split--reverse` (visual on the left from 62rem), `.split--even` (1fr 1fr), `.split--media-first` (visual first on one column only). The text column starts at the container edge, so the hero h1 and the first body container keep one left x.
- `.bleed-media` (on the visual inside `.split__media`, from 62rem): a negative end margin runs it to the viewport edge; `.bleed-media--start` for a visual on the left (`.split--reverse`). Needs a `.band` ancestor, whose clip absorbs the scrollbar width.
- `.flow-wide`: the default body of `MarketingLayout` in the wide frame. Paragraphs, headings and blockquotes at any depth, and top-level lists, `dl` and `.callout`, keep `min(--prose-max, 80ch)` at the frame's left edge; figures, tables, grids and splits use the frame. The same cap applies inside every `.prose` block, so prose that sits in a widened `.container` (hubs, services, forms) never runs past 46rem. A component's own width rule wins (layer order).
- `.grid` with `--grid-min` adds columns by itself; `.grid--min-20` gives 5 columns at 1760.
- `.with-rail` (article pages): from 62rem `minmax(0, 46rem) minmax(14rem, 30rem)` with `justify-content: space-between`, so the body keeps the left edge and the rail sits at the frame's right edge.

## 3. Layout props (`src/layouts/**`, WP-51; all additive)

| Layout | Change |
|---|---|
| `MarketingLayout` | New `width?: 'content' \| 'prose'`, default `'content'`: the body sits in `.container .flow-wide prose`. `'prose'` restores the 46rem column. The hero copy follows the body edge as before. |
| `GuideLayout`, `TemplateLayout`, `LegalLayout`, `ReferenceLayout` (not `wide`) | Unchanged: the centred 46rem reading column, and the hero shares it (pinned by `tests/unit/wp-16/layout-css.test.ts`). A family package that wants a wide reading page builds it from `MarketingLayout` or `ArticleLayout`. `ReferenceLayout wide` uses the frame. |
| `HomeLayout`, `HubLayout`, `StageLayout`, `ServiceLayout`, `ToolLayout`, `ArticleHub`, `ArticleLayout`, `BriefLayout`, `PlaybookLayout`, `FormLayout` | Already use `.container`; they widen with the token. |
| `ArticleLayout`, `BriefLayout` | New optional named slot `aside`: its contents go in the sticky rail (after the contents list or the methodology box), for figures or notes beside the body. `ArticleLayout` renders the rail when it has a contents list or an `aside`, and leaves out the related section when `related` is empty. |
| `HomeLayout` | The LCP preload is the existing `preloadImage` prop (forwarded to `BaseLayout`). WP-53 points it at the galaxy poster (W9-6). |

`Section.astro` gains `tone="deep"`: the dark band (`section--soft section--tinted band--deep`), which spaces like a tinted band. `Prose.astro` gains `width?: 'prose' | 'content'` (default `'prose'`, unchanged); `'content'` renders `.container.flow-wide.prose`. `PageHero` and `HeroEditorial` gain `frame?: 'default' | 'wide'`.

## 4. Heroes (`src/components/hero/**`, `src/styles/hero.css`, WP-51)

- `.hero__grid--media` is 3fr/2fr from 62rem and `minmax(0, 5fr) minmax(0, 7fr)` from 100rem (1600px): at 1920 the visual is wider than the copy, while 1440 keeps the layout the fold tests pin.
- `.hero__frame` keeps 16/9 and 4/3; `data-frame="wide"` (the `frame="wide"` prop) is 21/9 from 62rem.
- `data-hero="scene"` is a hero mode for a `<we-scene>` poster in the frame (`HERO_MODES` in `src/components/hero/types.ts`; WP-52 supplies the component; WP-53 uses it on home and adds it to `HERO_MODES` in `tests/e2e/folds.spec.ts` if a listed layout uses it). A page has exactly one `[data-hero]`; a scene inside a hero never carries its own.
- Hero copy is never centred; the hero h1 and the first body container share one left x within 1px at 1440 (`tests/e2e/layout.spec.ts`).

## 5. Visuals contract (WP-52 builds, families use)

Namespace `src/components/visuals/**`, `src/scripts/visuals/**`, posters in `src/assets/visuals/**`.

| Component | Props (all optional unless marked) |
|---|---|
| `Band.astro` | `tone?: 'plain' \| 'soft' \| 'tint-blue' \| 'tint-sand' \| 'tint-stone' \| 'deep'`, `id?`, `labelledby?`, `defer?: boolean`; slot `scene` for a background visual. Renders `section.band.band--<tone> > .container`. |
| `Split.astro` | `reverse?`, `even?`, `mediaFirst?`; slots `default` (text) and `media`. Renders `.split > .split__text + .split__media`. |
| `Scene.astro` | `scene` (required: `'galaxy' \| 'launch' \| 'orbit' \| 'hexfield'`), `poster` (required: an image import or an inline SVG component), `alt` (required, denylist-clean), `ratio?: '16/9' \| '21/9' \| '4/3' \| '1/1'`, `priority?: boolean` (hero only: `fetchpriority="high"`). Renders `figure.scene > .scene__frame > poster + <we-scene data-scene>`. |
| `GalaxyScene`, `LaunchTrajectory`, `OrbitDiagram`, `HexField`, `TeamConstellation` (the team WE steers: roles in a constellation, never a priced cart; replaces the earlier seat builder, W9-12), `UbfDiagram` | Each wraps `Scene` or is pure SVG; props in the WP-52 handoff. |

Gate (`src/scripts/visuals/gate.ts`, pure over a capabilities object): `(min-width: 64rem) and (pointer: fine) and (prefers-reduced-motion: no-preference)`, not `(forced-colors: active)`, `hardwareConcurrency >= 4`, `deviceMemory` absent or `>= 4`, `connection.saveData !== true`, WebGL2 available. The element imports nothing from `three` statically; scenes load through `import()` after an IntersectionObserver hit and an idle callback. DPR capped at 1.75; one live WebGL context per page; pause off screen and on `visibilitychange`; dispose on disconnect; a real pause `<button>` outside the canvas while a scene runs.

Hard rules (CI enforces): no `style=""` attribute, no inline script, no data:/blob: image, no blob worker, no third-party request, no `is:inline`; motion in longhands under `prefers-reduced-motion: no-preference`; SVG text, `alt`, `aria-label` and `<title>` pass `claims-denylist.json` ("cohort", "accelerator", "mentor", "alumni", "free", "perks", "investor network" are banned); colours from tokens or `currentColor` so forced colours work.

## 6. Constraints every family package inherits

- Global CSS gzip stays under 11,500 B (`tests/unit/wp-45/css-budget.test.ts`). The WP-51 handoff records the number after the layout change. New page and visual CSS goes in scoped `<style>` blocks; page styles go in `@layer pages`.
- Family templates under the WP-71 brand audit (`tests/e2e/wave8/wp-71/brand-audit.spec.ts`) accept only `--sp-1` to `--sp-10` for gaps and vertical padding. Use `.band` there with an `--sp-*` padding, not `--band-pad`.
- Desktop specs that do not test a scene emulate `prefers-reduced-motion: reduce`, so SwiftShader WebGL does not slow the e2e jobs.
- The Lighthouse mobile routes (`/`, `/program/`, `/services/`, `/insights/`, `/about/facts/` and the rest in `lighthouserc.json`) keep 10,240 B of gzipped JS; three never loads there.
- A file quoted by `.astro-magazine/release/RELEASE.md` moves its quoted line numbers in the same commit, through the package's scoped exception (W9-9).
- Copy follows `BRIEF.md`, `SALES.md` and `SITE-COPY.md` and needs a sources file `.astro-magazine/sources/wp-NN.json`; C-17 (genericized figures only) is usable (W9-10); C-07 is off until counsel clears it, so every equity line ships as its non-equity fallback (W9-13); `flags.seatPrice` stays off and no price appears anywhere (W9-12, W9-13). WE is a long-horizon business incubation and consulting firm: no seat cart, no employer-of-record framing, no cohorts, no demo day, no fixed batch, no public packages. CTA labels are WP-51's (section 8).

## 7. The 1920 test helper (`tests/e2e/wave8/wp-51/lib/full-width.ts`)

Wave 9 specs live in `tests/e2e/wave8/wp-NN/**` and run in the `wave8-desktop-1440x900` project with an in-spec viewport:

```ts
import { test } from '@playwright/test';
import { FULL_HD, expectFullWidth, expectNoHorizontalScroll } from '../wp-51/lib/full-width.ts';

test.use({ viewport: FULL_HD, reducedMotion: 'reduce' });
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'wave8-desktop-1440x900', 'desktop-only width checks');
});
```

Exports: `FULL_HD`, `SMALLEST_PHONE`, `MIN_FRAME_AT_FULL_HD` (1600), `MAX_LEFT_OFFSET_AT_FULL_HD` (160), `MAX_MEASURE_CH` (80); `expectFullWidth(page, scope = 'main')` (the widest visible `.container` in the scope is at least 1600px wide and starts within 160px of the left edge), `expectNoHorizontalScroll(page)`, `expectReadableProse(page, maxCh?)` (paragraphs and top-level lists in `.prose`, `.container--prose`, `.flow-wide` and `.split__text` at most 80ch of their own font; 46rem of 19px body type is about 77ch; returns the count measured), `expectBandsFullBleed(page)` (every visible `.band` spans the viewport; returns the count). WP-51's own spec is `tests/e2e/wave8/wp-51/full-width.spec.ts`. A family package lists its routes in its own spec.

## 8. Route owners and the CTA hierarchy (W9-13)

| Route or surface | Owner |
|---|---|
| `/`, `/program/**` | WP-53 |
| `/services/**`, `/how-we-work/` (replaces `/pricing/`), `/tools/**`, `/apply/**` (readiness-review intake), package retirement | WP-54 |
| `/about/**` (UBF at `/about/frameworks/ubf/`), `/network/**`, `/investors/**`, `/founders/**`, `/press/**`, `/trust/**`, `/contact/**` | WP-55 |
| `/insights/`, `/research/**`, `/library/**`, `/playbooks/**`, `/fundability/**`, `/briefs/**` (except `real-timeline`), reference and family hubs | WP-56 |
| `/why-it-takes-time/`, `/who-we-work-with/` and its seven situation pages, `/briefs/real-timeline/`, C-29 wording | WP-58 |
| CTA labels (`src/data/cta/targets.ts`, the header button, the mobile bar, hero primaries) | WP-51 |

| Level | Label (exact) | Destination |
|---|---|---|
| Primary | Start a readiness review | `/apply/` (persona variants per `SITE-COPY.md` go to `/apply/?situation=<id>`) |
| Secondary | See how long it really takes | `/why-it-takes-time/` |
| Secondary | See how WE works | `/how-we-work/` |
| Tertiary | Get the timeline brief | `/briefs/real-timeline/` |
| Tertiary | Get the Long Game letter | `/newsletter/`, hidden until its endpoint is set |
| Utility | Talk to WE | `/contact/` |
| Partner | Refer a founder | `/network/partners/enquire/` |

A family page picks its CTAs from this table and the CTA map (`src/data/cta/map.ts`); it never writes its own label for the primary.

Where the label lives (WP-51): `APPLY` in `src/components/hero/ctas.ts` (hero primaries, `HubLayout`/`ServiceLayout` defaults, family hero actions), the `apply` target in `src/data/cta/targets.ts` (end bands), `applyButton` in `src/data/nav.ts` (header, drawer and mobile bar). A page that still passes `{ label: 'Apply', href: '/apply/' }` by hand (about, fundability, services, team composer, FAQ, playbooks, the program MDX "Apply to the program") switches to `APPLY` when its owner rewrites it.

The header: the top row is full. From 1100 to 1499px the nav runs at 16px with `--sp-1` gaps and the button at 16px; from 1100 to 1239px the button shows "Readiness review" with the full label as its accessible name. The direct Pricing item left the top level to make room, so no package adds a top-level item (`/how-we-work/` is linked from the Program panel, the strips and the footer). The command palette keeps "Apply" as the command name, with the button label as its hint, so a search for "apply" still finds `/apply/`. Panel column links and the footer link to `/apply/` keep "Apply": they are navigation, not the CTA.

## 9. Statistics (`.astro-magazine/plans/wave9/statistics.json`, W9-13)

The register holds ST-01 to ST-41 (statistic as it may be quoted, original source, research file, status) and the `neverUse` list. A page quotes a figure only as the register words it, next to its source line, and adds one source record per cited figure to its own `.astro-magazine/sources/wp-NN.json` (`source_id` is the ST id; the other fields follow the usual record: `publisher_or_author`, `title`, `source_tier`, `exact_url_or_locator`, `retrieved_at`, `claims_supported`, `claims_not_supported`, `captured_by`). The figures describe the market, never WE's results (C-13); no page says WE improves survival, shortens the time to a raise or makes a company fundable (C-05, C-16). A status of DERIVED or SECONDARY keeps its qualifier on the page.
