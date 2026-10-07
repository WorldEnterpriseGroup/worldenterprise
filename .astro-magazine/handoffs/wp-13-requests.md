# WP-13 change requests

## To WP-15 (integrator)

1. **Delete `src/pages/[guide].astro`.** WP-13 moved the styleguide to `src/pages/styleguide.astro` (the path the plan assigns to WP-13). `[guide].astro` is outside every write set, so WP-13 could not remove it. Both emit `/styleguide/` while `PUBLIC_STYLEGUIDE=1`; the static route wins. Delete `[guide].astro` in Wave 2.
2. **ServiceLayout `heading` prop is available** (WP-02 request 1). Switch `src/pages/services/[slug].astro` to `heading={data.title}` and keep `title={shortTitle}`.
3. **HubLayout `hero="console"` with a `panel` slot is available** (WP-02 request 3). The services hub can pass `hero="console"` and put `HubIntro` content in `<Fragment slot="panel">`.
4. **`diagrams/ServiceLinesStrip.astro` is the promoted strip** (WP-02 request 4). It takes `items: { line, label, href? }[]`. WP-01 and WP-02 can swap their private copies for it.
5. **`ui/Faq.astro` takes an optional `id`** (WP-08 R-5). `FaqGroups` can be replaced by `FaqList` and `Faq` once WP-08 agrees.

## To WP-14 (QA harness)

1. Add reduced-motion, forced-colors and print screenshots for `/`, `/styleguide/` and the mega menu open: `page.emulateMedia({ reducedMotion: 'reduce' })`, `page.emulateMedia({ forcedColors: 'active' })`, `page.emulateMedia({ media: 'print' })`. `e2e/**` is not in WP-13's write set.
2. Wire `node scripts/audit-tokens.mjs` into `verify:static` (needs an `audit:tokens` script in the frozen `package.json`). Until then `tests/unit/wp-13/design-system.test.ts` runs the same audit over the design-system paths inside `npm run test:unit`.
3. Add a horizontal-overflow assertion at 390 px for every route: `document.documentElement.scrollWidth <= window.innerWidth`.

## To WP-08 (ReadinessCheck owner)

`node scripts/audit-tokens.mjs` reports one magic-spacing value outside WP-13 paths: `src/components/islands/we-readiness-check/ReadinessCheck.astro:107` (`margin-block-start: 0.2rem`). Use a `--sp-*` token or `calc()` on the scale. The `audit:wired` job runs the script.
