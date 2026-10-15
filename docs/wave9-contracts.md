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
| `--gutter` | `clamp(1rem, 0.25rem + 3.2vw, 5rem)` | Side gutter: 16px at 320, about 48px at 1440, 80px at 1920. |
| `--band-pad` | fluid, 48px to about 128px | Vertical padding of a `.band`. Family templates audited by the WP-71 brand audit use `--sp-*` steps instead (see 6). |
| `--fs-*`, `--space-*` | clamp from 360 to 1920 | The 360 ends and the ratio are unchanged; the top ends grow to 1920. |
| `--color-band-deep-bg` | `var(--color-bg-inverse)` (blue-night) | Background of a dark galaxy band (W9-7). |
| `--color-band-deep-text`, `--color-band-deep-muted`, `--color-band-deep-link`, `--color-band-deep-accent` | white, a pale blue, the tint blue, amber | Text on a dark band. Contrast pairs are checked by `audit:contrast`. |

Never name anything `container--wide` or `--page-wide` (`tests/unit/wp-16/layout-css.test.ts`).

## 2. Layout utilities (`src/styles/layout.css`, WP-51)

- `.container`: `min(100% - 2 * var(--gutter), var(--page-max))`, centred. 1760px at 1920.
- `.container--prose`: the 46rem reading column, for article bodies, legal text and guides only.
- `.band`: a full-bleed section. Put a `.container` inside it. `overflow-x: clip`, so a `.bleed-media` child never adds a horizontal scroll. Tones: `.band--soft` (mist), `.band--tint-blue`, `.band--tint-sand`, `.band--tint-stone`, `.band--deep` (blue-night, a CSS starfield fallback, light text). A `.band--deep` never holds the logo.
- `.split`: two columns from 62rem, `var(--split-text)` for the text and the rest for the visual. Children: `.split__text`, `.split__media`. Modifiers: `.split--reverse` (visual on the left), `.split--even` (1fr 1fr), `.split--media-first` (visual first on one column). The text column starts at the container edge, so the hero h1 and the first body container keep one left x.
- `.bleed-media` (inside `.split__media`): the visual runs to the viewport edge on its side; `.bleed-media--start` for the left side.
- `.flow-wide`: the default body of a layout in the wide frame. Text children (`p`, lists, headings, `blockquote`, `.callout`, `dl`) keep `--prose-max`; figures, tables, grids, splits, bands and `.wide` children use the frame.
- `.grid` with `--grid-min` adds columns by itself; `.grid--min-20` gives 5 columns at 1760.

## 3. Layout props (`src/layouts/**`, WP-51; all additive)

| Layout | Change |
|---|---|
| `MarketingLayout` | New `width?: 'content' \| 'prose'`, default `'content'`: the body sits in `.container .flow-wide prose`. `'prose'` restores the 46rem column. The hero copy follows the body edge as before. |
| `GuideLayout`, `TemplateLayout`, `ReferenceLayout` | The article body stays at prose width; the rail beside it widens (`.with-rail`: `minmax(0, 46rem) minmax(18rem, 1fr)`, rail capped). |
| `LegalLayout` | Prose width, in the wide frame. |
| `HomeLayout`, `HubLayout`, `StageLayout`, `ServiceLayout`, `ToolLayout`, `ArticleHub`, `ArticleLayout`, `BriefLayout`, `PlaybookLayout`, `FormLayout` | Already use `.container`; they widen with the token. |
| `HomeLayout` | The LCP preload is the existing `preloadImage` prop (forwarded to `BaseLayout`). WP-53 points it at the galaxy poster (W9-6). |

`Section.astro` gains `tone="deep"` (a dark band) and `bleed` (no change to the markup contract; the band runs full width as before). `Prose.astro` gains `width?: 'prose' | 'content'`.

## 4. Heroes (`src/components/hero/**`, `src/styles/hero.css`, WP-51)

- `.hero__grid--media` is 3fr/2fr from 62rem and `minmax(0, 5fr) minmax(0, 7fr)` from 75rem: at 1920 the visual is wider than the copy.
- `.hero__frame` keeps 16/9 and 4/3; `data-frame="wide"` adds 21/9.
- `data-hero="scene"` is a hero mode for a `<we-scene>` poster in the frame (WP-52 supplies the component; WP-53 uses it on home).
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
test.skip(({}, info) => info.project.name !== 'wave8-desktop-1440x900', 'desktop-only width checks');
```

Assertions exported: `expectFullWidth(page)` (the main content frame is at least 1600px wide at 1920 and starts within 160px of the left edge), `expectNoHorizontalScroll(page)`, `expectReadableProse(page)` (paragraphs in `.prose` and `.container--prose` at most 75ch), `expectBandsFullBleed(page)` (every `.band` spans the viewport). A family package lists its routes in its own `tests/e2e/wave8/wp-NN/routes-1920.ts`.

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

## 9. Statistics (`.astro-magazine/plans/wave9/statistics.json`, W9-13)

The register holds ST-01 to ST-41 (statistic as it may be quoted, original source, research file, status) and the `neverUse` list. A page quotes a figure only as the register words it, next to its source line, and adds one source record per cited figure to its own `.astro-magazine/sources/wp-NN.json` (`source_id` is the ST id; the other fields follow the usual record: `publisher_or_author`, `title`, `source_tier`, `exact_url_or_locator`, `retrieved_at`, `claims_supported`, `claims_not_supported`, `captured_by`). The figures describe the market, never WE's results (C-13); no page says WE improves survival, shortens the time to a raise or makes a company fundable (C-05, C-16). A status of DERIVED or SECONDARY keeps its qualifier on the page.
