# Wave 7 contracts

Issue #29, milestone "World Enterprise Incubator v1.1 (Wave 7: craft, transparency, GEO)". This is the shared contract for the eleven wave 7 packages, WP-40 to WP-50. The plan is `.astro-magazine/plans/wave7.md`; the decisions behind this file are W7-1 to W7-8 in `.astro-magazine/decisions.md`. WP-40 owns this file. A package that needs a contract changed says so in its handoff and WP-50 (or WP-40, before stage 1 starts) makes the change.

## 0. Shape of the wave

| Stage | Packages | Rule |
|---|---|---|
| 0 | WP-40 | Lands first on `demo`. Owns every frozen file the wave needs. |
| 1 | WP-41 to WP-49 | Parallel branches `wp/41` to `wp/49` on pairwise disjoint write sets. At most five at once. |
| 2 | WP-50 | After stage 1. The only package that may fix a seam between two packages. |

Write sets are registered in `.astro-magazine/ownership.json` and policed by `npm run check:ownership` on `wp/*` branches. Two things the checker did not do before wave 7 are now true:

- An assignment may carry `exclude`: globs inside its own write set that it must not edit (WP-45 excludes `src/components/ui/Card.astro`, `src/components/hero/HeroAtlas.astro` and `src/components/hero/HeroEditorial.astro`, which the photography lane holds). An `exceptions` entry that names the path overrides the exclusion.
- An assignment may carry `lane_exceptions`: photography-lane files the package edits through an `exceptions` entry (WP-42 `src/pages/pricing/index.astro`, WP-43 `src/pages/program/who-its-for.astro`). They were gated on WP-12d phase B until decision W7-9 (2026-10-10) lifted the wait: phase B photo generation is deferred and will rebase onto wave 7. Edit them on any branch. The rest of the photography lane (`Card.astro`, `HeroAtlas.astro`, `HeroEditorial.astro`, `src/components/cards/**`, `src/components/media/**`, `src/assets/photo/**`) stays excluded.

`tests/unit/wp-40/write-sets.test.ts` proves the stage-1 sets are pairwise disjoint and clear of the frozen paths, the photography lane (`src/assets/photo/**`, `scripts/photo/**`, the WP-12* assignments and the `lanes.photography` floor in `ownership.json`) and the release lane (WP-30). It reads the lanes from `ownership.json`, so a lane that is registered later extends the check with no edit to the test. If a package needs a file outside its set, it does not edit it. It writes the request in its handoff.

Rules for every package:

