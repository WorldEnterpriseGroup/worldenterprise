# WP-52 change requests

## To WP-57 (or a WP-51 fix-forward): high fetch priority for a scene poster

`docs/wave9-contracts.md` 5 gives `Scene.astro` a `priority` prop (`fetchpriority="high"`), but `tests/unit/wp-12b/markup.test.ts`
allows the word `fetchpriority` only in six named files and requires `loading="lazy"` on every other `<img>`. WP-52 cannot edit that
test, so the library ships the contract's intent another way:

- Scene's own poster is always `loading="lazy"`, `decoding="async"`, no fetch priority.
- A hero renders the LCP poster itself in the scene's `poster` slot (`<img slot="poster" class="scene__poster" ...>`), with
  `posterImage()` for the attributes and `posterPreload()` for `HomeLayout`'s `preloadImage` (W9-6). `src/components/home/HomeHero.astro`
  is already one of the test's LCP files, so WP-53 can do this without any test change. The README shows the exact markup.

Optional, if a later hero outside the LCP list needs it: add `src/components/visuals/Scene.astro` to the test's `LCP`/`EAGER` sets and
the fetchpriority list, then WP-57 may add a `priority` prop to Scene that renders the same attributes.

## To WP-57: contract text to align at close

- `docs/wave9-contracts.md` 5 lists the Scene names `'galaxy' | 'launch' | 'orbit' | 'hexfield'`. The library's scene names are
  `galaxy`, `launch`, `orbit`, `worldforge`, `starfield`; the hex field is pure SVG (`HexField`), so it needs no WebGL.
- It describes the DOM as `figure.scene > .scene__frame > poster + <we-scene data-scene>`. The shipped DOM is
  `we-scene.scene[data-scene] > figure.scene__figure > .scene__stage > .scene__frame > img.scene__poster` (the custom element wraps the
  figure so the pause button and labels sit inside the element that owns the scene). `.scene`, `.scene__frame` and `[data-scene]` all
  resolve as the contract expects.
- `SeatBuilder` is now an alias of the unpriced `TeamConstellation` (positioning change of 2026-10-14: nothing to build or buy).

## To the page families (WP-53 to WP-56)

- Only one scene per page should run live; set `static` on any second scene (the runtime animates only one scene at a time and pauses the others, but each live scene holds a WebGL context).
- Labels and figures are props; a page that publishes a statistic through `StatTile`, `SurvivalCurve`, `BarChart`, `DonutChart` or
  `LongHorizonTimeline` records the fetch in its own `.astro-magazine/sources/wp-NN.json`.
- First revenue and break-even have no verified typical timing in the kit research yet; `LongHorizonTimeline` takes them as milestones
  as soon as SALES.md supplies a source.
