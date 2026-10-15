# Wave 8 plan: from "technically excellent" to the most complete digital incubator site for startups, investors and partners

| | |
|---|---|
| Mode | PLAN. Read-only. Nothing in the repo was modified, nothing built locally. |
| Date | 2026-10-10 (revision 2, after the CEO scope expansion of the same day) |
| Repo / branch | `~/repos/WorldEnterpriseGroup/worldenterprise`, branch `demo` at 05c7582 (re-fetched, unchanged during planning), read through worktree `~/repos/WorldEnterpriseGroup/_wt/wp-12d` (`wp/12d`) and an extracted copy of `origin/demo`. The files that the three unmerged wave 7 branches (`wp/41`, `wp/46`, `wp/49`) add were read from their branch trees and are part of the base the checkers run on. |
| Authority | CEO direction of 2026-10-10, relayed by the orchestrator, including the scope expansion ("fan out as many agents as you'd like ... until our goal of having a SOTA site is complete ... the more pages and the more content, the better"). Decisions D-20 to D-24 below cite it. Fully autonomous: technical choices are the plan's, only irreversible or outward-facing steps are flagged (section 6). |
| Inputs | `wave8-gap.md` (GAP survey of `demo`), `wave8-ge.md` (globalenterprise.com and D365 intake survey), `wave7.md` (template and carried-over rules), `wave8-contracts.md` (binding contracts, committed as `docs/wave8-contracts.md`), `wave8-writesets.json` and the checker scripts (section 8.3) |
| Excluded by instruction | Photography (WP-12d phase B, lane WP-12 / 12b / 12c) and release (WP-30, `.astro-magazine/release/**`, `.gitlab-ci.yml` by role). Both lanes are reserved paths in the checker. |
| Evidence method | hix MCP tools were not exposed in this session, so discovery used shell reads over the extracted `origin/demo` tree, the three wave 7 branch trees and the two sibling repositories. No deployed site was fetched (the demo sits behind SSO). Tags: [O] observed in a file, [I] inference, [R] recalled. |