1. Edit only files in your registered write set.
2. Shared surfaces have one owner: `src/styles/**` and `src/components/ui/**` belong to WP-45, `src/components/layout/**` to WP-46, frozen files to WP-40 (stage 0) and WP-50 (stage 2). Every other package styles inside scoped `<style>` blocks in its own components and asks WP-45 for token changes in its handoff.
3. Components that other packages import (WP-45's `ui`, `blocks`, `program`, `diagrams`) keep their props backward compatible. WP-45 ships a unit test that pins the props.
4. Tests live in `tests/unit/wp-NN/**` and `tests/e2e/wave7/wp-NN/**`. See section 7.
5. The truth policy in section 6 binds every package.
6. Never run a build or Playwright on a developer machine. CI does both.

## 1. Packages and the `package` parameter

Single source: `src/data/packages.ts`. It is pure data with no Astro globals, so pages, islands' build-time code and node scripts all import it.

| Export | Meaning |
|---|---|
| `PACKAGE_IDS` | `spark`, `launch`, `accelerate`, `studio`, in the published order. |
| `packages` | Per package: `id`, `name`, `stageKey`, `stageFit`, `depth`. `stageFit` and `depth` are the sentences of the table in `pricing.mdx`, verbatim. |
| `PACKAGE_PARAM` | `'package'`, the query and form field name. |
| `PACKAGE_NOT_SURE` | `'not-sure'`, the form value for a founder who has not chosen. It is never a package id and never listed with the packages. |
| `parsePackageParam(value)` | Trims and lowercases; returns the id or `null`. An unknown, empty or repeated value is ignored, never an error: a stale link must still open the page. |
| `packageForStage(stageKey)` | The package whose published stage fit matches a stage key, or `null`. |

Contract:

- A package is addressed by id in a URL: `/apply/?package=launch`, `/tools/team-composer/?package=launch`. Pages read the query on the client with `parsePackageParam` and render the same markup server-side without it, so a crawler and a no-JS visitor see the page without a selection.
- The form field is `package` with the four ids plus `not-sure`. WP-43 owns the field and its validation (reject anything else), WP-42 and WP-44 only produce links.
- **No amounts, no seat counts, no term.** C-10 publishes names, stage fit and depth. `tests/unit/wp-40/packages.test.ts` fails on a digit, a currency sign or the word "seat" in any field, and the claims audit rule `W7-package-seat-count` fails a built page or text file that ties a seat count to a package.
- Until WP-42 renders the pricing table from this module, `packages.test.ts` asserts the module equals the table. After it, the test asserts the page imports the module, so the two cannot drift.

## 2. Markdown twins

Every published page that has a clean Markdown source may have a twin: the same text as plain Markdown, for crawlers and answer engines.

- **URL scheme:** the page `/insights/<slug>/` has the twin `/insights/<slug>.md`. The twin of `/pricing/` is `/pricing.md`, and of `/` is `/index.md`. In `dist` the file sits beside its page folder: `insights/<slug>.md` next to `insights/<slug>/index.html`.
- **Invariant, enforced:** `scripts/lib/audit-dist.mjs` refuses a `.md` file outside `library/` unless the page it mirrors was built (`twinPage('insights/x.md')` is `insights/x/index.html`). A twin that outlives its page, or a stray Markdown file, fails `audit:dist`. `library/*.md` are the existing template downloads and keep their own rule.
- **Same denylist as the page:** `audit:claims` scans every `.md` as plain text. A twin stands for its page's route (`insights/x.md` is `/insights/x/`), so a rule allowed on a page is allowed on its twin. Link addresses and bare URLs are removed before scanning because a slug is not copy. A `data-claim-allow` marker cannot exempt plain text, so a twin cannot quote forbidden wording at all.
- **Emission (WP-41):** only entries whose body is plain Markdown; a lint fails when JSX, imports or unresolved components remain; drafts, noindex routes and L2 routes are excluded. The page advertises its twin with `<link rel="alternate" type="text/markdown" href="...">`. The twin's first heading equals the page H1 and its canonical URL is the page's.

## 3. `llms.txt` and `llms-full.txt`

Generated, never typed by hand (WP-41: `src/pages/llms.txt.ts`, `src/lib/llms.ts`), from `src/data/site.ts`, the route state and `src/data/packages.ts`.

Top-level files; both are on the publish allowlist (`TOP_LEVEL_FILES`). Outline of `llms.txt`, in this order:

1. `# World Enterprise Incubator`, then a one-sentence summary as a blockquote (the site description).
2. What WE is.
3. What WE offers: the seven service lines and the four package names with stage fit.
4. What WE does not do. This section carries, verbatim: `WE makes no promise of funding.`, the Investor Introductions disclaimer (`INTRODUCTIONS_DISCLAIMER` in `src/components/blocks/introductions.ts`), and the FAQ sentence that WE does not describe a cohort calendar or a demo day.
5. The published commercial facts: the seat is the unit; four packages; amounts are not published and how to ask; Investor Introductions is a flat-fee add-on.
6. Key pages, as links to their Markdown twins.
7. How WE decides (link, when `/program/how-we-decide/` is live).
8. Contact: the form route. No mailbox until one is confirmed.
9. Optional pages.

`llms-full.txt` is the full text of the key pages, each block headed by its canonical URL, capped in size (WP-41's unit test sets the cap).

**Required text, enforced as soon as the file is built (`ifBuilt`):** `/llms.txt` and `/llms-full.txt` must contain `WE makes no promise of funding.` (`R-W7-C05-no-funding-disclaimer`) and the verbatim disclaimer (`R-W7-C14-intro-disclaimer`). The same no-funding sentence is required on `/program/how-we-decide/` once that page is built. A page that does not exist is not required to; the rule applies from the day it does.

## 4. Command palette attribute

WP-46 builds the `we-palette` island. Its commands are serialized at build time into one attribute on the island's root element, so there is no new route and no runtime fetch:

```html
<we-palette data-commands='[{"label":"Pricing","href":"/pricing/","group":"Services"}]'>
```

- `data-commands` is a JSON array. Each item has `label` (string), `href` (an internal route with a trailing slash) and `group` (string). `hint` (string) is optional.
- Only routes that are live per `computeRouteState` appear, exactly as `resolveNav` hides a link whose page does not exist. A route row without a page never reaches the palette.
- The array is derived from `src/data/nav.ts` and the route ledger; nothing in it is typed by hand in a component.
- Attribute values are HTML-escaped by the Astro attribute serializer. The island parses with `JSON.parse` in a `try` and falls back to an empty list on a parse error. Without JS the header keeps its link to `/search/`.

## 5. Routes and navigation

WP-40 pre-registers every new route as a `launch: true` row in `src/data/routes.ts` so no page-owning package edits a frozen file. A launched row with no page is inert: out of nav and sitemap, a warning in `audit:ledger`, a skip in the e2e route sweeps. Adding a page file for the path makes it live with no other edit. The release gate (`verify:release`) fails on a launched row with no page unless `RELEASE_ALLOW` names it, which is why WP-50 flips an unbuilt optional route to `launch: false` with a reason.

| Route | Owner |
|---|---|
| `/program/how-we-decide/` | WP-43 |
| `/about/facts/` | WP-41 |
| `/tools/`, `/tools/metrics-calculator/`, `/tools/evidence-room/` | WP-49 |
| `/about/frameworks/ubf/`, `/star/`, `/shift/`, `/android/` | WP-48 (optional) |
| `/llms.txt`, `/llms-full.txt` (machine routes) | WP-41 |

`src/data/nav.ts` links to these pages; they stay hidden until the page exists. No existing item is removed or reordered (DP-3).

## 6. Truth policy

Binding on every package.

- No fabricated portfolio, testimonials, statistics or people.
- No named company, event, cohort or date (D-12).
- No analytics, cookies or third-party scripts (D-14).
- Flags stay off.
- No "no fee", "no equity", "equity-free", "free of charge" or "no stake" statement about the commercial model. The fee-to-equity election exists in the agreement and is unpublished (F-4). The only legitimate occurrence is the verbatim Investor Introductions disclaimer ("takes no fee or stake tied to any investment"). Rules `W7-C09-no-fee`, `W7-C09-no-equity`, `W7-C09-free-of-charge`.
- No response-time or decision-time promises. Rule `W7-response-time`.
- No counts of applications, no acceptance rates. Rule `W7-application-counts`.
- No seat count tied to a package. Rule `W7-package-seat-count`.
- The literal "success fee" is blocked by the unconditional rule `C-08-success-fee`, so copy about the Introductions add-on says "tied to any investment", as the disclaimer does.

All of these are `contextRules` in `claims-denylist.json` (version 3): they apply to built output (`.html`, `.xml`, `.txt`, `.md`) and never to source files. An element in an HTML page that must quote forbidden wording in order to deny it carries `data-claim-allow="<rule id>"`. A text file cannot.

## 7. Tests, handoffs and sources

- Unit tests: `tests/unit/wp-NN/**`, run by `npm run test:unit`. Type-checked by `npm run check`. No `any`, no `@ts-ignore`.
- End-to-end tests: `tests/e2e/wave7/wp-NN/**`, run by the `e2e:wave7` CI job at 1440x900 and 390x844 (and the no-JS, forced-colors and zoom projects where the spec is tagged for them). The existing e2e jobs ignore this folder. The job runs only once a spec exists (`rules: exists`), so an empty wave is green. Never run Playwright locally.
- Handoff: `.astro-magazine/handoffs/wp-NN.md`. What changed, files, decisions, open items, requests to other packages.
- Sources: `.astro-magazine/sources/wp-NN.json`. Every new sentence of copy maps to a claim id (`src/data/claims.ts`) or to an existing page.
- Commits end with `Co-Authored-By` and `Claude-Session` trailers. Push the branch, watch the pipeline, fix red, repeat. Fast-forward `demo` only when green.

## 8. CI jobs added by WP-40

- `e2e:wave7`: runs the two Playwright projects `wave7-desktop-1440x900` and `wave7-mobile-390x844` for `tests/e2e/wave7/**`. The projects exist only when `E2E_WAVE7` is set (the job sets it) and the common projects ignore the folder, so no filter word in another job's command can pick a wave 7 spec up. Inert until a spec exists: the rules are `.qa-rules` plus `exists: tests/e2e/wave7/**/*.spec.ts`, so a pipeline without one has no job and is green, and the job blocks like every other qa job once it exists. Name specs freely; a spec outside `tests/e2e/wave7/` is not run by this job.
- `audit:geo` (`npm run audit:geo`): runs `scripts/audit-geo.mjs`, which WP-41 writes. Inert until the script exists (`rules: exists: scripts/audit-geo.mjs`, the same blocking policy as every qa job). The npm script is `node scripts/audit-geo.mjs --dist dist`, the same shape as `audit:seo`: WP-41 reads `--dist`. WP-41 validates `llms.txt` structure, that every linked twin exists and matches its page's H1 and canonical, that no twin or llms file contains a denylisted phrase, and that a production `robots.txt` allows the sitemap.
- `RELEASE_ALLOW` (a branch pipeline only) also tolerates the nine pending routes and the two machine files, each named and anchored (decision W7-6). A release tag and `gh-pages` allow nothing. WP-50 narrows it back to the form routes. The `mirror` job waits for both jobs above when they exist (`optional: true`).
- `audit:claims` and `audit:dist` already cover the new files through the extensions described in sections 2, 3 and 6.
