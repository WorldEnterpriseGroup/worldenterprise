# Wave 10 contracts: ecosystem context, write sets, sequencing

Owner: WP-32 (issue #81). Decisions D-W10-1 to D-W10-5 in `.astro-magazine/decisions.md`. Write-set map: `.astro-magazine/plans/wave10/writesets.json` (kept equal to `ownership.json` by `tests/unit/wp-32/write-sets-wave10.test.ts`). Claims tests for the mechanism: `tests/unit/wp-32/ecosystem-context.test.ts`.

A wave 10 package merges `origin/demo` once WP-32 has landed, before its first push. Anything outside your write set and your registered exceptions is requested from the tech lead, never edited silently.

## 1. Packages

| WP | Issue | Branch | Stage | Owns |
|---|---|---|---|---|
| WP-32 | #81 | `wp/32-governance` | 0 | governance, claims scoping, routes and nav rows |
| WP-33 | #82 | `wp/33-ecosystem` | 1 | `/ecosystem/**` (pages, content, `src/data/ecosystem/**`, `src/components/ecosystem/**`, `src/scripts/ecosystem*.ts`) |
| WP-34 | #83 | `wp/34-sbir-sttr` | 1 | `/sbir-sttr/**` (same layout with `sbir`) |
| WP-35 | #84 | `wp/35-data` | 1 | `/data/**`, `src/data/datasets/**`, `src/components/visuals/charts/**`, `src/scripts/charts*.ts` |
| WP-36 | #85 | `wp/36-html5` | 1 | `src/components/visuals/**` except `charts/**`, `src/assets/visuals/**`, `src/scripts/scene*/**`, `src/scripts/motion*.ts` |
| WP-37 | #86 | `wp/37-longevity` | 2 | home, program, how-we-work, why-it-takes-time, who-we-work-with (pages and content) |
| WP-38 | #87 | `wp/38-content` | 1 | `src/content/insights|guides|playbooks/**`, `src/assets/insights/**` |

Each package also owns `tests/unit/wp-NN/**`, `tests/e2e/wp-NN*.spec.ts`, `tests/e2e/wave8/wp-NN/**` (the 1920 desktop project, W9-9), `.astro-magazine/handoffs/wp-NN*` and `.astro-magazine/sources/wp-NN.json`.

## 2. The ecosystem context (D-W10-1)

Words and named programs the wave 9 copy rules banned (accelerator, cohort, incubator, mentor, mentorship, alumni, investor network, demo day, Y Combinator, Techstars, SBDCs, coworking brands, angel groups and the like) are allowed when they describe the **outside** ecosystem, inside an ecosystem context:

1. **Route context.** Any page whose route matches `/^\/(?:ecosystem|sbir-sttr|data)(?:\/|$)/` (exported as `ECOSYSTEM_ROUTES` from `scripts/audit-claims.mjs`). Its Markdown twin shares the route.
2. **Element context.** Any element carrying the attribute `data-context="ecosystem"`, on any page, including an article in `/insights/` or a home band. The whole element, with its descendants, is in the context. In MDX write `<div data-context="ecosystem">...</div>` or `<section data-context="ecosystem">`. The attribute value is exactly `ecosystem`; a class name or another value opens nothing.

Rules that honour the context carry `"ecosystemAllowed": true` in `claims-denylist.json`: `C-13-peers`, `C-14-investor-network`, `C-14-demo-day-outcomes`. `audit:claims` (`scan()` in `scripts/audit-claims.mjs`) skips them on the ecosystem routes and, elsewhere, strips `data-context="ecosystem"` elements (`stripEcosystemContext`, also exported) before matching. Plain-text machine files (llms.txt, llms-full.txt) have no markup and are not relaxed; keep ecosystem wording out of them unless the file is the Markdown twin of an ecosystem route.

The source-level test (`tests/unit/wp-18/copy.test.ts`) lifts the same rules for the ecosystem source folders (the write sets of WP-33, WP-34 and WP-35) and for marked elements inside any source file. A per-family test with its own word list (wp-74, wp-75, wp-77, wp-86, wp-87) stays strict for its fixed files; a new file outside those lists is not affected.

**Always banned, ecosystem context included** (rule ids): WE described as an accelerator, investor, fund, venture studio, investment adviser, employer of record or PEO (`W10-we-is-accelerator-or-investor`); "our / WE's investor network" (`W10-own-investor-network`); WE running a cohort, batch or demo day, in the first person (`W8-C13-own-peers`, `W10-own-demo-day`); partnership, endorsement or affiliation with a named program (`W10-named-program-endorsement`; negations such as "not affiliated with" pass); a price WE would charge (`W10-price`; award sizes and market figures pass); WE offering anything free, and "for free", "free of charge" (`W10-free-offer`). The existing C-05, C-09, C-14 (introductions disclaimer) and C-26 rules apply unchanged.

Writing rules for the context: describe outside programs generously and specifically, never disparage, say once per page that they are independent ("independent programs WE encourages founders to consider; no affiliation implied"), and close with the long-run stance ("Join them. WE works alongside, for the long run."). Do not imply WE has a relationship with a listed program unless the page owner has verified it and recorded the source. Every fact about a program (name, location, terms, status) carries a source record in `.astro-magazine/sources/wp-NN.json` with URL, publisher and retrieval date.

## 3. Routes and nav

`src/data/routes.ts` holds launched rows for `/ecosystem/` (HubLayout, WP-33), `/sbir-sttr/` (MarketingLayout, WP-34) and `/data/` (HubLayout, WP-35). A launched row with no page is inert: out of nav, sitemap and `audit:links` until the page file exists. Child rows go inside your own block, between the comment pair `// BEGIN WP-NN <name> block` and `// END WP-NN <name> block`; your registered exception covers only that block. Use the owner `WP-33`, `WP-34` or `WP-35` (type `WaveTenOwner`).

Navigation (`src/data/nav.ts`, filtered by `resolveNav`): Network panel, Founders column: "The wider ecosystem" (`/ecosystem/`) and "SBIR and STTR" (`/sbir-sttr/`); Resources panel, Read column: "Data and charts" (`/data/`); footer Learn: Data and charts; footer Company: the ecosystem and SBIR and STTR. No top-level item is added. The snapshot `tests/unit/foundation/fixtures/nav-snapshot.json` lists them under `wave8` additions and a `wave10` note. `src/data/cta/map.ts` has a row per prefix (Apply leads, briefs follow; `cta.test.ts` requires a row for every launched route). A child page's CTA row comes from the prefix row; add an own row only through a request.

WP-37 links to `/ecosystem/` and `/sbir-sttr/` only for routes that exist on demo when it merges (it merges after WP-33 and WP-34).

## 4. Frozen-file exceptions (registered in `ownership.json`, each with a reason)

- **WP-36:** `package.json` and `package-lock.json` (the `three` and `@types/three` lines only; lockfile through `npm install --package-lock-only`), `src/layouts/BaseLayout.astro` (head only), `src/styles/motion.css` (it already holds the `@view-transition { navigation: auto }` block and the reduced-motion guard; extend, do not duplicate), `src/components/seo/SpeculationRules.astro` and `src/lib/seo.ts` (`speculationRules()` only; keep the CSP script hash), `src/components/seo/SeoHead.astro`, `src/scripts/visuals/**` (the wave 9 scene scripts live here, not under `src/scripts/scene*`), `src/pages/styleguide.astro`, the pinning tests `tests/unit/wp-52/**`, `wp-60/motion.test.ts`, `wp-09/seo.test.ts`, `wp-13/design-system.test.ts`, `tests/e2e/wave7/wp-45/visual-system.spec.ts`, `tests/unit/wp-45/css-budget.test.ts` (measured, documented raise only) and `props-baseline.json`.
- **WP-37:** `src/components/home/**`, `src/components/program/**` (HomeHero and `program/who-its-for.astro` are photography-lane files, listed as lane exceptions), the sales components, data and content of WP-58, and the pinning tests for home, program and the sales pages (`wp-44/home`, `wp-53/**`, `wp-01/program`, `wp-58/**`, the e2e specs and `tests/e2e/folds.spec.ts`).
- **WP-33, WP-34, WP-35:** `src/data/routes.ts`, marked block only. WP-35 also holds `tests/unit/wp-45/props-baseline.json` and `pinned-props.test.ts` for additive chart props.
- **WP-38:** none. The insights, guides and playbooks tests pin fixed file lists; request an exception for any global test that a new file trips.

## 5. Sequencing

WP-32 merges first. WP-33 to WP-36 and WP-38 work in parallel and merge `origin/demo` before their first push. WP-37 merges last. Same per-WP steps as wave 9: worktree from `origin/demo`, push through `.astro-magazine/plans/wave8/push-slot.sh push <branch> --slots 3`, merge request to `demo`, branch pipeline green is the gate (merge request pipelines run no jobs), merge yourself, watch the demo pipeline, close your issue. Never touch `gh-pages` or `main`; promotion is a squash merge on the CEO's "ready" only.
