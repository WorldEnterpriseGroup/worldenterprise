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
| `Scene` | `Scene.astro`. Scene names are `galaxy`, `launch`, `orbit`, `worldforge`, `starfield`, `accretion`; the hex field is pure SVG (`HexField`), so it is not a scene. `poster` is a poster key or an imported image. A hero's high-priority poster comes through the `poster` slot (below), not a `priority` prop |
| `GalaxyScene`, `LaunchTrajectory` | Same names |
| `OrbitDiagram` | Alias of `OrbitSystem` |
| `UbfDiagram` | `OrbitSystem` preset with the ten UBF components |
| `HexField` | Alias of `illustrations/HexField` |
| `SeatBuilder` | Alias of `seats/TeamConstellation`: unpriced, nothing to build or buy (positioning change of 2026-10-14) |

DOM of a scene: `we-scene.scene[data-scene][data-state] > figure.scene__figure > .scene__stage > .scene__frame > img.scene__poster`
(+ `canvas.scene__canvas` once live), then `ol.scene__labels`, the optional `div.scene__tools` (key and about buttons), `div.scene__legend[popover]`, `dialog.scene__detail` and `button.scene__toggle`; `figcaption.scene__caption` closes the
figure.

## Layout primitives

The `.band`, `.split` and `.bleed-media` rules live in `src/styles/layout.css` (WP-51); these components fix the markup.

| Component | Use |
| --- | --- |
| `Band` | A full-bleed section: `section.band.band--<tone> > .container`. `<Band tone="deep" labelledby="h-x"><HexField slot="scene" tone="dark" /><h2 id="h-x">...</h2></Band>`. Props: `tone` (`plain`, `soft`, `tint-blue`, `tint-sand`, `tint-stone`, `deep`), `id`, `labelledby`, `defer` (content-visibility: auto; never the first band), `bleed` (a deep band with a scene melts into its neighbours; default on), `class`; slot `scene` for a background visual that fills the band under the content (a `HexField`, or `<Scene slot="scene" scene="starfield" poster="starfield" alt="" decorative fill />`). A deep band never holds the logo. |
| `Split` | Text beside a visual: `.split > .split__text + .split__media`. `<Split><h2>...</h2><p>...</p><WorldForge slot="media" /></Split>`. Props: `reverse`, `even`, `mediaFirst`, `class`. In a Band, put `class="bleed-media"` (`bleed-media bleed-media--start` when reversed) on the visual to run it to the viewport edge. |

## Scenes (three.js, desktop only)

A scene is a `<we-scene>` element around a poster. The poster is an AVIF frame of the same scene in a reserved aspect-ratio box: it is
what phones, reduced motion, forced colors, no-JS visitors and Lighthouse see, so pages never shift. The loader stub
(`src/scripts/visuals/scene-element.ts`, about 1.6 KB gzip) imports nothing from three; on a capable desktop it waits until the frame
is within 200px of the viewport and the browser is idle, then imports the runtime (with three) and the scene, and crossfades from the
poster. The gate (`src/scripts/visuals/gate.ts`): `(min-width: 64rem) and (pointer: fine) and (prefers-reduced-motion: no-preference)`,
not forced colors, at least four cores, `deviceMemory` absent or at least 4, no Save-Data, and a hardware WebGL2 context (asked with `failIfMajorPerformanceCaveat`, and refused when the renderer string, `WEBGL_debug_renderer_info` or `RENDERER`, names a software rasteriser: SwiftShader, llvmpipe, softpipe, Microsoft Basic Render Driver, Mesa offscreen; headless Chrome hands out SwiftShader without the caveat, so the name check is what keeps CI and software-GL visitors on the poster; the renderer uses the same attributes). Device pixel
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
| `AccretionScene` | Worlds take years: a disc of dust spiraling in toward a world still forming, planetesimals on the rings, one amber tile. Wide and short, made for a band behind text (home, /data/). `<AccretionScene align="end" ratio="21/9" />`. Props: `alt`, `align` (`center`, `end`: world to the right, copy room on the left), `ratio` (`16/9`, `21/9`, `3/1`), `sizes`, `caption`, `static`, `feather`, `class`. For a full-bleed background use `<Scene slot="scene" scene="accretion" poster="accretion-end" alt="" decorative fill />` in a deep `Band`. |
| `StarfieldBand` | Dark full-bleed section with a slow starfield behind slot content. `<StarfieldBand labelledby="h-x"><h2 id="h-x">...</h2></StarfieldBand>`. Props: `labelledby`, `id`, `size` (`default`, `tall`), `static`. Decorative sky; never put the logo on a dark band. |
| `Scene` | The frame the wrappers use; use it directly only for a new scene. Props: `scene`, `poster`, `alt`, `ratio`, `options`, `sizes`, `caption`, `labelsName`, `static`, `fill`, `decorative`, `labels` (`float`, `list`), `feather` (`edges` default, `none`), `hero` (names the frame `hero-media` for view transitions), `class`; slots `labels`, `overlay`, `legend` (a popover key) and `detail` (an "About this scene" dialog). |
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

