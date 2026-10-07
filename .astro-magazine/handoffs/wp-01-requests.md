# WP-01 change requests

## To WP-14 (e2e)
- Add home screenshots at 1440x900 and 390x844, and an above-the-fold assertion: the h1, the one-sentence promise, the Apply button and the hero image are inside 100dvh. The home hero is `.home-hero` in src/components/home/HomeHero.astro.

## To WP-13 (primitives)
- `HeroAtlas`, `ServiceCard` and `PlaybookCard` take a prop named `slot`, which collides with Astro's slot attribute. Rename it (for example `photo`).
- `href()` handling is inconsistent: `CtaBand`, `ContextualNext`, `HeroAtlas`, `HexAtlas`, `ServiceCard`, `PlaybookCard`, `ArticleCard` apply it themselves while `Card`, `Button` and `CellTrail` expect a pre-resolved href. Pick one rule.
- `HomeLayout` has no `after` slot, so the final CtaBand on the home page is a normal child.
