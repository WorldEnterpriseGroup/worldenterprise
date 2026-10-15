# Wave 7 plan: taking World Enterprise Incubator from "technically excellent" to state of the art

| | |
|---|---|
| Mode | SURVEY then PLAN. Read-only. Nothing in the repo was modified, nothing built locally. |
| Date | 2026-10-09 |
| Repo / branch | `~/repos/WorldEnterpriseGroup/worldenterprise`, branch `demo` at cc84ffa or newer (read through worktree `~/repos/WorldEnterpriseGroup/_wt/wp-12d`, `wp/12d`) |
| Excluded by instruction | Photography (WP-12d / phase B, lane WP-12 / 12b) and release (WP-30). Both lanes are treated as reserved paths below. |
| Evidence method | hix MCP tools were not exposed in this session, so discovery used shell reads. CI artifacts (dist, Lighthouse, Playwright screenshots) stand in for the deployed demo, which sits behind Entra / Keycloak SSO (I stopped at the login and did not authenticate). Benchmark facts come from a delegated read-only teardown with [O] observed, [O2] secondary source, [I] inference, [R] recalled, UNVERIFIED tags. |

**Status note (WP-40, 2026-10-09).** Committed by WP-40 as the wave's plan of record. Operator decisions applied: DP-1 (WP-30 merges first; WP-40 rebases before touching `.gitlab-ci.yml` and `package.json`), DP-2 (AI crawlers allowed with named groups), DP-3 (no nav slimming), DP-4 to DP-14 (plan defaults), Q-1 (no benchmark allowlist). Two corrections found while implementing: `audit-claims.mjs` did not scan `.txt` or `.md` (it does now, section 5 WP-40 item 5), and pre-registered `launch: true` rows fail `verify:release` unless `RELEASE_ALLOW` is widened in the same push (WP-40 item 1). The support scripts are in `.astro-magazine/plans/wave7/`; the paths below that name a session-local tmp directory were rewritten to it. The decisions are W7-1 to W7-9 in `.astro-magazine/decisions.md`.

**Status note (WP-40, 2026-10-10).** Decision W7-9 reverses the photography gate: phase B photo generation is deferred (the only serving GPU node is an etcd member while etcd is at 2 of 3), the vector compositions in every photo slot are the shipped imagery, and phase B will rebase onto wave 7 instead of wave 7 waiting for it. The files this plan called gated (`src/pages/pricing/index.astro` for WP-42, `src/pages/program/who-its-for.astro` for WP-43, and the WP-50 hero edits) are released. The rest of the photography lane (`Card.astro`, `HeroAtlas.astro`, `HeroEditorial.astro`, `src/components/cards/**`, `src/components/media/**`, `src/assets/photo/**`) stays excluded from WP-45. Wherever this plan says "gated" or "after WP-12d", read it as released. The CI jobs `e2e:wave7` and `audit:geo` and the `RELEASE_ALLOW` widening landed after WP-30 merged (DP-1 is satisfied: release 1 ships from the protected tag `release-1-rc2`).

Contents: 1 Summary | 2 Benchmark | 3 Where WE stands (seven axes) | 4 Plan shape and RICE | 5 Work packages WP-40 to WP-50 | 6 Decision points and irreversible steps | 7 Open questions | 8 Evidence

---

## 1. Summary

**Finding.** The site is already at or above the benchmarks on the things that are cheap to copy: Lighthouse is 1.0 in all four categories on the eight audited routes, mean LCP 1,682 ms, 131.9 KB total, one 9.4 KB stylesheet (CI artifact `lh/reports/lighthouse/network.md`). It is not yet at the benchmarks on the things that make an accelerator site feel elite: a published, inspectable account of how the deal and the selection work, a conversion path with one clear verb and visible criteria, a distinct visual signature, and a machine-readable layer for AI answer engines. None of the eight benchmarks has the last one (only Antler ships a real `llms.txt`), so that is the one place WE can be first rather than equal.

**Constraint that shapes everything.** The benchmarks win on portfolio proof (YC "$1.3 Trillion in combined valuation", speedrun "$300M to fund over 300 startups", Techstars "29 unicorns", Antler "2,000+", EF "$16B") [O]. WE has no portfolio, no named people, no dates, no published amounts, and the truth policy keeps it that way. WE cannot out-brag them. It can out-explain them: the way to be state of the art under the truth policy is **proof by inspectability** (every claim mapped to a page, every stage ending in artifacts you can open, every limit stated), plus craft and machine readability.

**Approach.** One small foundation package (WP-40) owns every frozen file for the wave: route rows, nav links, denylist rules, ownership registrations, shared package data and CI plumbing. Nine feature packages (WP-41 to WP-49) then run in parallel on disjoint write sets, and one integrator (WP-50) closes the wave. Overlap was checked mechanically: 36 stage-1 pairs, 174 patterns, zero overlaps, none against the frozen list, none against the photography lane, none against the declared release lane, and every tracked layout is claimed exactly once (section 8.3). The release lane (WP-30) has no assignment in `ownership.json`, so that list is declared from `docs/runbook-release.md` and the CI file, not registered; WP-40 touches `.gitlab-ci.yml` and `package.json`, so it must start after WP-30 merges (DP-1).

**Sequencing recommendation.** Do not hold WP-30 (release) for wave 7. The current demo is shippable on every measured axis. Wave 7 lands on `demo` after the release fast-forward and becomes release 2 (decision DP-1).

**Top five by RICE (judgement-scored, no analytics exist by D-14):** WP-42 pricing and packages (3.2), WP-44 home composition (3.2), WP-43 apply flow and "How WE decides" (3.2), WP-41 GEO and citation layer (2.4), WP-45 visual system v2 (1.7). WP-40 is a mandatory enabler (scored 6.7).

---

## 2. Benchmark (October 2026)

Source: read-only teardown of the eight sites, 2026-10-09. WebFetch returns rendered text only, so **visual design, JSON-LD, OG, canonical, fonts, dark mode and framework markers are UNVERIFIED on all eight.** Any visual claim below about a benchmark is therefore absent on purpose. A browser pass would close this gap; it needs the eight domains allowlisted (Q-1).

| Site | Primary nav [O] | One verb and above the fold [O] | Terms published [O] | Selection stated [O] | FAQ [O] | llms.txt [O] |
|---|---|---|---|---|---|---|
| Y Combinator | 6 items (About, Companies, Library, Partners, Resources, Startup Jobs) plus Log in and Apply | "Apply"; H1 "YC turns builders into formidable founders" | `/deal` publishes the math ($500,000 as $125,000 post-money SAFE for 7% plus $375,000 uncapped MFN SAFE, "no fees") | Interview feedback for every interviewee; FAQ "Do we need to know someone at YC" | 6 categories | 404 |
| a16z speedrun | 4 items (Companies, Demo day, Perks, FAQ) plus Apply now | "Apply now"; "We invest up to $1M in your new startup." | In the FAQ ($500K for 10% in a SAFE, plus $500K next round within 18 months, no board seat) | Published criteria: "earned secrets", "zero to one without waiting for permission" | 9 categories, about 35 questions | Not a file (catch-all returns homepage) [I] |
| Techstars | 6 items plus Apply Today | "Apply Today" and "Review $220K Investment Terms" as a second hero CTA | `/newsroom/investment-terms` ($200,000 uncapped MFN SAFE plus $20,000 for 5%, "no fee") | FAQ on help subdomain ("How does Techstars choose...") | 6 categories | 404 |
| Antler | 5 items (Locations, Resources, Portfolio, Investors, About) plus Pitch Us | "Pitch Us"; single CTA | In llms.txt only ("Each local fund sets its own terms") | None on page | Insights hub with filters | **Real file** with "Investment terms" and "Do not confuse with" sections |
| Entrepreneur First | 2 bracketed groups (Apply, Insights, FAQs; About, Portfolio, Careers) | "APPLY HERE"; claim headlines | Partial ("up to $250,000", no equity percent) | Rolling review, email either way | 10 questions | 404 |
| South Park Commons | 4 primary plus secondary links | Two cards (Residency, Funding) both to /apply | In the FAQ ($400,000 for 7% via SAFE, plus $600,000 in the next venture round) | Artifact-based application ("2-3 artifacts" of your work) | 14 questions | 404 |
| Pioneer | Not observable | No apply path (stopped new investments in 2024) | None | None | /faq 404 | 404 |
| Neo | Not observable (JS shell) | Not observable | From TechCrunch only [O2] | "3000+ reference checks" [O2] | Not observed | robots matches a Bubble dev path |