Posters live in `src/assets/visuals/posters/` (3840-wide AVIF masters rendered at pixel ratio 2; Astro emits 640/1024/1440/1920/2560/3840, so 1440p and 4K screens get a sharp frame). After changing a scene,
regenerate them with `node src/assets/visuals/tools/render-posters.mjs [key...]` (headless Chromium with SwiftShader, through the same WebGPURenderer node materials the live scene runs; set
`CHROMIUM_PATH` if the Playwright browser is not installed).

## Seamless scenes and the HTML5 platform (WP-36)

**Renderer.** Scenes run on three's `WebGPURenderer` (`three/webgpu`, three 0.186.1, the latest stable) with node (TSL) materials, so one
code path serves two backends. `src/scripts/visuals/backend.ts` picks WebGPU when `navigator.gpu.requestAdapter()` returns a hardware
adapter (a software or "fallback" adapter does not count) and WebGL2 otherwise; WebGL2 is three's own backend on a context the runtime
creates with the gate's `failIfMajorPerformanceCaveat` attributes. If WebGPU fails to initialise it retries once on WebGL2; a lost device
or context tears the scene down and keeps the poster. The gate itself is unchanged (hardware WebGL2 is still required, so software GL and
CI keep the poster) and the runtime keeps one live scene, the 1.75 DPR cap, IntersectionObserver and `visibilitychange` pause,
`pagehide` and disconnect disposal, and the pause button. Point clouds are instanced quads (WebGPU draws points one pixel wide): one draw
call per cloud, every position, size and colour a pure function of the scene clock, so the poster is exactly frame `posterTime`. The
nebula is a procedural noise dome in the node graph, not a texture. Everything is lazy: three never loads on phones, reduced motion,
forced colors, Save-Data or without JavaScript, so the mobile 10,240 B route budget is untouched. `data-backend="webgpu|webgl2"` on a
live `<we-scene>` says which backend runs. OffscreenCanvas in a worker is deliberately not used: the scenes draw glow textures and project
labels on the main thread, and a worker would add a separate module chunk and a second copy of three for no visible gain at one scene
per page.

**Seamless frames.** A framed scene has no box: its frame is masked with two intersecting `mask-image` gradients (`feather="edges"`,
default), so every edge dissolves into the page, over a fade that shrinks on narrow containers and grows slightly as the scene scrolls
in or out (`animation-timeline: view()` driving an `@property` number; no movement, no scroll-jacking). A `fill` scene is the background
of its band or hero, and the band owns the edges: a deep `Band` and `StarfieldBand` extend a soft skirt of the band colour past their
top and bottom edges (`bleed`). The poster sits in the same aspect-ratio box as the canvas, so the poster-to-canvas swap is a crossfade
(the canvas fades in with `@starting-style` as the poster fades out) with no layout shift.

| Feature | Where | Support and fallback |
| --- | --- | --- |
| Cross-document view transitions | `src/styles/motion.css` (`@view-transition`, header, page title); `Scene hero` names the lead scene frame `hero-media` | Chromium 126+, Safari 18.2+; others navigate normally. Off under reduced motion |
| Scroll-driven animation | `motion.css` reveals and progress rail; Scene edge materialise | Chromium, Safari 26; others show the resting state. Longhands only (WP-60 finding) |
| `@starting-style` | Scene canvas, pause button, key popover, about dialog | Chromium 117+, Safari 17.5+, Firefox 129+; others appear without a fade |
| Popover and anchor positioning | `legend` slot: `button[popovertarget] + div[popover]`, `position-anchor: auto; position-area` | Popover is baseline; without anchor positioning the browser centres it in the top layer |
| `<dialog closedby="any">` and invoker commands | `detail` slot: `button[commandfor][command=show-modal]` | Without `commandfor` the stub opens the dialog with `showModal()`; the dialog closes by Esc, outside click or its `form method=dialog` |
| `@property` typed custom properties | `--sheen` (one poster-state light sweep after load, never looped), `--depth` (edge feather) | Chromium, Safari 16.4+, Firefox 128+; the gradients read `var(--depth, 0)` so a browser without `@property` keeps the resting mask |
| Container queries | Scene labels and feather width (`container-name: scene`) | Baseline |
| `:has()` | The sheen runs only while the stage has no canvas | Baseline |
| `content-visibility: auto` | `Band defer` (a deferred band has no skirts, because containment would clip them) | Baseline 2024 |
| Speculation rules | `components/seo/SpeculationRules.astro`: prerender on hover, inline script registered with `Astro.csp.insertScriptHash`, which `audit:csp` already checks | Chromium; ignored elsewhere |
| `fetchpriority` on the LCP poster | The hero renders its own poster `<img>` in the `poster` slot (above); Scene's own posters stay lazy | Baseline |

Charts (`charts/**`) belong to the data-visualization package; the key popover and the dialog work for them through `Scene` only.

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