**Status note.** Plan of record for wave 8, to be committed by WP-60 as `.astro-magazine/plans/wave8.md`, with `wave8-contracts.md` as `docs/wave8-contracts.md` and the checker bundle in `.astro-magazine/plans/wave8/`. Orchestrator decisions applied and not reopened here: wave 7 finishes first (WP-41, 46 and 49 are still unmerged; 42, 43, 44 and 45 are merged); WP-47 (#36) is absorbed into the wave 8 content program (WP-86 playbooks, WP-87 guides and templates); WP-50's integrator scope (#39) is absorbed into the wave 8 foundation (WP-60) and integrator (WP-99); WP-48 (#37) stays deferred. Revision 2 replaces the ten-package plan with 32 packages, two limits on concurrency (up to 10 authoring agents, at most 5 branch pipelines) and a due date of 2026-10-31.

Contents: 1 Summary | 2 Direction, decisions and target architecture | 3 Where WE stands | 4 Plan shape, concurrency, rules and RICE | 5 Work packages WP-60 to WP-99 | 6 Decision points, irreversible steps and risks | 7 Open questions and operator inputs | 8 Evidence

---

## 1. Summary

**Finding.** The site is strong on mechanics: a data-driven mega menu with keyboard tests, a stepper apply flow, Lighthouse 1.0 on the audited routes, and a claims audit that fails the build on an unsupported sentence. It does not yet do the jobs the CEO set. Content pages, where traffic lands, carry no call to action of their own (the article, brief, template and guide layouts render byline, contents, sources and related links only). `/investors/` is a limits-first page that says what WE does not do, with no invitation, no way to register interest and no path to meet the companies WE incubates. The network page states in so many words that there is no partner program (`src/content/pages/network/index.mdx:34`), which contradicts the partnership posture. There are no gated executive briefs: the four research briefs and six library templates are open, indexed and mirrored into `llms-full.txt` and Markdown twins. The library holds 18 articles in four desks, 5 playbooks, 4 guides, 6 templates, about 40 glossary terms and 18 FAQ entries. There is one founders page, no page for any particular kind of founder, no industry, comparison or customer-journey page, and no brand story. The intake backend does not exist: the browser contract is finished and the production build renders every form disabled (hard release blocker B-2).

**What globalenterprise.com taught us, and one correction.** The sister site already runs the pattern the CEO means by "like our other websites do", but it does not use a Logic App. It posts a native form to an Azure Function (Flex Consumption, Node 24) that writes to Dynamics 365 / Dataverse with a managed identity, sends the brief by Azure Communication Services email with a short-lived private link, and runs a day 3, 10 and 21 follow-up. The only Logic App to D365 intake found is a different site's, and a bare Logic App cannot meet WE's forms contract (no single-origin CORS, no rate limit, no 303, no field-level errors; its trigger URL carries a signature that would be public in the bundle). Wave 8 therefore ports the Function pattern, not the Logic App (D-22).

**Constraint that shapes everything.** The truth policy is unchanged and binds harder here than in wave 7, because investor, partner, comparison and sector copy is where false claims are most tempting: no portfolio, logos, testimonials, counts, amounts, response times or named companies without a written record; Investor Introductions stays a flat-fee add-on with no success fees; the hybrid seats-plus-packages pricing stays unpublished; nothing is described as free, no-fee, no-equity or no-stake. WE is a digital incubator for SaaS: dedicated offshore team seats steered by WE, fully remote, no promise of funding. WE cannot out-brag a portfolio it does not publish. It can out-serve and out-explain: tell each audience plainly what WE offers them, what the next step is, what WE cannot promise, and put one honest, specific action in front of them on every page that has an audience (section 2.4). More pages raise the cost of one false sentence, so volume is bought with a mechanical gate (rubric, sources ledger, sentence ledger, denylist) rather than with trust.

**What the site is when wave 8 is done.** Expressed as capabilities, not packages:

| Capability | At the end of wave 8 |
|---|---|
| Library | About 122 articles in 14 desks (18 now), each 1,200 to 1,800 words with sources fetched in-session; about 120 glossary terms (40 now); about 60 FAQ entries grouped by audience (18 now); about 10 playbooks (5 now), about 8 guides (4 now), about 12 templates (6 now). |
| Audiences | Eight founder segment pages (first-time, technical, non-technical, solo, corporate innovators, student, second-career, global remote), each with its own path to apply; seven industry pages written as considerations, claiming no clients; seven honest comparison pages; a full investor journey (invitation, meet the startups, what you can see, readiness criteria, showcase format, FAQ, interest form); a full partner journey (overview, categories, how partners work with founders, FAQ, enquiry form). |
| Customer journey | One map per audience (startup, investor, partner, corporate innovator) across awareness, consideration, conversion, onboarding and advocacy, with a primary and secondary call to action per page family; "What happens after you apply", "Your first months, in order", an onboarding checklist and a founder resources hub; every map tested end to end. |
| Lead capture | Ten executive briefs behind squeeze pages (six for startups, two for investors, one for partners, one for corporate innovators), delivered by emailed private link; full text provably absent from every public artifact. |
| Tools | Four founder tools on the tools hub: the existing team composer plus a runway calculator, a pricing-page checker and a cap-table explainer, all client-side with no data leaving the browser. |
| Brand | A brand system across every family (one audit, vector compositions for the new families, an Open Graph card per family), a brand story page, and a brand kit page held back until brand sign-off. |
| Discoverability | Markdown twins, `llms.txt`, sitemap, feeds, search and the command palette scale to the new volume under a cap that cannot be silently exceeded. |
| Intake | Code-complete Azure Function to Dataverse in the globalenterprise pattern, inert until the operator provisions it. |

**Approach.** One foundation package (WP-60), delivered as two checkpoints, owns every frozen and shared surface: the ledger at scale, 14 desks, the page-family registry, forms contract v2, the CTA skeleton, the audience lens in the nav, ownership, decisions, and the WP-50 scope it absorbs. One intake service package (WP-61) builds the Function, the Dataverse model, the brief renderer and the privacy facts as code, behind flags and guards, because provisioning is an operator action outside the repo. One brand-and-families package (WP-71) builds the generic route files, components and vector compositions for the new page families so that content packages author content only. The remaining 27 packages run in three rounds of 8 to 10, on disjoint write sets, with one integrator (WP-99) closing the wave and one journey suite (WP-90) before it. At most 10 authoring agents and at most 5 branch pipelines run at once, enforced by a push-slot protocol (section 4.2). Overlap was checked mechanically: pool P0b of 12 packages (66 pairs), pool P1 of 30 packages (435 pairs), 346 patterns, zero overlaps, none against the 26 frozen paths, the 15 wave 8 frozen additions or the photography lane, and the one release-lane touch (`.gitlab-ci.yml`) is a declared serialization (section 8.3). Every test file that pins something wave 8 changes has exactly one owner (section 4.4, contracts section 12).

**What "done" means, honestly.** Wave 8 is code-complete and green with the forms disabled until the operator provisions the intake (section 7: OP-AZURE, OP-FD, OP-DV, OP-MAIL, OP-RETAIN). The agents cannot create the Azure resources, the Dataverse tables, the Front Door route or the DNS record, and the plan does not route around any of them. The release gate then fails closed on purpose until `PUBLIC_WE_INTAKE_API_URL` is set. Two items ship behind an operator input by design: the brand kit page (OP-BRAND, its ledger row already reads `launch: false`) and dedicated per-family Open Graph cards (OP-OG; families reuse the existing nine until the photography lane takes a request).

**Sequencing recommendation.** Wave 8 changes investor and partner copy and adds comparison and sector content, so it needs new counsel entries. Do not fold it into the release counsel is reviewing now (rc2). Let it become the next release train (DP-W8-1).

**Top five by RICE (judgment-scored; D-14 means there is no analytics):** WP-72 customer journey pages (4.5), WP-62 CTA system (4.2), WP-91 discoverability at scale (3.7), WP-99 integrator (3.3) and WP-73 founder segment pages (3.3). The CEO's headline asks (attract startups, briefs, investors, intake) are all P0 regardless of score.

---

## 2. Direction, decisions and target architecture

### 2.1 The CEO direction, mapped to packages

| Ask (2026-10-10) | Where it lands |
|---|---|
| One fully cohesive, very rich site on the full Astro build | WP-60 (shared skeleton), WP-71 (brand and templates), WP-99 (seams) |
| Attract startups with many CTAs | WP-62 (bands on every audience page), WP-60 (skeleton, layout slots), WP-63, 79 (briefs as lead path), WP-73 (a path per founder segment) |
| Executive briefs behind squeeze pages, segmented by audience | WP-63 (system and three briefs), WP-79 (three), WP-80 (four for investors, partners, corporate), WP-61 (delivery), WP-60 (sentinel audit) |
| A mega menu | WP-60 (audience lens, Partners, Briefs, Industries, Compare, Journey entries), WP-99 (final IA) |
| Invite investors to meet the startups WE incubates | WP-64 (seven pages and the interest form) |
| Strong partnership posture toward companies that help startups or provide tooling | WP-65 (overview, categories, how it works, FAQ, enquiry) |
| A large library of articles for entrepreneurs, spread over audiences and topics | WP-60 (desks, rubric), WP-66, 67, 68, 69, 81, 82, 83, 84, 85, 88, 89 (104 new articles, 14 desks) |
| Founder segments, industries, comparisons | WP-71 (templates), WP-73, WP-74, WP-75 (content) |
| Customer journey: what happens after you apply, first months, onboarding, resources | WP-72, WP-62 (CTAs), WP-90 (end-to-end tests) |
| Glossary, FAQ, templates, playbooks, guides, tools at scale (absorbs WP-47) | WP-77, WP-78, WP-87, WP-86, WP-76 |
| Brand consistency and imagery for new families | WP-71 |
| Findable by search engines and AI assistants at this volume | WP-91 |
| Intake into D365 "like our other websites do" | WP-61, WP-60 (forms v2) |
| "Do anything and everything"; "fan out as many agents as you'd like" | The whole plan: 32 packages, up to 10 agents at once, section 4.2 |

### 2.2 Decisions

D-20 to D-24 are recorded by WP-60 in `.astro-magazine/decisions.md`, each citing the 2026-10-10 CEO direction. W8-1 to W8-29 are plan decisions recorded in the same file.

| ID | Decision | Owner |
|---|---|---|
| D-20 | Library scale supersedes D-10 (28 long-form items) and `EX-SCALE`: the library grows to about 122 articles by editorial work; ledger and tests scale by invariant, not by count. | WP-60 |
| D-21 | Amends D-12: inbound investor and partner pages may launch without naming any company, person, event or date. The portfolio, delivery partners, founder stories and case studies stay L2 until a written record exists. | WP-60 |
| D-22 | Intake architecture: browser JSON fetch to one Azure Function endpoint behind the shared Front Door, managed identity to Dataverse, ACS email, no Logic App hop (contracts section 4). | WP-60, WP-61 |
| D-23 | Gated-brief rule: full text lives outside every path the build reads, is delivered only by emailed short-lived private link, and is proven absent from `dist`, `llms-full.txt`, Markdown twins and the Pagefind index by a sentinel audit that tests itself (contracts section 5). | WP-60, WP-63 |
| D-24 | CTA policy: honest copy, one primary and at most one secondary action per band, no scarcity or urgency, no exit-intent, no popup, no modal, no sticky bar, no CTA on legal, form, thanks, search, styleguide or 404 pages (contracts section 6). | WP-60, WP-62 |
| W8-1 | Wave 8 write sets use a separate `frozen_paths_wave8` key and a wave 8 test scoped to `WP-6x`, `WP-7x`, `WP-8x`, `WP-9x`. The wave 7 write-set test filters `WP-4x` and `WP-50` and stays untouched. | WP-60 |
| W8-2 | One endpoint (`PUBLIC_WE_INTAKE_API_URL`), the `form` field discriminates six kinds; the CSP already derives from the variable. | WP-60 |
| W8-3 | `requestId` is the idempotency key (`we_requestid`). The server writes the engagement row to Dataverse before it answers 202; email and webhook run after, with retries; a failed email is a status, not a lost lead. | WP-61 |
| W8-4 | The honeypot stays `website` (v1). The real organization URL field is `companyUrl`. The two names never collide. | WP-60 |
| W8-5 | Gated briefs live in `infra/intake/briefs/` (outside `src`, outside `astro.config.mjs` globs, never imported). Open abstracts live in a new `briefs` collection and may not reproduce a body sentence. | WP-63 |
| W8-6 | Mid-body CTAs are static HTML emitted by a hast plugin from the same `CtaModel` as the component. A CTA whose target is not a live route is dropped (the `pickRelated` precedent), so no dead link can ship. | WP-60, WP-62 |
| W8-7 | `src/data/desks.ts`, `src/data/families.ts` and a plain `node:fs` content reader are the only sources for desks, slugs, owners, family slug lists and related-title maps. Invariants replace the counts 99, 95, 23 and 18 and the per-desk slug lists. | WP-60 |
| W8-8 | An article rubric test runs over every file in `src/content/insights/**`. A sources ledger test fails on any source without a fetch record. | WP-60 |
| W8-9 | Source rule: every source in an article, brief, glossary entry, comparison, industry page or tool explainer was fetched in the writing session, with URL and fetch time recorded. A claim that cannot be sourced is dropped, never softened. | All content packages |
| W8-10 | `RELEASE_ALLOW` on `demo` and `wp/*` tolerates the disabled form routes and, one anchored pattern per path, wave 8 pages that do not exist yet. It is empty on release tags and `gh-pages`. WP-99 removes the pending patterns when the last page lands. | WP-60, WP-99 |
| W8-11 | Release-lane files are serialized, not shared: WP-60 adds one `include: local` line to `.gitlab-ci.yml` (guarded by `rules: exists`) after confirming no open wp/30 merge request; WP-99 commits the counsel entries to `RELEASE.md` on the same condition. | WP-60, WP-99 |
| W8-12 | Concurrency (supersedes the v1 five-agent cap): up to 10 authoring agents at once and at most 5 branch pipelines at once. Pools are checked as sets; the pipeline cap is enforced by the push-slot protocol of section 4.2. | Orchestrator |
| W8-13 | `flags.briefUpdates` (the optional updates checkbox) and `NURTURE_ENABLED` (the day 3, 10 and 21 sequence) ship OFF. They turn on only after the privacy notice covers CRM use and retention and counsel has reviewed the sequence. | WP-60, WP-61 |
| W8-14 | Not ported from globalenterprise.com: the corporate-email gate (WE serves founders, who use personal addresses), Plausible and `data-track` attributes (D-14), Turnstile (third-party). Spam control is honeypot, timing check, per-address rate limit and a Front Door rate rule. | WP-61 |
| W8-15 | Copy bans beyond the denylist: no "free" in copy about WE (its terms, program, briefs, tools, partner offers; generic pricing-model subject matter such as "free trial" or "freemium" is allowed in articles, glossary entries and comparisons, and the denylist phrases "free of charge", "completely free" and "at no cost" are never used), no "perks", no "accelerator", "cohort", "mentor" or "alumni" in page copy (`C-13-peers`), no "investor network". The nav label "Partners and perks" becomes "Partners". The one exception is the comparison page whose subject is the word (DP-W8-15). | All |
| W8-16 | The four open research briefs and six library templates stay open. Gated briefs are new documents. | WP-63 |
| W8-17 | The portfolio collection stays empty unless the operator supplies a consent record (OP-PORTFOLIO). With no entry the investors page shows one fixed sentence and says nothing about forming groups or dates. The same rule governs the showcase-format page. | WP-64 |
| W8-18 | Legacy tests: one owner per test file, the package that rewrites what it pins; tests that pin two packages' files are owned by WP-60, which splits them verbatim. Photography and release lane tests are read-only (contracts section 12). | WP-60 |
| W8-19 | Fourteen desks: the four existing plus `funding`, `legal`, `team`, `ai`, `gtm`, `ops`, `starting`, `pathways`, `models` and `sectors`. Articles gain two optional frontmatter fields: `segments` (founder segment slugs the article serves; the segment pages list matching articles from the collection, so no page is hand-edited) and `related` (insight slugs; a slug that is not live is dropped at build, so a package can name an article another package has not merged yet). | WP-60 |
| W8-20 | Page families: `src/data/families.ts` is the single registry of founder segments, industries, comparisons, journey pages and brief ids. WP-71 owns the generic route files and components; WP-72, 73, 74 and 75 author content in the `pages` collection only; ledger rows derive from the registry and stay inert until a page exists. Frontmatter for family pages is fixed in contracts section 8.2, so content can be authored before the templates merge. | WP-60, WP-71 |
| W8-21 | Rolling window and push protocol: batches are authored locally with commits, pushed once per batch (8 to 10 articles for a content agent), each push holding one of five slots until its pipeline ends (section 4.2). This applies the CEO's concurrency instruction and overrides the habit of pushing after every commit for wave 8 packages. | Orchestrator |
| W8-22 | Brand system: no global brand stylesheet and no edit to the shared stylesheets; brand styles live inside `src/components/brand/**` and `src/components/families/**`, tokens only. Vector compositions (inline SVG components or AVIF files under `src/assets/brand/**`) are shipped imagery (W7-9); photography-lane files are not edited. Open Graph images reuse the nine existing cards through `ogSlot`; dedicated per-family cards are a lane request (OP-OG). | WP-71 |
| W8-23 | Structured data: pages use the existing builders; a new JSON-LD node builder is package-local (inside the package's own component folder); no package edits shared `src/lib/seo*` or schema files, which keeps them unowned and unchanged. `FAQPage` and `DefinedTermSet` nodes come from `src/components/reference/jsonld.ts` (WP-77, import-only elsewhere). | All |
| W8-24 | Sector, industry, segment and comparison content is "considerations for", never an outcome claim and never a claimed client. Comparison pages name categories, not products, and say what each side does well. Segment pages never state eligibility beyond `/program/who-its-for/` (OP-SEGMENTS). Marketplace and platform articles say plainly that WE builds SaaS. | WP-73, 74, 75, 85, 88 |
| W8-25 | The customer journey is a first-class contract (contracts section 11): five stages, one map per audience, a primary and secondary call to action per page family, implemented by WP-62 and the WP-71 templates and proven by the WP-90 suite. No dead end: every page in a map has a forward path. | WP-60, WP-62, WP-90 |
| W8-26 | Discoverability at scale: `llms-full.txt` stays a curated key-page list (its cap is 262,144 bytes and the build throws past it), so article volume does not threaten it; WP-91 carries the cap as an acceptance criterion, adds the new families to the key pages and the Optional list, and decides which Markdown twins exist. Entries that fail the plain-Markdown lint get no twin. | WP-91 |
| W8-27 | Entry gate: WP-60 starts only after `wp/41`, `wp/46` and `wp/49` are merged to `demo` or closed. All checkers are re-run on the real tree. If a branch is abandoned, the patterns that depend on it are removed from the JSON (WP-91's `src/components/geo/**`, `tests/unit/wp-41/**` and the like; WP-76's `tests/unit/wp-49/**`) together with the matching pin acknowledgements. | WP-60 |
| W8-28 | Existing FAQ entries, glossary terms, readiness statement ids and the data-room checklist wording grow by additions only: existing entries are kept verbatim and tests that pin them (`wp-01/program`, `wp-41/content`, `wp-41/llms`, `wp-49/evidence-room`) stay green without edits. | WP-77, 78, 87 |
| W8-29 | Content packages that add pages author only files in the `pages` collection (plus their component folder); they never add a route file. A page family with no template at merge time stays inert, so a package may merge before WP-71 without a dead route. | WP-72, 73, 74, 75 |

### 2.3 Benchmark

No new external benchmark pass was made for this wave. Two sources are used.

**globalenterprise.com, read from its repository [O]** (`wave8-ge.md`). What WE ports and what it does not:

| Pattern at GE | Port to WE |
|---|---|
| Native `<form method="POST">` to `briefs.globalenterprise.com/api/brief-request`, 303 to a noindex thanks page | Yes, as the no-JavaScript path. WE adds JSON fetch with single-origin CORS, because the v1 contract already uses it. |
| Squeeze page in four parts: hero with three actions, preview with depth strip and outline, request panel, related briefs | Yes (WP-63), in WE's light theme (D-8), with the abstract open and indexable. |
| Private blob, user-delegation SAS (48 h), ACS email, scanner-safe unsubscribe, day 3, 10, 21 follow-up | Yes (WP-61), follow-up OFF (W8-13). |
| Function writes to Dataverse with a managed identity, alternate key for idempotent retry, blob-lease rate limit 5 per hour per address and per email, security headers on every response | Yes (WP-61). |
| Corporate-email gate, Plausible `data-track`, Turnstile field | No (W8-14). |
| Honeypot returns 400 | No. WE's contract answers a silent 200. |
| One primary CTA destination, `ContextualNext` band on every page except a few, no sticky or exit-intent | Partly. WE keeps the discipline (D-24) but has four audiences and several action types, and adds a mid-body band for long articles. |
| Two-panel mega menu from one data object, mobile accordion | WE already has `src/data/nav.ts` and a keyboard-tested MegaNav; wave 8 adds an audience lens and new entries, not a second menu. |
| Single contact route, no investor or partner pages | WE is ahead: `/investors/`, `/network/`, `/press/`, `/library/`, `/pricing/` exist. |

**Wave 7 benchmark (eight accelerator sites, [O] from the 2026-10-09 teardown).** Reused only for the navigation point: Y Combinator carries "Partners" in its primary nav and Antler carries "Investors" (`wave7.md` section 2). Neither site's investor or partner pages were read, so no claim about their content is made. No page-family benchmark (industries, segments, comparisons) was made: the families are specified from the CEO direction and the truth policy, and each family package states its own evidence rule.

### 2.4 Target architecture

**Audiences and routes.** Four audiences, `startup`, `investor`, `partner` and `corporate` (a company that wants to build new products or spin one out), each get a clear path (contracts section 1 lists every route, layout, owner and noindex status; section 11 holds the journey maps).

| Audience | Path | Action |
|---|---|---|
| Startup | home, `/founders/` and eight segment pages, every article, guide, playbook and template, `/industries/`, `/compare/`, `/journey/`, `/briefs/` | Apply; request a brief; use a tool |
| Investor | `/investors/` (rebuilt) and its six child pages | Ask to meet the companies WE incubates |
| Partner | `/network/partners/` and its four child pages | Tell WE what you provide to founders |
| Corporate innovator | `/founders/corporate-innovators/`, the `corporate-spinouts` brief, pathway articles | Request the brief; contact WE |

**Page families.** Nine families, each with one template (WP-71) and one content owner: `articles` (14 desks), `briefs` (10), `segments` (8), `industries` (7 plus a hub), `compare` (7 plus a hub), `journey` (4), `investors` (7 plus a thank-you page), `partners` (5 plus a thank-you page), `reference` (glossary, FAQ, resources, tools). The registry (`src/data/families.ts`) and the desk registry (`src/data/desks.ts`) are the only hand-edited lists; rows, nav links, sitemap entries and tests derive from them. About 170 routes are new or newly launched: 104 articles, 10 desk pages, 8 segment pages, 8 industry pages, 8 comparison pages, 4 journey pages, 12 brief routes, 8 investor routes, 6 partner routes, 3 tools and the brand story (172). Three of them (the brief, investor and partner thank-you pages) are noindex; the brand kit page stays `launch: false`.

**Mega menu.** WP-60 adds an audience lens to `src/data/nav.ts` (four entries, each a short list of the pages above), a Partners entry in the Network panel replacing "Partners and perks", a Briefs entry, entries for Industries, Compare and the journey pages in the panels where they belong, and a Topics column driven by `desks.ts`. Links stay hidden until their page exists (route-state). Existing panels are not removed or reordered. WP-99 finishes the IA after every page exists and updates the nav snapshot fixture; WP-91 adds the new routes to the command palette.

**CTA system.** Four placements on top of the existing header Apply button: an end-of-page band on content pages and hubs, a mid-body band in articles of at least 900 words (static, from a hast plugin), an aside variant on hubs, and an audience strip on the home page. Six variants (`apply`, `brief`, `investor-interest`, `partner-enquiry`, `tools`, `contact`), resolved by a pure function from frontmatter, route, collection and desk, with fail-closed dead-target handling and a primary and secondary action per page family (contracts section 6.2). No JavaScript, no tracking, no motion after load.

**Executive briefs.** Ten briefs of 2,500 to 4,000 words, each with an open abstract and a squeeze page, a `/briefs/` hub segmented by audience, a generic noindex thanks page. Full text never enters the build; a sentinel audit proves it, including inside the gzip-compressed Pagefind fragments, and proves itself with a self-test.

**Intake.** Browser, `fetch` to `https://intake.worldenterprise.org/api/intake`, an Azure Function behind the shared Front Door, a managed identity writing a `we_engagement` row to Dataverse and sending ACS email. Idempotent on `requestId`, honeypot silent 200, rate limit 5 per hour per address and per email, no cookies, no body logging. Operator-provisioned; the code ships guarded.

**Article program.** Fourteen desks, 18 articles today, 104 new, 122 in all, 1,200 to 1,800 words, at least two real sources fetched in-session unless the article makes no statistical claim (a legal or regulatory statement needs a primary source), a "What this article cannot tell you" section, claim ids. Articles are spread over audiences (the `starting` desk and the `segments` field), topics (funding, legal, team, product, go-to-market, operations) and models and sectors (`models`, `sectors`).

**Customer journey.** Five stages (awareness, consideration, conversion, onboarding, advocacy) and four maps (contracts section 11). The honest limits are written into the map: advocacy has no testimonials, share counts or referral rewards; it is the consent-gated showcase (L2 until a consent record exists), the partner enquiry and a pass-it-on section on the journey hub.

**Brand.** One audit across every family, one set of vector compositions for the new families, one mapping from family to Open Graph card, a brand story page and a brand kit page held back until sign-off (W8-22, OP-BRAND, OP-OG).


---

## 3. Where WE stands

Facts below were read from the repo (`origin/demo` at 05c7582, plus the files the unmerged wave 7 branches add) unless labelled [I].

### 3.1 The directions the CEO set

| # | Direction | What exists | Strength |
|---|---|---|---|
| a | Attract startups, many CTAs | Apply button on every page (nav), a featured card per mega panel, `/apply/` stepper (WP-43), `/founders/`, `/program/who-its-for/`, a rebuilt home (WP-44). No call to action inside the article, brief, template or guide layouts. No page for any particular kind of founder. | Medium on nav and home; weak on content pages [I from layout read] |
| b | Investors meet incubated startups | `/investors/` is limits-first: it says what WE does not do. The Investor Introductions add-on and its verbatim disclaimer exist (`src/components/blocks/introductions.ts`, decision F-5). `/founders/portfolio/` and `/case-studies/` are L2 (`requires: ['companies']`). The `portfolio` collection is empty. | Honest, not persuasive. No invitation, no interest form, no path to meet anyone. |
| c | Partnership posture | `/network/operators/` lists roles. `/network/partners/` and `/network/delivery-partners/` are L2. `src/content/pages/network/index.mdx:34` says there is no partner program. The nav carries "Partners and perks" as an L2 link. | Contradictory: the copy denies what the CEO wants. |
| d | Executive briefs behind squeeze pages | Four research briefs and six library templates, all open and indexed; library templates also served as `.md` twins; `llms-full.txt` mirrors open content. No PDF anywhere (`scripts/lib/audit-dist.mjs` allowlist). No gate, no capture, no delivery. | Absent, and structurally blocked: anything gated must be kept out of `dist`, the llms files, the twins and the search index. |
| e | Mega menu | Five panels plus Pricing and Apply, data-driven (`src/data/nav.ts`), descriptions, featured cards, strips, keyboard e2e (`e2e:menu`). WP-46 adds a command palette. | Strong mechanics; organized by topic, not by audience. |
| f | Large article library for a wide demographic | 18 articles in four desks (5 build, 4 dream, 5 fundable, 4 grow), 1,200 to 1,800 words, a required "What this article cannot tell you" section, at least two sources, claim ids. Five playbooks, four guides, six templates, four research briefs, 18 FAQ entries (`src/data/faq.yaml`), about 40 glossary terms (`src/data/glossary.yaml`). | High quality, low volume, one reader (a first-time SaaS founder). Scaling is blocked by hard-coded slug tuples and exact-count tests (3.2). |
| g | Intake into D365 | Closed JSON schema in `docs/forms-contract.md`, `PUBLIC_WE_INTAKE_API_URL`, modes endpoint, mailto and disabled (`src/data/forms.ts`, `src/lib/endpoints.ts`), `FORM_ROUTES`. No endpoint: `/apply/` and `/contact/` render disabled in production, `/newsletter/` is `launch: false`. | Client side done, backend nonexistent (B-2). |
| h | A complete customer journey and a full brand | Apply, thanks and program pages exist; there is no page for what happens after applying, no first-months page, no onboarding checklist, no resources hub with a purpose. `/press/` exists, `/press/brand-kit/` is `launch: false` (reason: needs the brand-owner usage sign-off), no brand story. Photography is a separate lane. | Entry and exit exist; the middle of the journey is missing. |

### 3.2 What blocks scale, specifically

1. `INSIGHT_SLUGS` (18), `DESKS` (4) and `insightOwner(index)` in `src/data/routes.ts` are hand-edited tuples; ownership is positional (the first nine belong to WP-05, the rest to WP-06). `route-core.ts` builds `'/insights/topic/[topic]/'` from `DESKS`.
2. Exact-count tests: `tests/unit/foundation/ledger.test.ts` asserts 99 rows, 95 indexable, 23 insights and 18 slugs; `wp-05` and `wp-06` assert the exact slug list per desk; `wp-04` asserts five playbooks and four guides.
3. `src/components/insights/related.ts` holds hard-coded `PLAYBOOK_TITLES` and `TEMPLATE_TITLES`.
4. The `topic` enum in `src/content.config.ts` has four values.
5. There is no registry for page families: every new family (segments, industries, comparisons, journey) would otherwise need hand-edited rows in the frozen ledger and the frozen nav.
6. `faq.yaml`, `glossary.yaml`, the readiness statements and the data-room checklist are pinned by tests (`wp-01/program`, `wp-41/content` and `wp-41/llms` once wave 7 lands, `wp-49/evidence-room`); growing them is safe only as additions (W8-28).
7. The machine layer (wave 7: Markdown twins, `llms.txt`, `llms-full.txt` with a 262,144-byte cap that throws) was built for about 63 documents, not 190 routes. `llms-full.txt` is a curated key-page list, so the cap is safe by design, but a page family that is not on the key-page list is invisible to it (W8-26).
8. 125 test files exist on `demo` (148 once the wave 7 branches add theirs). Several pin facts wave 8 changes on purpose (investors page blocks, apply stepper sentences, the privacy notice field list, exact playbook and guide counts). The pin scan found none unowned after the W8-18 assignment (section 8.3).

### 3.3 Constraints that bite hardest

- **Claims denylist v3 and the audit.** `scripts/audit-claims.mjs` scans built `html`, `xml`, `txt` and `md`. The traps that matter for wave 8 copy are tabulated, with their consequence for each package, in `docs/wave8-contracts.md` section 0.1. The notable ones: `C-13-peers` blocks "cohort", "mentor", "alumni" and "accelerator" everywhere but three routes (which matters for `/compare/incubator-vs-accelerator/`, DP-W8-15); the SAFE-mechanics rules (`C-08-valuation-cap`, `-discount-rate`, `-pro-rata`, `-mfn`) need a `data-generic-definition` wrapper (glossary, comparison and cap-table copy); `C-08-success-fee` blocks the literal phrase even in a negation; `W7-C09-*` blocks "no fee", "no equity", "free of charge", "no stake", "non-dilutive"; `C-13-funding-raised` blocks "portfolio companies" and "raised $"; `C-15-*` blocks certification claims (fintech, healthtech and sector copy); the required-text rules demand "WE makes no promise of funding." and the verbatim Introductions disclaimer on named routes.
- **Counsel.** The audit writes `reports/counsel-review.md`, listing every rendered sentence about investors and Investor Introductions. All new investor, partner, consent, brief, comparison and sector wording lands in the counsel queue, and counsel's register (CR-01 to CR-20, `.astro-magazine/release/RELEASE.md`) is in the release lane.
- **D-12** (no named people, companies, events or dates without a source), **D-13** (forms post to an external function), **D-14** (no analytics, cookies or third-party scripts), **D-8** (light theme only), **F-4 / F-5** (packages without amounts; the add-on is a flat fee).
- **Release gate.** `RELEASE_ALLOW` currently tolerates the launched form routes plus nine wave 7 pending routes and two machine files; it is empty on `release-*` tags and `gh-pages`. A launched row with no page, or a form with no endpoint, fails a release. That is the safety net for this wave and it must not be weakened (W8-10).
- **Backend.** An HTTP-trigger Logic App URL carries a `sig=` token; in a `PUBLIC_` variable it would be published in the HTML and the CSP. Not used.
- **CI capacity.** The Playwright configuration documents that four workers on a shared runner already produced timeouts; the CEO's limit of five branch pipelines at once (W8-12) is the ceiling for this wave.

### 3.4 Wave 7 state that wave 8 depends on

WP-42, 43, 44 and 45 are merged to `demo`. WP-41 (GEO layer: `llms.txt`, Markdown twins, `/about/facts/`), WP-46 (command palette and panel styling) and WP-49 (founder tools) are unmerged. They add files that wave 8 edits or links to (twin and llms inputs for the new routes, nav and palette entries, the tools hub as a CTA target). Their files are registered in the write sets of WP-91 and WP-76 and are part of the base the checkers run on (section 8.3). WP-60's entry gate handles the case where a branch changes before it merges or is abandoned (W8-27).

---

## 4. Plan shape, concurrency, rules and RICE

### 4.1 Shape

32 packages: 3 foundation packages (stage 0), three rounds of 8 to 10 packages (stage 1) and 2 closing packages (stage 2). A package is one scoped branch `wp/NN` in its own worktree, with one write set that no other package may touch.

| Stage | Packages | Gate to start |
|---|---|---|
| 0a | WP-60 checkpoint 60a (plan, ownership, decisions, desks, family registry, ledger at scale, schema, rubric tests) | Wave 7 branches 41, 46 and 49 merged or closed; entry gate complete (WP-60 entry actions) |
| 0b | WP-60 checkpoint 60b (forms v2, CTA skeleton, nav lens, audit script, CI, absorbed WP-50 scope); WP-61 (intake service); WP-71 (brand system and page-family templates) | 60a merged |
| R1 (article desks, 88 articles) | WP-83 starting, WP-66 funding, WP-81 gtm, WP-67 legal and fundable, WP-69 ai, WP-82 build and dream, WP-84 pathways, WP-68 team, WP-85 models and grow | 60a merged (desks, schema, rubric tests exist) |
| R2 (audience surfaces and tools) | WP-63 briefs system, WP-64 investors, WP-65 partners, WP-62 CTA system and home, WP-72 journey pages, WP-91 discoverability, WP-73 segments, WP-76 tools, WP-75 comparisons, WP-74 industries | 60b merged; WP-72, 73, 74 and 75 also need WP-71 merged before their final push |
| R3 (reference, briefs and depth) | WP-78 FAQ, WP-77 glossary, WP-79 briefs 4 to 6, WP-86 playbooks, WP-87 guides and templates, WP-80 briefs 7 to 10, WP-89 ops desk, WP-88 sectors desk | The R1 and R2 pages they link to are merged (per-package gates in section 5.4); WP-79 and WP-80 need WP-63 merged |
| 2 | WP-90 (journey suite), then WP-99 (integrator) | Every other package merged, or cut by name (4.6) |

WP-60 delivers two merge requests from `wp/60`; its single ownership assignment covers both. Articles do not need the form components, so they start at 60a.

### 4.2 Concurrency and the push protocol (CEO limits: 10 agents, 5 pipelines)

Two limits apply, and they bind different things.

- **At most 10 authoring agents at once.** An agent is authoring from the moment a package starts until its last merge request is merged. The orchestrator starts a package only when it has fewer than 10 running agents and the package's gate (4.1) is met.
- **At most 5 branch pipelines at once.** Authoring is local and costs no CI. A pipeline starts only when an agent pushes, so the cap is enforced at the push, by a slot protocol that every wave 8 agent uses (below). An agent that finds all five slots busy keeps authoring and queues its push.

**Occupancy by phase.** Peak agents never exceed 10 and the slot protocol keeps pipelines at 5 or fewer whatever the demand.

| Phase | Starts when | Authoring agents | Agents | Pipelines (cap 5) |
|---|---|---|---|---|
| P0 entry | Wave 7 branches merged or closed | WP-60 entry gate and 60a | 1 | 1 to 2 (push, fix) |
| P1 wide start | 60a merged | WP-60 (60b), WP-61, WP-71, WP-83, WP-66, WP-81, WP-67, WP-69, WP-82, WP-84 | 10 | demand spread by batch pushes; slots hold it at 5 |
| P2 R1 tail, R2 opens | An R1 package merges; 60b and WP-71 merge | WP-68 and WP-85 take the first freed slots; then WP-63, 64, 65, 62 (P0), then WP-72, 91, 73, 76, 75, 74 as slots free | 10 | at 5 |
| P3 R3 | R1 and R2 pages merge | WP-78, 77, 79, 86, 87, 80, 89, 88 as slots free and gates open | 8 to 10 | at 5, falling |
| P4 close | Every R3 package merged | WP-90, then WP-99 | 1 to 2 | at most 2 |

Priority for a freed slot: (1) WP-60, 61, 71; (2) R1 packages in the order listed in 4.1; (3) in R2, the P0 packages WP-63, 64, 65, 62 first (WP-62 merges after the other three), then the rest by RICE; (4) in R3, by RICE. The order is a rule of thumb for the orchestrator, not a safety property: safety comes from the disjoint write sets, which are checked for every pair that could ever run together (pools in 8.3), so any ordering inside the two limits is safe.

**Pipeline budget.** Each package gets an expected number of pipelines, counting its batch push, one fix push and the merge pipeline on `demo`:

| Packages | Pipelines each | Total |
|---|---:|---:|
| WP-60 (60a 3, 60b 4, entry gate 1) | 8 | 8 |
| WP-61, WP-71, WP-63 | 5 | 15 |
| WP-62, WP-64, WP-76, WP-80, WP-86, WP-87, WP-91 | 4 | 28 |
| WP-65, 72, 73, 74, 75, 77, 78, 79, 90 | 3 | 27 |
| Eleven article packages (66, 67, 68, 69, 81, 82, 83, 84, 85, 88, 89) | 3 | 33 |
| WP-99 | 5 | 5 |
| **All 32 packages** | | **116** |

With five at once, 116 pipelines need at least 24 pipeline durations of wall clock if the slots are always full. The duration of one pipeline on this runner was not measured by this plan [not verified]; WP-60 records the observed duration of its first three pipelines in its handoff and the orchestrator recomputes the schedule (4.6) from it.

**The push protocol (W8-21).** Every wave 8 agent follows it; the script is `push-slot.sh` in the committed bundle (`.astro-magazine/plans/wave8/push-slot.sh`, self-tested by `push-slot-test.sh`).

1. **Author locally in batches.** Commit locally as often as is useful (commit early, as ever) but do not push per commit. Content agents author a whole desk batch and push about 8 to 10 articles at once (a desk of up to 11 goes in one push; two pushes only if each carries at least 5, and the budget above rises by one). Page packages push at their own checkpoints (listed per package). Foundation packages push per checkpoint.
2. **Merge `origin/demo` into the branch** before the push (never rebase a pushed branch), so unit invariants run against the current tree.
3. **Push through a slot.** Run `bash .astro-magazine/plans/wave8/push-slot.sh push wp/NN` as a background command (a pipeline can outlast a foreground timeout). The script waits for a free slot (an `flock` on one of five files under the git common directory, shared by every worktree), pushes, waits for the pipeline of the pushed commit to end and releases the slot. A slot is therefore held from the push until the pipeline is green, red or canceled. A crashed agent frees its slot by itself.
4. **Fix and re-push through the slot again.** A red pipeline is diagnosed from the job log, fixed locally, and pushed once more through the protocol, never pushed in a hurry around it. Two fix pushes is the budget; a third is raised to the orchestrator.
5. **Merge, then watch `demo`.** After the merge request is merged (by the orchestrator, in the order below), the merger runs `push-slot.sh watch demo`: the `demo` pipeline is a pipeline like any other and takes a slot.
6. **If the script cannot run** (no `flock`, no `glab`), the orchestrator hands out push turns by message, at most five open at a time; the rule is the same.
7. **`push-slot.sh status`** prints which slots are held and by whom; the orchestrator uses it to see occupancy.

Local checks are limited to what needs no build: the node unit tests (`npm run test:unit`) where the worktree already has dependencies, the ownership check and the checker bundle. `astro build`, Lighthouse, axe and Playwright run only in CI.

**Merge order.** 60a, then any of {60b, 61, 71, R1 packages}, then R2 (WP-63, 64, 65 before WP-62), then R3, then WP-90, then WP-99. WP-61 reads the forms schema JSON that 60b creates, so it merges after 60b. WP-72 to 75 merge after WP-71. WP-79 and WP-80 merge after WP-63. Branches with disjoint write sets never conflict in `git`; the order exists for links (rule 5 of 4.3).

### 4.3 Rules for every package (also written into `docs/wave8-contracts.md` by WP-60)

1. A package edits only files in its registered write set. `check:ownership` enforces this on `wp/*` branches. A file outside the set is requested from the orchestrator, not edited.
2. Shared surfaces have one owner: frozen files and the wave 8 frozen additions (4.4) belong to WP-60 (stage 0) and WP-99 (stage 2, through registered exceptions); `src/data/cta/**` and `src/components/cta/**` belong to WP-60 until 60b merges, then to WP-62; `src/components/forms/**`, `src/scripts/forms.ts` and `src/data/forms.ts` belong to WP-60; page-family route files and components belong to WP-71.
3. Layout and component APIs stay additive: `tests/unit/wp-45/pinned-props.test.ts` allows new optional props and new components only.
4. Tests only in `tests/unit/wp-NN/**` and `tests/e2e/wave8/wp-NN/**` (run by the `e2e:wave8` job at 1440x900 and 390x844). Function tests live in `infra/intake/tests/**`. Each package writes a handoff `.astro-magazine/handoffs/wp-NN.md` and a sources file `.astro-magazine/sources/wp-NN.json`. Page copy maps every sentence to a claim id, an existing page and line, or a decision id; articles, briefs, glossary entries and every explainer use a claim ledger with a fetch record per source (contracts section 9).
5. Internal links point only at routes that exist on `demo` when the branch merges (a link to an unmerged article or page is a dead link to `audit:links`). A package that wants a later page uses the fail-closed mechanisms: the `related` frontmatter of an article, the `segments` field, the CTA map and the registry-driven lists, all of which drop a target that is not live. Truth policy (binding on all): contracts section 0. No amounts, seat counts, response-time promises, application counts, invented portfolio, logos, testimonials or statistics about WE; no "no fee", "no equity", "free of charge" or "no stake" about the commercial model; hybrid pricing stays unpublished; Investor Introductions is a flat-fee add-on with no success fees; no analytics, cookies or third-party scripts; flags stay OFF.
6. Quality bars for every page package: `npm run check`, `test:unit`, `check:ownership`, the full qa set and `verify:static` green; Lighthouse 1.0 in all four categories and axe zero violations on the package's routes; CLS under 0.1; no new third-party request; touch targets at least 24 px; keyboard-only completion of every form; correct no-JavaScript behavior.
7. Never run builds locally; CI builds. Commit locally when a unit is coherent; push at the batch boundary through the slot protocol (4.2); watch the pipeline; fix until green. Secrets by name only: Key Vault `omlab-secrets`, names `worldenterprise-intake-<purpose>`.
8. Existing reference content grows by additions only (W8-28). Existing FAQ entries, glossary terms and readiness statements are kept verbatim; a correction is raised in the handoff.

### 4.4 Frozen list, lanes, ownership and release policy

- **Frozen (26 current paths in `ownership.json`).** `package.json`, `package-lock.json`, `astro.config.mjs`, `tsconfig.json`, `.node-version`, `src/data/{site,flags,claims,routes,nav}.ts`, `src/lib/{url,url-core,route-state,content,env,route-core}.ts`, `src/content.config.ts`, `claims-denylist.json`, `CNAME`, `CLAUDE.md`, `plan.md`, `.claude/**`, `.astro-magazine/{ownership.json,decisions.md}`, `tests/unit/foundation/**`, `src/assets/photo/slots.ts`. WP-60 holds a registered exception for each one it edits (14 of them), in the same commit as the edit. WP-99 holds declared exceptions for `routes.ts` (to flip a cut page's row), `nav.ts`, `families.ts`, `desks.ts`, the nav snapshot fixture, `.gitlab-ci.yml`, `lighthouserc.json`, `decisions.md`, `ownership.json` and `RELEASE.md`.
- **Wave 8 frozen additions (`frozen_paths_wave8`, 15 entries, registered by WP-60).** `src/data/desks.ts`, `src/data/families.ts`, `src/data/forms.ts`, `src/scripts/forms.ts`, `src/components/forms/**`, `docs/forms-contract.md`, `docs/forms-contract.schema.json`, `docs/wave8-contracts.md`, `src/components/insights/**`, `src/lib/rehype-mid-cta.ts`, `src/lib/content-files.ts`, `src/layouts/**`, `src/components/layout/**`, `scripts/audit-gated-briefs.mjs`, `scripts/lib/gated-briefs.mjs`. Only WP-60 and WP-99 may touch them. `scripts/check-ownership.mjs` reads the new key (WP-60, 60a).
- **Photography lane (19 paths, reserved, nobody edits).** `src/assets/photo/**`, `src/assets/og/**`, `src/components/media/**`, `src/components/cards/**`, `src/components/ui/Card.astro`, `src/components/hero/{HeroAtlas,HeroEditorial}.astro`, `src/components/home/HomeHero.astro`, `src/components/services/LineAside.astro`, `src/pages/program/who-its-for.astro`, `src/pages/pricing/index.astro`, `scripts/photo/**`, `scripts/build-og.mjs`, the matching tests and handoffs. WP-62 leaves the home hero markup alone; no package adds a `cover` to an article; WP-71 reaches Open Graph cards only through the `ogSlot` prop and asks the lane for anything more (OP-OG).
- **Release lane (8 paths).** `.gitlab-ci.yml`, `scripts/release-preflight.mjs`, `scripts/lib/release-gate.mjs`, `docs/runbook-release.md`, `scripts/ci/**`, `.astro-magazine/release/**`, `tests/unit/wp-30/**`, `.astro-magazine/handoffs/wp-30*`. The declared serializations are WP-60's `include: local` line in `.gitlab-ci.yml` and WP-99's `.gitlab-ci.yml` and `RELEASE.md` edits (W8-11).
- **`RELEASE_ALLOW`.** Contracts section 10. WP-60 removes the wave 7 patterns (their pages exist; WP-48's four rows become `launch: false` with a reason) and adds one anchored pattern per pending wave 8 path; WP-99 removes them. On a release tag the value is empty, so the release needs every page built and `PUBLIC_WE_INTAKE_API_URL` set.
- **Legacy tests.** Contracts section 12: WP-60 owns `foundation`, `wp-03`, `wp-04`, `wp-05`, `wp-06`, `wp-08`, `wp-11`, `wp-18`, `wp-19`, `wp-40` and `wp-43`; WP-61 owns `wp-10`; WP-62 owns `wp-01` and `wp-44`; WP-63 owns `wp-07`; WP-76 owns `wp-49`; WP-91 owns `wp-41` and `wp-46`; the lane tests and the rest are read-only.

### 4.5 Milestones

Milestone: "World Enterprise Incubator v1.2 (Wave 8: a complete site for startups, investors and partners)", due 2026-10-31 (moved from 2026-10-24 by the scope expansion; the orchestrator confirms).

| Milestone | Packages | Success criterion |
|---|---|---|
| M8a Foundation | WP-60 (60a, 60b) after wave 7 closes | 60a and 60b merged to `demo`; `verify:static`, every qa job and `check:ownership` green with the new rows inert; wave 8 write sets registered and the wave 8 write-set test proves the pools disjoint; contracts, decisions and checker bundle committed; no exact-count test left |
| M8b Services and brand | WP-61, WP-71 | Each green on its own `wp/NN` branch and merged; the intake service code complete, tested with fakes and inert without operator inputs; the family templates render fixture pages for every registry slug; the brand audit and the vector compositions in place |
| M8c Audience surfaces | WP-62, 63, 64, 65, 72, 73, 74, 75 | Each merged with acceptance criteria met; every audience has a complete path (investor journey, partner journey, eight segment pages, seven industry pages, seven comparisons, four journey pages); briefs 1 to 3 live behind squeeze pages |
| M8d Library and tools | WP-66, 67, 68, 69, 81, 82, 83, 84, 85, 88, 89; WP-76, 77, 78, 79, 80, 86, 87 | About 122 articles, about 120 glossary terms, about 60 FAQ entries, 10 briefs, three new tools, about 10 playbooks, about 8 guides and about 12 templates merged or named in the cut list; the rubric, sources ledger and sentence ledgers green over every file |
| M8e Discoverability and integration | WP-91, WP-90, WP-99 | Machine layer and search cover every new family under the cap; every journey passes on both viewports; full pipeline green on `demo`; the release rehearsal reports only the disabled form routes; handoff lists every decision resolved and every operator input still open |

### 4.6 Schedule against the due date, and cut lines

Targets (calendar days from 2026-10-10, indicative): wave 7 closes day 1 to 2; 60a merged day 3; foundation and R1 day 4 to 9 (60b day 6); R2 day 8 to 13; R3 day 12 to 17; WP-90 day 17 to 18; WP-99 day 18 to 19 (2026-10-29), leaving two days against 2026-10-31. This is tight, and the pipeline duration it rests on is not measured (4.2). Evidence for feasibility: wave 7's foundation and first batch of five packages went from plan (12:26 on 2026-10-09) to merge requests (00:15 the next day) in under 12 hours [I, from job file timestamps]. Evidence against: wave 7's packages were mostly one agent writing one surface, wave 8's article and brief packages carry a fetch-and-verify cost per source (about 104 articles and 10 briefs, each source fetched in-session), the push protocol deliberately serializes pipelines beyond five, and wave 8 has two sources of delay outside the agents' control (wave 7 closing, operator provisioning).

If the date cannot be met, cut in this order and name each cut in the WP-99 handoff:
1. The sectors and operations desks (WP-88, WP-89, 16 articles). Their rows are not pre-registered; a missing article is absent, never pending, so nothing in the release gate changes (the ledger derives rows from files, W8-7).
2. The titles marked B in 5.2 (in each article package, the titles after the eighth: one to three per package, 16 in all) and the second half of the glossary and FAQ growth targets (additions only, so a partial result is a valid result).
3. Industry pages 5 to 7 and comparison pages 5 to 7 (WP-99 flips their registry entries to `launch: false` through its declared `families.ts` exception).
4. Briefs 5 to 10 (`pre-seed-evidence-pack`, `first-hires`, `early-stage-diligence`, `ai-company-diligence`, `partnering-with-founders`, `corporate-spinouts`): WP-99 flips their registry entries and the CTA map's fail-closed rule drops the targets.
5. New playbooks, guides and templates beyond the depth pass on the existing five playbooks and four guides (WP-86, WP-87).
6. Never cut: WP-60, the WP-61 code, WP-71 core templates, WP-62, WP-63 (system and briefs 1 to 3), WP-64, WP-65, WP-72, WP-73, WP-91, WP-90, WP-99 and the first eight titles of each article package. Live intake is not an agent deliverable; it depends on the operator inputs in section 7 and its absence does not delay the milestone.

### 4.7 RICE

Reach is the relative share of evaluating visitors who touch the surface (0 to 10). Impact is 0.25, 0.5, 1, 2, 3. Confidence is evidence quality. Effort is agent-sessions (one session is one scoped branch taken to green CI). **Reach and Impact are judgments, because D-14 means there is no analytics to measure them.** Confidence is lowered where delivery depends on operator provisioning or on sources that must be fetched.

| WP | Package | Reach | Impact | Confidence | Effort | RICE | Priority |
|---|---|---:|---:|---:|---:|---:|---|
| WP-60 | Foundation (two checkpoints) | 10 | 1 | 90% | 5 | 1.8 | P0 enabler, first |
| WP-61 | Intake service | 10 | 3 | 60% | 6 | 3.0 | P0 |
| WP-71 | Brand system and page-family templates | 9 | 2 | 70% | 5 | 2.5 | P0 enabler |
| WP-62 | CTA system and home | 9 | 2 | 70% | 3 | 4.2 | P0 |
| WP-63 | Gated briefs system and briefs 1 to 3 | 7 | 2 | 60% | 6 | 1.4 | P0 |
| WP-64 | Investor journey | 3 | 3 | 70% | 3.5 | 1.8 | P0 |
| WP-65 | Partner journey | 2 | 2 | 70% | 3 | 0.9 | P1 |
| WP-72 | Customer journey pages and resources hub | 8 | 2 | 70% | 2.5 | 4.5 | P0 |
| WP-73 | Founder segment pages (8) | 7 | 2 | 70% | 3 | 3.3 | P0 |
| WP-74 | Industry pages (7) | 4 | 1 | 70% | 2.5 | 1.1 | P1 |
| WP-75 | Comparison pages (7) | 5 | 1 | 60% | 2.5 | 1.2 | P1 |
| WP-76 | Founder tools (3 new) | 5 | 1 | 70% | 3 | 1.2 | P1 |
| WP-91 | Discoverability at scale | 8 | 2 | 70% | 3 | 3.7 | P0 |
| WP-83 | Articles: starting out (10) | 8 | 2 | 60% | 5 | 1.9 | P1 |
| WP-66 | Articles: funding (10) | 7 | 2 | 60% | 5 | 1.7 | P1 |
| WP-81 | Articles: go-to-market (10) | 7 | 2 | 60% | 5 | 1.7 | P1 |
| WP-67 | Articles: legal and fundable (11) | 7 | 2 | 60% | 6 | 1.4 | P1 |
| WP-69 | Articles: AI-native building (9) | 6 | 2 | 60% | 5 | 1.4 | P1 |
| WP-82 | Articles: build and dream (9) | 6 | 2 | 60% | 5 | 1.4 | P1 |
| WP-84 | Articles: pathways (10) | 6 | 2 | 60% | 5 | 1.4 | P1 |
| WP-68 | Articles: team (9) | 5 | 2 | 60% | 5 | 1.2 | P1 |
| WP-85 | Articles: models and grow (10) | 5 | 2 | 60% | 5 | 1.2 | P1 |
| WP-89 | Articles: operations and wellbeing (8) | 4 | 1 | 60% | 5 | 0.5 | P2 |
| WP-88 | Articles: sectors (8) | 3 | 1 | 50% | 5 | 0.3 | P2 |
| WP-78 | FAQ at scale | 7 | 1 | 80% | 2.5 | 2.2 | P1 |
| WP-77 | Glossary at scale | 6 | 1 | 80% | 3 | 1.6 | P1 |
| WP-79 | Briefs 4 to 6 | 5 | 2 | 60% | 5 | 1.2 | P1 |
| WP-86 | Playbooks | 5 | 1 | 70% | 4 | 0.9 | P1 |
| WP-80 | Briefs 7 to 10 | 4 | 2 | 50% | 6 | 0.7 | P1 |
| WP-87 | Guides, templates, readiness check | 5 | 1 | 70% | 5 | 0.7 | P1 |
| WP-90 | Journey end-to-end suite | 10 | 1 | 90% | 3 | 3.0 | Mandatory |
| WP-99 | Integrator and release rehearsal | 10 | 1 | 100% | 3 | 3.3 | Mandatory, last |

Why WP-61 sits at 60% confidence: the code is in the agents' hands, the provisioning is not. Why the article and brief packages sit at 50 to 60%: each source must be fetched and each claim must survive the denylist, and a claim that cannot be sourced is dropped. Why WP-88 and WP-89 are P2: they serve audiences the CEO named only as "considerations" (sectors) or as a general topic (operations), so they are the first cut.


---

## 5. Work packages

Each package lists scope, write set, acceptance criteria and dependencies. Write sets are generated from `wave8-writesets.json` (section 8.3), so they match what the checker proved. `docs/wave8-contracts.md` is binding on every package; where a package issue and the contracts disagree, the contracts win and the package raises the question in its handoff. Section 5.1 holds the stage 0 packages, 5.2 the article program (nine round 1 packages and the two round 3 desk packages WP-88 and WP-89), 5.3 round 2, 5.4 round 3 and 5.5 the two closing packages.

### 5.1 Stage 0: foundation, intake, brand and templates

### WP-60 Foundation (stage 0, P0 enabler, two checkpoints, 5 sessions)

**Why first.** Nearly every other package needs a frozen or shared file: a route row, a nav link, a denylist rule, an ownership registration, a form component, a layout slot. Letting each package edit them would break the no-overlap rule at once, so WP-60 lands all of it, mirroring WP-40 in wave 7. It ships as two merge requests so the article packages, which need only desks, schema and tests, are not held behind form and nav work.

**Entry gate (hard, recorded in the handoff).** (1) WP-41, WP-46 and WP-49 are merged to `demo` or closed (W8-27). (2) The coverage, pins, overlap, self-test, prose, triage and owner checkers are re-run on the post-wave-7 tree, regenerating their inputs there (`git ls-files` for the tracked list, the real `tests/` directory as the tests root, the committed plan as the prose input; the copies in the job directory will not exist); any file those branches added that a wave 8 package must edit is registered (candidates: `src/components/geo/**` for `llms-full.txt` and Markdown twin inputs, `src/components/nav/**` and the palette entries, `src/pages/tools/**` and `src/components/tools/**` for CTA targets); `wave8-writesets.json` is updated until each checker reports zero. If a wave 7 branch is abandoned instead of merged, its patterns and matching pin acknowledgements are removed from the JSON first. (3) This plan, `wave8-contracts.md` and the checker bundle (`wave8-writesets.json`, `wave8-lib.mjs`, `wave8-overlap.mjs`, `wave8-selftest.mjs`, `wave8-coverage.mjs`, `wave8-pins.mjs`, `wave8-prosecheck.mjs`, `wave8-triage.mjs`, `wave8-owners.mjs`, `wave8-push-slot.sh`, `wave8-push-slot-test.sh`) are committed. (4) The observed duration of the first three pipelines is recorded in the handoff (4.2).

**Checkpoint 60a: scale, governance, schema, registries (unblocks WP-61, WP-71 and the nine R1 article packages)**
1. **Governance.** Commit the plan as `.astro-magazine/plans/wave8.md`, the contracts as `docs/wave8-contracts.md` and the checker bundle under `.astro-magazine/plans/wave8/` (the script names without the `wave8-` prefix, so `.astro-magazine/plans/wave8/push-slot.sh`). Register the 32 ownership assignments WP-60 to WP-99 (owner, branch `wp/NN`, write set from the JSON) and `frozen_paths_wave8` in `.astro-magazine/ownership.json`; extend `scripts/check-ownership.mjs` to read the new key; register one exception per frozen file WP-60 edits, in the same commit. Add `tests/unit/wp-60/write-sets-wave8.test.ts`, scoped to `/^WP-(?:6\d|7\d|8\d|9\d)$/` so the wave 7 test is untouched, asserting that pool members are pairwise disjoint and avoid the frozen, wave 8 frozen and photography lists (W8-1); and `tests/unit/wp-60/push-slot.test.ts`, which runs the push-slot self-test (a unit test that skips with a message when `flock` is absent).
2. **Decisions.** D-20 to D-24 and W8-1 to W8-29 in `.astro-magazine/decisions.md`, each citing the 2026-10-10 CEO direction; update `EX-SCALE`.
3. **Ledger at scale.** Create `src/data/desks.ts` (14 desks, contracts section 2), `src/data/families.ts` (the page-family registry, which also defines `AUDIENCES` and the `Audience` type that `forms.ts` and the CTA map import, contracts section 8.1) and `src/lib/content-files.ts` (a plain `node:fs` directory reader in the style of `src/lib/page-files.ts` so `routes.ts` still imports under plain Node for `scripts/lib/export-ledger.mjs`). `src/data/routes.ts` derives `INSIGHT_SLUGS`, the desk rows, the family rows, `DESK_LABELS` and `insightOwner` from them; a desk route is pending until the desk holds at least one article, and a family row is pending until its page exists; `src/lib/route-core.ts` builds `'/insights/topic/[topic]/'` from `desks.ts`; `RouteOwner` gains WP-60 to WP-99; `src/components/insights/related.ts` derives its title maps and resolves the `related` frontmatter fail-closed. Replace the exact-count assertions (99, 95, 23, 18, five playbooks, four guides) and the per-desk slug lists in `wp-04`, `wp-05`, `wp-06` and `wp-08` with the invariants of contracts section 1.
4. **Schema.** `src/content.config.ts`: the `topic` enum takes the 14 desk ids; insights gain optional `segments` and `related` (contracts section 2); a `briefs` collection (contracts section 5, audience enum with `corporate`); the `portfolio` schema (contracts section 7); an optional `cta` field on insights, guides, playbooks, pages and library; the family frontmatter on `pages` (contracts section 8.2). The glossary and FAQ YAML shapes (contracts section 8.4) are validated by `tests/unit/wp-60/reference-data.test.ts`, which accepts the 18 existing FAQ entries and the existing glossary terms unchanged.
5. **Desk pages.** The desk route is generated from `desks.ts`; each desk's optional intro page `src/content/pages/insights/topic-<id>.mdx` is written by the desk's own package (WP-60 owns no `topic-*` file). Desk pages for the four existing desks stay as they are.
6. **Tests that carry the library.** `tests/unit/wp-60/article-rubric.test.ts` over every file in `src/content/insights/**` (contracts section 2: desk folder equals `topic`, unique slug, 1,200 to 1,800 words, the required H2, at least three internal links to live routes, no `cover`, sources rule, `segments` values from the registry, `related` values as slugs); `tests/unit/wp-60/sources-ledger.test.ts` (contracts section 9, including the host allowlist kept in the test, applied to every `.astro-magazine/sources/wp-*.json`); `tests/unit/wp-60/families.test.ts` (every registry slug has a unique path, known layout and owner; every page file in a family folder has a registry entry; an entry with no page is pending, never an error; each family page's frontmatter validates); `tests/unit/wp-60/existing-articles.test.ts`, which pins the sha256 of the 18 articles that exist today so that an article package that owns a whole desk folder cannot edit a published article by accident (a deliberate correction needs an orchestrator-approved handoff note and an `exceptions` entry, never a silent edit).
7. **Claims.** Register in `src/data/claims.ts` the next free claim ids that WP-62 to WP-65, WP-72 and WP-73 cite: investors may ask to meet the companies WE incubates and WE cannot promise a meeting or funding; an organization that helps or equips founders may send WE an enquiry and sending one creates no partnership; WE sends a requested brief by email to the address given; WE uses form details to answer the request as the privacy notice describes; WE is a digital incubator for SaaS with dedicated offshore team seats steered by WE, fully remote, and WE makes no promise of funding (re-using the existing ids where they exist). Each is traceable to the CEO direction and D-21. Add `W8-C13-own-peers` (first-person "our cohort", "WE mentors" and the like, no marker allowed) to `claims-denylist.json`. Each new rule is checked against the current build first and starts green; the self-test has a positive and a negative case for each.

**Checkpoint 60b: forms, CTA skeleton, nav, audit, CI, absorbed WP-50 scope**
8. **Forms contract v2.** `docs/forms-contract.md` rewritten as v2; `docs/forms-contract.schema.json` and `tests/unit/wp-60/forms-schema.test.ts` (fails on drift, `UPDATE_SCHEMA=1` regenerates); `src/data/forms.ts` (`validate(kind, values)` mirroring the required matrix, `planForm` for the three new kinds, `FORM_ROUTES` extended with the ten squeeze routes `/briefs/<id>/` of contracts section 5, plus `/investors/interest/` and `/network/partners/enquire/`, so WP-63, 64, 65, 79 and 80 never edit the frozen file); `src/scripts/forms.ts` (`requestId` from `crypto.randomUUID()`, `audience`, the new fields, field-level 422 mapping); three components, `BriefRequestForm`, `InvestorInterestForm` and `PartnerEnquiryForm`, with their fixed consent and disclaimer text; the audience select on the contact form (four audiences, contracts section 3); `flags.briefUpdates` added OFF; the `e2e:forms` mocked-endpoint spec extended to all kinds.
9. **CTA skeleton.** `src/data/cta/index.ts` (types, the default map per page family of contracts section 6.2, `resolveCta`, a pure liveness predicate over the ledger and a plain page listing); `CtaBand`, `CtaAside` and `AudienceStrip` components with `src/components/cta/cta.css` (tokens only); `cta-end` and `cta-mid` slots wired in every layout, additively; `src/lib/rehype-mid-cta.ts` registered next to `tableWrapPlugin` in `astro.config.mjs`. If the Sätteri context offers no insert operation, fall back to a marker element the layout fills, and record the finding.
10. **Navigation.** The audience lens in `src/data/nav.ts` (For startups, For investors, For partners, For corporate teams), "Partners" replacing "Partners and perks", a Briefs entry, entries for Industries, Compare and the journey pages in their panels, a Topics column from `desks.ts`; `src/components/layout/**` and `src/components/nav/panels.ts` render it; the nav snapshot fixture is updated. Existing items are not removed or reordered. Links to pages that do not exist yet stay hidden (route-state).
11. **Ledger rows.** Pre-register as `launch: true` every route in contracts section 1 (inert until a page exists; family, desk and brief rows derive from the registries); the `/network/partners/` row loses `requires: ['companies']` and gains its own source (D-21). The form-route tests ignore a `FORM_ROUTES` entry whose row is `launch: false`, so a cut brief needs no edit to that frozen list (WP-60 adjusts the tests if they do not already). WP-60 does not add or re-own any WP-11 route (`tests/unit/wp-11/network.test.ts` pins the exactly four it owns).
12. **Gated-brief audit and CI.** `scripts/audit-gated-briefs.mjs` and `scripts/lib/gated-briefs.mjs` (contracts section 5, with `--self-test` and Pagefind gunzip); `scripts/audit-claims.mjs --source` for text that never reaches `dist`; CI jobs `audit:gated` and `e2e:wave8` (`E2E_WAVE8`) and an `include: local` of `infra/intake/ci.yml` guarded by `rules: exists`; Playwright projects `wave8-desktop-1440x900` and `wave8-mobile-390x844`. Confirm no wp/30 merge request is open before touching `.gitlab-ci.yml` (W8-11).
13. **Denylist for the comparison page (DP-W8-15).** After proving the unchanged build clean and measuring how the audit treats an `href` that contains a blocked word, add `allowPaths` entries for `/compare/incubator-vs-accelerator/` and its Markdown twin to `C-13-peers` and record them in the handoff and the counsel queue. Give the registry entry the label "Incubators and other startup programs" and `blockedWord`, so every generated list renders it from the label (contracts section 8.1; a unit test asserts no generated list carries the word). If the audit flags the slug in an `href` or in `sitemap.xml` (Q-7), rename the slug to `incubator-vs-other-programs` in the registry before any page exists and record the change; the `allowPaths` list does not grow.
14. **Absorbed WP-50 scope (#39).** `lighthouserc.json` entries for the new pages that exist (WP-99 completes the rest); narrow `RELEASE_ALLOW` per contracts section 10; flip WP-48's four rows (`/about/frameworks/ubf/`, `/star/`, `/shift/`, `/android/`) to `launch: false` with a reason (WP-48 stays deferred, #37); fold the `WebApplication` JSON-LD contract into `docs/`; write `docs/wave7-handoff.md`; fix the `src/styles/motion.css` shorthand risk WP-45 flagged.
15. **Legacy tests.** Split `wp-11` and `wp-18` page-specific blocks verbatim into `tests/unit/wp-64/legacy-investors-page.test.ts` and `tests/unit/wp-62/legacy-founders-page.test.ts` (seed files; test count before and after equal); update `wp-03`, `wp-19` and `wp-43` for the forms v2 field lists and the apply pages.

**Write set** (70 patterns, pools P0b): `package.json`, `package-lock.json`, `astro.config.mjs`, `src/content.config.ts`, `src/data/routes.ts`, `src/data/nav.ts`, `src/data/claims.ts`, `src/data/flags.ts`, `src/data/desks.ts`, `src/data/families.ts`, `src/data/forms.ts`, `src/data/cta/**`, `claims-denylist.json`, `.astro-magazine/ownership.json`, `.astro-magazine/decisions.md`, `.astro-magazine/plans/**`, `.gitlab-ci.yml`, `playwright.config.ts`, `lighthouserc.json`, `scripts/check-ownership.mjs`, `scripts/audit-claims.mjs`, `scripts/audit-route-ledger.mjs`, `scripts/run-lighthouse.mjs`, `scripts/audit-gated-briefs.mjs`, `scripts/lib/audit-dist.mjs`, `scripts/lib/export-ledger.mjs`, `scripts/lib/ledger.mjs`, `scripts/lib/gated-briefs.mjs`, `src/lib/route-core.ts`, `src/lib/route-state.ts`, `src/lib/content-files.ts`, `src/lib/rehype-mid-cta.ts`, `src/components/insights/**`, `src/components/forms/**`, `src/scripts/forms.ts`, `src/components/cta/**`, `src/components/nav/panels.ts`, `src/layouts/**`, `src/components/layout/**`, `src/styles/motion.css`, `src/pages/insights/**`, `src/pages/apply/**`, `src/pages/contact/**`, `src/content/pages/apply/**`, `src/content/pages/contact/**`, `docs/forms-contract.md`, `docs/forms-contract.schema.json`, `docs/wave8-contracts.md`, `docs/wave7-handoff.md`, `docs/wave7-contracts.md`, `tests/unit/foundation/**`, `tests/unit/wp-03/**`, `tests/unit/wp-04/**`, `tests/unit/wp-05/**`, `tests/unit/wp-06/**`, `tests/unit/wp-08/**`, `tests/unit/wp-11/**`, `tests/unit/wp-18/**`, `tests/unit/wp-19/**`, `tests/unit/wp-40/**`, `tests/unit/wp-43/**`, `tests/unit/wp-60/**`, `tests/e2e/*.spec.ts`, `tests/e2e/support/**`, `tests/e2e/wave7/wp-43/**`, `tests/e2e/wave8/wp-60/**`, `.astro-magazine/handoffs/wp-60*`, `.astro-magazine/sources/wp-60.json`, `tests/unit/wp-62/legacy-founders-page.test.ts`, `tests/unit/wp-64/legacy-investors-page.test.ts`.

**Registered frozen-file exceptions (14, one entry each in the same commit as the edit):** `package.json`, `package-lock.json`, `astro.config.mjs`, `src/content.config.ts`, `src/data/routes.ts`, `src/data/nav.ts`, `src/data/claims.ts`, `src/data/flags.ts`, `claims-denylist.json`, `.astro-magazine/ownership.json`, `.astro-magazine/decisions.md`, `tests/unit/foundation/**`, `src/lib/route-core.ts`, `src/lib/route-state.ts`.

**Serialize with the release lane (W8-11, confirm no wp/30 merge request is open):** `.gitlab-ci.yml`.

**Acceptance criteria**
- `npm run check`, `test:unit`, `check:ownership`, the full qa set and `verify:static` green on both merge requests, with every new row inert (a launched row with no page is a warning, not an error, off the release gate).
- No exact-count test remains. Adding a valid file under `src/content/insights/<desk>/` produces exactly one ledger row with no edit to a frozen file (a unit test with a fabricated content directory proves it); adding a family page whose slug is in the registry makes its row live; a family page with no registry entry fails the families test. Removing the file removes the row.
- The wave 8 write-set test passes, and an injected conflict in each lane fails it. Ownership has teeth: a scratch branch per registered assignment that touches one file per glob of its own set passes `check:ownership`; touching another package's file, a wave 8 frozen file with no exception, or a frozen file with no exception each fail.
- The push-slot self-test passes in CI (four pushes through two slots never overlap more than two) and the handoff records the observed pipeline durations.
- The forms schema test passes and fails on drift; `validate` accepts and rejects exactly what the required matrix says; the mocked-endpoint e2e covers all six kinds, the honeypot, a 422 mapped to fields, a 429, the no-JavaScript fallback and the rule that `mailto` applies to `contact` and `apply` only.
- The mid-body plugin and `CtaBand` render the same label and href for the same model (unit); a dead target is dropped from both; a layout excluded by D-24 renders no band; every row of the default map of contracts section 6.2 resolves to a model or to null by the stated rule.
- `audit-gated-briefs --self-test` finds every planted sentinel (HTML page, `.md` twin, `llms-full.txt`, gzip fragment); the real audit is inert when no brief exists and requires `pagefind/pagefind-entry.json` when one does.
- The nav snapshot is updated; a unit test proves every lens, Partners, Industries, Compare and journey link resolves to a launched route or is hidden; "Partners and perks" no longer appears.
- `RELEASE_ALLOW` equals the contracts section 10 value; `verify:release` passes on `demo`; `verify:release` with an empty value reports only the disabled form routes and the pending wave 8 pages.
- The claims audit on the unchanged build reports zero hits with every new rule; each new rule has a positive and a negative self-test case.
- The legacy test split leaves the test count unchanged and every moved test green.
- `docs/wave8-contracts.md` exists and is linked from every wave 8 issue; the handoff records the entry actions, the Sätteri finding, the denylist finding (Q-7) and the list of operator inputs.

**Dependencies.** WP-41, WP-46 and WP-49 merged or closed. Everything else depends on WP-60 (60a for WP-61, WP-71 and the article packages; 60b for WP-62 to WP-65 and the rest of R2).

---

### WP-61 Intake service (stage 0b, P0, RICE 3.0, 6 sessions)

**Why.** The CEO asked for intake into D365 "like our other websites do". The browser contract is finished and the endpoint does not exist (B-2). This package builds the service as code that is correct, tested with fakes, inert until the operator provisions it, and documented well enough that provisioning is a checklist.

**Scope**
1. **The Function** (`infra/intake/src/**`, TypeScript, Node 24, Flex Consumption). Routes: `POST /api/intake`, `GET|POST /api/unsubscribe`, `GET /api/health`; timers for the retry sweep and (behind `NURTURE_ENABLED`) the follow-up. Pure logic (validation, rate limiting, idempotency, mapping, rendering) lives in `infra/intake/src/logic/**` and imports nothing outside `node:` builtins, so the root `test:unit` can run it; Azure SDK code lives in `infra/intake/src/azure/**` and is tested with fakes by `intake:test`.
2. **The WE contract** (contracts section 3.3): single-origin CORS and Origin check; per-kind rate limits, 5 per hour per client address and per email address, `429` with `Retry-After`; a non-empty `website` returns a silent `200`; JSON plus form-encoded with a `303` to the kind's thanks page and an allowlisted `redirect` field; idempotency on `requestId`; durable write first, then `202`; no cookies, no body logging, no PII in URLs (request id, kind, status and a hashed address only); security headers on every response (CSP `default-src 'none'`, `Referrer-Policy: no-referrer`, `nosniff`, `X-Frame-Options: DENY`, `Cache-Control: no-store`); field errors as `{ ok: false, errors: { field: message } }` with `400` or `422`. The server loads `docs/forms-contract.schema.json`, so browser and server cannot drift. The audience rule: a request's `audience` must be allowed for its kind and, for a brief request, for that brief's registry entry (a brief whose abstract says `audience: [investor]` refuses a `startup` request with a `422` on `audience`).
3. **Dataverse** (`infra/intake/dataverse/**`, as code, applied only by the designated workflow): a WE business unit and owner team, an Account upsert (normalized email domain for non-consumer domains, a person-level Account otherwise), the `we_engagement` table with the `we_requestid` alternate key and the columns in contracts section 4 (including a four-valued `we_audience`), a least-privilege role and application user for the managed identity. Contact upsert by email under a lease lock; an ambiguous match keeps the engagement row and sets a review status rather than creating a duplicate.
4. **Brief delivery and rendering** (`infra/intake/render/**`): a job that renders `infra/intake/briefs/<id>.md` for all ten briefs to HTML and PDF (in the Playwright image the e2e jobs already use, with no new dependency in the root `package.json`), publishes private blobs `briefs/<id>/v<version>/` and a `briefs.json` registry (id, version, title, audience list); the Function mints a 48-hour read-only user-delegation SAS and sends the ACS email with a scanner-safe unsubscribe (the link opens a confirmation page and unsubscribes only on the page's POST); the unsubscribe token is stored encrypted; suppression is honored before every send. The renderer does not fail when only some of the ten briefs exist yet (briefs land from three packages); it fails when a brief's front matter is invalid.
5. **IaC** (`infra/intake/iac/**`): Bicep for the Function app, storage, ACS Email service, user-assigned managed identity and Key Vault role (mirroring the globalenterprise templates), and a Terraform change for the shared Front Door profile (custom domain `intake.worldenterprise.org`, origin, routes `/api/intake`, `/api/unsubscribe`, `/api/health`, no caching, a rate-limit rule) prepared as a merge request to `FocusApiary/infrastructure`, never applied by hand. The direct `azurewebsites.net` origin answers 403; only the Front Door (service tag and `x-azure-fdid` header) reaches the app.
6. **CI** (`infra/intake/ci.yml`, included by WP-60): `intake:test`, `intake:render`, and `intake:deploy`, which runs on `demo` only, manually, only when the operator variables exist, refuses a what-if that deletes resources, and asserts the origin returns 403 and the public `/api/health` reports configured with the security headers. Without the variables the pipeline is green and the job is absent.
7. **Privacy facts** (`docs/forms-privacy-facts.md`, `src/content/pages/legal/privacy.md`): name every field the six forms collect, the CRM use, the emailed link, and keep "sets no cookies" and "no analytics". No numeric retention period until the operator supplies one (OP-RETAIN); the `wp-10` pins are updated by this package only for those facts.
8. **Runbook** (`docs/intake-runbook.md`): the provisioning checklist with every operator input and its owner, the health check, rollback, and Key Vault secret names (`worldenterprise-intake-unsubscribe-key`, `worldenterprise-intake-hmac-secret`, and `worldenterprise-intake-acs-endpoint` only if IaC does not inject it; names only, never values).

**Write set** (17 patterns, pools P0b, P1): `infra/intake/src/**`, `infra/intake/iac/**`, `infra/intake/dataverse/**`, `infra/intake/render/**`, `infra/intake/tests/**`, `infra/intake/ci.yml`, `infra/intake/package.json`, `infra/intake/package-lock.json`, `infra/intake/tsconfig*.json`, `infra/intake/README.md`, `docs/intake-runbook.md`, `docs/forms-privacy-facts.md`, `src/content/pages/legal/privacy.md`, `tests/unit/wp-10/**`, `tests/unit/wp-61/**`, `.astro-magazine/handoffs/wp-61*`, `.astro-magazine/sources/wp-61.json`.

**Acceptance criteria**
- A contract test per row of the required matrix, valid and invalid, against the committed schema JSON; wrong `audience` for a kind, or for a brief, gives a `422` on `audience`.
- Honeypot returns `200` and writes nothing; a repeated `requestId` returns the original outcome and sends no second email; the sixth request in an hour from one address, and the sixth for one email, return `429` with `Retry-After` (fake clock); a disallowed Origin is refused; a body over the cap is refused; a form-encoded post returns `303` to the right thanks page and ignores a `redirect` that is not on the allowlist.
- Durable write first: with a failing mail sender the request still returns `202` and the row is `delivery-failed`; with a failing Dataverse write the Function returns `503` and keeps nothing it must not.
- The unsubscribe link does nothing on GET and unsubscribes on POST; suppression blocks a later send; `NURTURE_ENABLED=false` sends nothing from the timer.
- A log-capture test shows no request body, email address, token or SAS in any log line.
- The renderer renders a fixture brief set of one, three and ten briefs to HTML and PDF without error and rejects a brief with a missing sentinel or an `audience` outside the enum.
- The IaC compiles in `intake:test`; the what-if gate script is unit-tested on a deleting fixture; a repository scan finds no secret value, only the three names above.
- `tests/unit/wp-10/**` green with the updated privacy facts; the notice still has no numeric retention period and still says it sets no cookies.
- Without operator variables, the pipeline on `demo` is green and `intake:deploy` does not appear.
- The runbook lists OP-AZURE, OP-FD, OP-DV, OP-MAIL and OP-RETAIN, each with what is needed and who provides it.

**Dependencies.** Starts after 60a (ownership, contracts, `briefs` collection schema). Merges after 60b (the forms schema JSON). Provisioning is outside the repo (section 7); WP-61 never creates a cloud resource, a Dataverse object or a DNS record.

---

### WP-71 Brand system and page-family templates (stage 0b, P0 enabler, RICE 2.5, 5 sessions)

**Why.** Eight new page families need templates before their content can appear, and the CEO asked for full branding and consistency across a much larger site. One owner builds the templates, the vector compositions and the audit, so that the four family content packages (WP-72 to WP-75) author only content, and the brand is applied once rather than interpreted nine ways.

**Scope**
1. **Family route files.** `src/pages/founders/[segment].astro` (static paths from the registry, only for slugs whose `pages` entry exists), `src/pages/industries/index.astro` and `[vertical].astro`, `src/pages/compare/index.astro` and `[pair].astro`, `src/pages/journey/index.astro` and `[page].astro`, `src/pages/about/brand-story/index.astro`, and the `/press/` pages. Existing layouts are reused (`MarketingLayout`, `HubLayout`); no layout is created or edited, so the family structure lives in components inside the page.
2. **Family components** (`src/components/families/**`): `SegmentPage` (who this is for, what is hard at this stage, the articles for this segment taken from the `segments` field, one path to apply), `IndustryPage` (considerations for building SaaS in the vertical, with the standing "no claimed clients" statement), `ComparePage` (two columns, "where each fits", a sourced definitions block; neutral by construction: both columns take the same fields), `JourneyList` and `JourneyStep` (an ordered sequence, no durations), `FamilyHub` and `FamilyCard` (a grid of registry entries; the shared `Card` is a photography-lane file and is not used).
3. **Brand system** (`src/components/brand/**`): lockup usage, section dividers, step markers, callouts, badges, all from tokens; the dark-band rule (D-8: no logo on a dark band) enforced in the components. No new global stylesheet and no edit to the shared ones (W8-22).
4. **Vector compositions** (`src/assets/brand/**` and `src/components/brand/Compositions.astro`): one composition per family hero (segments, industries, compare, journey, investors, partners, briefs hub, resources hub), as inline SVG or AVIF at the exact display size (W7-9: shipped imagery, not photography), colored by tokens, with a text alternative or `aria-hidden` when decorative. No people, no logos, no depiction of a real product, no chart with numbers (a drawn chart could read as a result).
5. **Open Graph per family.** Each family page passes an existing `ogSlot` (mapping kept in `src/components/families/og.ts`); WP-71 does not edit the lane's `OgMap.ts`. The handoff files the lane request OP-OG: the card list a dedicated set would need and the lane paths that would change.
6. **Brand story and press.** `/about/brand-story/` (`src/content/pages/about/brand-story.mdx`): what WE is and how the brand speaks (voice, the words WE uses and avoids), drawn only from the ORBITAL description, the manifesto and editorial policy pages and the decisions; no invented history, no dates, no names. The `/press/` pages (`src/pages/press/**`, `src/content/pages/press/**`) gain a link to the brand kit when it is live. The brand kit page (`/press/brand-kit/`: logo usage, colors from the tokens, type, clear space, do and do not) is built behind its existing `launch: false` row (reason: needs the brand-owner usage sign-off, OP-BRAND), so it is absent from the sitemap and nav until sign-off; a small copy-to-clipboard island (`src/components/islands/we-brand-copy/**`, `src/scripts/brand-copy.ts`) is progressive enhancement and stores nothing.
7. **Brand consistency audit** (`tests/unit/wp-71/brand-audit.test.ts`, `tests/e2e/wave8/wp-71/brand-audit.spec.ts`): static checks that every stylesheet in the family, brand, journey, segment, industry, compare, investor, partner, briefs, cta and tools component folders uses tokens and no hard-coded color; rendered checks over a sample page of every family, existing and new (one `h1`, heading order, one lockup in the header, no logo on a dark band, section spacing from the token scale, buttons from the shared `Button`, a visible focus ring). The audit reports findings in files it does not own in `.astro-magazine/handoffs/wp-71-brand-audit.md`, each routed to the owning package while it is running or to WP-99 (links and navigation text only); WP-99 re-runs the audit on the final build.

**Write set** (17 patterns, pools P0b, P1): `src/assets/brand/**`, `src/components/brand/**`, `src/components/families/**`, `src/pages/founders/[segment].astro`, `src/pages/industries/**`, `src/pages/compare/**`, `src/pages/journey/**`, `src/pages/about/brand-story/**`, `src/content/pages/about/brand-story.mdx`, `src/pages/press/**`, `src/content/pages/press/**`, `src/components/islands/we-brand-copy/**`, `src/scripts/brand-copy.ts`, `tests/unit/wp-71/**`, `tests/e2e/wave8/wp-71/**`, `.astro-magazine/handoffs/wp-71*`, `.astro-magazine/sources/wp-71.json`.

**Acceptance criteria**
- The templates render a fixture page for every registry slug (unit, from a fabricated content set) and a registry slug with no `pages` entry produces no route (inert); the real pages are covered by the e2e once WP-72 to WP-75 merge.
- Every composition is inline SVG or AVIF at its display size, at most 12 KB, with an accessible name or `aria-hidden`, and contains no person, logo, product depiction or numeric chart (unit scan of the files plus a review note in the handoff).
- The brand audit reports zero findings in WP-71's own files; findings elsewhere are listed with an owner; the audit self-tests with a planted hard-coded color and a planted second lockup.
- Lighthouse 1.0 and axe zero on one sample page per family and on `/about/brand-story/`; `/press/brand-kit/` stays `launch: false` and is absent from the sitemap, nav and `llms.txt`.
- Layout and shared component files are byte-identical to `demo` (`check:ownership`, `wp-45` pinned props); all new component props are additive.
- The `wp-10` truth tests (a directory-wide scan that reads the about and press folders) are green with the new copy; the sentence ledger maps every sentence of the brand story, press and brand kit pages.
- The OP-OG request is in the handoff.

**Dependencies.** Starts after 60a (registry, schema, frontmatter contract). Merges after 60b (layout slots). WP-72 to WP-75 merge after it. Reads the existing logo and tokens; edits no photography-lane file.

---


### 5.2 The article program: 104 new articles in 14 desks (WP-66, 67, 68, 69, 81, 82, 83, 84, 85, 88, 89)

The library grows from 18 articles to about 122, spread over audiences (the `starting` and `pathways` desks and the `segments` field), topics (funding, legal, team, AI, product, go-to-market, operations) and business models and sectors. Eleven packages author the 104 new articles. Each package owns whole desk folders, its own desk page, its own handoff and its own sources ledger, so there is no overlap, and none touches a frozen file (WP-60 has registered the desks, the schema, the ledger and the tests). All eleven apply the same rules, which the unit tests of WP-60 enforce.

**Shared rules for every article package**

- **Marks.** A title marked A is in the first eight of its package and is never cut (4.6, item 6). A title marked B is after the eighth (16 in all: WP-66 two, WP-67 three, WP-68 one, WP-69 one, WP-81 two, WP-82 one, WP-83 two, WP-84 two, WP-85 two) and is cut first within the article program (4.6, item 2). WP-88 and WP-89 have eight titles and no B, but the whole of both is the first cut (4.6, item 1). A package merges when its A set is complete; B titles ride in the same push when ready or follow in a second merge request.
- **Rubric** (contracts section 2, enforced by `tests/unit/wp-60/article-rubric.test.ts`): file `src/content/insights/<desk>/<slug>.mdx` (`.md` when no component is needed); the desk folder equal to the front matter `topic`; the slug unique across desks; 1,200 to 1,800 words; the existing insights schema (`title`, `description` of 50 to 160 characters, `topic`, `publishedDate`, `sources` of at least two real sources or `noStatistics: true`, `evidence`, `claimsUsed`, `draft: false`; `relatedPlaybook`, `relatedTemplate` and `relatedServices` only when the route is live); optional `segments` (registry slugs of the founder segments the article serves, usually one to three) and `related` (slugs of other articles, dropped at build when not live); the required H2 "What this article cannot tell you" (jurisdiction, date, company size, what the sources do not cover); at least three internal links in the body to routes that exist at merge (an article in the same desk, a playbook, a template, a guide, a tool or the glossary); no `cover`; a statistic needs a source on the page and a regulatory or legal statement needs a primary source (statute, agency or standards-body page).
- **Source rule** (W8-9). Every statistic, date, threshold, legal rule and quotation was fetched in the session and is recorded in `.astro-magazine/sources/wp-NN.json` with URL, fetch time, HTTP status and the quoted passage. Primary sources first (statutes, agency pages, standards bodies, vendor documentation); allowlisted hosts only (WP-60 defines the list; OP-HOSTS extends it). A source that cannot be fetched is dropped and the sentence with it. No statistic without a quote in the ledger; no "studies show". About three fetches per article is the planning figure (about 300 in all), so each package budgets its fetch time (risk R-9, section 6).
- **Voice.** Plain, specific, second person for the reader. WE speaks only of what the site already supports (the claims registry). No first-person "our cohort", "our mentors" or "our portfolio" (`W8-C13-own-peers`); no percentage of startups that fail or succeed unless sourced and quoted; no "perks", "accelerator", "cohort" or "mentor" and no "free" in a sentence about WE (W8-15; "free trial" and "freemium" may name a pricing model; the cohort-retention wording in retention articles carries the `C-13-peers` marker). Legal, tax and funding articles say what a document or instrument is and what to ask counsel; they never say what the reader should do. Each carries a dated "this is general information, not legal or financial advice" line where the reader needs it and a pointer to a qualified professional. No outcome or time promises (`C-16-time-to-mvp`).
- **Neutrality.** A named product appears only where a source names it, only to describe how a thing works, never as a recommendation or a price comparison; vendor claims are attributed to the vendor. No article says WE uses, endorses or partners with a named product.
- **Audience.** Articles teach the reader, not WE's offer. An article may end in one honest pointer to a WE page that exists (the CTA system adds the band; the author adds no CTA wording). An article that touches a segment's situation (student, second-career, corporate, global) says what the sources say and no more; it never states who is eligible for WE (OP-SEGMENTS).
- **Mechanics from the denylist.** A SAFE, convertible-note, valuation-cap, discount or pro-rata article is a `.mdx` with the `data-generic-definition` marker on the defining paragraph (contracts section 0.1). The literal phrase "success fee" is never written, even in a negation. Certification, audit-status and security-framework descriptions are described as frameworks, never as something WE holds (`C-15-*`).
- **Batch and push.** One local branch per package, committed as often as is useful, pushed once through the slot (4.2). A package of 8 to 11 articles goes up in one push, then at most two fix pushes. The package runs `npm run test:unit` locally where its worktree has dependencies (the rubric and ledger tests need no build) and never runs `astro build`.
- **Handoff and ledger.** `.astro-magazine/handoffs/wp-NN.md` holds a table of title, slug, mark, desk, word count, source count, claims-audit result and any substitution with its reason. `.astro-magazine/sources/wp-NN.json` is the claim ledger, one entry per source. One file per package, so no two packages write the same file.
- **Substitution.** Titles are provisional. A title may be replaced by another title of the same desk and mark when it cannot be sourced to the standard above; the replacement is recorded in the handoff. A package may not drop a title without replacing it unless the orchestrator agrees, because the volume target is part of the CEO direction.
- **Desk page.** Each package writes `src/content/pages/insights/topic-<desk>.mdx` for every desk it owns, modeled on the existing four (a short introduction of at most 150 words and the reading order; the desk route lists the articles from the collection, so no list is hand-edited). Every desk sentence carries a claim id, an existing page and line, or a decision id.

Segment short names in the tables: first-time, technical, non-technical, solo, corporate (innovators), student, second-career, global (remote). The front matter uses the registry slugs of contracts section 8.1.

---

### WP-66 Funding and capital desk (stage 1A, R1, P1, RICE 1.7, 5 sessions)

**Why.** Money is the first thing a founder asks about and the topic with the highest cost of error, so this desk gets the strictest source rule. It introduces the instruments and the routes to capital in plain language and tells the reader what to ask counsel; it never recommends.

| Mark | Title (provisional) | Segments | Sources and traps |
|---|---|---|---|
| A | Funding a software startup: the routes and what each asks of you | first-time, solo | Overview; links to every other title. Agency and standards pages for definitions; no amounts, no percentages |
| A | SAFE or convertible note: how the two instruments differ | first-time, technical | `.mdx`, `data-generic-definition`. Primary: the instrument publishers' own documents. Links to the existing guide "SAFEs in plain language" |
| A | Reading a term sheet, line by line | first-time | Primary: a published model term sheet. Says what each clause does, never what to accept |
| A | Grants and SBIR programs for software companies | technical, student | Primary: the program agencies' pages. Says "does not require giving up shares"; never "non-dilutive" (`W7-C09`); never says a program funds WE companies |
| A | Angels, micro-funds and funds: how each one decides | first-time, non-technical | Primary: securities regulator investor-education pages. No named investor, no amounts. Cross-link to the existing "Choosing the right first investors" article |
| A | Runway and burn: the arithmetic | solo, non-technical | `noStatistics: true`. A worked formula with an invented, labelled round number; the runway calculator (WP-76) is linked only if live |
| A | Cap table basics for founders | first-time | `.mdx`, `data-generic-definition`. Primary: model documents and regulator glossaries. No percentages as advice |
| A | Revenue-based financing and venture debt: when they apply | technical, solo | Primary: lender and regulator pages. Names no lender; says what the product is and what to ask |
| B | Crowdfunding and Regulation CF for a software company | solo, global | Primary: the securities regulator's pages and rules; jurisdiction scoped in the "cannot tell you" section |
| B | Funding a first SaaS from customer revenue | solo, technical | `noStatistics: true`. Describes prepayment and annual billing mechanics; no figure |

**Write set** (4 patterns, pools P0b, P1): `src/content/insights/funding/**`, `src/content/pages/insights/topic-funding.mdx`, `.astro-magazine/handoffs/wp-66*`, `.astro-magazine/sources/wp-66.json`.

**Acceptance criteria**
- The rubric and sources-ledger tests of WP-60 are green for every file; the claims audit reports zero hits; no sentence uses a banned term; every date and threshold in a legal, tax or regulatory statement has a ledger quote from a primary source fetched with status 200.
- The two mechanics articles carry the `data-generic-definition` marker where the denylist requires it and the claims audit confirms it; the grants article contains neither "non-dilutive" nor any statement that a program funds WE companies; no article names a law firm, bank, investor or platform as a recommendation.
- No article gives an amount, a percentage or a range that is not in its sources.
- Every article's three internal links resolve (`audit:links`); the Markdown twin and `llms-full.txt` build without a new warning; Lighthouse 1.0 and axe zero on one sampled article and on `/insights/topic/funding/`.
- A marks complete (8 of 10); B (2) in the handoff with status; `topic-funding.mdx` present.

**Dependencies.** Starts after 60a. None on WP-61 to WP-65. The `related` field names the existing "SAFEs in plain language" guide's neighbors through slugs that are live at build.

---

### WP-67 Legal and company basics, and fundability (stage 1A, R1, P1, RICE 1.4, 6 sessions)

**Why.** Entity, equity, privacy and contracts are the second question a founder asks, and the fundability desk turns the existing diligence articles into a usable path. These are the articles most likely to be read as advice, so the voice rule is strictest here.

| Mark | Title (provisional) | Desk | Segments | Sources and traps |
|---|---|---|---|---|
| A | Choosing an entity: LLC or C corporation | legal | first-time, solo | Primary: tax agency and state-formation pages. No "PBC" (`C-18-pbc`); US scope in the "cannot tell you" section |
| A | Founder equity splits and vesting | legal | first-time, technical, non-technical | `.mdx`, `data-generic-definition` on defining paragraphs. Describes mechanics; gives no recommended split |
| A | The 83(b) election and its deadline | legal | first-time | Primary: the tax agency's own pages; quotes the deadline text; says to ask a tax professional |
| A | Open-source licenses inside a commercial product | legal | technical | Primary: the license texts and the standards body's pages; names licenses as texts, not as advice |
| A | Privacy law basics for a small product | legal | global, technical | Primary: GDPR text and US state agency pages; jurisdiction scoped; no "compliant" claim |
| A | Terms of service and privacy policy: what each document is for | legal | non-technical, first-time | `noStatistics: true`; says what each document does, not what to put in it |
| A | Founder IP assignment and confidentiality agreements: what each document does | legal | corporate, technical | Primary: statute and agency pages; complements, not repeats, the existing "IP, contracts and access diligence" article |
| A | Ordering a pre-seed evidence pack | fundable | first-time, technical | Sources: the existing library templates and guides (internal) plus two external; no outcome claim; feeds the `pre-seed-evidence-pack` brief |
| B | Trademark name clearance before you commit | legal | first-time, solo | Primary: the trademark office's search and registration pages |
| B | Answering a security and privacy questionnaire | fundable | technical | Standards bodies' questionnaires described as formats; no certification claim (`C-15-*`) |
| B | Customer evidence and reference calls | fundable | first-time, non-technical | FTC endorsement guidance by primary source; no testimonials about WE |

**Write set** (6 patterns, pools P0b, P1): `src/content/insights/legal/**`, `src/content/insights/fundable/**`, `src/content/pages/insights/topic-legal.mdx`, `src/content/pages/insights/topic-fundable.mdx`, `.astro-magazine/handoffs/wp-67*`, `.astro-magazine/sources/wp-67.json`.

**Acceptance criteria**
- Same as WP-66 for 11 articles in two desks (`legal`, `fundable`; `topic-legal.mdx` and `topic-fundable.mdx` present), with the legal and tax sentences each quoted from a primary source.
- Each article says what a document is and what to ask counsel, and states no conclusion about any reader's situation; the dated "not legal advice" line is present where a reader would act on a deadline or an election.
- No article mentions "PBC", names a firm or a registered-agent service, or gives a tax rate or fee unless it is quoted from a primary source fetched in the session with its date.
- A marks complete (8 of 11); B (3) in the handoff with status.

**Dependencies.** Starts after 60a. The `fundable` desk already holds five articles that stay unchanged.

---

### WP-68 Team and hiring desk (stage 1A, R1, P1, RICE 1.2, 5 sessions)

**Why.** The first hire, the contractor question and the remote-team questions are where small teams make expensive mistakes, and WE's own model (dedicated offshore seats, fully remote) means readers will want a balanced account of hiring across borders.

| Mark | Title (provisional) | Segments | Sources and traps |
|---|---|---|---|
| A | Your first hire: what to settle before you write the job | first-time, solo | `noStatistics: true`; decision framework, no recommendation |
| A | Contractors and employees: the classification tests | first-time, global | Primary: labor and tax agency tests; states that classification depends on facts and jurisdiction; no conclusion about any reader |
| A | Writing a job description people can answer | non-technical | `noStatistics: true`; plain-language and inclusive wording guidance cited to a primary source if used |
| A | Structured interviews for a small team | technical, first-time | Primary: a public-sector or standards-body source on structured interviewing; no claim about predictive power unless quoted |
| A | Offer letters: what they should state | first-time | General information; at-will and jurisdiction scoped; no template that reads as advice |
| A | Hiring across borders: employees, contractors and employers of record | global, corporate | Primary: agency pages for one or two jurisdictions; names no provider; no statement about WE's own seats |
| A | Stock options for early employees: what an option is and what to ask | first-time, technical | `.mdx`, `data-generic-definition`; primary: tax agency pages; no valuation figure |
| A | Writing down how a remote team works: a team handbook | solo, global | `noStatistics: true`; complements the existing "operating rhythm for a remote offshore team" article (link it) |
| B | Onboarding a new team member: what to prepare before day one | first-time | `noStatistics: true`; avoids the literal "30/60/90" (DP-W8-16) |

**Write set** (4 patterns, pools P0b, P1): `src/content/insights/team/**`, `src/content/pages/insights/topic-team.mdx`, `.astro-magazine/handoffs/wp-68*`, `.astro-magazine/sources/wp-68.json`.

**Acceptance criteria**
- Same as WP-66 for 9 articles (`topic-team.mdx` present).
- The classification article gives the tests the sources give and says plainly that classification depends on facts and jurisdiction; the cross-border article names no provider and no country ranking.
- No article says or implies that WE guarantees an outcome, a hire or a candidate, or describes WE's seat model beyond what the program pages say.
- A marks complete (8 of 9); B (1) in the handoff.

**Dependencies.** Starts after 60a. None on others.

---

### WP-69 AI-native building desk (stage 1A, R1, P1, RICE 1.4, 5 sessions)

**Why.** WE is an AI-native incubator, so this desk is where credibility is most visible and where careless claims age fastest. Every statement is attributed to a standard or to vendor documentation, and every number is quoted with its date.

| Mark | Title (provisional) | Segments | Sources and traps |
|---|---|---|---|
| A | Choosing a model provider: the questions that matter | technical, non-technical | Vendor documentation, attributed; no ranking, price or latency figure unless quoted with date |
| A | Evaluating an LLM feature before you ship it | technical | Standards and vendor documentation; method, not benchmarks |
| A | Prompt injection and the OWASP Top 10 for LLM applications | technical | Primary: the OWASP project pages; describes the list, makes no WE security claim |
| A | AI features and customer data: what to decide first | non-technical, corporate | Primary: provider data-handling documentation and regulator guidance; scoped by date and jurisdiction |
| A | The NIST AI Risk Management Framework for a small team | technical, corporate | Primary: the framework document; never says WE follows or is certified to it (`C-15-*`) |
| A | Retrieval-augmented generation: what it is and where it breaks | technical | Primary: the original research and provider documentation; no performance figures without a quote |
| A | Metering and budgeting model usage | technical, solo | Provider documentation on billing units, attributed and dated; no price figure unless quoted |
| A | Human review in an AI feature: where to keep a person in the loop | non-technical, corporate | Standards-body guidance; `noStatistics: true` if no figures |
| B | AI regulation for a small SaaS company: what to ask counsel about the EU AI Act and state laws | global, corporate | Primary: the legal texts and agency pages; jurisdiction and date scoped; no compliance claim |

**Write set** (4 patterns, pools P0b, P1): `src/content/insights/ai/**`, `src/content/pages/insights/topic-ai.mdx`, `.astro-magazine/handoffs/wp-69*`, `.astro-magazine/sources/wp-69.json`.

**Acceptance criteria**
- Same as WP-66 for 9 articles (`topic-ai.mdx` present).
- Every article cites the standard or vendor documentation it describes; no benchmark number, model ranking, price or latency figure appears unless it is quoted from a source fetched in the session with its date; no article calls any model or vendor "best"; no sentence says WE builds, hosts or evaluates a particular model for a client.
- The NIST and OWASP articles describe the frameworks and state no conformance, audit or certification about WE (unit scan for `C-15-*` hits plus a review note).
- A marks complete (8 of 9); B (1) in the handoff.

**Dependencies.** Starts after 60a. None on others.

---

### WP-81 Go-to-market, pricing and sales desk (stage 1A, R1, P1, RICE 1.7, 5 sessions)

**Why.** Founders arrive with a product and need customers, which the existing grow and playbook content covers thinly. This desk gives a sourced path from positioning to the first sales call without promising any result.

| Mark | Title (provisional) | Segments | Sources and traps |
|---|---|---|---|
| A | A one-page positioning statement | non-technical, first-time | `noStatistics: true`; a method with an invented, labelled example |
| A | Choosing your first channels | first-time, solo | `noStatistics: true` unless a source is quoted; no channel ranking |
| A | Cold outreach that follows CAN-SPAM | first-time, non-technical | Primary: the statute and the FTC compliance guide, quoted; says to ask counsel for other jurisdictions |
| A | Founder-led sales calls: a structure | technical, solo | `noStatistics: true`; complements the existing "first ten customers" article (link it) |
| A | Pricing a first SaaS: value, packaging and the questions to ask | technical, first-time | Complements the existing "Pricing page fundamentals" article; no price or percentage as advice; never describes WE's own pricing |
| A | Trials, demos and self-serve: how a customer first meets the product | technical, solo | "Free trial" and "freemium" may name a pricing model, never WE's own terms (W8-15); mechanics only |
| A | Writing a landing page that says what the product does | non-technical | Accessibility and plain-language guidance cited to a primary source |
| A | Customer references and case studies without breaking FTC rules | first-time | Primary: FTC endorsement guidance, quoted; no statement about WE's own case studies or customers |
| B | Landing page tests you can read | technical | Statistics basics from a primary educational source; no uplift figure |
| B | Marketplaces and partner channels: when a listing helps | technical, global | Platform documentation, attributed; names no platform as a recommendation |

**Write set** (4 patterns, pools P0b, P1): `src/content/insights/gtm/**`, `src/content/pages/insights/topic-gtm.mdx`, `.astro-magazine/handoffs/wp-81*`, `.astro-magazine/sources/wp-81.json`.

**Acceptance criteria**
- Same as WP-66 for 10 articles (`topic-gtm.mdx` present). The cold-outreach and case-study articles cite the statute and the FTC guidance by primary source with quotes.
- No article promises a result, a conversion rate, a number of customers or a timeline (`C-16-time-to-mvp` and the stricter local list for urgency words).
- The pricing article describes pricing models in general and states nothing about WE's pricing, which stays unpublished (F-4).
- A marks complete (8 of 10); B (2) in the handoff.

**Dependencies.** Starts after 60a. None on others.

---

### WP-82 Build and product desk, with Dream (stage 1A, R1, P1, RICE 1.4, 5 sessions)

**Why.** The build desk has five articles and the dream desk four. This package adds the product-management layer and the engineering practices a first release needs, and three validation articles that were the missing half of the dream desk. It owns both desk folders.

| Mark | Title (provisional) | Desk | Segments | Sources and traps |
|---|---|---|---|---|
| A | Product management for a first SaaS: roles, backlog and decisions | build | non-technical, first-time | `noStatistics: true`; describes a practice and its limits |
| A | Writing a product requirements document people read | build | non-technical | `noStatistics: true`; a structure with an invented, labelled example |
| A | Shipping safely with feature flags and rollback | build | technical | Vendor and engineering documentation, attributed; no named product as a recommendation |
| A | Estimating a first release: ranges and what they hide | build | technical, solo | `noStatistics: true`; no duration promise (`C-16-time-to-mvp`) |
| A | A boring first technology stack | build | technical, non-technical | Documentation of the technologies named only as examples; no ranking |
| A | Mapping the alternatives a customer already uses | dream | first-time, non-technical | `noStatistics: true`; method |
| A | Fake-door and concierge tests | dream | first-time, solo | `noStatistics: true`; ethics and honesty note: a fake door must not take payment |
| A | Kill criteria: deciding in advance when to stop | dream | solo, first-time | `noStatistics: true`; no claim about failure rates |
| B | Observability for a small team: logs, metrics and alerts you will actually read | build | technical | Vendor and standards documentation, attributed |

**Write set** (6 patterns, pools P0b, P1): `src/content/insights/build/**`, `src/content/insights/dream/**`, `src/content/pages/insights/topic-build.mdx`, `src/content/pages/insights/topic-dream.mdx`, `.astro-magazine/handoffs/wp-82*`, `.astro-magazine/sources/wp-82.json`.

**Acceptance criteria**
- Same as WP-66 for 9 articles in two existing desks (`topic-build.mdx` and `topic-dream.mdx` exist today; this package edits them only to keep the introduction accurate, and the sentence ledger covers every changed sentence).
- No article names a product as a recommendation, claims a result, or states a duration; the product-management article describes a practice and says what the sources do not cover.
- A marks complete (8 of 9); B (1) in the handoff.

**Dependencies.** Starts after 60a. The five existing build and four existing dream articles stay unchanged.

---

### WP-83 Starting out desk (stage 1A, R1, P1, RICE 1.9, 5 sessions)

**Why.** This desk is where the breadth of the CEO's "wide demographic" lives in the library: a different article for each kind of founder, so the eight segment pages (WP-73) have real reading to point to. It states what the sources say about each situation; it states nothing about who WE accepts (OP-SEGMENTS).

| Mark | Title (provisional) | Segments | Sources and traps |
|---|---|---|---|
| A | What a first-time founder should settle first | first-time | `noStatistics: true`; a checklist of decisions, not a timeline |
| A | A technical founder's blind spots: selling, pricing and saying no | technical | `noStatistics: true` |
| A | A non-technical founder building SaaS: what to own and what to delegate | non-technical | `noStatistics: true`; names no agency; links the existing research brief on dedicated teams, agencies and freelancers |
| A | Solo founders: where a second pair of eyes comes from | solo | `noStatistics: true`; no advisor, cohort or mentor wording (`C-13-peers`) |
| A | Student founders: the questions to settle before you start | student | Primary: university policy pages and government agency pages on student work and IP, scoped; no visa or immigration advice |
| A | Second-career founders: turning domain knowledge into a SaaS idea | second-career | `noStatistics: true`; links the dream desk |
| A | Founders inside a company: intellectual property and employment agreements | corporate | Statute and agency pages for one jurisdiction; general information; says to ask counsel |
| A | Founding from outside the United States: what changes for a remote founder | global | Primary: agency pages (payments, entity, tax) for two or three jurisdictions, scoped; no country ranking |
| B | Choosing a co-founder, or deciding not to | first-time, solo | `noStatistics: true` unless a primary source is quoted |
| B | Part-time to full-time: deciding when to commit | second-career, student | `noStatistics: true`; no financial advice |

**Write set** (4 patterns, pools P0b, P1): `src/content/insights/starting/**`, `src/content/pages/insights/topic-starting.mdx`, `.astro-magazine/handoffs/wp-83*`, `.astro-magazine/sources/wp-83.json`.

**Acceptance criteria**
- Same as WP-66 for 10 articles (`topic-starting.mdx` present). Every article has a non-empty `segments` field and, together, the A articles tag every one of the eight registry segments at least once (unit test over the desk).
- No article states or implies who WE accepts, a requirement for applying, an acceptance rate, or any outcome for a kind of founder; no visa, immigration, tax or employment conclusion about a reader.
- A marks complete (8 of 10); B (2) in the handoff.

**Dependencies.** Starts after 60a. WP-73 lists these articles through the `segments` field, so nothing in WP-73 waits for them.

---

### WP-84 Pathways desk (stage 1A, R1, P1, RICE 1.4, 5 sessions)

**Why.** Founders arrive by different routes: an idea, a skill, a service business, an employer, an acquisition. And they reach capital by different routes. This desk maps the routes without ranking them, which is also the honest way to describe WE's place among them.

| Mark | Title (provisional) | Segments | Sources and traps |
|---|---|---|---|
| A | Three ways to start: an idea, a skill, a problem you have lived | first-time, second-career | `noStatistics: true` |
| A | Spinning a product out of an employer: what to settle first | corporate | General information; employment and IP scope by jurisdiction; sources primary where a statute is cited |
| A | From client work to a product: productizing a service business | second-career, technical | `noStatistics: true` unless a source is quoted |
| A | Acquiring a small software product instead of building one: what to check | non-technical, solo | Primary: securities and commerce agency pages where cited; no valuation multiple |
| A | Matching a funding route to a stage: a decision guide | first-time | Links the funding desk; no amount, no recommendation |
| A | Customers as capital: pilots, prepayment and design partners | technical, corporate | `noStatistics: true`; says what to write down before a pilot; no named customer |
| A | Joining as a founding team member: what to ask before you commit | second-career, global | General information; equity wording uses the generic-definition marker |
| A | From side project to company: the decision points | solo, student | `noStatistics: true` |
| B | Acquisitions, acqui-hires and wind-downs: the exits to recognize | first-time | Agency and statutory pages where cited; no outcome figure |
| B | Paying a first team before funding: the options and what each risks | solo, first-time | General information; no statement about WE's own seats |

**Write set** (4 patterns, pools P0b, P1): `src/content/insights/pathways/**`, `src/content/pages/insights/topic-pathways.mdx`, `.astro-magazine/handoffs/wp-84*`, `.astro-magazine/sources/wp-84.json`.

**Acceptance criteria**
- Same as WP-66 for 10 articles (`topic-pathways.mdx` present).
- No article ranks the routes or tells the reader which to take; no article names WE as a route unless the sentence already exists on a program page, in which case it links that page; no accelerator, cohort or mentor wording.
- A marks complete (8 of 10); B (2) in the handoff.

**Dependencies.** Starts after 60a. None on others.

---

### WP-85 Business models desk, with Grow (stage 1A, R1, P1, RICE 1.2, 5 sessions)

**Why.** The existing articles assume a B2B SaaS. A wider audience asks about marketplaces, platforms, developer products and pricing models, and WE builds SaaS, so the honest answer for a marketplace or a platform is to say what the model demands and what WE's seats can and cannot build.

| Mark | Title (provisional) | Desk | Segments | Sources and traps |
|---|---|---|---|---|
| A | B2B SaaS: how the model works and what it asks of a first company | models | first-time, technical | `noStatistics: true` unless quoted |
| A | Vertical SaaS: depth over breadth | models | second-career, corporate | `noStatistics: true`; links the industries hub once live (by `related`) |
| A | Marketplaces: the two-sided start-up problem | models | first-time, non-technical | Says plainly that WE builds SaaS, not marketplaces as a service; sources attributed |
| A | Platforms and ecosystems: when a product becomes a platform | models | technical, corporate | Platform documentation described, not recommended |
| A | Usage-based, seat-based and hybrid pricing models | models | technical, non-technical | `.mdx`, `data-generic-definition` for the pricing terms; says nothing about WE's pricing (F-4) |
| A | Product-led and sales-led growth: choosing between them | models | first-time, solo | `noStatistics: true`; no conversion benchmarks |
| A | Retention basics | grow | technical, first-time | `.mdx`; the word "cohort" carries the `C-13-peers` marker (contracts section 0.1); formulas only |
| A | API-first products and developer tools | models | technical | Documentation of public API style guides, attributed |
| B | Open-core and open-source businesses | models | technical | License texts and foundation pages; no outcome claim |
| B | Feedback loops that reach the product | grow | non-technical, first-time | `noStatistics: true`; complements the existing "Onboarding is acquisition" article |

**Write set** (6 patterns, pools P0b, P1): `src/content/insights/models/**`, `src/content/insights/grow/**`, `src/content/pages/insights/topic-models.mdx`, `src/content/pages/insights/topic-grow.mdx`, `.astro-magazine/handoffs/wp-85*`, `.astro-magazine/sources/wp-85.json`.

**Acceptance criteria**
- Same as WP-66 for 10 articles in two desks (`topic-models.mdx` present; `topic-grow.mdx` exists today and is edited only to keep the introduction accurate).
- The marketplace and platform articles state that WE builds SaaS and say nothing that implies WE builds or runs a marketplace for a client; the pricing-models article contains no statement about WE's pricing.
- The retention article passes the denylist: every use of "cohort" is inside the `C-13-peers` marker, confirmed by the claims audit.
- A marks complete (8 of 10); B (2) in the handoff.

**Dependencies.** Starts after 60a. None on others.

---

### WP-88 Sectors desk (stage 1D, R3, P2, RICE 0.3, 5 sessions; first to be cut)

**Why.** Some founders arrive with a sector in mind. These articles are "considerations for" a sector, written from primary sources. They are the first cut (4.6, item 1) because they serve a named audience only as considerations and carry the highest `C-15-*` risk.

| Mark | Title (provisional) | Segments | Sources and traps |
|---|---|---|---|
| A | Fintech SaaS: considerations before you build | corporate, technical | Primary: financial regulators' pages describing perimeters and licensing, scoped by jurisdiction; no "compliant", no named bank or partner |
| A | Healthtech SaaS: considerations before you build | corporate, technical | Primary: the health-privacy regulator's pages; no "HIPAA compliant" for any WE service (`C-15-*`) |
| A | Edtech SaaS: considerations before you build | second-career, technical | Primary: education and child-privacy regulator pages |
| A | Climate-tech software: considerations before you build | corporate, technical | Primary: reporting-standard bodies and agency pages; no impact claim |
| A | Government software: considerations for selling to the public sector | corporate | Primary: procurement agency pages; FedRAMP described as a program, never as something WE holds |
| A | HR and recruiting software: considerations before you build | corporate, technical | Primary: employment-agency guidance and the cited local rules |
| A | Legal software: considerations before you build | second-career, corporate | Primary: bar and regulator pages on unauthorized practice, scoped |
| A | Security software: considerations before you build | technical, corporate | Standards bodies' pages; frameworks described, no certification claim |

**Write set** (5 patterns, pools P1): `src/content/insights/sectors/**`, `src/content/pages/insights/topic-sectors.mdx`, `tests/e2e/wave8/wp-88/**`, `.astro-magazine/handoffs/wp-88*`, `.astro-magazine/sources/wp-88.json`.

**Acceptance criteria**
- Same as WP-66 for 8 articles (`topic-sectors.mdx` present).
- Every article says "considerations" in its title or first heading and contains no outcome claim, no claim of clients in the sector, no claim WE serves the sector, and no certification, accreditation or compliance statement about WE (unit scan of the denylist `C-15-*` and `C-13-*` families plus the claims audit).
- Regulator and standards pages are fetched in-session and quoted; the jurisdiction is in the first paragraph.
- Missing from the release only if cut by name in the WP-99 handoff.

**Dependencies.** Starts after 60a; scheduled in round 3 (4.1). Its desk route is pending until the first article exists, so the cut leaves no pending row.

---

### WP-89 Founder operations and wellbeing desk (stage 1D, R3, P2, RICE 0.5, 5 sessions; first to be cut)

**Why.** Running a company is more than product and sales. This desk covers books, tax calendars, tools, meetings and the person running the company, in general terms and without advice. Wellbeing content stays on what public health and workplace bodies publish.

| Mark | Title (provisional) | Segments | Sources and traps |
|---|---|---|---|
| A | A weekly operating rhythm for a founder | solo, first-time | `noStatistics: true`; complements the existing "founder time budget of a raise" article |
| A | Burnout: recognizing it and what to change | solo, first-time | Primary: a public health or workplace body's definition, quoted; not medical advice; points to a professional |
| A | Books and basic accounting for a software startup | non-technical, first-time | Primary: tax agency and standards pages; general information |
| A | The tax calendar a US software startup should know exists | first-time | Primary: the tax agency's calendar pages; scoped; no advice |
| A | Choosing and managing a small company's software stack | non-technical, solo | `noStatistics: true`; criteria, not products |
| A | Meetings, async work and decision records for a small team | technical, global | `noStatistics: true` |
| A | Insurance for a software startup: what exists and what to ask | first-time, corporate | Primary: regulator and trade-body pages; no provider named |
| A | Working through a disagreement with a co-founder | first-time | General information; a process, with a pointer to a qualified mediator; no outcome claim |

**Write set** (5 patterns, pools P1): `src/content/insights/ops/**`, `src/content/pages/insights/topic-ops.mdx`, `tests/e2e/wave8/wp-89/**`, `.astro-magazine/handoffs/wp-89*`, `.astro-magazine/sources/wp-89.json`.

**Acceptance criteria**
- Same as WP-66 for 8 articles (`topic-ops.mdx` present).
- No article gives medical, tax or legal advice; wellbeing sentences are quotes or attributed summaries of published guidance and point to a qualified professional; no article claims WE offers wellbeing support, coaching or mentoring.
- Missing from the release only if cut by name in the WP-99 handoff.

**Dependencies.** Starts after 60a; scheduled in round 3 (4.1).

---


### 5.3 Round 2: audience surfaces, journey and tools

Round 2 starts when 60b has merged (4.1). The page packages author content in the `pages` collection and in their own component folders; the route files for the families are WP-71's (W8-29), so a package may merge before the template and its pages stay inert until the template lands. Each package states where it pushes (4.2): a checkpoint is a coherent unit that is committed locally and pushed once through a slot.

### WP-63 Gated briefs system, and briefs 1 to 3 (stage 1B, R2, P0, RICE 1.4, 6 sessions)

**Why.** Executive briefs behind squeeze pages are the lead-capture engine of the site and the CEO's headline ask. The globalenterprise pattern is proven; the hazard on WE is that its open content is mirrored into `llms-full.txt`, Markdown twins and the search index, so the full text must never enter the build (D-23). This package builds the generic squeeze system for all ten briefs and writes the first three, so WP-79 and WP-80 add briefs by adding content files only.

**Scope**
1. **The system.** `src/pages/briefs/[id].astro` (static paths from the `briefs` collection, so a brief appears when its abstract exists and never before), `src/pages/briefs/index.astro` (hub), `src/pages/briefs/thanks.astro` and `src/components/briefs/**`. Squeeze page: hero with a primary action to the request panel and a secondary to the outline; preview with the outline and a depth strip (format, updated date, section count; no reading time, because the body is outside the build); the request panel with `BriefRequestForm` (the `audience` select is preset from the brief's registry audience list, contracts section 5); related briefs. Light theme (D-8). JSON-LD `WebPage`; no `Offer`, no download action.
2. **The hub `/briefs/`** (HubLayout) groups the briefs by audience (for startups, for investors, for partners, for corporate teams) and shows a brief only when its abstract exists; an audience with no live brief shows no empty group. It links the four open research briefs, which stay open (W8-16).
3. **The thanks page `/briefs/thanks/`** (FormLayout, `noindex`): generic text, no brief title read from the query string, no delivery-time promise.
4. **Briefs 1 to 3** in `infra/intake/briefs/<id>.md`, 2,500 to 4,000 words each, with an "About the evidence" and a "What this brief cannot tell you" section, no images, at least six distinct sources fetched in-session (W8-9): `funding-paths` (funding paths for a first SaaS company; desk link funding), `company-setup` (entity, equity, IP and privacy basics; desk legal) and `ai-native-build` (building a product that depends on a model; desk ai). Open abstracts in `src/content/briefs/<id>.md` of at most 300 words, written separately from the body, with an `outline` of section titles and no body sentence reproduced.
5. **The sentinel** front-matter sentence per brief for the audit, and the proposed counsel text for the consent line and the delivery sentences, in the handoff.
6. `src/pages/research/**`, `src/components/research/**` and `src/content/pages/research/**` link to the briefs hub (fail-closed).

**Write set** (17 patterns, pools P1): `src/pages/briefs/**`, `src/content/pages/briefs/**`, `src/components/briefs/**`, `src/content/briefs/funding-paths.md`, `infra/intake/briefs/funding-paths.md`, `src/content/briefs/company-setup.md`, `infra/intake/briefs/company-setup.md`, `src/content/briefs/ai-native-build.md`, `infra/intake/briefs/ai-native-build.md`, `src/pages/research/**`, `src/components/research/**`, `src/content/pages/research/**`, `tests/unit/wp-07/**`, `tests/unit/wp-63/**`, `tests/e2e/wave8/wp-63/**`, `.astro-magazine/handoffs/wp-63*`, `.astro-magazine/sources/wp-63.json`.

**Acceptance criteria**
- `audit-gated-briefs` (real run and `--self-test`) is green: the sentinel and three probe sentences per brief are absent from every text file in `dist`, from `llms.txt`, `llms-full.txt`, every `.md` twin, `sitemap*.xml`, `rss.xml` and the decoded Pagefind fragments; the audit fails if the index is missing.
- A unit test fails if an abstract shares a run of ten or more words with its brief body, if an abstract exceeds 300 words, if a brief is outside 2,500 to 4,000 words, or if a brief's `audience` is outside the enum. The test runs over every brief file, so WP-79 and WP-80 inherit it.
- The sources ledger has at least six fetched, status-200 sources per brief and a quote for every statistic or regulation claim; `audit-claims --source infra/intake/briefs` reports zero hits.
- Every squeeze route is in `FORM_ROUTES` (registered by WP-60); with no endpoint the page says plainly that requests are not being accepted yet (no mailto fallback, contracts section 3.4); with an endpoint the mocked e2e covers success, a 422 mapped to fields, a 429, keyboard-only completion and the no-JavaScript path to `/briefs/thanks/`.
- A fixture brief set of one, three and ten abstracts renders hub and squeeze pages without error (unit, fabricated collection); an abstract for a brief whose registry entry is `launch: false` produces no route.
- `/briefs/thanks/` is `noindex` and absent from the sitemap; the squeeze pages and the hub are indexable; Lighthouse 1.0 and axe zero on every route; `wp-07` green.
- The sentence ledger maps every page sentence; nothing says "free", "exclusive", "download now" or promises a delivery time.

**Push plan.** Checkpoint 1: system, hub, thanks, brief 1 with its abstract and the unit tests (push). Checkpoint 2: briefs 2 and 3 and the e2e specs (push). One fix push in reserve; five pipelines in the budget.

**Dependencies.** Starts after 60b. WP-61 renders and delivers the briefs; the interface is the brief id (file name equals `briefId` equals collection entry id). WP-63 never edits `infra/intake/src/**`. WP-79 and WP-80 merge after it.

---

### WP-64 Investor journey (stage 1B, R2, P0, RICE 1.8, 3.5 sessions)

**Why.** `/investors/` says what WE does not do and offers no way in. The CEO wants investors invited to meet the startups WE incubates. WE has no published portfolio, so the honest invitation is a process: how an investor asks, how a founder agrees, what an investor can inspect now, and what WE cannot promise. Seven pages and a thank-you page cover the journey from first look to a request.

**Scope.** Seven pages and a thank-you page, each with the stage of the investor journey it serves (contracts section 11).
1. **`/investors/`** (rebuilt, MarketingLayout; awareness): an invitation; the sentence "WE makes no promise of funding."; the verbatim `INTRODUCTIONS_DISCLAIMER`; "The fee does not depend on whether any investment closes."; "Not an offer of securities" (the legacy pins move verbatim to `tests/unit/wp-64/legacy-investors-page.test.ts`, seeded by WP-60); the shared `InvestorIntroductionsOffer` and `NoFundingDisclaimer` blocks in `src/components/blocks/` are imported, never edited, each use with a unique `idPrefix` as `tests/unit/wp-18/copy.test.ts` requires.
2. **`/investors/meet-startups/`** (consideration): how an investor asks to meet the companies WE incubates; that WE introduces a company only when its founder agrees; that WE cannot promise a meeting, a date or funding. No dates, no counts, no names. The consent-gated portfolio component `PortfolioShowcase` renders `getPublished('portfolio')`; with zero entries it shows exactly "No portfolio is published yet. WE lists a company here only with its founder's written consent." (contracts section 7; no statement about forming groups, OP-COHORT).
3. **`/investors/what-you-can-see/`** (consideration): the evidence formats a founder can share (linking the evidence-room tool from WP-49 and the seed data-room checklist in the library). Nothing about outcomes.
4. **`/investors/readiness-criteria/`** (consideration): the readiness criteria WE applies, taken only from the existing investor readiness checklist and the fundability guides (the page quotes or restates statements that already exist on those pages and links them); WP-64 invents no criterion. A criterion that exists nowhere else is raised in the handoff as a question (OP-CRITERIA), not written.
5. **`/investors/showcase-format/`** (consideration): how a consent-gated showcase entry would read, as a field list and consent scopes in prose and a table. It contains no example company, no placeholder name and no sample metric, because an illustrative company that looks real is an invented portfolio (W8-17).
6. **`/investors/faq/`** (consideration): eight to ten investor questions. Every answer maps to a claim id, an existing page and line, or D-21 and the CEO direction. `FAQPage` JSON-LD from the shared builder in `src/components/reference/jsonld.ts` (import-only; WP-77 owns that file).
7. **`/investors/interest/`** (conversion, FormLayout) with `InvestorInterestForm`, and **`/investors/interest/thanks/`** (onboarding stage, `noindex`): the form never asks for accreditation status, amounts, fund size or return targets; the thank-you text promises no response time and no meeting.
8. The handoff proposes the counsel text for the next release (new CR entries) because every rendered investor sentence lands in the counsel review report. No success-fee, return, guarantee or "investor network" language anywhere (contracts section 0.1). The advocacy stage has nothing for investors beyond the consent-gated showcase (L2 until a consent record exists).

**Write set** (8 patterns, pools P1): `src/pages/investors/**`, `src/content/pages/investors/**`, `src/components/investors/**`, `src/content/portfolio/**`, `tests/unit/wp-64/**`, `tests/e2e/wave8/wp-64/**`, `.astro-magazine/handoffs/wp-64*`, `.astro-magazine/sources/wp-64.json`.

**Acceptance criteria**
- `/investors/` contains the three required sentences and the verbatim disclaimer; every new page whose main content names the add-on carries the disclaimer; `wp-11` and the moved legacy test are green with the same test count as before the move.
- Unit tests: `PortfolioShowcase` with fixture entries renders only the fields whose scope is in `consentRecord.scope`; an entry without `consent: true` or without a `consentRecord` does not parse; with zero entries the page holds the fixed sentence and no other statement about the portfolio. A scan of `/investors/showcase-format/` fails on any company-like name, any number followed by a currency or a percentage sign, and any "example company".
- The sentence ledger maps every sentence to a claim id, an existing page and line, or D-21 and the CEO direction; the readiness page restates only statements that exist on a linked page; the claims audit reports zero hits; the counsel review report lists the new investor sentences and the handoff carries the proposed CR entries.
- The form e2e covers success, a 422, a 429, the disabled state, keyboard-only completion and the no-JavaScript path; `FORM_ROUTES` includes `/investors/interest/` (registered by WP-60).
- Lighthouse 1.0 and axe zero on all eight routes; the thanks page is `noindex`; JSON-LD is `WebPage`, `FAQPage` or `Organization`, never `Offer`.
- Every page in the investor map has a forward link (contracts section 11 rule), checked by the unit test of WP-90's map for this audience once it exists.

**Push plan.** Checkpoint 1: `/investors/`, `/investors/meet-startups/`, the portfolio component and the legacy test (push). Checkpoint 2: the remaining pages, form and e2e (push). Four pipelines in the budget.

**Dependencies.** Starts after 60b. Reads WP-49's tools and the fundability guides. Counsel review is a release-time gate, not a merge gate (DP-W8-2).

---

### WP-65 Partner journey (stage 1B, R2, P1, RICE 0.9, 3 sessions)

**Why.** The network page currently denies a partner program. The CEO wants a strong partnership posture toward companies that help startups or provide tooling. The honest version is an inbound program that names no company and promises nothing it cannot keep.

**Scope**
1. **`/network/partners/`** (MarketingLayout; awareness): who WE wants to hear from, in six categories (tooling and SaaS, cloud credit programs, legal services, finance and accounting, delivery partners, ecosystem and community programs); what WE can offer a partner (a warm introduction when a founder asks for it, co-authored content, a place in founder playbooks where the offer fits a stage); what WE asks (founder-first terms: terms written down before any introduction, accurate descriptions of the offer). No company is named, "free" and "perks" do not appear, no discount or saving is claimed.
2. **`/network/partners/categories/`** (consideration): each category in a short section, what a good enquiry from that category says, and what WE does not do for that category.
3. **`/network/partners/how-it-works/`** (consideration): how WE evaluates an enquiry and how an introduction happens (the founder agrees first). The evaluation criteria are written for operator confirmation (OP-PARTNER) and the page states only the ones the operator has confirmed in the handoff; until then it says what an enquiry should contain.
4. **`/network/partners/faq/`** (consideration): six to eight answers, each mapped to a claim id, an existing page and line, or D-21; `FAQPage` JSON-LD from the shared builder (import-only).
5. **`/network/partners/enquire/`** (conversion, FormLayout) with `PartnerEnquiryForm` (category, organization URL, what the organization provides and on what terms) and **`/network/partners/enquire/thanks/`** (`noindex`; no response-time promise).
6. **Rewrite `src/content/pages/network/index.mdx`**: remove the sentence at line 34 that denies a partner program, link the new pages, keep the verbatim Investor Introductions disclaimer on `/network/` and the `roles.ts` API unchanged (`wp-15/seat-roles.test.ts`). `/network/delivery-partners/` stays L2; the partners pages name delivery partners as a category only.
7. The handoff proposes counsel text (new CR entries) and the evaluation criteria for confirmation (OP-PARTNER). The partner brief `partnering-with-founders` (WP-80) is the secondary action once live. The advocacy stage for partners is the enquiry itself plus a pass-it-on link; nothing about shared referrals or revenue.

**Write set** (8 patterns, pools P1): `src/pages/network/**`, `src/content/pages/network/**`, `src/components/network/**`, `src/components/partners/**`, `tests/unit/wp-65/**`, `tests/e2e/wave8/wp-65/**`, `.astro-magazine/handoffs/wp-65*`, `.astro-magazine/sources/wp-65.json`.

**Acceptance criteria**
- The denial sentence is gone and no sentence on any partner page contradicts the program; the sentence ledger maps every sentence; the claims audit is clean.
- A unit test scans the partner pages and the network page for a list of well-known vendor and platform names and fails if any appears; another fails on "free", "perk", "discount", "accelerator", "cohort", "mentor" and "network of".
- `wp-11/network.test.ts` (pins four owned routes and the investors block) and `wp-15/seat-roles.test.ts` are green; the verbatim disclaimer is on `/network/`.
- The form e2e covers success, a 422 on a missing category or URL, a 429, the disabled state (no mailto fallback), keyboard-only completion and the no-JavaScript path; `FORM_ROUTES` includes `/network/partners/enquire/` (registered by WP-60).
- Lighthouse 1.0 and axe zero on the six routes.

**Push plan.** One checkpoint for the pages and the network rewrite, one for the form and e2e. Three pipelines in the budget.

**Dependencies.** Starts after 60b.

---

### WP-62 CTA system, home and founders hub (stage 1C, R2, P0, RICE 4.2, 3 sessions)

**Why.** The CEO asked for many calls to action to attract startups. Content pages are where visitors land and carry none. The skeleton exists after 60b; this package gives it its copy, its surface map, its placement and, as the implementation of the customer-journey contract (W8-25), the primary and secondary action for every page family.

**Scope.** (1) Final copy and the surface map in `src/data/cta/**`, starting from the contracts section 6 tables: end bands on articles, guides, playbooks, templates, services, research briefs, hubs, investor and partner pages, segment, industry, compare, journey, brief and reference pages; a mid-body band in articles of at least 900 words; an aside variant on hubs. The default map per page family (contracts section 6.2) is data in `src/data/cta/` with a unit test over the family registry: every family has a primary and at most one secondary action, and a family without an entry fails the test. (2) `src/components/cta/**` refined (props additive). (3) `src/components/blocks/ContextualNext.astro` resolves through `resolveCta`, additively. (4) The home page: an audience strip for the four audiences under the hero (`src/pages/index.astro`, `src/components/home/audience/**`), `LatestInsights.astro` showing the new desks, home copy in `src/content/pages/home/**`; the hero markup is not touched (`HomeHero.astro` is in the photography lane). (5) `/founders/` rebuilt as the founders hub (`src/pages/founders/index.astro`, `src/content/pages/founders/index.mdx`): one entry per segment taken from the registry, shown only for live segment pages. (6) The insights hub copy (`src/content/pages/insights/index.mdx`) names the 14 desks from `desks.ts`. (7) The legacy home and program sentence tests (`wp-01`, `wp-44`) are updated only for sentences this package changes; the founders-page pins that WP-60 moved to `tests/unit/wp-62/legacy-founders-page.test.ts` stay green. No layout edit: layouts are WP-60's and the slots already exist.

**Write set** (17 patterns, pools P1): `src/components/cta/**`, `src/data/cta/**`, `src/components/blocks/ContextualNext.astro`, `src/pages/index.astro`, `src/pages/founders/index.astro`, `src/components/home/audience/**`, `src/components/home/LatestInsights.astro`, `src/content/pages/home/**`, `src/content/pages/founders/index.mdx`, `src/content/pages/insights/index.mdx`, `tests/unit/wp-01/**`, `tests/unit/wp-44/**`, `tests/e2e/wave7/wp-44/**`, `tests/unit/wp-62/**`, `tests/e2e/wave8/wp-62/**`, `.astro-magazine/handoffs/wp-62*`, `.astro-magazine/sources/wp-62.json`.

**Acceptance criteria**
- A surface matrix e2e (1440 and 390, plus a JavaScript-disabled project): for a sample route of every family, the expected band count, variant and href; no band on legal, form, thanks, search, styleguide or 404 pages; at most one end band and one mid band per page; the mid band sits after the 50 percent boundary, never in the first 20 or last 10 percent, never between a heading and its first paragraph, and only in documents of at least 900 words.
- Every CTA string passes the claims denylist (unit) and a stricter local list that bans urgency and scarcity words ("limited", "last chance", "hurry", "only N left", "countdown", "exclusive"); headings are at most 70 characters, sentence case; each band has one primary and at most one secondary action; every `href` is a live route (`audit:links`); no CTA renders without its target (fail closed).
- The family map test: every registry family and every legacy family has a primary and at most one secondary; a secondary that points at a not-yet-live brief or page is dropped; on a fixture ledger with no live brief the article band falls back to the apply action.
- No JavaScript, no new request, no cookie, no tracking attribute beyond `data-cta`; CLS under 0.1; Lighthouse 1.0 and axe zero on `/`, `/founders/`, one article, one guide, one playbook, one template and the hubs.
- The home hero markup and image are byte-identical to `demo` (`check:ownership` plus a unit assertion).
- The sentence ledger maps every new sentence; `wp-01` and `wp-44` are green.

**Push plan.** Checkpoint 1: the data map, components and unit tests (push). Checkpoint 2: home, founders hub and the surface matrix e2e (push). Four pipelines in the budget.

**Dependencies.** Starts after 60b. Merges after WP-63, WP-64 and WP-65 so every variant has a live target, and after WP-71 so the family pages it points at exist (the fail-closed rule means a late page only costs a later band, never a dead link). Reads WP-49's and WP-76's `/tools/*` as CTA targets.

---

### WP-72 Customer journey pages and the founder resources hub (stage 1C, R2, P0, RICE 4.5, 2.5 sessions)

**Why.** Entry and exit exist; the middle of the journey is missing. This package writes the four journey pages and rebuilds the resources hub so that a visitor can see what applying leads to, in order, without any promise the program pages do not make. It is the highest-scoring package in the plan.

**Scope**
1. **`/journey/`** (hub; awareness): the founder path as five steps with a link to each page, and the "pass it on" section for the advocacy stage (share this page; the partner enquiry; the consent-gated showcase once it exists; no referral reward, share count or testimonial).
2. **`/journey/after-you-apply/`** (consideration): what happens after an application, taken from the five steps in `src/components/program/steps.ts` (apply, agree the scope, seat the team, work in focused cycles, review and decide) and the program pages. It adds no step and no duration. Where the program pages are silent, the page does not describe WE's behavior; it lists questions the founder can ask at that step.
3. **`/journey/first-months/`** (consideration): "Your first months, in order": the same sequence from the founder's side. For each step, what the founder sees, what the founder decides, and the questions to ask. No durations, no "30/60/90" (DP-W8-16), no outcome.
4. **`/journey/onboarding-checklist/`** (onboarding): a checklist a founder can use to prepare, built from the steps and the library templates and guides (the problem brief, the MVP cut line worksheet, the investor readiness checklist). The checklist is guidance; it is not stated as a condition of applying (that would be a new claim about WE).
5. **`/resources/`** (reference; rebuilt hub, `src/pages/resources/**`, `src/content/pages/resources/**`, `src/components/reference/resources.ts`): the library, guides, playbooks, templates, tools, briefs hub, research, glossary and FAQ grouped by where a founder is (before you apply, while you build, when you raise). The lists derive from the registries and the liveness predicate, so a page that does not exist is not listed.
6. Content in the `pages` collection only (W8-29); the family templates are WP-71's. A step that cannot be traced to an existing sentence is not written; the gaps go in the handoff as OP-PROCESS questions for the operator (the real sequence in detail).

**Write set** (9 patterns, pools P1): `src/content/pages/journey/**`, `src/components/journey/**`, `src/pages/resources/**`, `src/content/pages/resources/**`, `src/components/reference/resources.ts`, `tests/unit/wp-72/**`, `tests/e2e/wave8/wp-72/**`, `.astro-magazine/handoffs/wp-72*`, `.astro-magazine/sources/wp-72.json`.

**Acceptance criteria**
- The sentence ledger maps every sentence of the four journey pages and the resources hub to a claim id, a line of `steps.ts` or a program page, or a decision id; a unit test asserts the journey pages contain no digit followed by "day", "week" or "month" (no durations), no "30/60/90", and the same five step titles as `steps.ts` in the same order.
- Every journey page links forward (contracts section 11: no dead end) and every link resolves; the claims audit is clean.
- The resources hub lists only live routes (unit with a fixture ledger) and covers every library family that is live.
- The journey pages render through the WP-71 template once it has merged (e2e, 1440 and 390); before that the pages are inert and the unit tests carry the criteria.
- Lighthouse 1.0 and axe zero on `/journey/`, the three child pages and `/resources/`.

**Push plan.** One checkpoint for the four journey pages and one for the resources hub and e2e. Three pipelines in the budget.

**Dependencies.** Starts after 60b. WP-71 must have merged before the final push (the template); WP-62 supplies the bands; WP-90 tests the journey.

---

### WP-73 Founder segment pages (stage 1C, R2, P0, RICE 3.3, 3 sessions)

**Why.** The CEO asked for content spread over audiences, and a first-time founder, a solo founder and a corporate innovator are different readers who want to know the site is for them. Eight pages, one per segment, each with its own reading path and one honest path to apply.

**Scope.** Eight pages in the `pages` collection, `src/content/pages/founders/<segment>.mdx`: `first-time-founders`, `technical-founders`, `non-technical-founders`, `solo-founders`, `corporate-innovators`, `student-founders`, `second-career-founders` and `global-remote-founders`. Each has, in the fixed frontmatter of contracts section 8.2: who the page is for (`whoFor`, the reader's situation, not eligibility), what is hard at this stage (`challenges`, taken from the segment's articles, with a claim or source per sentence), the reading path (the template lists the articles whose `segments` field names this segment; nothing is hand-listed), one path to apply, and a secondary action per segment (the matching brief or tool, fail-closed). `src/components/segments/**` holds any segment-only component. A segment page never states eligibility beyond `/program/who-its-for/`: where that page is silent on a segment (corporate innovators in particular), the page describes the situation in general terms, points at the application and records the question for the operator (OP-SEGMENTS) in the handoff.

**Write set** (13 patterns, pools P1): `src/content/pages/founders/first-time-founders.mdx`, `src/content/pages/founders/technical-founders.mdx`, `src/content/pages/founders/non-technical-founders.mdx`, `src/content/pages/founders/solo-founders.mdx`, `src/content/pages/founders/corporate-innovators.mdx`, `src/content/pages/founders/student-founders.mdx`, `src/content/pages/founders/second-career-founders.mdx`, `src/content/pages/founders/global-remote-founders.mdx`, `src/components/segments/**`, `tests/unit/wp-73/**`, `tests/e2e/wave8/wp-73/**`, `.astro-magazine/handoffs/wp-73*`, `.astro-magazine/sources/wp-73.json`.

**Acceptance criteria**
- Each page has its own `h1`, description, JSON-LD `WebPage`, canonical and Open Graph slot; the sentence ledger maps every sentence; the claims audit is clean; no page contains a number about applicants, acceptance, outcomes or time; no page uses "cohort", "mentor", "accelerator" or "perks".
- A unit test asserts that each page names no requirement for applying that `/program/who-its-for/` does not already state and no discount or preference for any segment.
- The reading path renders from fixtures with zero, one and many matching articles (unit); at release, WP-99 asserts at least three live articles per segment, or lists the segment in the cut notes.
- Lighthouse 1.0 and axe zero on all eight pages.

**Push plan.** One push for all eight pages and tests (the pages are short), one fix push. Three pipelines in the budget.

**Dependencies.** Starts after 60b. Pages are inert until WP-71 merges (W8-29). Reads the `segments` field from the article packages through the collection; no dependency on their merge.

---

### WP-74 Industry pages (stage 1C, R2, P1, RICE 1.1, 2.5 sessions)

**Why.** Founders arrive with a vertical in mind. These pages are written as considerations for building SaaS for a vertical, and claim no client, no result and no capability WE has not stated elsewhere (W8-24).

**Scope.** Seven pages in the `pages` collection plus the hub text: `/industries/` and `/industries/<vertical>/` for `fintech`, `healthtech`, `edtech`, `climate-tech`, `legaltech`, `logistics` and `proptech`. Each page covers, in the fixed frontmatter of contracts section 8.2 (`buyer`, `perimeter`, `dataQuestions`, `salesCycle`, `sources`), who the buyer is, what the regulatory perimeter looks like in general terms (named from primary sources, scoped by jurisdiction and date), the data-handling questions to settle, the sales-cycle considerations (no numbers) and a standing sentence: "This page is about considerations. It does not describe any WE company or result." The `related` links to the sector articles (WP-88) are fail-closed. `src/components/industries/**` holds any industry-only component. The first four are the core; `legaltech`, `logistics` and `proptech` are the first cut within the family (4.6, item 3).

**Write set** (6 patterns, pools P1): `src/content/pages/industries/**`, `src/components/industries/**`, `tests/unit/wp-74/**`, `tests/e2e/wave8/wp-74/**`, `.astro-magazine/handoffs/wp-74*`, `.astro-magazine/sources/wp-74.json`.

**Acceptance criteria**
- The source rule applies (W8-9): every regulatory or standards statement is fetched in-session and recorded with its quote in `.astro-magazine/sources/wp-74.json`; the claims audit and the `C-15-*`, `C-13-*` families report zero hits; no page names a client, a partner or a customer in the industry; no page says WE serves, is certified for, or is compliant with anything in the industry.
- A unit test scans every industry page for the standing sentence and for currency amounts, percentages not in a quoted source, and the words "clients", "customers we", "our work in".
- Lighthouse 1.0 and axe zero on the hub and one sampled page (WP-99 re-runs all).

**Push plan.** One push for the four core pages and the hub, one for the other three, one fix. Three pipelines in the budget.

**Dependencies.** Starts after 60b. Inert until WP-71 merges.

---

### WP-75 Comparison pages (stage 1C, R2, P1, RICE 1.2, 2.5 sessions)

**Why.** A visitor weighing WE against alternatives will compare; a page that does it honestly earns more trust than silence. The risk is that comparison copy drifts into advocacy or into claims about WE's commercial model, so the pages are built on one fixed shape and a strict neutrality test.

**Scope.** Seven pages in the `pages` collection plus the hub text: `/compare/` and `/compare/<pair>/` for `incubator-vs-other-programs`, `incubator-vs-venture-studio`, `dedicated-team-vs-agency`, `dedicated-team-vs-freelancers`, `build-vs-buy`, `onshore-vs-offshore-teams` and `bootstrapping-vs-outside-funding`. Each page has, in the fixed frontmatter of contracts section 8.2 (`sides`, `whereEachFits`, `definitions`, `sources`), the same fields for both sides (what it is, who it fits, what it asks of the founder, what to ask), a "where each fits" section that names a situation for each side, and a definitions block with sources fetched in-session. The pages compare categories, never products or companies (W8-24). They say what WE is only with sentences that already exist on a program page, and they never describe WE's fee or equity model in either direction (the hybrid pricing stays unpublished, F-4, and "no equity" and "no fee" are blocked by `W7-C09`). The first four pages are the core; the last three are the first cut within the family (4.6, item 3). `incubator-vs-other-programs` (renamed from `incubator-vs-accelerator` by 60b item 13, see Q-7) uses the word the denylist blocks everywhere else, which needs the narrow `allowPaths` entry WP-60 adds (DP-W8-15); if that entry is declined, WP-99 flips the row to `launch: false` and the page stays inert.

**Write set** (6 patterns, pools P1): `src/content/pages/compare/**`, `src/components/compare/**`, `tests/unit/wp-75/**`, `tests/e2e/wave8/wp-75/**`, `.astro-magazine/handoffs/wp-75*`, `.astro-magazine/sources/wp-75.json`.

**Acceptance criteria**
- A neutrality unit test: both columns of every page contain the same fields with a comparable number of words (within 25 percent), no superlative ("best", "worst", "better than") and no second-person recommendation of one side; each page names a situation where the other side fits better than WE.
- No product, vendor, platform or company is named (scan of the page against a list of well-known names, plus a manual review note); no statement about WE's fees, equity, pricing or number of clients.
- Every statement about the other category cites a source fetched in-session with a quote in `.astro-magazine/sources/wp-75.json`; generic-definition markers are present where the SAFE-mechanics rules require them.
- The claims audit is clean, including on `/compare/incubator-vs-other-programs/` under the `allowPaths` entry; no other path gains an exception.
- Lighthouse 1.0 and axe zero on the hub and one sampled page.

**Push plan.** One push for the four core pages and the hub, one for the remaining three, one fix. Three pipelines in the budget.

**Dependencies.** Starts after 60b. Inert until WP-71 merges. `incubator-vs-other-programs` waits for the `allowPaths` entry (60b item 13).

---

### WP-76 Founder tools (stage 1C, R2, P1, RICE 1.2, 3 sessions)

**Why.** Tools turn a reader into a user and give the CTA system a low-commitment target. WP-49 built the first tool and the contract for the rest; wave 8 adds three more, all client-side with no data leaving the browser.

**Scope.** Three tools and the hub: `/tools/runway-calculator/` (runway from cash, burn and optional growth in months of burn, with the arithmetic shown), `/tools/pricing-page-checker/` (a checklist over the reader's own pricing page based on the existing "Pricing page fundamentals" article; presence checks only, no score claim) and `/tools/cap-table-explainer/` (how issuing shares changes ownership, from the reader's own inputs; `data-generic-definition` markers on the defining text). Each tool is an Astro page, an MDX body, an island (`we-runway`, `we-pricing-checker`, `we-cap-table`) and a pure-logic script under `src/scripts/`; the tools hub (`/tools/`) lists the live tools from the registry. Inputs start empty or at zero; no default value is presented as typical; every result carries "an illustration from your inputs, not advice". Existing WP-49 tests (`tests/unit/wp-49/**`, `tests/e2e/wave7/wp-49/**`) are owned here and updated only for the hub listing.

**Write set** (21 patterns, pools P1): `src/pages/tools/index.astro`, `src/pages/tools/runway-calculator.astro`, `src/pages/tools/pricing-page-checker.astro`, `src/pages/tools/cap-table-explainer.astro`, `src/content/pages/tools/index.mdx`, `src/content/pages/tools/runway-calculator.mdx`, `src/content/pages/tools/pricing-page-checker.mdx`, `src/content/pages/tools/cap-table-explainer.mdx`, `src/components/tools/**`, `src/components/islands/we-runway/**`, `src/components/islands/we-pricing-checker/**`, `src/components/islands/we-cap-table/**`, `src/scripts/runway.ts`, `src/scripts/pricing-checker.ts`, `src/scripts/cap-table.ts`, `tests/e2e/wave7/wp-49/**`, `tests/unit/wp-49/**`, `tests/unit/wp-76/**`, `tests/e2e/wave8/wp-76/**`, `.astro-magazine/handoffs/wp-76*`, `.astro-magazine/sources/wp-76.json`.

**Acceptance criteria**
- Pure-logic unit tests per tool, including zero, negative and very large inputs, rounding, and "not defined" results (zero burn gives no runway, not infinity).
- E2E (1440 and 390, keyboard only): results appear in an `aria-live="polite"` region; no network request is made after load (route-abort assertion); nothing is written to cookies or storage; the no-JavaScript view shows the explanation and the formulas.
- JSON-LD `WebApplication` per the existing contract; the sentence ledger maps every sentence; the claims audit is clean (no "free" in the tool copy; "free of charge" is blocked).
- Lighthouse 1.0 and axe zero on the hub and the three tools; the hub still lists the team composer.

**Push plan.** One push per tool pair (two checkpoints), one fix. Four pipelines in the budget.

**Dependencies.** Starts after 60b. WP-49 merged (entry gate). Linked from CTA bands and articles through fail-closed targets.

---

### WP-91 Discoverability at scale (stage 1C, R2, P0, RICE 3.7, 3 sessions)

**Why.** Wave 7's machine layer was built for about 63 documents. At about 300 routes, search engines and assistants must still find the right pages, and the 262,144-byte cap on `llms-full.txt` (which makes the build throw) must stay a safe design, not an accident.

**Scope.** (1) `llms.txt`: every new family listed by registry (the Optional section for the families too large to list in full), with the curated key-page list for `llms-full.txt` extended to one key page per family and per desk; the cap is an acceptance criterion with a 10 percent margin (W8-26). (2) Markdown twins: generated for the new families only where the plain-Markdown lint passes; thank-you pages, gated briefs and `noindex` pages have none. (3) The sitemap page and `sitemap*.xml`, `rss.xml` (articles feed, with the new desks), `robots.txt`, all registry-driven; `noindex` pages are absent. (4) Search: the Pagefind configuration indexes the new families and the open brief abstracts; it never sees a gated brief body (the sentinel audit proves it). (5) The command palette entries for the new families (`src/components/nav/commands.ts`): audiences, briefs, industries, compare, journey, tools. (6) `scripts/audit-geo.mjs` extended to the new families. (7) Wave 7 tests (`wp-41`, `wp-46`) are owned here and updated by additions only.

**Write set** (24 patterns, pools P1): `src/components/geo/**`, `src/lib/llms.ts`, `src/lib/markdown-twins.ts`, `src/pages/llms.txt.ts`, `src/pages/llms-full.txt.ts`, `src/pages/[...path].md.ts`, `src/pages/sitemap.astro`, `src/pages/rss.xml.ts`, `src/pages/robots.txt.ts`, `src/pages/search/**`, `src/components/islands/we-search/**`, `src/components/islands/we-palette/**`, `src/components/nav/commands.ts`, `src/scripts/search.ts`, `src/scripts/palette.ts`, `scripts/audit-geo.mjs`, `tests/unit/wp-41/**`, `tests/unit/wp-46/**`, `tests/e2e/wave7/wp-41/**`, `tests/e2e/wave7/wp-46/**`, `tests/unit/wp-91/**`, `tests/e2e/wave8/wp-91/**`, `.astro-magazine/handoffs/wp-91*`, `.astro-magazine/sources/wp-91.json`.

**Acceptance criteria**
- With a fabricated content set of 350 routes (unit), `llms.txt` lists every family and `llms-full.txt` stays under the cap with a 10 percent margin; a deliberately oversized fixture still throws `LlmsFullTooLargeError`.
- The twin of an article, a segment page and a comparison page equals its source Markdown after the documented transforms; a page that fails the lint has no twin and no link to one; a thank-you page appears nowhere in `llms.txt`, the sitemap, the feed or the palette.
- `audit-geo` reports no new warning; the sitemap lists exactly the indexable launched routes (a unit test compares it with the ledger); the feed validates.
- The palette lists a new-family entry only when its route is live; the keyboard e2e of `wp-46` is green.
- The claims audit scans the new machine files (they are in the audit's scope already) and reports zero hits.

**Push plan.** Checkpoint 1: `llms.txt`, twins, sitemap, feed and tests (push). Checkpoint 2: search, palette, audit and e2e (push). Four pipelines in the budget.

**Dependencies.** Starts after 60b; WP-41 and WP-46 merged (entry gate). Registry-driven, so it never waits for a content package. WP-99 re-runs the machine-layer checks on the final build.

---


### 5.4 Round 3: reference, briefs and depth

Round 3 packages link to pages that round 1 and round 2 create, and rule 5 of 4.3 forbids a link to a route that is not on `demo` at merge. Each package therefore has a gate, which the orchestrator checks before starting it (a package may start authoring earlier, but it does not push its final batch until the gate is met).

| Package | Gate before its final push |
|---|---|
| WP-77 Glossary | At least the funding, legal and gtm desks (WP-66, 67, 81) merged, so "see also" links resolve |
| WP-78 FAQ | WP-63, 64, 65, 72 merged, so the answers can link the briefs, investor, partner and journey pages |
| WP-79 Briefs 4 to 6 | WP-63 merged (the system) |
| WP-80 Briefs 7 to 10 | WP-63 merged (the system); WP-64 and WP-65 merged for the secondary links |
| WP-86 Playbooks | WP-63, 76 merged and the R1 desks funding, legal, team, gtm, ai merged |
| WP-87 Guides, templates, readiness check | WP-76 merged and the R1 desks merged |
| WP-88, WP-89 (5.2) | 60a only; scheduled here to use freed slots |

### WP-77 Glossary at scale (stage 1D, R3, P1, RICE 1.6, 3 sessions)

**Why.** A glossary is the cheapest way to answer the long tail of "what is X" questions that bring founders to the site, and about 40 terms is thin. The risk is the denylist: the SAFE-mechanics terms and "cohort" are blocked without a marker, so the list component carries the markers and every definition is generic.

**Scope.** (1) `src/data/glossary.yaml` grows from about 40 to about 120 terms by additions only: existing entries are kept verbatim (W8-28). Groups: the seven that exist today and are kept verbatim (Funding, Finance and metrics, Legal and contracts, Customers and product, Product delivery, Security and accessibility, WE vocabulary; the last holds only terms the site already defines) plus three new ones (Go-to-market, Team and hiring, AI and data), fixed in contracts section 8.4. (2) Each new definition is one to three sentences, general and neutral, with at least one source fetched in-session recorded in `.astro-magazine/sources/wp-77.json`; a term the denylist treats as SAFE mechanics (valuation cap, discount rate, pro-rata, most favored nation) is flagged in the YAML so `GlossaryList.astro` wraps the definition in `data-generic-definition`; "cohort" appears only as a retention term inside the `C-13-peers` marker; "accelerator" is not defined (the comparison page covers it). (3) `related` links point at terms that exist; a "see also" link to a route appears only when the route is live. (4) `src/pages/glossary/**` and `GlossaryList.astro` render grouped terms with a jump list and a stable anchor per term; there are no per-term pages (a decision: the volume buys no search value that a well-anchored single page does not, and it would add about 80 routes to the gate). (5) `src/components/reference/jsonld.ts` keeps its builders (`faqPageNode`, `definedTermSetNode`, `anchorId`, `groupBy`, `initials`) with unchanged output; WP-64, WP-65 and WP-78 import them, so any change is additive and covered by a snapshot test. WP-77 owns the file only so that one package edits it.

**Write set** (8 patterns, pools P1): `src/data/glossary.yaml`, `src/pages/glossary/**`, `src/components/reference/GlossaryList.astro`, `src/components/reference/jsonld.ts`, `tests/unit/wp-77/**`, `tests/e2e/wave8/wp-77/**`, `.astro-magazine/handoffs/wp-77*`, `.astro-magazine/sources/wp-77.json`.

**Acceptance criteria**
- Unit tests: terms unique by id, groups from the fixed list, every `related` id exists, every definition is one to three sentences and 10 to 80 words, every source in the ledger has a fetch record, the existing terms are unchanged byte for byte (snapshot of the original list), and every flagged SAFE-mechanics term renders inside `data-generic-definition`.
- The claims audit is clean on `/glossary/`; no definition describes WE, a WE company or any WE result; the only WE terms are those the site already defines.
- `DefinedTermSet` JSON-LD validates and lists every term; a snapshot test shows `faqPageNode` and `definedTermSetNode` produce unchanged output for the existing entries.
- Lighthouse 1.0 and axe zero on `/glossary/`; the jump list is keyboard-operable.
- At least 80 terms at the first push; the target is about 120 and the second half is the cut line within this package (4.6, item 2).

**Push plan.** One push at the gate with all terms, one fix. Three pipelines in the budget.

**Dependencies.** Gate in the table above. WP-64, WP-65 and WP-78 import `jsonld.ts`, which already exists on `demo`; none waits for this package.

---

### WP-78 FAQ at scale (stage 1D, R3, P1, RICE 2.2, 2.5 sessions)

**Why.** The FAQ is where visitors with a specific doubt land, and it is the page the CEO's audiences will each want: a founder, an investor, a partner and a corporate team ask different questions. 18 entries in one flat list is too few and not grouped by audience.

**Scope.** `src/data/faq.yaml` grows from 18 to about 60 entries by additions only (W8-28): existing entries are kept verbatim and a correction is raised in the handoff. Each entry has an id, a question, an answer of one to four sentences, a group, `claimsUsed` and `related`, plus a new optional `audience` field (contracts section 8.4) so the page groups by audience first (for startups, for investors, for partners, for corporate teams) and by topic inside each (the four existing topic groups, About WE, The seat model, Applying and cost and Scope and limits, plus the groups WP-78 adds and lists in its own test). An entry with no `audience` is general and renders first, under "For everyone"; the 18 existing entries are general. Every answer maps to a claim id, an existing page and line, or a decision; an answer the site cannot support is not written. Pricing answers say only what the site already says (pricing is discussed with the founder and not published). The answers about investors, partners and corporate teams restate only what WP-64, WP-65 and the corporate segment page say. `src/pages/faq/**` renders the groups with a jump list and the `FAQPage` JSON-LD from the shared builder (WP-77's `jsonld.ts`, import-only).

**Write set** (6 patterns, pools P1): `src/data/faq.yaml`, `src/pages/faq/**`, `tests/unit/wp-78/**`, `tests/e2e/wave8/wp-78/**`, `.astro-magazine/handoffs/wp-78*`, `.astro-magazine/sources/wp-78.json`.

**Acceptance criteria**
- Unit tests: ids unique, every `related` id exists, every `claimsUsed` id is enabled, every answer is one to four sentences, the existing 18 entries are unchanged byte for byte, every entry has an audience or is in the general group, and the page JSON-LD contains one `Question` per entry.
- The sentence ledger maps every new answer; the claims audit is clean; the new answers avoid "accelerator", "cohort", "mentor" and "perks" (the `/faq/` exception in `C-13-peers` is for the existing answers); no answer states an amount, a response time or a count.
- Lighthouse 1.0 and axe zero on `/faq/`; the page works without JavaScript; the jump list is keyboard-operable.
- At least 40 entries at the first push; the target is about 60 and the second half is the cut line within this package.

**Push plan.** One push at the gate, one fix. Three pipelines in the budget.

**Dependencies.** Gate in the table above.

---

### WP-79 Gated briefs 4 to 6 (stage 1D, R3, P1, RICE 1.2, 5 sessions)

**Why.** The first three briefs prove the system; three more cover the founder questions that bring the most readers (customers, the evidence investors ask for, and hiring). The package adds content files only: the squeeze system, form routes and audits are WP-63, WP-60 and WP-61.

**Scope.** Three briefs, each in `infra/intake/briefs/<id>.md` (2,500 to 4,000 words, an "About the evidence" and a "What this brief cannot tell you" section, no images, at least six distinct sources fetched in-session) with an open abstract in `src/content/briefs/<id>.md` (at most 300 words, written separately, an outline, no body sentence reproduced): `first-100-customers` (from the first ten customers to the first hundred; desks gtm and grow), `pre-seed-evidence-pack` (the evidence investors ask to see before a pre-seed conversation; desk fundable) and `first-hires` (roles, contracts and onboarding for a first hire; desk team). Each has a sentinel. Briefs are for founders (`audience: [startup]`). The proposed counsel text for each brief's consent line goes in the handoff.

**Write set** (9 patterns, pools P1): `src/content/briefs/first-100-customers.md`, `infra/intake/briefs/first-100-customers.md`, `src/content/briefs/pre-seed-evidence-pack.md`, `infra/intake/briefs/pre-seed-evidence-pack.md`, `src/content/briefs/first-hires.md`, `infra/intake/briefs/first-hires.md`, `tests/e2e/wave8/wp-79/**`, `.astro-magazine/handoffs/wp-79*`, `.astro-magazine/sources/wp-79.json`.

**Acceptance criteria**
- The unit tests and the sentinel audit of WP-63 and WP-60 run over the new files and pass: word counts, abstract rules, audience enum, six sources with quotes, no abstract sentence in the body, no sentinel or probe sentence in any public artifact.
- `audit-claims --source infra/intake/briefs` reports zero hits; no sentence says "free", "exclusive", "guarantee", "in N weeks" or promises a result; the evidence-pack brief does not say or imply that following it leads to funding.
- Each brief's squeeze page renders through the WP-63 system with no edit to a route file (the page appears because the abstract exists).
- The handoff lists every source with its fetch record and the proposed counsel text.

**Push plan.** One push for the three briefs (they are content files), one fix. Three pipelines in the budget.

**Dependencies.** Gate in the table above. WP-61 renders the briefs when it is provisioned; nothing here depends on it.

---

### WP-80 Gated briefs for investors, partners and corporate teams (stage 1D, R3, P1, RICE 0.7, 6 sessions)

**Why.** The CEO asked for briefs segmented by audience. Investors, partners and corporate teams read different documents from founders, and they are the audiences where an over-claim is most costly. Four briefs, each a document a member of that audience would plausibly read to decide how to engage a company of this kind.

**Scope.** Four briefs under the same rules as WP-79, with the audience set in each abstract: `early-stage-diligence` (`audience: [investor]`; what an investor can look at in an early-stage SaaS company and what the evidence cannot show), `ai-company-diligence` (`[investor]`; diligence for a company whose product depends on a model), `partnering-with-founders` (`[partner]`; structures, expectations and written terms when an organization works with early-stage founders) and `corporate-spinouts` (`[corporate]`; building or spinning out a new software product inside a company). The briefs describe how the subject works in general and cite their sources; they do not describe WE's clients, results or terms. The investor briefs never use the literal "success fee", "investor network", a return, a guarantee or a statement that WE companies are investable; the partner brief names no company and promises no introduction; the corporate brief claims no corporate client. The proposed counsel text goes in the handoff, and the investor briefs are added to the counsel queue (every rendered investor sentence is reviewed).

**Write set** (11 patterns, pools P1): `src/content/briefs/early-stage-diligence.md`, `infra/intake/briefs/early-stage-diligence.md`, `src/content/briefs/ai-company-diligence.md`, `infra/intake/briefs/ai-company-diligence.md`, `src/content/briefs/partnering-with-founders.md`, `infra/intake/briefs/partnering-with-founders.md`, `src/content/briefs/corporate-spinouts.md`, `infra/intake/briefs/corporate-spinouts.md`, `tests/e2e/wave8/wp-80/**`, `.astro-magazine/handoffs/wp-80*`, `.astro-magazine/sources/wp-80.json`.

**Acceptance criteria**
- Same as WP-79 for all four briefs, with the audience enum asserted per brief and the `BriefRequestForm` audience preset resolving to the abstract's value (unit over the registry).
- A scan of the four briefs and abstracts fails on "success fee", "investor network", "returns", "guaranteed", "our portfolio", "portfolio companies" and any company-like name not in a quoted source.
- The counsel register receives the investor-facing sentences in the handoff for WP-99.

**Push plan.** Two pushes (two briefs each) so a failed review of one pair does not hold the other; one fix. Four pipelines in the budget.

**Dependencies.** Gate in the table above.

---

### WP-86 Playbooks (stage 1D, R3, P1, RICE 0.9, 4 sessions; absorbs half of WP-47, #36)

**Why.** Playbooks are the pages the founder-facing calls to action send people to once they want to act, and WP-47 (#36) asked for exactly the depth pass on them. It is folded into wave 8 and split across two owners so each owner edits one set of files: playbooks here, guides and templates in WP-87.

**Scope.** (1) Every existing playbook (`validate-the-problem`, `design-the-product`, `build-and-ship-v1`, `earn-your-first-customers`, `build-repeatable-growth`) gains a "what good looks like" section, a "common mistakes" section, an evidence block at the end listing its sources, a decision aid (a short table or checklist the reader can apply), links to the templates, tools and briefs that fit (fail-closed through the existing mechanisms), and a link to the next playbook in the chain. (2) About five new playbooks of the same shape, provisional titles: set up the company and its paperwork, hire your first team member, price a first SaaS product, run your first outbound sequence, and prepare for investor conversations. Together the ten form one chain (validate, design, set up the company, build and ship v1, hire, price, earn your first customers, outbound, build repeatable growth, investor conversations) with exactly one terminal. (3) Worked examples are labelled "Illustrative example, not a real company" and use no name, figure or outcome that could be read as a WE company. (4) No `HowTo` structured data. (5) The same source rule as articles (W8-9) for every new factual sentence.

**Write set** (8 patterns, pools P1): `src/content/playbooks/**`, `src/content/pages/playbooks/**`, `src/pages/playbooks/**`, `src/components/playbooks/**`, `tests/unit/wp-86/**`, `tests/e2e/wave8/wp-86/**`, `.astro-magazine/handoffs/wp-86*`, `.astro-magazine/sources/wp-86.json`.

**Acceptance criteria**
- A unit test over every playbook asserts the five added elements exist, the next-playbook chain forms a single path with exactly one terminal and no cycle, and every illustrative example carries the exact label; the sources ledger covers every new factual sentence; the existing `wp-04` invariants (converted by WP-60) are green.
- No HowTo JSON-LD (unit); no new image; no sentence about WE's results or timelines; the claims audit is clean; the legal and funding playbooks say what to ask counsel and never what to do.
- Lighthouse 1.0 and axe zero on two sampled playbooks, one existing and one new.
- The handoff records the WP-47 closure evidence for playbooks (which changed, before and after word counts).

**Push plan.** One push for the five existing playbooks, one for the five new ones, one fix. Four pipelines in the budget.

**Dependencies.** Gate in the table above. The playbook chain links to a new playbook only when it is live (fail-closed), so the two pushes do not depend on each other.

---

### WP-87 Guides, templates and the readiness check (stage 1D, R3, P1, RICE 0.7, 5 sessions; absorbs the other half of WP-47, #36)

**Why.** Guides and templates are the evidence-backed tools founders use between reading and applying. The four guides and six templates are strong but few, and the readiness check on `/fundability/` is where several journeys end. WP-47's guide and template scope lands here.

**Scope.** (1) The four existing guides (`safe-explained`, `data-room`, `investor-readiness-checklist`, `investor-updates`) under about 900 words are deepened to about 900 to 1,400 with an evidence block; guides already longer are not padded. (2) About four new guides, provisional titles: a founder's term sheet checklist, a security questionnaire answer guide, a pricing experiment guide and a customer interview synthesis guide. (3) About six new templates (`.md`, the library pattern), provisional: landing page brief, pricing page checklist, job description template, outreach sequence worksheet, interview synthesis sheet and decision log. The library index lists them from the collection. (4) The readiness-check island and its script gain links to the new desks and no new claim; `src/content/pages/fundability/**` and `src/pages/fundability/**` link the new guides. (5) Every new factual sentence has a fetched source (W8-9); worked examples carry the exact "Illustrative example, not a real company" label.

**Write set** (13 patterns, pools P1): `src/content/guides/**`, `src/content/pages/fundability/**`, `src/pages/fundability/**`, `src/components/fundability/**`, `src/content/library/**`, `src/pages/library/**`, `src/components/library/**`, `src/components/islands/we-readiness-check/**`, `src/scripts/readiness-check.ts`, `tests/unit/wp-87/**`, `tests/e2e/wave8/wp-87/**`, `.astro-magazine/handoffs/wp-87*`, `.astro-magazine/sources/wp-87.json`.

**Acceptance criteria**
- Guide, template and library unit tests (rubric for each collection: required sections, evidence block, label, link targets live); `wp-04` invariants and `wp-12` library tests green; Markdown twins build for the new templates without a lint warning.
- The readiness check's statements are unchanged (existing ids and wording; additions only, W8-28) and its e2e is green with the new links.
- No new image; no HowTo structured data; the claims audit is clean; `safe-explained` keeps its `data-generic-definition` markers.
- Lighthouse 1.0 and axe zero on one sampled guide, one template, the library index and `/fundability/`.
- The handoff records the WP-47 closure evidence for guides and templates.

**Push plan.** Checkpoint 1: existing guides and the readiness check (push). Checkpoint 2: new guides and templates (push). Four pipelines in the budget.

**Dependencies.** Gate in the table above.

---

### 5.5 Stage 2: journey suite and integration

### WP-90 Customer-journey end-to-end suite (stage 2, mandatory, RICE 3.0, 3 sessions)

**Why.** The CEO made the customer journey a first-class requirement (W8-25). A journey that is only documented can rot; one that is walked by a browser in CI cannot. This package encodes the four audience maps of contracts section 11 as tests that move through the site by clicking links, the way a visitor does.

**Scope.** (1) `tests/e2e/wave8/journeys/maps.ts` holds the four maps (startup, investor, partner, corporate) as data: for each, the ordered pages across the five stages, the expected primary and secondary action per page, and the form or brief at the end. (2) One spec per audience walks the map from the home page by clicking visible links only (no `goto` after the first page), asserting at each page the stage's primary and secondary actions and href, a forward link (no dead end), click depth from home to each conversion page of at most three, and the thank-you page after a mocked-endpoint submission. (3) A disabled-endpoint variant proves each form says plainly that it is not yet accepting requests and offers no `mailto` except on `contact` and `apply` (contracts section 3.4). (4) A unit test (`tests/unit/wp-90/maps.test.ts`) asserts that every page in a map is in the ledger, every page family in the registry appears in at least one map, and a map step whose route has `launch: false` (a cut page) is skipped by the suite and listed in its output. (5) Projects `wave8-desktop-1440x900` and `wave8-mobile-390x844`, in the `e2e:wave8` job.

**Write set** (4 patterns, pools P1, P2): `tests/e2e/wave8/journeys/**`, `tests/unit/wp-90/**`, `.astro-magazine/handoffs/wp-90*`, `.astro-magazine/sources/wp-90.json`.

**Acceptance criteria**
- All four maps pass on both viewports against the merged `demo` build, with every stage reachable by links and the action pairs of contracts section 6.2 present; a deliberately broken fixture (a removed forward link) fails the suite.
- The suite does not depend on timing; each form step uses a mocked endpoint and an unmocked disabled variant.
- A cut page is reported, not silently skipped (the output lists the steps skipped and why).
- No new third-party request; the suite adds no dependency to `package.json`.

**Push plan.** One push when every other package is merged or cut, two fix pushes in reserve. Three pipelines in the budget.

**Dependencies.** Every other package merged or cut by name (4.6). WP-99 follows.

---

### WP-99 Integrator (stage 2, mandatory last, RICE 3.3, 3 sessions; absorbs WP-50 scope, #39)

**Why.** Wave 7 showed that a final integration package finds what no single package can: dead links across packages, a nav snapshot that disagrees with reality, a gate that still allows what it should not. Wave 8 has 32 packages and a release gate that must pass with an empty `RELEASE_ALLOW`, so this package proves that rather than assuming it.

**Scope**
1. **Seams.** Verify the cross-package links that only make sense when everything exists (articles to briefs and tools, playbooks to briefs through the end bands, `/insights/` to the 14 desks, the home audience strip to live routes, segment pages to their reading paths) with a scripted check in `scripts/lib/wave8/` and a unit test. WP-99 owns no content file, so a missing seam is fixed by a one-line edit to the merged file through an `ownership.json` exceptions entry naming the file and the finding, added in the same commit (`scripts/check-ownership.mjs` honors an exception for any path). Seam fixes are limited to links and navigation text; a new sentence needs a ledger row and a claims-audit pass like any other. Desk page sentence requests from the article packages are applied the same way.
2. **Navigation final.** The mega menu and audience lens in their final form against the real route set; `tests/unit/foundation/fixtures/nav-snapshot.json` regenerated; every link resolves; `aria-current` on each page; keyboard and screen-reader pass on the mega menu (declared exception, `src/data/nav.ts`).
3. **Lighthouse.** `lighthouserc.json` entries for every new route, with a representative article per desk, each squeeze page, each family page and each tool.
4. **Cut execution and release gate.** Execute the cut list (4.6): flip the registry entry of a cut brief, industry page or comparison page to `launch: false` with a reason (declared exceptions on `src/data/families.ts` and `src/data/routes.ts`); a cut article or desk needs no change because its row derives from a file that does not exist. Remove the pending wave 8 patterns from `RELEASE_ALLOW`; run `verify:release` with an empty value and confirm it reports only the disabled form routes (and the routes the owner keeps off, such as the brand kit); prove the mirror and release jobs still behave (rehearsal in the handoff, with the pipeline link). Declared exceptions: `.gitlab-ci.yml`, `RELEASE.md`, serialized with the release lane (W8-11).
5. **Invariants at release.** Article count, desk count and per-segment article count against the targets, with each shortfall listed; brand audit (WP-71) re-run on the final build, with each finding routed to a seam fix or the handoff.
6. **End-to-end seams** (`tests/e2e/wave8/wp-99/**`, projects `wave8-*`): the mega menu keyboard path; each form's disabled state and, with a mocked endpoint, its success and error states; a sample of every family at both viewports. The journey maps are WP-90's.
7. **Gated-content proof on the final build.** `audit-gated-briefs` against the final `dist`, the sentinel count, and a spot-check of ten percent of quotes across the new sources ledgers (every selected quote re-fetched, mismatches reopen the owning package).
8. **Counsel register.** Add the proposed CR entries from the WP-63, WP-64, WP-65, WP-75 and WP-80 handoffs to `.astro-magazine/release/RELEASE.md` after confirming no wp/30 merge request is open; the entries quote the rendered sentence with its file and line at the time of commit.
9. **Handoff.** `docs/wave8-handoff.md`: what shipped (in capabilities), the cut list, every operator input with its status, the closure evidence for #36 and #39, the known gaps, and the exact steps to flip the forms live (DP-W8-14).

**Write set** (9 patterns, pools P2): `tests/e2e/*.spec.ts`, `tests/e2e/support/**`, `scripts/lib/wave8/**`, `docs/wave8-handoff.md`, `.astro-magazine/handoffs/wave8*`, `tests/unit/wp-99/**`, `tests/e2e/wave8/wp-99/**`, `.astro-magazine/handoffs/wp-99*`, `.astro-magazine/sources/wp-99.json`.

**Declared exceptions (10):** `src/data/routes.ts`, `src/data/nav.ts`, `src/data/families.ts`, `src/data/desks.ts`, `tests/unit/foundation/fixtures/nav-snapshot.json`, `.gitlab-ci.yml`, `lighthouserc.json`, `.astro-magazine/decisions.md`, `.astro-magazine/ownership.json`, `.astro-magazine/release/RELEASE.md`.

**Serialize with the release lane (W8-11, confirm no wp/30 merge request is open):** `.gitlab-ci.yml`, `.astro-magazine/release/RELEASE.md`.

**Acceptance criteria**
- `verify:release` with an empty `RELEASE_ALLOW` reports exactly the form routes (disabled) and the routes the owner keeps off, nothing else; recorded with the pipeline link.
- The nav snapshot matches; no link anywhere points to a route absent from the ledger; `audit:links` and `audit:wired` green; WP-90 green on the final build.
- `audit-gated-briefs` green on the final `dist`; the quote spot-check has zero mismatches (or the owning package is reopened and its merge request fixed before release).
- Lighthouse 1.0 on every new route and axe zero; the sentence ledger and the claims audit clean on the whole site.
- The invariants report lists every shortfall against the plan (articles, glossary, FAQ, briefs, segments) and each is either met or in the cut list.
- The handoff exists, lists every operator input, and says which GitLab issues the integrator may close (#36, #39) and which stay open (#37).

**Push plan.** Checkpoint 1: seams, nav, Lighthouse, cut execution (push). Checkpoint 2: invariants, e2e, proofs, counsel register and handoff (push). Five pipelines in the budget (the release rehearsal is one).

**Dependencies.** All other packages merged or cut by name. It closes the wave.

---


## 6. Decision points, irreversible steps and risks

No work package deletes data or changes billing. Provisioning cloud resources, a DNS name and a customer-data store are outward-facing and sit outside the repo, so they are operator steps with defaults (section 7). Defaults are what the plan assumes if the operator stays silent. IDs are prefixed DP-W8 to avoid collision with wave 7's DP-1 to DP-14.

| ID | Decision | Default in this plan | Owner | Reversibility |
|---|---|---|---|---|
| DP-W8-1 | Release train | Wave 8 is not folded into release candidate 2. The counsel target stays rc2 (the owner's keep-demo-branch decision, commit a54f672); wave 8 ships as the next release after rc2 because it adds investor, partner, brief, comparison and sector wording and a customer-data collection path that counsel has not seen. Alternative: fold wave 8 into rc2, which restarts counsel review on a much larger surface. | Operator | Reversible (tag order) |
| DP-W8-2 | Securities-adjacent investor wording | Proposed CR entries go to counsel before the release that carries `/investors/**`; no merge gate, a release gate. Wording stays within "WE makes no promise of funding", the verbatim disclaimer and "Not an offer of securities". | Counsel | Reversible until released |
| DP-W8-3 | Brief email sender and mailbox | Agents write the sender as configuration (`site.mailboxes` confirmed value, ACS verified domain), never a guessed address. Until confirmed the email template renders a clearly marked placeholder only in test fixtures, never on a page. | Operator | Reversible |
| DP-W8-4 | Nurture sequence (day 3, 10 and 21) | Built, off: `NURTURE_ENABLED=false`, `flags.briefUpdates` OFF, `consentUpdates` field absent from the live forms. Enabling sends email to people; an email cannot be unsent, and counsel must approve the consent wording and sequence first. | Operator and counsel | Irreversible once sent |
| DP-W8-5 | Azure and Dataverse provisioning | Only through IaC and the designated workflow, never by hand, never by an agent. Agents write the code and the runbook. | Operator | Reversible (IaC) |
| DP-W8-6 | Front Door and DNS for `intake.worldenterprise.org` | A merge request to `FocusApiary/infrastructure` adds the custom domain to the shared profile; the operator merges it and creates the DNS record. The name is public by necessity (a browser must reach it) while the origin answers 403 to anything but the Front Door. | Operator | Reversible; DNS names are cached |
| DP-W8-7 | Corporate-email gate on briefs | Not ported. GE blocks consumer mail domains for its enterprise buyers; WE's audience is founders, who often use personal addresses, and a gate would contradict "attract startups". | Operator | Reversible |
| DP-W8-8 | Bot protection beyond honeypot and rate limit | Not adopted (no Turnstile, no third-party script; D-14 and the no-third-party rule). Honeypot, per-address and per-email rate limits and idempotency only. Revisit only on observed abuse. | Operator | Reversible |
| DP-W8-9 | Research briefs stay open | The four existing research briefs and the library stay open and indexable (W8-16); only the ten new executive briefs are gated. Gating existing content would remove pages the site already serves and reopen the claims review. | Operator | Reversible |
| DP-W8-10 | Portfolio | Empty. `PortfolioShowcase` renders the fixed empty-state sentence until a company's written consent record exists; no logo, name, metric, quote or example company is ever invented (W8-17, OP-PORTFOLIO). The showcase-format page has no example. | Operator | Reversible |
| DP-W8-11 | Cut line if the due date slips | The six steps of 4.6, in order: sectors and operations desks, B-marked articles and the second half of glossary and FAQ growth, industry and comparison pages 5 to 7, briefs 5 to 10, new playbooks, guides and templates. Never WP-60, the WP-61 code, WP-71 core templates, WP-62 to WP-65, WP-72, WP-73, WP-91, WP-90, WP-99, briefs 1 to 3 and the first eight titles of each article package. | Orchestrator | Reversible |
| DP-W8-12 | Partner evaluation criteria | WP-65 proposes criteria the page states (founder-first terms in writing, accurate offer description, relevance to a stage, no exclusivity request); the operator confirms before release. Until then the page says only what an enquiry should contain. | Operator | Reversible |
| DP-W8-13 | Consent to updates | The `consentUpdates` checkbox exists in the contract but is not rendered while `flags.briefUpdates` is OFF; no mailing list is created. | Operator and counsel | Reversible until emails are sent |
| DP-W8-14 | Flipping the forms live | Setting `PUBLIC_WE_INTAKE_API_URL` for the release build makes all six form kinds live at once. Preconditions, in order: the privacy notice describes the CRM use (OP-RETAIN), the service is provisioned and healthy (OP-AZURE, OP-FD, OP-DV, OP-MAIL), counsel has cleared the consent wording (OP-COUNSEL). Collecting personal data in a store is the point of no practical return for the data it holds. | Operator | Data collected is not unwound by a redeploy |
| DP-W8-15 | The comparison page whose subject is the word "accelerator" | WP-60 adds `allowPaths` entries to the denylist rule `C-13-peers` for `/compare/incubator-vs-accelerator/` and its Markdown twin, and records them in the counsel queue. Every generated list (hub card, nav, palette, footer, sitemap page, feeds) renders the entry from a label without the word (contracts section 8.1). If the audit flags the slug in a link or in `sitemap.xml` (Q-7), WP-60 renames the slug to `incubator-vs-other-programs` before any page exists. No other path gains an exception and no other page uses the word. Alternative: no such page; WP-99 flips its registry row to `launch: false`. | Operator and counsel | Reversible (flip the row, remove the entry) |
| DP-W8-16 | Durations and the literal "30/60/90" | Not used anywhere on the customer-journey pages or in WE's own sentences. The first months are written as a sequence, because the program pages promise no durations (C-16) and a "30/60/90" plan would read as a promise. Articles about a reader's own hire may describe a first-weeks checklist but not the literal. | Operator | Reversible |
| DP-W8-17 | Due date | 2026-10-31, moved from 2026-10-24 by the scope expansion. The schedule in 4.6 reaches 2026-10-29 on its stated assumptions, which include an unmeasured pipeline duration. | Orchestrator | Reversible |

### Risks

| ID | Risk | Likelihood | Effect | Mitigation |
|---|---|---|---|---|
| R-1 | The due date is aggressive: wave 7 must close first, then 32 packages | High | Release slips or scope cut | Cut lines (4.6); WP-60 split into two checkpoints so articles start at 60a; 10 agents in parallel; A marks first; slot protocol keeps CI from collapsing under load |
| R-2 | Pipeline duration on the shared runner is unmeasured, and 116 pipelines at five at a time need at least 24 durations of wall clock | High | The schedule in 4.6 is optimistic | WP-60 records the first three durations in its handoff; the orchestrator recomputes the schedule; batch pushes of 8 to 10 articles; two fix pushes at most per package; the cut list is ordered |
| R-3 | A new sentence trips a denylist trap (peers, cohort, mechanics, success-fee literal, certification, "free") | High | Red claims audit, late rework | Contracts section 0.1 lists each trap with its remedy; WP-60 adds a rule only after proving the unchanged build clean; the article rubric and the package scans fail early; `data-generic-definition` and `C-13-peers` marker discipline |
| R-4 | A legacy test pins a count or a sentence a package must change | Certain | Red unit job | W8-18: one owner per test, split before change, test count unchanged; the pins checker covers every test file (section 8.3) |
| R-5 | Wave 7 branches (41, 46, 49) add files a wave 8 package needs, or are abandoned | Medium | Overlap or an orphaned file | WP-60 entry gate re-runs coverage, pins, overlap and prose on the post-wave-7 tree and updates the JSON until zero (W8-27) |
| R-6 | Gated brief text leaks into `dist` through search, twins or `llms-full.txt` | Medium | Gated content becomes public and cannot be recalled | Briefs live outside `src/`, only abstracts in the collection, sentinel audit including decoded Pagefind fragments, `--self-test` proving the audit sees leaks, WP-99 re-runs it on the final build; ten briefs raise the surface, not the mechanism |
| R-7 | Live intake never gets provisioned in the window | Medium | Forms stay disabled | Disabled state is honest and tested; milestone success does not depend on provisioning; the runbook turns it into a checklist |
| R-8 | Source-fetch burden: 104 articles, 10 briefs, three glossary and FAQ sets and the family pages, with about 300 fetches for articles alone | High | Time, dropped claims, thin articles | Source rule drops unsourced sentences, never softens them; A and B marks put the buffer where it belongs; each package carries its own fetch ledger; WP-99 spot-checks ten percent of quotes |
| R-9 | Invention pressure from volume: segment, industry, comparison and journey pages invite specifics the site cannot support | High | A false claim ships on a page that looks routine | "Considerations for" rule (W8-24); a sentence ledger per page; standing sentences; unit scans for client names, numbers, durations and superlatives; the neutrality test on comparisons; OP-SEGMENTS and OP-PROCESS raise the questions instead of answering them |
| R-10 | 104 articles overlap or contradict one another across desks | Medium | Mixed advice, duplicate pages | Titles are distinct per package and listed in the plan; slugs unique across desks (test); `related` cross-links; WP-99 seam check lists near-duplicate titles |
| R-11 | Counsel register line numbers drift when pages change | Medium | CR entries quote stale lines | WP-99 writes the CR entries last, from the final rendered text |
| R-12 | Sätteri has no insert operation for the mid-body band | Medium | Mid-body CTA needs the fallback | WP-60 verifies at 60b and falls back to a layout-filled marker; recorded in the handoff |
| R-13 | Two agents need `.gitlab-ci.yml` or `RELEASE.md` | Low | Merge conflict in the release lane | W8-11: WP-60 and WP-99 serialize with the release lane and confirm no wp/30 merge request is open first |
| R-14 | Voice drifts toward accelerator language ("cohort", "mentors", "perks") | High | Claims review fails | W8-15 copy bans as unit tests over every new page and article; `W8-C13-own-peers` |
| R-15 | The push-slot script needs `flock` and `glab` in every agent's environment | Medium | An agent cannot push, or pushes outside the protocol | `push-slot.sh` self-test runs in CI (a unit test that skips cleanly without `flock`); fallback in 4.2 step 6: the orchestrator hands out push turns by message, five open at a time |
| R-16 | Ten worktrees on one machine, each wanting dependencies for local unit tests | Medium | Disk, CPU and install time | Local checks are the node unit tests only, where a worktree already has dependencies; otherwise the package relies on CI; builds never run locally |
| R-17 | Entry gate waits on wave 7, so wave 8 cannot start | Medium | Wave 8 starts late | Entry gate is explicit (W8-27); the plan, contracts and bundle are already complete, so WP-60 starts the hour wave 7 closes; packages that need only 60a start next |

---

## 7. Open questions and operator inputs

### 7.1 Open questions

- **Q-1.** Does the Sätteri rehype context accept an insert operation for a mid-body element (contracts section 6)? WP-60 finds out at 60b with a unit test and chooses the plugin or the layout-marker fallback; the plan works either way and the cost is one component.
- **Q-2.** Which Dataverse environment should the WE business unit live in: the environment GE uses (default, as GE does, with a new business unit and owner team) or a separate one? The default keeps one operator surface; a separate environment isolates data. OP-DV.
- **Q-3.** What retention period applies to engagement records and brief requests? The privacy notice avoids a number until the operator supplies one (OP-RETAIN).
- **Q-4.** Is the library data-room template slug the evidence-room page should link to present on `demo` after WP-49 merges? WP-64 resolves against the post-wave-7 tree; if absent, the checklist stands alone.
- **Q-5.** Which hosts beyond the allowlist WP-60 defines should article sources be allowed to cite (state agencies, standards bodies, regulators)? Each package proposes additions in its handoff; OP-HOSTS approves. With 104 articles and four regulated sectors, this list will be long.
- **Q-6.** Should an individual founder with no company be a person-level Account or a Contact only? The default is a person-level Account (as GE does for non-corporate addresses); confirm in OP-DV.
- **Q-7.** Does `scripts/audit-claims.mjs` scan the `href` attribute text of built HTML? If it does, every page that links to `/compare/incubator-vs-accelerator/` would trip `C-13-peers` through the slug alone. WP-60 measures it (60b item 13) on a fixture, covering `href` values and `<loc>` text in `sitemap.xml` and the feeds. If any scanned surface flags the slug, the slug becomes `incubator-vs-other-programs` in the registry before any page exists; the `allowPaths` list never grows past the page and its twin. **Resolved 2026-10-10 (60b item 13): the audit ignores `href` but flags the slug in JSON-LD, `og:url`, `<loc>` and a feed, so the slug is `incubator-vs-other-programs` and `allowPaths` holds one entry, for that page (its Markdown twin maps to the same route). Measured detail in `docs/wave8-contracts.md` section 8.1.**
- **Q-8.** How long does one branch pipeline take on this runner, and does the job set run in parallel? Not measured. WP-60 records it from its first three pipelines and the orchestrator recomputes the schedule (4.2, R-2).

### 7.2 Operator inputs

Every item below is outside the repo. Agents never create a cloud resource, a Dataverse object, a DNS record or a CI/CD variable, and never route around a missing one; the pipeline stays green and the dependent job stays absent until the input exists. Names only: no secret value appears in Git, in an issue or in this plan.

| ID | Needed | Why and what exactly | Default if absent |
|---|---|---|---|
| OP-AZURE | Azure subscription and resource group for the intake service, a workload-identity federation (OIDC) for the CI deploy job, and three GitLab CI/CD variables (names proposed: `INTAKE_AZURE_CLIENT_ID`, `INTAKE_AZURE_TENANT_ID`, `INTAKE_AZURE_SUBSCRIPTION_ID`) | `intake:deploy` needs them; it was designed to appear only when they exist | Deploy job absent; code and tests complete |
| OP-FD | Merge the Front Door Terraform merge request in `FocusApiary/infrastructure` and create the DNS record for `intake.worldenterprise.org` | Browser reach to the endpoint, through the shared profile | Endpoint unreachable; forms disabled |
| OP-DV | Dataverse: create the WE business unit, owner team and application user through the designated workflow (code supplied by WP-61); confirm environment (Q-2) and person-level Account policy (Q-6) | Where engagements are written | No writes possible; service reports unconfigured |
| OP-MAIL | Confirmed mailboxes (`site.mailboxes`), ACS Email sender domain verification, the reply-to address | Brief delivery email | No brief email; forms disabled |
| OP-RETAIN | Retention period for engagement and brief-request records; sign-off that the privacy notice describes CRM use | The notice must say what happens to data before the forms go live (DP-W8-14) | Notice carries no number; forms stay disabled |
| OP-COUNSEL | Counsel review of the proposed CR entries (investors, partners, briefs, comparisons), the consent wording and the nurture sequence | Release gate, not merge gate (DP-W8-2, DP-W8-4) | Not released |
| OP-PORTFOLIO | A written consent record per company before it appears in the portfolio | `PortfolioShowcase` renders only consented entries | Empty-state sentence |
| OP-COHORT | Whether and when WE may state that companies are formed in groups or cohorts | Several denylist rules ban peer and cohort language about WE | No such statement |
| OP-PARTNER | Confirm or amend the partner evaluation criteria WP-65 states | DP-W8-12 | Page states only what an enquiry should contain |
| OP-ENDPOINT-VAR | `PUBLIC_WE_INTAKE_API_URL`, value `https://intake.worldenterprise.org/api/intake`, set for the release build only. Not a secret | Turns every form live (DP-W8-14) | Forms disabled, honestly |
| OP-HOSTS | Approve additions to the article source-host allowlist | Source rule (W8-9, Q-5) | Only allowlisted hosts |
| OP-RELEASE | Choose the release train (DP-W8-1) and cut the `release-*` tag; the mirror job and release gate are the release lane's | Wave 8 does not self-release | Wave 8 waits on `demo` |
| OP-FLAGS | `flags.briefUpdates` and `NURTURE_ENABLED` stay OFF until counsel clears them | DP-W8-4, DP-W8-13 | Off |
| OP-BRAND | Brand-owner usage sign-off for the brand kit page | `/press/brand-kit/` is built behind its existing `launch: false` row; it goes live on sign-off | Page absent from sitemap and nav |
| OP-OG | A photography-lane request for dedicated per-family Open Graph cards (the card list is in the WP-71 handoff) | Families reuse the nine existing cards through `ogSlot` | Existing cards only |
| OP-SEGMENTS | Confirm how the eight founder segments are positioned, in particular corporate innovators, student and global remote founders | Segment pages state no eligibility beyond `/program/who-its-for/` (W8-24) | General situation text, one path to apply |
| OP-PROCESS | Confirm any detail of what happens after an application beyond the five steps the program pages already state | The journey pages add no step and no duration (WP-72, DP-W8-16) | Five steps and the questions a founder can ask |
| OP-CRITERIA | Confirm any investor readiness criterion not already in the existing checklist and guides | `/investors/readiness-criteria/` restates existing statements only (WP-64) | Existing statements only |

Key Vault names (`omlab-secrets`), names only: `worldenterprise-intake-unsubscribe-key`, `worldenterprise-intake-hmac-secret`, and `worldenterprise-intake-acs-endpoint` only if the IaC does not inject it. Personal accounts, if any are needed, live in the Bitwarden vault, never in Key Vault.

---

## 8. Evidence

Method: the `hix` MCP tools were not exposed in this session; every finding comes from direct reads of files in the worktree, the extracted `origin/demo` tree, the three wave 7 branch trees and the research inputs below (shell discovery and Read). Nothing was built and nothing in the repo was modified.

### 8.1 Repo files read (worktree `~/repos/WorldEnterpriseGroup/_wt/wp-12d`, branch wp/12d at 81f14f1, `origin/demo` 05c7582)

| Area | File |
|---|---|
| Ledger and nav (frozen) | `src/data/routes.ts` (`INSIGHT_SLUGS`, `DESKS`, `insightOwner`, `launch` and `requires`), `src/lib/route-core.ts` (topic route from DESKS), `src/lib/route-state.ts`, `src/data/nav.ts`, `src/data/flags.ts`, `src/data/claims.ts` |
| Schema | `src/content.config.ts` (topic enum, collections), `src/lib/page-files.ts` (the node:fs reader pattern) |
| Forms | `src/data/forms.ts`, `src/scripts/forms.ts`, `src/lib/endpoints.ts`, `docs/forms-contract.md`, `src/components/forms/**`, `tests/e2e/forms.spec.ts` |
| Claims | `claims-denylist.json` (version 3), `scripts/audit-claims.mjs`, `.astro-magazine/release/RELEASE.md` (CR-01 to CR-20) |
| Governance | `.astro-magazine/ownership.json`, `scripts/check-ownership.mjs:33-54` (exceptions apply to any path), `.astro-magazine/decisions.md`, wave 7 plan and issue script |
| CI | `.gitlab-ci.yml` (`QA_STRICT`, `RELEASE_ALLOW`, release and mirror jobs), `playwright.config.ts`, `package.json` scripts |
| Layouts and components | `src/layouts/**`, `src/components/layout/**`, `src/components/blocks/ContextualNext.astro`, `src/components/insights/related.ts`, `src/pages/insights/**`, `src/pages/investors/**`, `src/pages/network/**`, `src/content/pages/network/index.mdx` |
| Reference and journey sources | `src/components/program/steps.ts` (the five steps), `src/content/pages/program/*.mdx`, `src/components/reference/jsonld.ts`, `src/data/glossary.yaml`, `src/data/faq.yaml`, `src/pages/glossary/`, `src/pages/faq/`, `src/pages/resources/`, the 18 article titles, the five playbooks, four guides, six templates and four research briefs |
| Tests | the test files on `demo` under `tests/unit/**` and `tests/e2e/**`, and the files the three unmerged wave 7 branches add (pins scan, section 8.3) |
| globalenterprise (read-only) | `infra/brief-delivery/**` (Function, Bicep, Terraform, brief rendering, SAS and unsubscribe logic), `src/pages/resources/[slug].astro` and the squeeze components, `Header.astro` (mega menu), `astro.config.mjs`, `src/content.config.ts` |

### 8.2 Inputs

- `wave8-gap.md` (WE GAP read) and `wave8-ge.md` (globalenterprise survey and D365 intake report, including the Logic App correction): `~/.claude/jobs/504efe46/tmp/`.
- `wave7.md` and `wave7-issues.py` as the structural precedent.
- The CEO direction of 2026-10-10, the scope expansion of the same day, and the orchestrator decisions recorded in the header of this plan.

### 8.3 Mechanical no-overlap proof

- Write sets: `wave8-writesets.json` (committed by WP-60 as `.astro-magazine/plans/wave8/writesets.json`).
- Checker: `wave8-overlap.mjs` over `wave8-lib.mjs` (run: `node .astro-magazine/plans/wave8/overlap.mjs .astro-magazine/plans/wave8/writesets.json`). Packages are compared within pools: P0b (12 packages: WP-60, 61, 71 and the nine round 1 article packages, 66 pairs), P1 (30 packages: WP-61 to WP-91 less WP-60 and WP-99, 435 pairs) and P2 (WP-90, WP-99). Any ordering inside the 10-agent and 5-pipeline limits is therefore covered. The glob comparison is exact for single-star globs and conservative when both sides hold a double star.
- Checks beyond pairs: each package against the 26 frozen paths (WP-60's 14 registered exceptions allowed), the 15 wave 8 frozen additions, the 19-path photography lane and the 8-path release lane; declared exceptions (WP-99) and the one serialization (`.gitlab-ci.yml`) are reported, not counted as overlaps.
- Registry owners: `wave8-owners.mjs` expands the registries (14 desks, 10 briefs, 8 segments, 7 industries, 7 comparisons, journey pages) into the files they derive and requires exactly one owner for each, the one the contracts name, so a registry slug can never land on a file nobody owns or two packages own.
- Base: the tracked-file list is `origin/demo` plus the files the three unmerged wave 7 branches add (post-wave-7 inputs). Those inputs are copies in the job directory; WP-60 regenerates them on the real tree at its entry gate.

Live output:

```
pool P0b: WP-60, WP-61, WP-71, WP-66, WP-67, WP-68, WP-69, WP-81, WP-82, WP-83, WP-84, WP-85 (66 pairs)
pool P1: WP-61, WP-71, WP-66, WP-67, WP-68, WP-69, WP-81, WP-82, WP-83, WP-84, WP-85, WP-62, WP-63, WP-64, WP-65, WP-72, WP-73, WP-74, WP-75, WP-76, WP-91, WP-88, WP-89, WP-77, WP-78, WP-79, WP-80, WP-86, WP-87, WP-90 (435 pairs)
pool P2: WP-90, WP-99 (1 pairs)
Patterns checked: 346; frozen entries: 26; wave-8 frozen additions: 15; photography-lane entries: 19; release-lane entries: 8
serialize with the release engineer (WP-30): WP-60 .gitlab-ci.yml  <->  RELEASE-LANE .gitlab-ci.yml
sequential hand-offs (packages that never run together, listed for the record): 6
  WP-60 src/data/cta/**  ->  WP-62 src/data/cta/**
  WP-60 src/components/cta/**  ->  WP-62 src/components/cta/**
  WP-60 tests/unit/wp-62/legacy-founders-page.test.ts  ->  WP-62 tests/unit/wp-62/**
  WP-60 tests/unit/wp-64/legacy-investors-page.test.ts  ->  WP-64 tests/unit/wp-64/**
  WP-60 tests/e2e/*.spec.ts  ->  WP-99 tests/e2e/*.spec.ts
  WP-60 tests/e2e/support/**  ->  WP-99 tests/e2e/support/**
RESULT: zero overlaps
```

Self-test (one injected conflict per rule, then the glob comparison cases, then the baseline):

```
ok   P1 pair: partners reaching the investors copy
ok   P0b pair: two article agents on one desk folder
ok   P0b pair: an article agent on another agent's desk topic page
ok   P1 pair: literal path inside another package glob
ok   P1 pair: briefs source folder claimed by the intake package
ok   P1 pair: a second brief owner on one brief file
ok   P1 pair: segment pages reaching the founders hub copy
ok   P1 pair: the founders hub package reaching the dynamic segment route
ok   P1 pair: FAQ package reaching the glossary data
ok   P1 pair: guides package reaching a playbook
ok   P1 pair: tools package reaching the journey pages
ok   P0b pair: foundation and intake on the same doc
ok   P0b pair: brand package on the page-family registry
ok   P2 pair: integrator reaching the journey suite
ok   P1 pair: the journey suite reaching a page package suite
ok   frozen: a stage-1 package on content.config.ts
ok   frozen exception dropped: WP-60 on nav.ts
ok   frozen wave-8 addition: CTA package on a layout
ok   frozen wave-8 addition: partners on the forms components
ok   frozen wave-8 addition: segment package on the family registry
ok   frozen wave-8 addition: an article package on the desk registry
ok   photography lane: investors on cards
ok   photography lane: CTA package on the gated pricing page
ok   photography lane: brand package on the OG cards
ok   photography lane: brand package on the OG slot map
ok   release lane: an article agent on the CI file
ok   release lane: a package on the counsel register
ok   declared exception sitting in a stage-1 write set
ok   declared exception sitting in a stage-1 write set: the desk registry
ok   glob: a single-star glob does not reach into a deeper folder
ok   glob: a single-star glob meets a deep glob over the same folder
ok   glob: a deeper folder never matches a single-star file glob
ok   glob: two single-star globs of different depth never meet
ok   glob: two single-star globs on one folder with compatible suffixes meet
ok   glob: two single-star globs on one folder with different suffixes do not meet
ok   glob: a literal path inside a deep glob meets it
ok   glob: two deep globs on one folder meet
ok   glob: two deep globs on sibling folders do not meet
ok   baseline map has zero failures (0)
```

Coverage (every pattern that matches no tracked file is a file this wave creates; every tracked file with no owner is reported):

```
patterns: 346; files in the base tree (demo plus the files the unmerged wave-7 branches add): 850
patterns matching no file of the base tree (files this wave creates, review for typos): 212
tracked files under src/ scripts/ docs/ tests/ .astro-magazine/ that no wave-8 package edits: 535
claimed src/content/pages/network/index.mdx -> WP-65
claimed src/content/pages/investors/index.mdx -> WP-64
claimed src/pages/investors/index.astro -> WP-64
claimed src/pages/network/index.astro -> WP-65
claimed src/components/insights/articles.ts -> WP-60
claimed src/components/insights/related.ts -> WP-60
claimed src/components/insights/DeskRail.astro -> WP-60
claimed src/components/blocks/ContextualNext.astro -> WP-62
claimed src/content/pages/legal/privacy.md -> WP-61
claimed src/pages/research/index.astro -> WP-63
claimed src/content/pages/research/index.md -> WP-63
claimed src/content/pages/insights/topic-grow.mdx -> WP-85
claimed src/scripts/forms.ts -> WP-60
claimed src/data/forms.ts -> WP-60
claimed src/layouts/ArticleLayout.astro -> WP-60
claimed src/layouts/MarketingLayout.astro -> WP-60
claimed src/layouts/HubLayout.astro -> WP-60
claimed src/layouts/FormLayout.astro -> WP-60
claimed src/components/layout/MegaNav.astro -> WP-60
claimed src/pages/insights/index.astro -> WP-60
claimed tests/unit/foundation/ledger.test.ts -> WP-60
claimed tests/unit/wp-05/articles.test.ts -> WP-60
claimed tests/e2e/support/routes.ts -> WP-60, WP-99
claimed src/data/faq.yaml -> WP-78
claimed src/data/glossary.yaml -> WP-77
claimed src/components/reference/resources.ts -> WP-72
claimed src/components/reference/GlossaryList.astro -> WP-77
claimed src/components/reference/jsonld.ts -> WP-77
claimed src/pages/tools/index.astro -> WP-76
claimed src/components/nav/commands.ts -> WP-91
claimed src/components/nav/panels.ts -> WP-60
claimed src/lib/llms.ts -> WP-91
claimed src/lib/markdown-twins.ts -> WP-91
claimed src/content/pages/press/index.md -> WP-71
claimed src/pages/press/index.astro -> WP-71
claimed src/pages/resources/index.astro -> WP-72
claimed src/pages/library/index.astro -> WP-87
claimed src/pages/playbooks/index.astro -> WP-86
claimed src/pages/fundability/index.astro -> WP-87
claimed src/pages/glossary/index.astro -> WP-77
claimed src/pages/faq/index.astro -> WP-78
claimed src/content/pages/home/index.mdx -> WP-62
claimed src/content/pages/founders/index.mdx -> WP-62
claimed src/pages/founders/index.astro -> WP-62
(per-directory breakdown and the list of patterns that create new files omitted; re-run the script for them)
```

Pins (every test file on the base has one owner or is read-only):

```
scanned 148 test files
lane-owned pins (read-only constraints): 15; acknowledged pins: 69; acknowledged entries naming a missing test: 0
orphan pins, specific file: 0; wide directory scans (invariants): 1
wide     WP-71  tests/unit/wp-10/truth.test.ts  [owner: WP-61]  reads: src/content/pages/about, src/content/pages/press, src/pages/about
```

Prose check (`wave8-prosecheck.mjs`: every file path named in backticks inside a package section is matched against that package's write set and exceptions; a miss is triaged by hand, because a path may be a read):

```
WP-60 MISS tests/
WP-60 MISS src/components/geo/**
WP-60 MISS llms-full.txt
WP-60 MISS src/components/nav/**
WP-60 MISS src/pages/tools/**
WP-60 MISS src/components/tools/**
WP-60 MISS wave8-writesets.json
WP-60 MISS wave8-contracts.md
WP-60 MISS wave8-lib.mjs
WP-60 MISS wave8-overlap.mjs
WP-60 MISS wave8-selftest.mjs
WP-60 MISS wave8-coverage.mjs
WP-60 MISS wave8-pins.mjs
WP-60 MISS wave8-prosecheck.mjs
WP-60 MISS wave8-triage.mjs
WP-60 MISS wave8-owners.mjs
WP-60 MISS wave8-push-slot.sh
WP-60 MISS wave8-push-slot-test.sh
WP-60 MISS wp/NN
WP-60 MISS forms.ts
WP-60 MISS src/lib/page-files.ts
WP-60 MISS routes.ts
WP-60 MISS '/insights/topic/[topic]/'
WP-60 MISS desks.ts
WP-60 MISS src/content/pages/insights/topic-<id>.mdx
WP-60 MISS src/content/insights/**
WP-60 MISS .astro-magazine/sources/wp-*.json
WP-60 MISS infra/intake/ci.yml
WP-60 MISS docs/
WP-60 MISS src/content/insights/<desk>/
WP-60 MISS .md
WP-60 MISS pagefind/pagefind-entry.json
WP-61 MISS docs/forms-contract.schema.json
WP-61 MISS infra/intake/briefs/<id>.md
WP-61 MISS package.json
WP-61 MISS briefs/<id>/v<version>/
WP-61 MISS briefs.json
WP-61 MISS FocusApiary/infrastructure
WP-71 MISS [vertical].astro
WP-71 MISS [pair].astro
WP-71 MISS [page].astro
WP-71 MISS OgMap.ts
WP-71 MISS llms.txt
WP-66 MISS .mdx
WP-66 MISS llms-full.txt
WP-66 MISS topic-funding.mdx
WP-67 MISS .mdx
WP-67 MISS topic-legal.mdx
WP-67 MISS topic-fundable.mdx
WP-68 MISS .mdx
WP-68 MISS topic-team.mdx
WP-69 MISS topic-ai.mdx
WP-81 MISS topic-gtm.mdx
WP-82 MISS topic-build.mdx
WP-82 MISS topic-dream.mdx
WP-83 MISS topic-starting.mdx
WP-84 MISS topic-pathways.mdx
WP-85 MISS .mdx
WP-85 MISS topic-models.mdx
WP-85 MISS topic-grow.mdx
WP-62 MISS LatestInsights.astro
WP-62 MISS HomeHero.astro
WP-62 MISS desks.ts
WP-63 MISS llms-full.txt
WP-63 MISS infra/intake/briefs/<id>.md
WP-63 MISS src/content/briefs/<id>.md
WP-63 MISS llms.txt
WP-63 MISS .md
WP-63 MISS infra/intake/src/**
WP-64 MISS src/components/blocks/
WP-64 MISS tests/unit/wp-18/copy.test.ts
WP-64 MISS src/components/reference/jsonld.ts
WP-65 MISS roles.ts
WP-65 MISS wp-15/seat-roles.test.ts
WP-65 MISS wp-11/network.test.ts
WP-72 MISS src/components/program/steps.ts
WP-72 MISS steps.ts
WP-73 MISS src/content/pages/founders/<segment>.mdx
WP-76 MISS src/scripts/
WP-91 MISS llms-full.txt
WP-91 MISS llms.txt
WP-91 MISS robots.txt
WP-88 MISS topic-sectors.mdx
WP-89 MISS topic-ops.mdx
WP-77 MISS GlossaryList.astro
WP-77 MISS jsonld.ts
WP-78 MISS jsonld.ts
WP-79 MISS infra/intake/briefs/<id>.md
WP-79 MISS src/content/briefs/<id>.md
WP-87 MISS .md
WP-90 MISS package.json
WP-99 MISS ownership.json
WP-99 MISS scripts/check-ownership.mjs
WP-99 MISS RELEASE.md
prose check: 94 path(s) named in a package section but outside its write set
```

Triage of the misses (`wave8-triage.mjs` classifies each miss; the classes and my review follow). Result: no miss is a write outside a package's set.

- **Bare file names whose full path is in the same package's set** (23): `routes.ts`, `desks.ts`, `package.json` (WP-61's is `infra/intake/package.json`), the ten `topic-<desk>.mdx` desk pages in each desk owner's set, `LatestInsights.astro`, `GlossaryList.astro`, `jsonld.ts` (WP-77), `ownership.json` and `RELEASE.md` (WP-99 declared exceptions, with full paths).
- **Reads of another package's or the base's file** (24): `src/components/program/steps.ts`, `roles.ts`, `wp-15/seat-roles.test.ts`, `wp-11/network.test.ts`, `HomeHero.astro` and `OgMap.ts` (photography lane, read-only), `src/components/blocks/`, `src/scripts/`, `src/lib/page-files.ts` (pattern to copy, not edit), `tests/unit/wp-18/copy.test.ts` (WP-60), `src/components/reference/jsonld.ts` (WP-77; WP-64 and WP-78 import it), `docs/forms-contract.schema.json` (WP-60; WP-61's server tests read it), `infra/intake/ci.yml` (WP-61; WP-60 only adds the `include`), `infra/intake/src/**` (WP-61; WP-63's squeeze pages call the endpoint), `scripts/check-ownership.mjs` and `package.json` (WP-60; WP-99 and WP-90 name them to say they do not edit them).
- **Entry-gate candidates in WP-60's section**: `src/components/geo/**` (WP-91), `src/components/nav/**`, `src/pages/tools/**`, `src/components/tools/**` (WP-76) are the post-wave-7 directories WP-60 checks for new collisions. Today they are claimed file by file: nav by WP-60 (`panels.ts`) and WP-91 (`commands.ts`), tools by WP-76 (named pages plus `src/components/tools/**`), geo by WP-91. If a wave 7 branch adds a file there that a wave 8 package must edit, WP-60 registers it at the gate and re-runs the checkers.
- **Placeholder paths** (13), each resolved by the owner check below to exactly one owner: `src/content/pages/insights/topic-<id>.mdx`, `src/content/briefs/<id>.md`, `infra/intake/briefs/<id>.md`, `src/content/pages/founders/<segment>.mdx`, `[vertical].astro`, `[pair].astro`, `[page].astro` (under `src/pages/industries/**`, `src/pages/compare/**`, `src/pages/journey/**`, all WP-71), `.astro-magazine/sources/wp-*.json` (each package its own), `src/content/insights/<desk>/` (a scan target of WP-60's rubric test, owned per desk), `'/insights/topic/[topic]/'` (a route, not a file).
- **Not repository paths** (34): the bundle script names, `wp/NN`, `llms.txt`, `llms-full.txt`, `robots.txt` (generated outputs; their generators belong to WP-91), `.md` and `.mdx` suffixes, Pagefind output, the blob layout `briefs/<id>/v<version>/` and `briefs.json`, and the infrastructure repository name.

Owner check (`wave8-owners.mjs`): every file a registry derives has exactly one owner, the one the contracts name.

```
owner check: 76 registry-derived files, 0 mismatch(es)
```

Limits. The checker compares declared sets with each other and with the four lists; the prose check covers paths but not files referred to by symbol, which were reviewed by hand. It does not check that a package keeps to its set at run time; `check:ownership` does that per branch once WP-60 registers the assignments. Re-run all checkers at WP-60's entry gate on the post-wave-7 tree.

### 8.4 What I did not verify

- `hix` MCP tools were not used (not exposed); discovery was by direct file reads.
- No build, no test run, no browser pass. Statements about what a page renders come from source, not from a render.
- Wave 7 branches 41, 46 and 49 are unmerged; the plan reads `demo` at 05c7582 plus the files those branches add, and defers re-verification to WP-60's entry gate.
- globalenterprise was read from its repository; no live Azure, Dataverse, Front Door or Key Vault inspection was done, and no cloud API was called.
- The duration of one branch pipeline on this runner (Q-8). The schedule in 4.6 and the 116-pipeline budget rest on it.
- The Sätteri insert operation (Q-1) is unverified.
- Whether the library data-room template slug exists on `demo` after wave 7 (Q-4).
- Whether the claims audit scans `href` text (Q-7).
- RICE Reach and Impact are judgments; no analytics exist by design (D-14).
- The denylist traps in contracts section 0.1 were read from the rules; no new copy exists yet to run them against, so the audit's behavior on wave 8 text is predicted, not observed.
- The claim that layouts carry no CTA slot is from the GAP read, not re-checked against the post-wave-7 tree.
- The 104 article titles, the eight segment pages, seven industries, seven comparisons, four journey pages and ten briefs are provisional and unsourced; whether each can be sourced to the standard is found out by its package. The planning figure of about three fetches per article is an estimate.
- The source host allowlist is undefined until WP-60 writes it.
- Whether the existing form-route tests already tolerate a `FORM_ROUTES` entry whose row is `launch: false` (needed if a brief is cut); WP-60 adjusts them if not.
- Whether `scripts/check-ownership.mjs` can read a second frozen key without changing its exception semantics; the plan assigns that extension and its test to WP-60 (60a) rather than assuming it.
- Whether `push-slot.sh` behaves the same under every agent's shell and with the real `glab` (its self-test uses mocks for the push and the pipeline lookup); WP-60's CI unit test and the first real pushes are the check.
- Counsel's view on any investor, partner, consent, comparison or sector wording; the CR entries are proposals.