**Patterns that matter for WE (all [O] unless noted):**

1. One verb. Every site funnels to a single "Apply" and none runs a separate "Contact" as a peer CTA.
2. Nav of 4 to 6 items; WE has 7 primary items (6 mega panels) plus 4 utility links plus Apply (`src/data/nav.ts`).
3. The commercial terms are published as a page, a hero CTA or a FAQ answer. WE can only publish the structure, not the amounts (F-4, C-10).
4. Selection is explained in public on the best sites (speedrun criteria, SPC artifacts, YC interview feedback).
5. The FAQ is the main trust asset on five of eight, and it is categorized.
6. Named thesis (SPC "-1 to 0", YC "formidable") and claim headlines (EF "We invest early, fast, and on founder-friendly terms").
7. Essay or library depth: YC about 400 articles; the rest 4 to 20. WE has 18 insights, 4 research briefs, 6 library templates, 5 playbooks, 4 guides, 18 FAQ entries.
8. Hygiene is not uniform: Antler's footer shows an unrendered `{{year}}` and states 1,800+ and 2,000+ for the same count; EF's footer says 2025; speedrun's FAQ is stale against its own apply page; Neo is a JS shell. WE's audits already beat this.

---

## 3. Where WE stands, on the seven axes

Facts below were read from the repo or CI artifacts; judgements are labelled [I].

### 3.1 Information architecture and conversion
- Nav: 7 primary items, 6 of them mega-menu popovers, plus utility links (For investors, Press, Contact, Search) and an Apply button (`src/data/nav.ts`). The nav file itself notes that Apply, Contact and Trust are duplicated into panels so people can find them. Benchmarks run 4 to 6.
- Paths: Apply, Contact, Pricing and the Team Composer are four peer routes to action. None of them states how applications are read. The Apply aside explains what happens next (four steps) and what is collected, not how WE decides (`src/pages/apply/index.astro:36-57`).
- The only selection facts live on `/program/who-its-for/` ("You are a good fit if", "WE is probably not the right fit if"), which the Apply page does not link as criteria.
- Pricing: four packages (Spark, Launch, Accelerate, Studio) shown as a data table with stage and depth, then seats, drivers, the Investor Introductions add-on, "What this page does not show" and nine FAQ items (`src/content/pages/pricing/pricing.mdx`). The earlier visual audit called the page legal-looking (`.plan/qa/visual-brand.md` P1-8); the table-first order is still there.
- Team Composer: role by seat-count number inputs, GET to `/apply/`, no link to packages (`src/components/islands/we-team-composer/TeamComposer.astro`).

### 3.2 Visual craft [I, judged from CI screenshots at 1440 and 390 and the source]
- Strong base: OKLCH tokens, fluid type scale, scroll-driven reveal and stagger, reading progress, cross-document view transitions with a persistent header, hex atlas hover (`src/styles/motion.css`). Reduced motion is respected.
- Template-like signals still present: the home count band of catalogue numbers (`src/pages/index.astro:50-65` and `90-98`, "7 service lines, 5 playbooks, 18 insight articles"), repeated two-column hero with vector art, one card variant, table-first pricing, a long single-form Apply. These match the open items P1-4, P1-8, P2-3 in the Oct 8 audit; the P0 and most P1 findings from that audit were fixed by WP-16 and WP-17.
- No dark mode, by decision (D-8 / EX-LIGHT). Not reopened.

### 3.3 Content depth and honest credibility
- Depth is real but uneven: five playbooks of 549 to 605 words each (2,911 total), program pages of 100 to 165 words each, 18 insights and 4 research briefs of article length.
- Honest credibility signals available today: the EvidenceLedger (claim, source, basis), stage exit evidence, the editorial policy, the trust centre, the limits blocks, the explicit no-funding statement. These are the raw material for "proof by inspectability" and are underused on the home page.

### 3.4 Interaction quality
- Mega-menu is a native popover with focus return and arrow keys (decisions W-8). Search is a separate page over Pagefind (`src/scripts/search.ts`, `/search/`); there is no in-page palette. Forms are a single page with native-post no-JS fallback and a documented contract (`src/data/forms.ts`, `docs/forms-contract.md`). The Composer is a plain stepper.

### 3.5 Performance and accessibility (at or above benchmark; not a gap)
- Lighthouse 1.0 on performance, accessibility, best practices and SEO for 8 routes; FCP mean 1,390 ms, LCP mean 1,682 ms, one render-blocking stylesheet of 9.4 KB, 5 to 7 WOFF2 font requests, 104 to 145 KB per route (`network.md`).
- The Oct 8 SEO audit's two P1s (CSS not inlined, WOFF1 fonts) are fixed in the current build (1 CSS request; WOFF2 per the WP-19 handoff). Its P2-4 (Article JSON-LD has no `image`) is also fixed: built insight pages carry `"image":"https://worldenterprise.org/_astro/og-resources.*.avif"`. Do not re-plan these.

### 3.6 SEO and GEO
- Baseline is complete: titles, canonical, OG and Twitter, a JSON-LD `@graph` (ProfessionalService, WebSite with SearchAction, WebPage, Article, AboutPage, CollectionPage, BreadcrumbList, FAQPage), sitemap index, RSS, speculation rules.
- GEO gaps (observed in `art/static2/dist`): `robots.txt` is `User-agent: * / Allow: /` plus the sitemap line; no `llms.txt` or `llms-full.txt`; no AI-crawler policy; Markdown alternates exist only for the 6 library templates (`scripts/lib/audit-dist.mjs:36` allows `.md` only under `library/`); the home graph has no `OfferCatalog`.
- Caveat [I]: the effect of `llms.txt` on citation by answer engines is unproven. The plan treats it as cheap and differentiating, not as a ranking lever, and puts the weight on structured data, clean Markdown twins and one canonical entity-facts page.

### 3.7 Template-like or generic (consolidated)
1. Catalogue-count band on the home page.
2. Pricing as a table.
3. A single card variant and one repeated hero pattern.
4. Apply as one long form with no criteria.
5. Mega-menu density and the Composer without a package link.
6. Insight thumbnails and 40 of 88 pages sharing one social card (`.plan/qa/seo-perf.md` P2-5). **Excluded**: this is the OG and photography lane (WP-12 family); hand it to that lane.

---

## 4. Plan shape and RICE

**Shape.** Stage 0 (WP-40) lands first and merges to `demo`. Stage 1 (WP-41 to WP-49) runs in parallel branches `wp/41` ... `wp/49`. Stage 2 (WP-50) runs after stage 1 and is the only package allowed to fix seams between them.

**Recommended concurrency.** At most five stage-1 agents at once. The Playwright config documents that four workers on a shared runner already produced timeouts (retries are set to 2 in CI). Suggested batches by RICE: A = WP-42, WP-43, WP-44, WP-41, WP-46; B = WP-45, WP-49, WP-47, WP-48.

