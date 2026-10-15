# Visuals library (WP-52)

The shared visuals for the wave 9 redesign: three.js scenes with static posters, no-JS SVG and CSS illustrations, sourced data
visualization, and the unpriced team visuals. Every component is shown, live and as its fallback, in the **Visuals** section of the
styleguide (`/styleguide/#visuals`, built with `PUBLIC_STYLEGUIDE=1`; source `styleguide/VisualsShowcase.astro`).

Rules every component enforces at build time (`contracts.ts`; a violation fails the build with the component name):

- No denied words in any label, alt, caption or title: the `DENYLIST` in `contracts.ts` (the audit:claims denylist words, the
  positioning bans of ORCHESTRATION 2026-10-14, funding-outcome and investment-term wording, UK spellings, and the lowercase "We build /
  steer / coordinate"). WE is an ongoing incubation and consulting firm, never an investor or a batch program.
- No prices anywhere. The team visuals have no cart, selector, seat count or rate.
- Every statistic carries a source (`{ label, href?: https URL, period? }`). Charts print it under the figure.
- Markup carries no `style` attribute, no inline script and no third-party request (CSP). Positions use the `vp-x-N` / `vp-y-N`
  classes of `positions.css`; live scenes move labels with CSSOM custom properties only.

## Contract names (docs/wave9-contracts.md 5)

The wave 9 contract names map onto this library as follows; the alias files forward every prop unchanged.

| Contract name | Component |
| --- | --- |
| `Band`, `Split` | `Band.astro`, `Split.astro` (below) |
| `Scene` | `Scene.astro`. Scene names are `galaxy`, `launch`, `orbit`, `worldforge`, `starfield`; the hex field is pure SVG (`HexField`), so it is not a scene. `poster` is a poster key or an imported image. A hero's high-priority poster comes through the `poster` slot (below), not a `priority` prop |
| `GalaxyScene`, `LaunchTrajectory` | Same names |
| `OrbitDiagram` | Alias of `OrbitSystem` |
| `UbfDiagram` | `OrbitSystem` preset with the ten UBF components |
| `HexField` | Alias of `illustrations/HexField` |
| `SeatBuilder` | Alias of `seats/TeamConstellation`: unpriced, nothing to build or buy (positioning change of 2026-10-14) |

DOM of a scene: `we-scene.scene[data-scene][data-state] > figure.scene__figure > .scene__stage > .scene__frame > img.scene__poster`
(+ `canvas.scene__canvas` once live), then `ol.scene__labels` and `button.scene__toggle`; `figcaption.scene__caption` closes the
figure.

## Layout primitives

The `.band`, `.split` and `.bleed-media` rules live in `src/styles/layout.css` (WP-51); these components fix the markup.

| Component | Use |
| --- | --- |
| `Band` | A full-bleed section: `section.band.band--<tone> > .container`. `<Band tone="deep" labelledby="h-x"><HexField slot="scene" tone="dark" /><h2 id="h-x">...</h2></Band>`. Props: `tone` (`plain`, `soft`, `tint-blue`, `tint-sand`, `tint-stone`, `deep`), `id`, `labelledby`, `defer` (content-visibility: auto; never the first band), `class`; slot `scene` for a background visual that fills the band under the content (a `HexField`, or `<Scene slot="scene" scene="starfield" poster="starfield" alt="" decorative fill />`). A deep band never holds the logo. |
| `Split` | Text beside a visual: `.split > .split__text + .split__media`. `<Split><h2>...</h2><p>...</p><WorldForge slot="media" /></Split>`. Props: `reverse`, `even`, `mediaFirst`, `class`. In a Band, put `class="bleed-media"` (`bleed-media bleed-media--start` when reversed) on the visual to run it to the viewport edge. |

## Scenes (three.js, desktop only)

A scene is a `<we-scene>` element around a poster. The poster is an AVIF frame of the same scene in a reserved aspect-ratio box: it is
what phones, reduced motion, forced colors, no-JS visitors and Lighthouse see, so pages never shift. The loader stub
(`src/scripts/visuals/scene-element.ts`, about 1.6 KB gzip) imports nothing from three; on a capable desktop it waits until the frame
is within 200px of the viewport and the browser is idle, then imports the runtime (with three) and the scene, and crossfades from the
poster. The gate (`src/scripts/visuals/gate.ts`): `(min-width: 64rem) and (pointer: fine) and (prefers-reduced-motion: no-preference)`,
not forced colors, at least four cores, `deviceMemory` absent or at least 4, no Save-Data, and a hardware WebGL2 context (asked with `failIfMajorPerformanceCaveat`, so software GL such as SwiftShader or a blocklisted GPU keeps the poster; the renderer uses the same attributes). Device pixel
ratio is capped at 1.75, only one scene animates at a time, scenes pause offscreen and in hidden tabs, and they dispose on navigation.
A live scene shows a real **Pause animation** button (WCAG 2.2.2); the canvas is `aria-hidden`.

Labels are real HTML (`SceneLabel`): links or text, floated at their anchors on containers 48rem and wider, a list below the frame on
narrow ones. Arrow keys, Home and End step through the label links.

| Component | Use |
| --- | --- |
| `GalaxyScene` | Hero galaxy: a spiral of blue stars with a hex world assembling in it. `<GalaxyScene ratio="21/9" align="end" />`. Props: `alt`, `align` (`center`, `end`: core to the right, headline room on the left), `ratio` (`16/9`, `21/9`), `sizes`, `caption`, `static`. |
| `LaunchTrajectory` | Dream, Build, Grow as one flight: pad, gate, world; stations link to the stage pages. `<LaunchTrajectory waypoints={[{ label: 'Diagnostic and roadmap' }]} />`. Props: `stations` (exactly three, defaults to Dream/Build/Grow with Survey/Blueprint/Territory notes), `waypoints` (0 to 8, hang below the path), `alt`, `caption`, `labelsName`, `static`. |
| `UbfDiagram` | The UBF planetarium: the ten UBF components (`ubf.ts`, paraphrased one-line definitions) on nested rings, with its own poster. `<UbfDiagram href="/about/frameworks/ubf/" />`. Props: `href` (every label links there), `alt`, `caption`, `static`, `class`. |
| `OrbitSystem` | A sun with 1 to 12 labeled bodies on orbit rings (service lines, UBF components). `<OrbitSystem bodies={lines} accent={5} />`. Props: `bodies` (`{ label, href?, description? }[]`), `rings` (`single`, `nested`), `accent` (index of the one amber body), `alt`, `caption`, `labelsName`, `static`. Seven on single rings and ten on nested rings have their own posters; any other count draws its rings and bodies in SVG over the sun-only poster. |
| `WorldForge` | The incubation nursery: a world forming from hex tiles, seven O.R.B.I.T.A.L. rings, moons condensing from dust. `<WorldForge moons={[{ label: 'A side project', description: 'Formed' }]} />`. Props: `moons` (0 to 7 labels; the scene draws that many moons), `alt`, `caption`, `labelsName`, `static`. Labels always list below the frame. |
| `StarfieldBand` | Dark full-bleed section with a slow starfield behind slot content. `<StarfieldBand labelledby="h-x"><h2 id="h-x">...</h2></StarfieldBand>`. Props: `labelledby`, `id`, `size` (`default`, `tall`), `static`. Decorative sky; never put the logo on a dark band. |
| `Scene` | The frame the wrappers use; use it directly only for a new scene. Props: `scene`, `poster`, `alt`, `ratio`, `options`, `sizes`, `caption`, `labelsName`, `static`, `fill`, `decorative`, `labels` (`float`, `list`), `class`; slots `labels` and `overlay`. |
| `SceneLabel` | One label in a `labels` slot: `index` (anchor), `label`, `href`, `description`, `x`/`y` (0 to 1, poster position), `below`. |

**Hero poster (W9-6).** A scene's own poster always loads lazily with async decoding (the wp-12b image rules reserve eager loading and high fetch priority for the hero components on their allow list; adding Scene there is a request to the rules owner, see `.astro-magazine/handoffs/wp-52-requests.md`). So a hero whose LCP image is the galaxy poster renders that image itself, in the
`poster` slot, from the same helpers the head preload uses:

```astro
---
import GalaxyScene from '../visuals/GalaxyScene.astro';
import { galaxyPosterKey, posterImage, posterPreload } from '../visuals/poster.ts';
const sizes = '(min-width: 75rem) 58vw, 100vw';
const poster = await posterImage(galaxyPosterKey('end'), sizes);
// the page passes `await posterPreload(galaxyPosterKey('end'), sizes)` to HomeLayout as preloadImage
---
<GalaxyScene align="end" sizes={sizes}>
  <img slot="poster" class="scene__poster" src={poster.src} srcset={poster.srcset} sizes={poster.sizes} width={poster.width}
    height={poster.height} alt="..." decoding="async" fetchpriority="high" />
</GalaxyScene>
```

The slotted image must keep `class="scene__poster"`: Scene positions it, and fades it out when the canvas goes live. Set `static` to show only the poster (a second scene on a page that already has one running, print-like contexts).

Posters live in `src/assets/visuals/posters/` (1920-wide AVIF masters; Astro emits 640/1024/1440/1920). After changing a scene,
regenerate them with `node src/assets/visuals/tools/render-posters.mjs [key...]` (headless Chromium with SwiftShader; set
`CHROMIUM_PATH` if the Playwright browser is not installed).

## Long-horizon timeline

| Component | Use |
| --- | --- |
| `LongHorizonTimeline` | The multi-year path of building a business, a world forming along the track, milestones placed where they typically happen and survival gates below. `<LongHorizonTimeline horizon={10} milestones={[{ at: 0.57, label: 'First payroll', source }, { at: 5, kind: 'survival', label: '49.2% still operating', source }]} />`. Props: `milestones` (1 to 12; `at` in years, `label`, `detail?`, `source?`, `kind` `event` or `survival`), `horizon` (1 to 20 years), `label`, `caption`, `id` (footnote prefix when a page has two), `class`. Gentle log scale so the first months stay readable; axis ticks read "Year N", never "N years" (claims C-11). Horizontal on containers 52rem and wider, a vertical list below that. |

## Data visualization (sourced statistics)

| Component | Use |
| --- | --- |
| `charts/StatTile` | One figure: `<StatTile value="49.2%" label="Still operating after five years" source={sba} icon="gate" />`. `value` must contain a number and never a price. Props also `tone` (`light`, `dark`), `hideSource`. |
| `charts/StatTiles` | A row of one to six figures; shared sources listed once, numbered. `<StatTiles stats={stats} label="Starting a business in the U.S." />`. Props: `stats`, `tone`, `label`, `id`. |
| `charts/SurvivalCurve` | Share still operating by year, stepped lines (1 to 3 series), optional gates, the figures as a table behind a "Show the figures as a table" disclosure (inside the site's `.table-wrap` region, named "<title>, as a table"), a source line. `<SurvivalCurve title="..." series={[{ label, points: [{ year, percent }] }]} source={bls} gates={[1, 2, 5, 10]} />`. Props also `note`. |
| `charts/BarChart` | Horizontal bars, 2 to 10 rows, one amber highlight, the figures as a table behind a disclosure (`.table-wrap` region, as SurvivalCurve). `<BarChart title="..." items={[{ label, value, display? }]} source={src} max={100} highlight={2} valueLabel="Share of firms" />`. |
| `charts/DonutChart` | Parts of a whole, 2 to 6 segments; the HTML legend carries every figure. `<DonutChart title="..." items={items} source={src} center="47%" centerLabel="at a profit" />`. |
| `charts/SourceNote` | The "Source:" line: `<SourceNote sources={[src]} />`. |

The styleguide samples (`styleguide/samples.ts`) are real figures from BLS Business Employment Dynamics, the SBA Office of Advocacy,
the Census Business Formation Statistics, GEM, Azoulay et al. and the Federal Reserve Small Business Credit Survey, taken from the
redesign kit research file `research/timeline-stats.json`. Pages own their data; a page that publishes a figure records its source.

## Illustrations (no JavaScript)

| Component | Use |
| --- | --- |
| `illustrations/JourneyRoadmap` | Dream, Build, Grow on one track, each milestone with what the company keeps (BRIEF 3.2, genericized). `<JourneyRoadmap />`. Props: `milestones` (override, same shape as `journey.ts`), `links` (phase names link to stage pages, default true), `label`, `caption`. Never numbered as milestones "M0 to M8", never days or fees. |
| `illustrations/ReadinessScorecard` | Six readiness areas as a hex radar, dashed baseline and solid later shape, the baseline / review / close-the-gaps loop. `<ReadinessScorecard />`. Props: `baseline`, `later` (six fractions, drawn only, never printed), `steps`, `title`. Illustration only: no scores, weights or thresholds. Pages that require it show "WE makes no promise of funding." next to it. |
| `illustrations/HexField` | Decorative hex texture, dense at one edge, one amber cell, seeded. Place inside a positioned container: `<div class="relative"><HexField edge="right" /></div>`. Props: `edge`, `density` (0 to 1), `seed`, `amber`, `tone` (`light`, `dark`), `aspect`. |
| `ServiceLineSet` | The seven service lines as linked hex-icon tiles (names and routes from the primary navigation). `<ServiceLineSet only={['A', 'B']} layout="honeycomb" />`. Props: `only`, `descriptions`, `layout` (`grid`, `honeycomb`), `label`. |
| `VisualIcon` | One hex-tile icon: a service line `A` to `G` or a program icon (`calendar`, `checklist`, `clock`, `contact`, `data`, `document`, `gate`, `globe`, `handover`, `report`, `steering`, `team`). `<VisualIcon name="team" size={48} />`. Decorative unless `alt` is given. |

## The team WE steers (unpriced)

| Component | Use |
| --- | --- |
| `seats/TeamConstellation` | The roles around "Your company" on a honeycomb, with a faint steering ring. `<TeamConstellation roles={[{ role: 'Delivery lead', level: 'Steering', group: 'coordination' }]} />`. Props: `roles` (1 to 10), `center`, `label`, `caption`. Illustrative: no prices, no seat counts to buy, no selector. |
| `seats/RoleCard` | One role as a card with a hex token. `<RoleCard role="Product design" level="Senior" group="build" description="..." />`. `group` is a `src/data/seat-roles.ts` group id. Not the pricing-era `src/components/cards/RoleCard.astro`. |

## Files

- `src/components/visuals/`: components (aliases `OrbitDiagram`, `HexField`, `SeatBuilder`), `ubf.ts` (UBF definitions), `contracts.ts` (prop contracts and copy rules), `chart-math.ts` (chart and timeline geometry),
  `poster.ts`, `icons.ts`, `positions.css`, `illustrations/journey.ts` and `illustrations/shapes.ts` (pure data and geometry).
- `src/scripts/visuals/`: `scene-element.ts` (stub), `gate.ts`, `runtime.ts`, `geometry.ts`, `palette.ts`, `rng.ts`, `types.ts`,
  `scenes/*.ts`.
- `src/assets/visuals/`: posters, program icons, the poster tool.
- Tests: `tests/unit/wp-52/*.test.ts` (contracts, math, gate, geometry, markup rules), `tests/e2e/wave8/wp-52/visuals.spec.ts`.