**Rules for every package (also written into `docs/wave7-contracts.md` by WP-40):**
1. A package edits only files in its registered write set. `check:ownership` enforces this on `wp/*` branches.
2. Shared surfaces have one owner: `src/styles/**` and `src/components/ui/**` belong to WP-45; `src/components/layout/**` to WP-46; frozen files to WP-40 (stage 0) and WP-50 (stage 2). Every other package puts new styling in scoped `<style>` blocks inside its own new components and asks WP-45 for token changes through its handoff.
3. Components that other packages import (anything in WP-45's `ui`, `blocks`, `program`, `diagrams`) keep their prop API backward compatible; WP-45 ships a unit test that pins the props.
4. Every package writes its tests only in `tests/unit/wp-NN/**` and `tests/e2e/wave7/wp-NN/**`, plus a handoff at `.astro-magazine/handoffs/wp-NN.md` and a sources file `.astro-magazine/sources/wp-NN.json` that maps each new sentence to a claim id or page.
5. Truth policy, binding on all: no fabricated portfolio, testimonials, statistics or people; no named company, event, cohort or date (D-12); no analytics, cookies or third-party scripts (D-14); flags stay OFF; no "no fees", "no equity", "free" or "no stake" statements about the commercial model (the fee-to-equity election exists in the agreement and is unpublished, F-4); no response-time promises; no counts of applications, acceptance rates or seat numbers per package.

**Milestones**

| Milestone | Packages | Success criterion |
|---|---|---|
| M7a Foundation | WP-40, after WP-30 has merged | WP-40 merged to `demo`; `verify:static`, every qa job and `check:ownership` green with zero new pages; wave-7 write sets registered and a unit test proves stage-1 sets are pairwise disjoint; `docs/wave7-contracts.md` published |
| M7b Features | WP-41 to WP-49 (WP-48 optional) in two batches | Each package green on its own `wp/NN` branch, merged to `demo`, own acceptance criteria met, handoff and sources files present, Lighthouse 1.0 and axe clean on its routes |
| M7c Integration | WP-50 | Full pipeline green on `demo`, including `verify:release` (every launched route exists, no draft, no denylist hit); wave handoff lists decisions resolved and still open |

**RICE.** Reach is the relative share of evaluating visitors who touch the surface (0 to 10). Impact is 0.25, 0.5, 1, 2, 3. Confidence is the evidence quality. Effort is agent-sessions (one session is one scoped branch taken to green CI). **Reach and Impact are judgements, because D-14 means there is no analytics to measure them.** Confidence is lowered where the benchmark evidence is UNVERIFIED or secondary.

| WP | Package | Reach | Impact | Confidence | Effort | RICE | Priority |
|---|---|---:|---:|---:|---:|---:|---|
| WP-40 | Foundation, ledger, claims, ownership, packages data, CI | 10 | 1 | 100% | 1.5 | 6.7 | P0 enabler, first |
| WP-42 | Pricing, packages, Team Composer | 8 | 2 | 80% | 4 | 3.2 | P0 |
| WP-44 | Home composition | 10 | 1 | 80% | 2.5 | 3.2 | P0 |
| WP-43 | Apply flow and How WE decides | 9 | 2 | 70% | 4 | 3.2 | P0 |
| WP-41 | GEO and citation layer | 6 | 2 | 60% | 3 | 2.4 | P1 |
| WP-45 | Visual system v2 | 10 | 2 | 50% | 6 | 1.7 | P1 |
| WP-46 | Navigation identity and command palette | 8 | 1 | 70% | 3.5 | 1.6 | P1 |
| WP-49 | Interactive founder tools | 5 | 2 | 60% | 5 | 1.2 | P2 |
| WP-47 | Playbooks, guides, readiness depth | 4 | 2 | 70% | 5 | 1.1 | P2 |
| WP-48 | Frameworks depth | 3 | 1 | 50% | 3 | 0.5 | P3, optional |
| WP-50 | Integrator and regression | 10 | 1 | 100% | 3 | 3.3 | Mandatory, last |

Why WP-45 sits at 50% confidence: the benchmark visuals are UNVERIFIED, so "elite visual craft" is partly taste. Allowlisting the eight domains for one screenshot pass (Q-1) would lift it to about 70% and raise its score.

---

## 5. Work packages

Each package lists scope, files, acceptance criteria and dependencies. Globs are the registered write sets and match `wave7-writesets.json` (section 8). "Lane exception" files (formerly "gated") are in the photography lane's exception list; decision W7-9 (2026-10-10) released them, so a package edits them through its own ownership exception on any branch, with no wait for WP-12d phase B.

### WP-40 Foundation (stage 0, P0 enabler, 1.5 sessions)

**Why first.** Nearly every other package needs a frozen file: a route row (otherwise `audit:ledger` fails), a nav link, a denylist rule, an ownership registration, a CI job. Letting each package edit them would break the no-overlap rule immediately, so WP-40 lands all of it once, mirroring the WP-15 pattern already in `ownership.json`.

**Scope**
1. `src/data/routes.ts`: extend the `RouteOwner` union with WP-40 to WP-50. Pre-register every new route as a `launch: true` row, the same way WP-00 pre-registered the 90 existing rows, so no page-owning package ever needs a frozen file. This is safe by construction: `computeRouteState` keeps a launched row with no built page out of nav and sitemap (`computeRouteState` in `src/lib/route-core.ts`); `audit:ledger` runs without `--strict` on branches (`package.json:26`), where such a row is a warning (`pending` findings in `auditLedger`, `scripts/audit-route-ledger.mjs`); the release gate (`scripts/lib/release-gate.mjs`, "missing launched routes") is what turns it into a failure. The opposite choice is the unsafe one, because a built page whose row is `launch:false` is an error on the branch (`leaked` findings). Rows: `/program/how-we-decide/` (WP-43), `/about/facts/` (WP-41), `/tools/`, `/tools/metrics-calculator/`, `/tools/evidence-room/` (WP-49), `/about/frameworks/ubf/`, `/star/`, `/shift/`, `/android/` (WP-48, optional). MACHINE_ROUTES: `/llms.txt`, `/llms-full.txt` (owner WP-41, generated `page`; pending is a warning off the release gate). If WP-48 is deferred, WP-50 flips its four rows to `launch:false` with a reason so the release gate passes. No filesystem-existence helper is added: `routes.ts` is imported by the Astro build, by node audit scripts and by `export-ledger.mjs`, and a new `node:fs` dependency there buys nothing the existing pending-warning does not already give.
2. `src/data/nav.ts`: links to the new pages (they stay hidden until the page exists, per `route-state`), and update `tests/unit/foundation/fixtures/nav-snapshot.json`. No removal or reordering of existing items (see DP-3).
3. `src/data/packages.ts` (new, the single home for package data): id (`spark`, `launch`, `accelerate`, `studio`), name, stage fit, depth, transcribed verbatim from the table in `pricing.mdx`. A unit test asserts equality with the table until WP-42 renders the table from this module. Consumers: WP-41, WP-42, WP-43, WP-44. No amounts, no seat counts (F-4 and `KEY-VALUES.md` give none).
4. `claims-denylist.json` (version 3): (a) a rule against "no fee", "no fees", "no equity", "equity-free", "free of charge", "no stake" about the commercial model, with the verbatim Investor Introductions disclaimer as a mandatory negative test case (it contains "takes no fee or stake tied to any investment" and must keep passing); (b) a rule against response-time promises ("within 24 hours", "reply within N days") and counts of applications or acceptance rates; (c) `R-C05` and the Introductions rules extended to the new pages; (d) note that the unconditional rule `C-08-success-fee` blocks the literal "success fee", so new copy must use "tied to any investment" wording (the existing disclaimer does). Checked against the current build before proposing the rules (grep of `art/static2/dist`, html, txt, md, xml): the only hit for "no fee(s)", "no equity", "equity-free", "free of charge", "no stake", "within N hours/days" or "acceptance rate" is the verbatim disclaimer ("takes no fee or stake tied to any investment"), present on 7 built pages (faq, pricing, investors, network, the fundable topic page, one insight, the fundability service). So the new rules start green provided they exempt exactly that sentence; the exemption is a required test case, not an afterthought.
5. `scripts/lib/audit-dist.mjs`: allow `llms.txt` and `llms-full.txt` at the top level (`TOP_LEVEL_FILES`, line 39) and allow `.md` next to a built page (`SCOPED_EXTENSIONS`, line 36) with an invariant test: every `.md` in `dist` has a sibling route with an `index.html`, except library templates. `scripts/audit-claims.mjs` already walks and scans every file in `dist`, so `.txt` and `.md` are covered; add a test with an `llms.txt` fixture to prove it.
6. `.gitlab-ci.yml`, `playwright.config.ts`, `package.json`: an `e2e:wave7` job running `tests/e2e/wave7/**` at 1440 and 390 (the specs are matched by name today, `.gitlab-ci.yml:187-216`, `playwright.config.ts:6`); an `audit:geo` npm script and job guarded with `rules: exists: scripts/audit-geo.mjs` so it runs only once WP-41 lands the script (no stub scripts).
7. `.astro-magazine/ownership.json`: register WP-40 to WP-50 assignments (owner, branch `wp/NN`, `write_set`) from `wave7-writesets.json`. Verified in `scripts/check-ownership.mjs` and `tests/unit/foundation/ownership.test.ts`: a branch maps to exactly one assignment, a path may sit in several assignments and exceptions (WP-12b and WP-15 already share files with WP-03 and WP-01), and nothing asserts cross-owner disjointness. So registration is additive and no ownership transfer is needed. Two consequences. (a) The checker polices a branch only against its own write set and `frozen_paths`, so it will not catch two wave-7 packages that collide; WP-40 therefore adds `tests/unit/wp-40/write-sets.test.ts`, the durable form of my overlap checker, asserting that stage-1 write sets are pairwise disjoint, avoid `frozen_paths` and avoid the photography lane. (b) A frozen file can only be edited by a branch that holds an `exceptions` entry for it, so WP-40 registers one exception per frozen file it edits, in the same commit (the WP-15 pattern; `ownership.json` is read from the branch under test, so self-registration works). The two photography-lane files (pricing and who-its-for) are registered as exceptions for WP-42 and WP-43; they were gated on phase B with that reason until W7-9 released them.
8. `.astro-magazine/decisions.md`: entries W7-1 to W7-8 recording the contracts and the decision points resolved by the operator. `docs/wave7-contracts.md`: package ids and the `?package=` query contract, the Markdown twin URL scheme, the `llms.txt` outline, the palette command attribute, the test and handoff conventions, the truth-policy list above.

**Write set.** `package.json`, `package-lock.json`, `astro.config.mjs` (only if needed), `src/data/{routes,nav,claims,flags,site,packages}.ts` (claims, flags, site only on operator input), `src/content.config.ts` (only if needed), `claims-denylist.json`, `.astro-magazine/{ownership.json,decisions.md}`, `.gitlab-ci.yml`, `playwright.config.ts`, `lighthouserc.json`, `tests/unit/foundation/**`, `scripts/lib/audit-dist.mjs`, `scripts/audit-claims.mjs`, `docs/wave7-contracts.md`, `tests/unit/wp-40/**`, own handoff and sources.

**Acceptance criteria**
- `npm run check`, `test:unit`, `check:ownership` and the full verify pipeline are green with zero new pages (the new rows are inert).
- Every new route has a `launch: true` row and an owner in the extended union; `audit:ledger` on the WP-40 build reports them as pending warnings, not errors; adding a stub page for any new path makes `isLive` true with no further edit to a frozen file (unit test over `computeRouteState` with a fabricated context).
- `packages.ts` equals the `pricing.mdx` table; the denylist self-test passes with positive and negative cases for each new rule, including the verbatim disclaimer, and the claims audit on the unchanged current build still reports zero hits.
- `docs/wave7-contracts.md` exists and is linked from every WP issue.
- Ownership has teeth: a scratch branch `wp/NN` per registered assignment that touches one file per glob of its own write set passes `check:ownership`; the same branch touching one file from another stage-1 package's set, and one frozen file with no exception, each fail; `tests/unit/wp-40/write-sets.test.ts` passes.
- `audit:geo` and `e2e:wave7` jobs exist and are inert until their files exist (rules `exists:`), and a pipeline with neither file present is green.

**Dependencies.** WP-30 (release) merged first, because WP-40 edits `.gitlab-ci.yml` and `package.json`, which the release engineer also owns by role (`docs/runbook-release.md` says WP-30 adds `scripts/release-preflight.mjs`; `ownership.json` has no WP-30 assignment, so this is declared, not enforced). Everything else depends on WP-40.

---

### WP-42 Pricing, packages, Team Composer (P0, RICE 3.2, 4 sessions)

**Goal.** Turn the pricing page from a table into the equivalent of YC's `/deal` and Techstars' terms CTA, within what C-10 allows (names, stage fit, depth), and connect the Composer to it.

**Scope**
1. `src/components/pricing/**` (new): `PackageCards` (four cards from `packages.ts`: name, stage fit, depth, "Start with this package" to `/apply/?package=<id>`, "Sketch the team" to `/tools/team-composer/?package=<id>`); `SeatExplainer` (what one seat is, reusing the existing SeatDiagram by import); `NotPublished` ("What WE does not publish here and how to ask": amounts, the contact topic `seat-rate`); `PackagePicker` (a stage question that highlights the package whose published stage fit matches; plain list without JS, `aria-live` result with JS). The stage-to-package mapping is read from `packages.ts`, never invented.
2. `src/content/pages/pricing/pricing.mdx`: reorder to lead, package cards, how seats work, picker, what drives the seat count, Investor Introductions add-on (`InvestorIntroductionsOffer variant="brief"`, verbatim disclaimer and flat-fee sentence stay), what this page does not publish, FAQ. All existing required texts remain.
3. Composer (`src/components/islands/we-team-composer/**`, `src/scripts/team-composer.ts`, `src/pages/tools/team-composer.astro`, `src/content/pages/tools/team-composer.mdx`): read `?package=`, show "Sketching for <package>, sized for <stage fit>", add an optional stage select, carry `package` into the Apply link, keep the no-JS GET form. **No preset seat counts per package** (none are published).
4. `src/pages/pricing/index.astro` (lane exception, released by W7-9): wire the components in; keep the rate column logic that appears only when `flags.seatPrice.published` is true.

**Write set.** `src/components/pricing/**`, `src/components/islands/we-team-composer/**`, `src/scripts/team-composer.ts`, `src/pages/tools/team-composer.astro`, `src/content/pages/tools/team-composer.mdx`, `src/content/pages/pricing/**`, lane-exception `src/pages/pricing/index.astro`, tests and handoff.

**Acceptance criteria**
- `/pricing/` shows four package cards driven by `packages.ts`; no currency amount anywhere (rules `C-06-*` pass); no per-package seat count; `R-C05`, `R-C14-*` required texts present.
- Round trip: choosing a package on `/pricing/` opens `/tools/team-composer/?package=launch`, and the Apply link from there carries `package=launch` (e2e at 1440 and 390).
- No-JS: cards, picker fallback list and Composer GET form all work (`modes.spec` no-js project).
- axe clean; the picker result is announced; focus order follows reading order; touch targets at least 24 px.
- Lighthouse on `/pricing/` stays at 1.0 on all four categories; CLS under 0.1; no new third-party request.
- The lane-exception file is edited through its ownership exception on any branch (W7-9); the markup around its image slots does not change, so phase B can rebase onto it later.

**Dependencies.** WP-40 (`packages.ts`, rows, denylist). Soft dependency on WP-43 for the shape of the `package` parameter (contract is in `docs/wave7-contracts.md`, so the two build independently). Edits one photography-lane file through an exception (W7-9 released the wait for WP-12d).

---

### WP-43 Apply flow and "How WE decides" (P0, RICE 3.2, 4 sessions)

**Goal.** One clear verb with visible criteria. Match speedrun and SPC on selection transparency, using only what the site already says.

**Scope**
1. New page `/program/how-we-decide/` (`src/pages/program/how-we-decide.astro`, `src/content/pages/program/how-we-decide.mdx`). Sections: how an application is read (from `/program/how-it-works/`), "You are a good fit if" and "WE is probably not the right fit if" (shared data, below), what you can send (the form's own fields), what a clear no looks like (existing line: "a clear no is as useful to you as a yes"), what WE does not decide (funding; the existing no-funding statement). **No timelines, acceptance rates, counts or new criteria.** Anything not already published elsewhere is an operator input (DP-5).
2. `src/components/apply/fit.ts` (new): the fit and not-fit lists as data. `src/pages/program/who-its-for.astro` (lane exception, released by W7-9) imports them and renders identically (a snapshot test pins this).
3. Apply form (`src/components/forms/**`, `src/scripts/forms.ts`, `src/pages/apply/**`, `src/content/pages/apply/**`): keep one `<form>` with every fieldset in the DOM, then progressively enhance. With JS: step grouping with a progress list (About you, About the idea, Team and package, Review), Back and Next, per-step validation using the existing validators and error summary, a review step, focus moved to the step heading, `aria-live` status. Without JS: all fieldsets visible and the native-post contract unchanged. Add an optional package field fed from `?package=` (from `packages.ts`, plus "Not sure"). If `docs/forms-contract.md` defines a closed payload schema for the intake endpoint, encode the package inside an existing free-text field rather than adding a key (the endpoint is external, D-13).
4. Apply page copy: a "What WE reads" aside that links the new page; `/contact/` unchanged except cross-links.

**Write set.** `src/components/forms/**`, `src/scripts/forms.ts`, `src/data/forms.ts`, `docs/forms-contract.md`, `src/pages/apply/**`, `src/pages/contact/**`, `src/content/pages/apply/**`, `src/content/pages/contact/**`, `src/components/apply/**`, `src/pages/program/how-we-decide.astro`, `src/content/pages/program/how-we-decide.mdx`, lane-exception `src/pages/program/who-its-for.astro`, tests and handoff.

**Acceptance criteria**
- `sources/wp-43.json` maps every sentence on the new page to an existing page and line or a claim id; a unit test fails on an unmapped sentence.
- The form works without JS exactly as the forms contract states (`modes.spec` no-js, `forms.spec`); with JS, a keyboard-only run completes all steps; errors are reported in the summary and inline with `aria-describedby`.
- WCAG 2.2 2.4.11: a sticky progress bar on mobile never obscures the focused field (test at 390 and at 200 percent zoom).
- No PII is persisted on the device (no localStorage, no cookies); step state lives in memory (DP-13).
- Posting still resolves through `src/lib/endpoints.ts`; a disabled endpoint still disables submit in markup.
- Lighthouse and axe unchanged at 1.0 and zero violations on `/apply/` and `/program/how-we-decide/`.

**Dependencies.** WP-40 (row, `packages.ts`, denylist, no-response-time rule). Edits one photography-lane file through an exception (W7-9 released the wait for WP-12d). Operator input DP-5 if the criteria are to grow beyond what the site already says.

---

### WP-44 Home composition (P0, RICE 3.2, 2.5 sessions)

**Goal.** Replace "what is on this site" with "what you leave with", and reorder the page as an argument: promise, evidence, mechanism, price structure, limits, depth, action.

**Scope**
1. Remove the catalogue-count band (`src/pages/index.astro:50-65`, `90-98`). Add `src/components/home/leave-with/**`: a band with three columns, Dream, Build, Grow, each listing the evidence artifacts from the stage data (`src/components/program/stages.ts`, read-only import), so the home page and the stage pages cannot disagree.
2. Add `src/components/home/proof/**`: a rebuilt "Promise and proof" that keeps the four claim, source, basis rows but presents the source as the lead and each row as a link to the page that holds the evidence.
3. Add a small packages teaser (four names with stage fit from `packages.ts`, link to `/pricing/`). No amounts.
4. Reorder `src/pages/index.astro`: hero, what you leave with, how seats work, packages teaser, proof, investor evidence with the no-funding disclaimer, fully remote, insights, FAQ, CTA. `content-visibility: auto` on below-fold sections.
5. `HomeHero.astro` is not touched (photography lane exception). Hero copy changes, if any, go to WP-50, which registers its own exception (W7-9 released the wait for WP-12d).

**Write set.** `src/pages/index.astro`, `src/content/pages/home/**`, `src/components/home/{LatestInsights.astro,faq.ts}`, `src/components/home/leave-with/**`, `src/components/home/proof/**`, tests and handoff.

**Acceptance criteria**
- No numeric catalogue statistic on the page; every artifact named on the home page exists in the stage data (unit test).
- `R-C05` no-funding disclaimer still on `/`; claims audit green; spelling rules green.
- CLS under 0.1 (`layout-shift.spec`); LCP unchanged within 100 ms of the 1,656 ms baseline; Lighthouse 1.0.
- Home passes `folds.spec` at 1440 and 390; hero preload and `fetchpriority` untouched.
- Styling lives in scoped `<style>` blocks; no edit to `src/styles/**`.

**Dependencies.** WP-40 (`packages.ts`). Soft: WP-45 may later offer tokens or variants; WP-50 harmonizes.

---

### WP-41 GEO and citation layer (P1, RICE 2.4, 3 sessions)

**Goal.** Be the first site in this peer set with a complete machine-readable layer (only Antler has an `llms.txt`; none has Markdown twins). Differentiate on structure, not on volume.

**Scope**
1. `/llms.txt` (`src/pages/llms.txt.ts`, logic in `src/lib/llms.ts`), generated from `site.ts`, the route state and `packages.ts`, never typed by hand. Sections: what WE is (the site description), what it offers (service lines and the four package names with stage fit), what it does not do (verbatim: promises no funding; the Introductions disclaimer; "does not describe a cohort calendar or a demo day" from the FAQ), the published commercial facts (seat as the unit, four packages, amounts unpublished and how to ask, Investor Introductions as a flat-fee add-on), key pages as links to Markdown twins, how WE decides (link, when live), contact (the form route; no mailbox until confirmed), optional pages.
2. `/llms-full.txt`: the full text of the key pages in one file, each block headed by its canonical URL, capped in size (a unit test sets the cap).
3. Markdown twins (`src/pages/[...path].md.ts`, `src/lib/markdown-twins.ts`): `/insights/<slug>.md` and the same for research, playbooks, guides, glossary, FAQ, services and key marketing pages. Only entries whose body is plain Markdown are emitted; a lint fails when JSX, imports or unresolved components remain; drafts, noindex routes and L2 routes are excluded. The pattern is already proven by `src/pages/library/[slug].md.ts`. `src/components/seo/SeoHead.astro` (inside WP-41's `src/components/seo/**`; it already receives `path`) adds `<link rel="alternate" type="text/markdown">` by asking a helper in `src/lib/markdown-twins.ts` whether `path` has a twin, so no prop is added and `BaseLayout.astro` (WP-45) is not touched.
4. `robots.txt` (`src/pages/robots.txt.ts`, `src/lib/seo.ts`): production keeps `Allow: /` and the sitemap line, adds explicit groups for named AI crawlers with a default of allow (DP-2); preview keeps Disallow all. No `Crawl-delay` (Antler and EF carry one; Google ignores it [R]).
5. JSON-LD (`src/lib/schema.ts`): Organization gets `hasOfferCatalog` with the four packages as `Offer` items without price, and `knowsAbout` limited to the seven service lines; the facts page gets `about`; research briefs add `citation` from their sources list. `sameAs` stays GitHub only (DP-7).
6. "Cite this page" block on Article, Brief, Playbook and Guide layouts (`src/components/geo/CiteThis.astro`, the four layouts listed in the write set): suggested citation (title, WE Editorial, updated date, canonical URL) with a copy button through the existing `we-copy` island. No new script.
7. `/about/facts/` (`src/pages/about/facts.astro`, `src/content/pages/about/facts.mdx`): question-and-answer entity page: what WE is, what it is not, what it offers, how the commercial model works (published facts only), how it decides (link), how to contact, how to cite, last reviewed. "Do not confuse with" is limited to category disambiguation grounded in existing statements; named look-alike companies need an operator source (DP-8).
8. `scripts/audit-geo.mjs` (and `audit:geo` job from WP-40): validates `llms.txt` structure, that every linked twin exists and matches its page's H1 and canonical, that no twin or `llms` file contains a denylisted phrase, and that `robots.txt` in a production build allows the sitemap. Extend `scripts/validate-jsonld.mjs` for the new nodes.

**Write set.** `src/pages/{llms.txt.ts,llms-full.txt.ts,robots.txt.ts,[...path].md.ts}`, `src/lib/{seo,schema,llms,markdown-twins}.ts`, `src/components/{seo,geo}/**`, the four named layouts, `src/pages/about/facts.astro`, `src/content/pages/about/facts.mdx`, `scripts/{audit-geo,audit-seo,validate-jsonld}.mjs`, tests and handoff.

**Acceptance criteria**
- `llms.txt` and `llms-full.txt` are built from data (changing a package name in `packages.ts` changes both) and pass `audit:geo`; `audit:dist` allows them.
- Every twin has a matching HTML page and `rel=alternate`; zero JSX leakage; zero denylist hits (claims audit scans them already, WP-40 proves it).
- JSON-LD validates (`audit:jsonld`); the `OfferCatalog` offers carry no price.
- Production `robots.txt` matches the chosen policy and preview still disallows everything (both modes tested).
- `/about/facts/` has the no-funding disclaimer; every sentence maps to an existing claim or page in `sources/wp-41.json`.
- Lighthouse SEO 1.0 on all audited routes; no new third-party request; no extra JS beyond `we-copy`.

**Dependencies.** WP-40 (machine routes, audit-dist allowances, `packages.ts`). Soft: WP-43 for the `how-we-decide` link (listed only when the route is live).

---

### WP-45 Visual system v2 (P1, RICE 1.7, 6 sessions)

**Goal.** Give the site a recognizable signature and break the uniformity, inside the light theme (D-8 / EX-LIGHT).

**Scope**
1. Step 0 (needs Q-1): one screenshot pass of the eight benchmark sites at 1440 and 390 to replace UNVERIFIED with observations. Without the allowlist, skip and proceed on taste, with the lower confidence stated in the handoff.
2. Variants (new components in `src/components/ui/`): a feature card, a ledger card (dotted-leader rows for claim and source), a stat-free "claim card", a divider and section-tint system built with `color-mix()` on existing tokens. **No dark sections** (a dark band beside a light-only logo rule invites a reopen of D-8; see DP-4).
3. Signature moments, CSS only, scroll-driven, reduced-motion safe: a stage rail that tracks Dream, Build, Grow with `animation-timeline`, built inside `src/components/program/AltitudeDiagram.astro` (the "three stages" figure the `/program/` hub already imports) and `StageLayout.astro`, so no page file is edited; hex cells assembling on view in `src/components/ui/HexAtlas.astro`; `src/components/blocks/EvidenceLedger.astro` rows stacking in; named view-transition elements for headings across pages (progressive enhancement; browsers without support see no change).
4. Hero variants (`src/components/hero/**` except the two photography-lane files HeroAtlas and HeroEditorial, which stay excluded): add a statement hero (claim headline, no art) and select defaults by layout so pages do not need to change. Layouts owned by WP-45 choose the variant; page files stay untouched.
5. Typography polish where measurable: `text-wrap: balance` and `pretty` on headings and leads, tabular numerals in tables, consistent measure. Update `src/pages/styleguide.astro` (dev only).
6. Budgets: global stylesheet transfer stays under 13.5 KB (currently 9.4 KB, `network.md`); no new JS.

**Write set.** `src/styles/**`, thirteen layout files (every file in `src/layouts/` except the four WP-41 owns: BaseLayout, HomeLayout, MarketingLayout, HubLayout, StageLayout, ServiceLayout, ToolLayout, FormLayout, LegalLayout, ReferenceLayout, ArticleHub, TemplateLayout and the shared `types.ts`), `src/components/{ui,hero,diagrams,motion,blocks,program}/**` (minus the three excluded files), `src/assets/{brand,hex,icons,fonts}/**`, `public/{favicon.svg,apple-touch-icon.png}`, `src/pages/styleguide.astro`, `scripts/audit-tokens.mjs`, tests and handoff. Excluded and reserved to the photography lane: `src/components/ui/Card.astro`, `src/components/hero/{HeroAtlas,HeroEditorial}.astro`, `src/components/cards/**`, `src/components/media/**`.

**Acceptance criteria**
- `audit:tokens` and `audit:contrast` pass; reduced-motion test shows no animation; forced-colors and 200 percent zoom projects still pass (`modes.spec`).
- A pinned-props unit test proves that every component other packages import keeps its API.
- CLS under 0.1; Lighthouse 1.0; LCP within 100 ms of baseline on the eight audited routes; CSS budget held.
- Review artifacts: screenshots at 390, 768 and 1440 for home, program, pricing and a hub, attached to the handoff.
- No new colour mode, no reversed logo, no image added (photography is out of scope).

**Dependencies.** WP-40. Q-1 optional. WP-50 reconciles the other packages' scoped styles with the new variants.

---

### WP-46 Navigation identity and command palette (P1, RICE 1.6, 3.5 sessions)

**Goal.** Reduce the felt weight of seven items and six panels without changing the nav data, and add the interaction pattern the best sites use for dense catalogues (Antler's insights search, SPC and speedrun directory filters [O]).

**Scope**
1. Command palette island `we-palette` (`<dialog>`, opened by Ctrl or Cmd plus K, "/" and a header button). Commands come from the nav and route state, serialized into a data attribute on the element at build time (no new route). Results from Pagefind are loaded the same way `we-search` does today (same-origin dynamic import). Keyboard: arrows, Enter, Escape; combobox and listbox roles; native dialog focus trap; reduced motion honored. Without JS the header keeps the link to `/search/`.
2. Mega-menu identity: consistent description style, one featured tile per panel, reduced density, de-duplicated entries rendered once (the data change, if wanted, is DP-3 and goes through WP-40).
3. Mobile drawer: sticky Apply, search entry, large targets.
4. `/search/`: result-type chips derived from the URL prefix (Article, Research, Playbook, Guide, Template, FAQ, Glossary) filtered client-side; no layout edits needed.

**Write set.** `src/components/layout/**`, `src/components/nav/**`, `src/components/islands/{we-search,we-palette}/**`, `src/scripts/{nav,search,palette}.ts`, `src/pages/search/**`, tests and handoff.

**Acceptance criteria**
- A keyboard-only e2e opens the palette, finds `/pricing/`, navigates and returns focus; screen-reader roles verified with axe and a role snapshot.
- `menu.spec`, `modes.spec` (no-JS, forced colors, zoom 200) green; no console errors; CSP audit unchanged (no inline script).
- Palette interactive in under 100 ms after the first open on the CI runner (measured with a Playwright timing assertion, with a 3x margin).
- No third-party request; no analytics.

**Dependencies.** WP-40 (nav links for new pages). No dependency on WP-45 (uses existing tokens).

---

### WP-49 Interactive founder tools (P2, RICE 1.2, 5 sessions)

**Goal.** The honest analogue of YC's SAFE calculator and Startup School: free, client-side tools that earn the visit without any claim about WE.

**Scope**
1. `/tools/` hub (`src/pages/tools/index.astro`, `src/content/pages/tools/index.mdx`) listing the Composer and the two new tools.
2. Metrics calculator (`/tools/metrics-calculator/`): inputs for starting and new, expansion and churned MRR, acquisition cost, gross margin, cash and burn; outputs net new MRR, revenue churn, quick ratio, CAC payback, LTV to CAC with the formula and assumptions shown, runway. Formulas must match the definitions in the existing research brief on early-stage SaaS metrics (link to it; a unit test compares names and formulas). Methodology box shown. The page states "your numbers stay on this page" and an e2e proves it (no network request after load).
3. Evidence-room builder (`/tools/evidence-room/`): an interactive checklist built from the data-room and investor-readiness guides, filter by stage, check items off, print or copy as Markdown. State lives in the URL hash only (no localStorage, DP-13).
4. No SAFE calculator in this wave (DP-9).
5. JSON-LD `WebApplication` for the two tools, with no price claim. `src/lib/schema.ts` belongs to WP-41, so WP-49 builds the node in its own `src/components/tools/webApplicationNode.ts`, typed with the exported `JsonLdNode`, and passes it through the page's `jsonLd` prop (`ToolLayout` spreads page meta into `BaseLayout`, which accepts `jsonLd`, `src/layouts/types.ts:26`, as `faq/index.astro` already does for FAQPage). WP-41's `validate-jsonld.mjs` extension accepts a `WebApplication` node (contract in `docs/wave7-contracts.md`).

**Write set.** `src/pages/tools/{index,metrics-calculator,evidence-room}.astro`, matching `src/content/pages/tools/*.mdx`, `src/components/tools/**`, `src/components/islands/{we-calc,we-evidence-room}/**`, `src/scripts/{metrics-calc,evidence-room}.ts`, tests and handoff.

**Acceptance criteria**
- Math is unit-tested against fixtures including zero and negative edge cases; invalid input shows a described error and never `NaN` or `Infinity`.
- No-JS fallback shows the formulas and the checklist as static content.
- axe clean; outputs in a `role="status"` region; no layout shift on result updates.
- No network request after page load (e2e); CSP unchanged.
- Claims audit green (the words "valuation cap", "pro rata" and the other SAFE terms do not appear).

**Dependencies.** WP-40 (rows). Read-only dependence on the research and guides content. WP-47 links to the new tools once live.

---

### WP-47 Playbooks, guides, readiness depth (P2, RICE 1.1, 5 sessions)

**Goal.** Match depth honestly: fewer, deeper pieces rather than a volume race against YC's roughly 400 articles.

**Scope.** For each of the five playbooks (549 to 605 words today): per-step "what good looks like", common mistakes, the evidence you hold at the end, a decision aid, links to the relevant library templates and tools, and a "next playbook" chain. Worked examples are labelled "Illustrative example, not a real company" and name no company (D-12). Audit the four guides and deepen any under about 900 words. Every non-trivial claim carries a source or is labelled editorial judgement. No outcome or time-to-result promises (`C-16-time-to-mvp`). No `HowTo` schema (Google retired that rich result in 2023 [R]); Article stays.

**Write set.** `src/content/{playbooks,guides}/**`, `src/content/pages/{playbooks,fundability}/**`, `src/pages/{playbooks,fundability}/**`, `src/components/{playbooks,fundability}/**`, `src/components/islands/we-readiness-check/**`, `src/scripts/readiness-check.ts`, tests and handoff.

**Acceptance criteria**
- A rubric test per playbook: required sections present, at least three internal links, `claimsUsed` populated, reading time computed, zero denylist hits, US spelling, "WE" in capitals.
- `sources/wp-47.json` lists the source or "editorial judgement" per claim.
- Lighthouse and axe unchanged.

**Dependencies.** WP-40. Soft: WP-49 for the tool links.

---

### WP-48 Frameworks depth (P3, optional, RICE 0.5, 3 sessions)

**Scope.** Four additional framework pages (UBF, STAR, SHIFT, ANDROID), paraphrased from the source documents in `~/repos/WorldEnterpriseGroup/dot-github/Frameworks/` in the same template as the existing ORBITAL and ANDROID Ops pages. Internal first names in the sources are never carried over. Update the frameworks index. **No named thesis**: coining a brand name is an operator decision (DP-6), not a package.

**Write set.** `src/pages/about/{frameworks,manifesto}/**`, `src/components/about/**`, `src/content/pages/about/{frameworks,orbital,android-ops,manifesto}.md`, `src/content/pages/about/framework-*.md`, tests and handoff.

**Acceptance criteria.** Each page's `sources/wp-48.json` points at the source document and section; the C-20 exclusions (the two names in the denylist rule `C-20-frameworks`), C-11 (years claim) and C-12 (superlatives) pass; home "Published frameworks" count is no longer shown (WP-44 removes it), so no drift.

**Dependencies.** WP-40. Operator or counsel review per framework (DP-10).

---

### WP-50 Wave 7 integrator and regression (stage 2, mandatory, 3 sessions)

**Scope.** Runs after stage 1. Sole writer for seam fixes (each registered as an exception). (a) Complete the hero edits that stage 1 could not make (W7-9: phase B no longer gates them; it rebases onto wave 7 later), each registered as an exception. (b) Reconcile scoped styles from WP-42, 43, 44, 46, 49 with WP-45's new variants. (c) Add the new pages to `lighthouserc.json` and the route screenshots. (d) Cross-package journeys: home to pricing to picker to Composer to Apply with `package` to review step; palette to any page; `llms.txt` links all resolve. (e) Re-run every audit, review screenshots at 390, 768 and 1440, write the wave handoff and the list of operator actions for the next release (`docs/wave7-handoff.md`).

**Write set.** `tests/e2e/*.spec.ts`, `tests/e2e/support/**`, `scripts/lib/wave7/**`, `docs/wave7-handoff.md`, tests and handoffs; fix-forward exceptions are registered one by one.

**Acceptance criteria.** Full pipeline green on `demo` including `verify:release` (every launched route exists, none pending, no draft; `RELEASE_ALLOW` still tolerates only the unprovisioned form endpoints); Lighthouse 1.0 on the eight original routes plus the new ones; zero open WP-4x issues; handoff lists every decision point resolved or still open.

---

## 6. Decision points and irreversible steps

None of the work deletes data or changes billing. The items below are outward-facing or policy-bearing, so each has a default and an owner. Defaults are what the plan assumes if the operator stays silent.

| ID | Decision | Default in this plan | Owner | Reversibility |
|---|---|---|---|---|
| DP-1 | Release ordering | Ship WP-30 first; wave 7 lands on `demo` afterwards and becomes release 2. Alternative: merge wave 7 before release. Then WP-30 and WP-40 collide on `.gitlab-ci.yml` and `package.json`, and the release would carry the home, pricing and apply rewrites, which cannot be hidden behind a ledger row. If the operator chooses it, serialize WP-30 and WP-40 by hand. | Operator | Reversible (branch order) |
| DP-2 | AI crawler policy in `robots.txt` | Allow all, with named groups for the main AI crawlers, because the goal is citation. Blocking training use is a business choice. Crawler names are recalled [R] and WP-41 re-verifies against each vendor's documentation. | Operator | Public once deployed, cached by crawlers; easy to edit later |
| DP-3 | Nav slimming (7 items to 6 or fewer) | Not in this wave. It reopens the exact-nav decision in SAGE-PLAN section 5. Evidence for the change: benchmarks run 4 to 6 [O]. First ship the palette and the identity work, then decide. | Operator | Reversible |
| DP-4 | Dark mode, reversed logo, dark sections | Out of scope (D-8 / EX-LIGHT). No dark sections either. | Operator | n/a |
| DP-5 | Selection criteria beyond what the site already says | WP-43 restates `who-its-for` and the form only. New criteria, response times or process stages need an operator source. | Operator | Reversible |
| DP-6 | A named thesis (like SPC "-1 to 0") | Not coined by an agent. The home H1 "Build the evidence a SaaS idea needs to be a company" is the closest existing statement. Naming is a brand decision. | Operator | Reversible |
| DP-7 | `sameAs` profiles | GitHub only. Any other profile (LinkedIn, Crunchbase) needs an operator-confirmed URL. | Operator | Reversible |
| DP-8 | "Do not confuse with" naming real look-alike companies | Not shipped. Category disambiguation only, using statements already on the site. | Operator | Reversible |
| DP-9 | SAFE calculator | Deferred. WE gives no securities advice (F-5) and a calculator is the closest the site would come; counsel decides. | Counsel | Reversible |
| DP-10 | Four new framework pages | Optional (WP-48); each page needs claims review of the paraphrase. | Operator | Reversible |
| DP-11 | New public machine files (`llms.txt`, Markdown twins, new sitemap entries) | Proceed. They are indexed and cached by third parties once live, so treat the first deployment as the point of no practical return for their content, not for their existence. | Operator | URL removal possible; third-party caches are not controllable |
| DP-12 | Commercial-model wording on the pricing and facts pages | Restrict to C-10 and C-14 as written. The page may say what is published and what is not. It must not say "no fees", "no equity" or "no stake" about the model (the fee-to-equity election exists and is unpublished). Counsel already reviews the Introductions wording before release. | Counsel | Reversible |
| DP-13 | Persisting form or tool state on the device | No. Memory and URL hash only, never PII in storage. | Operator | n/a |
| DP-14 | Email-first apply start (speedrun pattern) | Not adopted: it would change the forms contract (native post without JS). The progressive stepper keeps the contract. | Operator | Reversible |

---

## 7. Open questions

- **Q-1.** Can the eight benchmark domains be allowlisted for a browser or curl pass (the `guard-external-url.sh` hook blocked direct fetches and I did not work around it)? It would verify the visual, JSON-LD, font and dark-mode claims that are UNVERIFIED today and raise WP-45's confidence.
- **Q-2.** Is the preview readable by the agents (it sits behind Entra / Keycloak)? Without it, visual review of wave 7 relies on CI screenshots, which blank lazy images in full-page shots (`visual-brand.md` section 6).
- **Q-3 (resolved, kept for the record).** `scripts/check-ownership.mjs` accepts one path in several assignments and exceptions; ownership is additive. What it does not do is police cross-owner overlap, which `tests/unit/wp-40/write-sets.test.ts` takes over (WP-40 item 7). Still open: WP-30 has no assignment, so whether it will register one that overlaps `.gitlab-ci.yml` or `package.json` is unknown; that is why WP-40 waits for it.
- **Q-4.** What payload schema does the external intake endpoint accept (D-13)? It decides whether `package` can be a field or must ride inside an existing one. Until the endpoint is provisioned (operator action in the WP-19 handoff), forms remain disabled in markup.
- **Q-5.** Operator inputs still outstanding from earlier handoffs affect wave 7 pages: confirmed mailboxes (`site.mailboxes`), `securityContact`, counsel review of the Introductions wording, the `pbcWording` and `legalTerms` flags (both OFF). Wave 7 assumes they stay OFF.
- **Q-6.** Is the OG image scraper risk with AVIF (EX-OG-AVIF) still accepted? It affects every new page's social card. Out of scope here (OG lane) but new pages should not ship a distinct card until that lane decides.
- **Q-7.** Should the 40 pages that share one social card get per-section cards? Belongs to the photography and OG lane; flagged for them, not planned here.

---

## 8. Evidence

### 8.1 Repo files read (worktree `~/repos/WorldEnterpriseGroup/_wt/wp-12d`)

| Area | File |
|---|---|
| Nav and routes (frozen) | `src/data/nav.ts`, `src/data/routes.ts` (RouteOwner union, `launch` and `requires` rules, `routes.ts:207` terms row gated by `flags.legalTerms`, MACHINE_ROUTES at `:243-252`), `src/data/flags.ts`, `src/data/claims.ts` (C-10 and C-14 at lines 37 and 41), `src/data/site.ts` |
| Home | `src/pages/index.astro` (count band at `:50-65`, `:90-98`) |
| Pricing | `src/content/pages/pricing/pricing.mdx`, `src/pages/pricing/index.astro` |
| Apply and forms | `src/pages/apply/index.astro:36-57`, `src/data/forms.ts`, `src/scripts/forms.ts` (543 lines), `src/components/forms/**` |
| Composer | `src/components/islands/we-team-composer/TeamComposer.astro`, `src/scripts/team-composer.ts` |
| Selection facts | `src/pages/program/who-its-for.astro:18-87`, `src/data/faq.yaml` (`is-it-an-accelerator`) |
| Search and nav UI | `src/scripts/search.ts`, `src/components/layout/MegaNav.astro` |
| SEO | `src/lib/seo.ts`, `src/lib/schema.ts` (exports include `articleNode`, `withArticleImage`, `faqPageNode`), `src/pages/robots.txt.ts` |
| Motion | `src/styles/motion.css` |
| Audits and CI | `scripts/lib/audit-dist.mjs:21-46`, `scripts/audit-route-ledger.mjs` (pending is a warning, `--strict` an error; `leaked` and `unledgered` are errors), `scripts/lib/release-gate.mjs`, `scripts/audit-claims.mjs:331-338`, `.gitlab-ci.yml:40-46` (`RELEASE_ALLOW`, `QA_STRICT` is the blocking policy, not the ledger flag) and `:187-216`, `playwright.config.ts:6-38`, `package.json:26,31` |
| Ownership mechanics | `scripts/check-ownership.mjs` (one assignment per branch, additive paths, frozen only with an exception), `tests/unit/foundation/ownership.test.ts`, `tests/unit/wp-15/ownership.test.ts`, `src/lib/route-core.ts` (`computeRouteState`, `routeExists`) |
| Governance | `.astro-magazine/ownership.json` (frozen list, 21 assignments, 33 exceptions, no WP-30 assignment), `.astro-magazine/decisions.md` (D-1 to D-19, F-4, F-5, P-1 to P-3), `claims-denylist.json` (version 2), WP-17 and WP-19 handoffs |
| Prior audits (main checkout) | `.plan/SAGE-PLAN.md`, `.plan/qa/visual-brand.md`, `.plan/qa/seo-perf.md` at `~/repos/WorldEnterpriseGroup/worldenterprise/.plan/` (audited e8a706b; two P1s and one P2 verified fixed, see 3.5) |

### 8.2 CI artifacts (current build, not the stale `static/` directory)

- `~/.claude/jobs/504efe46/tmp/art/static2/dist/` (robots.txt, home head and JSON-LD, insight JSON-LD with `image`, `/library/*.md`)
- `~/.claude/jobs/504efe46/tmp/art/lh/reports/lighthouse/network.md` and `summary.json` (Lighthouse 1.0 across categories; FCP mean 1,390 ms; LCP mean 1,682 ms; 131.9 KB mean)
- `~/.claude/jobs/504efe46/tmp/art/shots/test-results/routes-route-*/attachments/*.jpg` and `shots/crops/*` (home, pricing, apply, team-composer, services, investors, founders, network, trust at 1440; pricing, apply, composer at 390)
- Benchmark teardown: delegated read-only report, held in the session transcript (tags [O], [O2], [I], [R], UNVERIFIED as defined in section 2).

### 8.3 Mechanical no-overlap proof

- Write sets: `.astro-magazine/plans/wave7/wave7-writesets.json`
- Checker: `.astro-magazine/plans/wave7/wave7-overlap.mjs` (run: `node .astro-magazine/plans/wave7/wave7-overlap.mjs .astro-magazine/plans/wave7/wave7-writesets.json`)
- Result: `Stage-1 packages checked pairwise: WP-41 ... WP-49 (36 pairs)`; `Patterns checked: 174; frozen entries: 26; photography-lane entries: 18; release-lane entries (declared, not registered): 6`; `RESULT: zero overlaps`. The two lane-exception files (`src/pages/pricing/index.astro`, `src/pages/program/who-its-for.astro`) are reported as reserved by the photography lane and listed as lane exceptions, not as overlaps. WP-40's `package.json` and `.gitlab-ci.yml` are reported as "serialize after WP-30", which is the dependency stated in WP-40 and DP-1.
- Self-test (`.astro-magazine/plans/wave7/wave7-selftest.mjs`): five injected conflicts, one per lane (release lane twice, a layout claimed by two packages, a frozen file, a photography-lane glob), all reported; exit 0 means every case was caught.
- Coverage check (`.astro-magazine/plans/wave7/wave7-coverage.mjs`, run against the worktree's tracked files): every pattern that matches no existing file is a file this wave creates (no mistyped glob), and it found one real gap, `TemplateLayout.astro` and `src/layouts/types.ts` claimed by nobody, now assigned to WP-45. The remaining unclaimed tracked files (content collections, program and about pages, `src/lib`, audits) are ones no package edits.
- Limits. The checker compares declared sets with each other and with the frozen, photography and release lists; it does not compare a package's prose scope with its own write set. That was reviewed by hand for every package, and three scope edits were corrected (WP-41 `SeoHead`, WP-45 stage rail, WP-49 JSON-LD). The checker is conservative for glob against glob (prefix test), so it can raise false positives but not miss an overlap of this kind. The release lane is a declared list because WP-30 has no assignment in `ownership.json`; release exclusion is therefore reasoned, not registered. `check:ownership` enforces diffs per branch but never cross-owner overlap (WP-40 adds a unit test for that). Re-run the checker whenever WP-12d registers new exceptions or WP-30 registers an assignment.

### 8.4 What I did not verify

- The deployed demo itself (SSO). Visual statements about WE come from CI screenshots and source; about the benchmarks there are none (UNVERIFIED).
- `Playwright MCP` was not used past the login wall.
- Effect sizes (RICE Reach and Impact) are judgements; no analytics exist by design (D-14).
- Crawler user-agent names in DP-2 are recalled [R].
- The WP-30 release lane's real write set (none is registered; only `docs/runbook-release.md`, `scripts/lib/release-gate.mjs` and the CI file point to it).
- The WP-30 release state and whether the pipeline sha matches `cc84ffa` (the pipeline detail API returned HTTP 500; the current-build hero text in the screenshots matches the WP-18 wording, so the artifacts are current).
