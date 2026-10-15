# Editorial and engineering decisions

Source of truth for scope: `.plan/SAGE-PLAN.md` (internal, untracked). Decisions D-1 to D-19 are made; they are not re-opened with the operator.

## Decisions D-1 to D-19 (copied from the plan, section 2)

### D-1

**Decision.** **Quarantine `bee90c7`; never push it.** Create local branch `quarantine/httrack-wip` at `bee90c7`, mount it as a read-only reference worktree at `/home/seantech/repos/WorldEnterpriseGroup/_refs/finbiz` (`git worktree add --detach`), repoint local `gh-pages` to `origin/gh-pages`, and start all work from `origin/demo`. Nothing is deleted; the commit stays reachable.

**Why.** Pushing puts 44 MB of unlicensed third-party template into mirrored history. This is the one irreversible-looking step; it is fully reversible because the commit is pinned by a branch. The PostToolUse "push now" nudge does not apply to this commit.

### D-2

**Decision.** **Template is inspiration only.** No template image, SCSS, JS, icon font or copy is ported. No AVIF conversion of its photography. All imagery is new (ComfyUI or whitelab vectors).

**Why.** No license file; commercial theme.

### D-3

**Decision.** **Branch model:** integration on `demo` (existing, GitLab Pages internal preview), release by fast-forward to `gh-pages`. This is an explicit override of the project CLAUDE.md rule "push directly to `gh-pages`, no branches" for the build phase only (the release itself is still a push to `gh-pages`). Each Wave 1 agent works in its own `git worktree` on branch `wp/<id>`, pushes the branch, and merges to `demo` only after its CI job is green.

**Why.** 14 concurrent agents sharing one checkout would collide; branch pipelines give each WP isolated CI feedback. Ownership is still exclusive per directory and CI-enforced.

### D-4

**Decision.** **Deploy topology = trustora pattern + GitLab QA gate.** GitLab `verify:static` (check, build, audits, Playwright, axe, Lighthouse) must be green on `gh-pages` before the launch-sequence `mirror` job force-pushes to GitHub; GitHub Actions `pages.yml` then builds, runs the forbidden-file gate, copies `CNAME` into `dist`, and deploys. The heavier globalenterprise signed-provenance model is deferred to a post-launch hardening WP (L2) because it needs key management and a second repo-variable ceremony that a marketing site does not justify at launch.

**Why.** Simplest topology that still makes GitLab the release authority in practice (nothing reaches GitHub unless GitLab is green). Residual risk: a direct push to GitHub `gh-pages` would deploy; mitigated by a push restriction that still allows the mirror identity to force-push (B-1 checklist).

### D-5

**Decision.** **CI-only verification.** No `astro build`, `astro dev`, `astro preview` or Playwright runs locally. Allowed locally: `npm ci`, `astro sync`, `astro check`, `node --test` unit tests (type/lint level). Everything else (build, audits, Playwright at 1440/390, axe, link check, Lighthouse) is a CI job or runs in a K8s-runner container against the built `dist` or the `demo` preview. CI uploads screenshots and reports as job artifacts that agents read with the Read tool.

**Why.** Global operator rules: never build locally, never test against localhost.

### D-6

**Decision.** **Re-pin the CI include** to `DroidOpsInc/launch-sequence` at an immutable SHA (start from the globalenterprise pin `7b817a720e9d89217ab74c08e8223909f51d8e26`; WP-00 verifies it is still current against repo HEAD `6c547b75...`) and drop `FocusApiary/ci-templates@main`. Override `.pages:deploy` with a Node 24 image and `SITE_DIR: dist/.`.

**Why.** Org standard; unpinned `main` is not reproducible.

### D-7

**Decision.** **Base-path handling:** use Astro `base` from env (`PAGES_BASE_PATH`) plus a single `href()`/`asset()` helper (all internal links go through it), instead of the globalenterprise post-hoc rewrite `scripts/prefix-pages-base.mjs`. Production has no base. Preview builds set `PUBLIC_PREVIEW=1` (robots noindex, canonical still points at production).

**Why.** The GitLab Pages preview is path-based; a helper is deterministic and testable, the rewrite script is a regex over built HTML. Fallback if the helper leaks: port the precedent script.

### D-8

**Decision.** **Light theme only** (`color-scheme: light`). No reversed logo (whitelab brand findings: logo is dark-on-light only; do not invent a reversed version). Dark bands may exist but never carry the logo. Recorded as an accepted exception to the project "prefers-color-scheme" suggestion.

**Why.** Brand integrity over a "nice to have".

### D-9

**Decision.** **No Tailwind, no UI framework.** Hand-written layered CSS (`@layer`) on OKLCH tokens; vanilla TypeScript custom elements for the 3 interactive islands.

**Why.** The template's 571 KB CSS is not portable and not on our tokens; the skill's token contract wants cascade layers; fewer deps keep the SBOM small (dreamlimited precedent); Astro islands need a framework adapter only if we use one.

### D-10

**Decision.** **Launch scale: 90 routes (86 indexable), 28 long-form items.** Growth path (not a commitment): 2 articles per week after launch.

**Why.** See 6.1. The skill's 150 is a ceiling and its guardrail forbids noun-swapped padding; this company has no evidence base beyond its method.

### D-11

**Decision.** **Truth by construction:** claims ladder (section 3), `launch` flags per route, `claims-denylist.json` scanned against `dist`, model-neutral commercial copy, seat price flag-gated and OFF.

**Why.** Operator constraint plus legal exposure.

### D-12

**Decision.** **Nothing that needs named people, companies, events or dates ships** unless the route ledger cites a source file. Portfolio, founder stories, mentors by name, team bios, Demo Day, cohorts, events, careers, partners and perks are `launch:false` (L2).

**Why.** Prevents fabricated social proof.

### D-13

**Decision.** **Forms:** build-time variable `PUBLIC_WE_INTAKE_API_URL` (and `PUBLIC_WE_NEWSLETTER_API_URL`) pointing at an external function (the trustora / globalenterprise pattern) is the target; a `mailto:` fallback is rendered only when the mailbox exists. Apply going live is a hard release blocker (B-2).

**Why.** Static host cannot run server code; Astro Actions need a runtime.

### D-14

**Decision.** **No analytics, no cookies, no third-party scripts at v1.0.** No consent banner.

**Why.** Privacy-first, simpler legal surface. If Sean wants analytics later: self-hosted Umami/Plausible on K8s plus a CSP change.

### D-15

**Decision.** **Search:** Pagefind (static, post-build) at `/search/`.

**Why.** 90 routes need search; no runtime needed.

### D-16

**Decision.** **Frameworks:** publish a restrained "How WE steers a team" page set from the six documented frameworks (hub + ANDROID Ops + ORBITAL deep pages; UBF, STAR, SHIFT summarised on the hub). No efficacy claims ("scientific approach" is not published).

**Why.** Source-backed only.

### D-17

**Decision.** **Registry is not self-edited.** WP-31 prepares a PR/patch to `Om-Labs/registry` proposing a `nav` entry and a "digital incubator for SaaS" clarification for the description.

**Why.** Registry is a separate source of truth.

### D-18

**Decision.** **OG images are AVIF** per project standard, with a recorded risk (FLAG-OG): some social scrapers do not render AVIF. Recommended follow-up exception (OG-only 1200x630 JPEG) is an operator decision.

**Why.** Project CLAUDE.md says AVIF only; do not silently deviate.

### D-19

**Decision.** **Authoring format for the studio:** `.astro-magazine/` is initialised with `init-editorial-studio.mjs` (not `adopt-existing-publication.mjs`, because the legacy template is not adopted). The skill's 8-cluster/150-article model is scaled down to 4 topic desks that mirror the brand motto.

**Why.** Fits the business; keeps the skill's gates.

## Accepted exceptions

- **EX-LIGHT.** Light theme only (`color-scheme: light`); no `prefers-color-scheme: dark` styles. The logo is dark-on-light only and no reversed logo may be invented (D-8).
- **EX-OG-AVIF.** Open Graph images are AVIF per the project standard; some social scrapers do not render AVIF (FLAG-OG). An OG-only JPEG exception needs an operator decision (D-18).
- **EX-CSP-META.** GitHub Pages cannot set headers. CSP and referrer policy are delivered through `<meta>` tags; `frame-ancestors`, `Permissions-Policy` and HSTS cannot be enforced and are accepted as limits (R-12). Details and the two directive exceptions are in I-2.
- **EX-NO-TAILWIND.** No Tailwind or UI framework (D-9): hand-written layered CSS on OKLCH tokens, vanilla custom elements for islands.
- **EX-CLAUDE-MD.** The operator authorised Astro and a full rebrand, overriding the repo `CLAUDE.md` "no build tools" and "push directly to gh-pages" rules for the construction phase. `CLAUDE.md` and `plan.md` are auto-synced from the org `.github` repo and are never edited here.
- **EX-SCALE.** Launch scale was 90 routes, 18 articles and 4 briefs (D-10, D-19), not the skill defaults of 150 and 8. Wave 8 supersedes the counts (D-20): the library grows to about 122 articles in 14 desks, plus a briefs system, investor, partner and customer-journey page families, and the ledger, tests and nav scale by invariant, not by count. Nothing is padded to reach a number: every article carries its own sources (W8-9) and a cut line (plan 4.6) removes the last desks first.

## Decisions made during WP-00

### W-1 TypeScript 6.0.3, not 7.0.2
`@astrojs/check@0.9.10` declares `typescript ^5.0.0 || ^6.0.0`. TypeScript 7.0.2 is the latest, but the check CLI does not support it, so the project pins 6.0.3 (R-08). Revisit when the check CLI widens its peer range.

### W-2 Pinned Launch Sequence commit
The include is pinned to `6c547b757f89ec5552b5d769dfa64700e9bd4289` (repository HEAD on 2026-10-06). The only difference from the globalenterprise pin `7b817a72...` in the files this project uses (`static-site.yml`, `pages-deploy.yml`, `preflight.yml`, `github-mirror.yml`) is additive retry and interruptible rules. The template `lint` job only runs on merge requests and the default branch, so it does not run on `demo`, `wp/*` or `gh-pages`; the project's own `verify:static` job runs on every branch.

### W-3 Preview base path
The internal GitLab Pages URL is `https://worldenterprisegroup.pages.developerdojo.org/worldenterprise`, so the preview uses `PAGES_BASE_PATH=/worldenterprise`. Production has no base (D-7).

### W-4 Fourth noindex route
The plan says 90 routes, 86 indexable, and names three noindex routes (`/apply/thanks/`, `/sitemap/`, `/404.html`). The fourth is `/search/` (a search results state is not a useful landing page; it stays crawlable with `noindex,follow`).

### W-5 Pagefind runs as an npm postbuild hook
The npm `build` script ends with `pagefind --site dist` (npm `postbuild`), so every consumer (CI jobs, the Pages job) gets the search index without extra commands.

### W-6 Machine routes in the ledger module
`src/data/routes.ts` holds the 90 page rows plus `MACHINE_ROUTES` (rss, robots, security.txt) and `L2_RESERVED` (declared, never launched). Nav items that point at an L2 or not-yet-existing route stay hidden.

### W-7 Fonts are local
The Astro Fonts API (stable in 7.3.6) is configured with the local provider and the whitelab `.woff` files, so there is no network fetch at generation time and no Google Fonts request. OFL licence texts ship beside the files.


### W-8 Chrome uses the Popover API with a script enhancement layer
MegaNav panels are `popover="auto"` opened by `popovertarget`, so they work without JavaScript; each panel carries its hub link. `src/scripts/nav.ts` adds focus return, arrow keys, hover intent (150 ms, fine pointers) and panel positioning. The browser smoke (mega-menu keyboard, no-JS fallback, mobile drawer) runs in `e2e:smoke`.

### W-9 Verify build renders the full nav (PUBLIC_NAV_FIXTURE)

**Superseded by I-3.** The fixture is retired; the nav is built from the routes that exist.

Nav hides routes that do not exist, so before Wave 1 the menu is empty. The verify build sets `PUBLIC_NAV_FIXTURE=1` so the browser tests can exercise the real menu. It is never set for preview or production.

### W-10 og:image omitted while the slot is a placeholder

**Superseded by I-4.** Every page now resolves an og:image from its section.

BaseLayout emits no og:image until WP-12 replaces the placeholder (FLAG-OG), rather than advertising a decorative graphic.

### W-11 Wordmark sized by width
The wordmark ratio is 14:1, so the header and footer logos are sized by width instead of the 36/30 px height in the brand spec.

### W-12 Ownership gate image
`check:ownership` runs on the full `node:24` image because it needs `git` and the runners are non-root (no `apk`). It only runs on `wp/*` branches and was verified against a seeded out-of-scope change on a throwaway branch.

### W-13 Styleguide and fixtures are kept out of the sitemap
`/styleguide/` is a dynamic route emitted only when `PUBLIC_STYLEGUIDE=1`, marked noindex, and filtered from the sitemap along with any `/fixture-` URL. Fixture routes use the last segment of the glob id because fixtures sit in `_fixtures/`.

## Decisions made during WP-15 (integration)

### I-1 Flag snapshot at integration (2026-10-08)

Every publication flag is OFF. Nothing flagged is published, and no test or build flips a flag.

| Flag (`src/data/flags.ts`, `src/data/site.ts`) | Value | What stays unpublished | Who flips it |
|---|---|---|---|
| `flags.seatPrice.published` | `false` (`monthlyRate` `null`, `currency` `'USD'`) | The per-seat price. The Team Composer and /pricing/ show no figure; the claims audit scans `dist` for a currency-per-seat phrase. | Operator (C-06, FLAG-PRICE) |
| `flags.legalTerms` | `false` | /legal/terms/ stays `launch:false` (not built). | Counsel sign-off (C-23) |
| `flags.pbcWording` | `false` | The footer and About do not call WE a "Delaware public benefit corporation". The legal line renders without it until counsel confirms. | Counsel (FLAG-PBC) |
| ~~`flags.limitsConfirmed`~~ | removed (WP-18, see F-3) | It had no reader. The "does not do" limits render by default under G-LEGAL; confirmation is tracked in the WP-18 handoff. | Operator (Q-17) |
| `flags.focusShiftConfirmed` | `false` | Focus Shifts are not described as used in seat operations. | Operator (FLAG-FOCUS) |
| `site.securityContact` | `null` | /.well-known/security.txt returns an empty body; the route is a machine row, not a page. | Operator, once a monitored security@ mailbox exists (C-22) |
| `site.mailboxes.hello`, `.apply` | `confirmed: false` | No mailto fallback is rendered. | Operator (B-2) |
| `PUBLIC_WE_INTAKE_API_URL`, `PUBLIC_WE_NEWSLETTER_API_URL` | unset in production builds | /apply/ and /contact/ render their forms disabled; /newsletter/ is `launch:false`. | Operator provisions the function (D-13, B-2) |

`flags.seatPrice.currency` was added during integration because the Team Composer reads it only when the price is published; it does not publish anything.

### I-2 Content Security Policy (Astro `security.csp`)

The policy is built in `src/lib/csp.ts` and enabled in `astro.config.mjs`. Astro emits it as a per-page `<meta http-equiv="content-security-policy">` with SHA-256 hashes for every script and style it processes, and `BaseLayout` hashes the one inline style (the `@layer` order declaration) with `Astro.csp.insertStyleHash`.

- `default-src 'self'`, `img-src 'self'`, `font-src 'self'`, `object-src 'none'`, `base-uri 'self'`.
- `script-src 'self' 'wasm-unsafe-eval'` plus hashes. No `unsafe-inline`, no `unsafe-eval`.
- `style-src-elem 'self'` plus hashes; `style-src-attr 'unsafe-inline'`.
- `connect-src` and `form-action` are `'self'` plus the origins of the two endpoint variables when they are set at build time. A malformed endpoint URL fails the build.
- The browser tests fail on any console error, so a blocked resource on any launched route fails `e2e:routes`; `e2e:routes` also asserts the policy on five sampled pages.

Accepted exceptions:

- **EX-CSP-WASM.** `'wasm-unsafe-eval'`: Pagefind compiles its WebAssembly index reader. It does not allow `eval()`.
- **EX-CSP-STYLE-ATTR.** `style-src-attr 'unsafe-inline'`: about 14 elements set CSS custom properties or SVG `stop-color` in a `style` attribute (for example `style="--grid-min:16rem"`). Script stays locked to `'self'` and hashes, so an attribute cannot run code. Replacing them with classes is hardening work (L2), not a launch blocker.
- **EX-CSP-NO-HEADERS.** A meta policy ignores `frame-ancestors`, `report-uri` and `sandbox`, and GitHub Pages cannot send `Permissions-Policy`, `Strict-Transport-Security` or `X-Content-Type-Options`. The site cannot be framed-proofed on this host (R-12). Moving to a host that sets headers would close all of these.
- **EX-NO-REPORTING.** There is no violation reporting endpoint (D-14: no third-party scripts, no collection).

### I-3 W-9 retired: the nav is built from the routes that exist

`PUBLIC_NAV_FIXTURE` made the verify build show every menu entry before the pages existed, which hid 89 `/newsletter/` link errors until it was removed. Nav, footer, breadcrumbs, sitemap and the HTML site map are generated from `getRouteState().live`. The draft fixture entries (`src/content/*/_fixtures/`), the superseded smoke suite and the colliding `src/pages/[guide].astro` are deleted. The unlaunched `/newsletter/` and `/legal/terms/` routes are absent from every list.

### I-4 og:image is wired for every page (supersedes W-10)

`BaseLayout` takes `ogSlot` from the page or from `ogSlotForPath(path)` (`src/components/media/OgMap.ts`), so every page advertises an AVIF og:image of its section. D-18 still applies: some social scrapers do not render AVIF (FLAG-OG). `/research/`, `/insights/` and `/press/` fall back to `og-default`; mapping the first two to `og-resources` is a one-line change for WP-12b.

### I-5 Route state reads page files from disk

`route-state.ts` listed the page files with `import.meta.glob` over `src/pages`. Even a lazy glob puts every page module in every page's graph, so every page linked all 29 route stylesheets. It now reads the directory (`src/lib/page-files.ts`); each page links its own stylesheet and the layout's. A unit test fails if any module globs `src/pages` again.

### I-6 Sitemap lastmod

`lastmod` is the frontmatter `updated` or `updatedDate`; otherwise the git commit date of the content entry; otherwise the git date of the page file; otherwise none. It is never the build time. Git history needs a full clone, so every CI job sets `GIT_DEPTH: "0"` and `verify:static` and `check:ownership` run on the full Node image (W-12). If git is unavailable the build warns once and routes without a frontmatter date get no `lastmod`.

### I-7 Title contract

Titles are `{Page} | World Enterprise Incubator`, at most 60 characters. A page whose natural title is longer sets `seoTitle` in its frontmatter (18 insight files do), and the page heading keeps the full title.

### I-8 Links: one rule

`href()` and `asset()` are idempotent, and every component that renders a link calls `href()` itself, so a caller may pass a site path or a resolved link and the preview base is never doubled. Card props named `slot` were renamed `photo` (Astro reads `slot` as the slot attribute).

### I-9 Release gate allow-list

`RELEASE_ALLOW` is `^launched form route`: the only items `verify:release` forgives off `gh-pages` are the two forms that render disabled until the endpoint exists. Every launched route is built and no draft remains. On `gh-pages` the variable is empty, so production cannot ship with a disabled form.

### I-10 QA strictness

All qa jobs were advisory on `wp/*` and `demo` until every one had been green on one wp/15 pipeline. That happened on pipeline 64205 (sha e0c03fe), and `QA_STRICT: "1"` was then set in `.gitlab-ci.yml` (a5de47b), so every qa job now blocks on every branch; removing the variable restores allow_failure on `wp/*` and `demo`. `gh-pages` and `*negatives` branches are always strict. CI retries are 2 so one slow minute on the runner does not redden a blocking pipeline. The GitHub workflow runs the same audits with `--strict`.

### I-11 WP-12b ownership

`wp/12b` (photography pass, issue #22) owns `src/assets/photo/**`, `src/assets/og/**`, `src/components/media/**`, `scripts/build-og.mjs`, and, as exceptions, the slot id file and the `img` markup of the card, hero and home hero components (width, srcset, sizes only). `check-ownership` maps `wp/NNx` to `WP-NNx`.


### I-12 Metric fallback fonts and the font-swap stability test

Astro's generated fallback faces name `local("Arial")` and `local("Times New Roman")`. Chromium matches `local()` on a font's full or PostScript name with no aliases, so on Linux (the CI image) and Android neither face resolves and the page painted in an unscaled generic font; the swap to the web fonts then re-wrapped paragraphs and shifted the page (CLS 0.158 on the security-baseline brief at the Lighthouse phone in pipelines 64197 and 64200). `src/styles/fallback-fonts.css` adds `WE Sans Fallback`, `WE Serif Fallback` and `WE Display Fallback` faces that name the metric-compatible fonts on those platforms (Liberation, Arimo, Tinos, Roboto) and carry Astro's computed `size-adjust`, `ascent-override` and `descent-override`; `astro.config.mjs` lists them as `fallbacks`. After the change the same page measured CLS 0.000 (pipeline 64203). The plan's limit of two font preloads (display 700, serif 400) is unchanged.

Matching the average width does not make every line wrap the same way: a trailing item that is 3 percent wider in the web font wraps to a new line at one phone width and not at another (the `/program/` table of contents at 412 px, CLS 0.143). Two consequences. First, the hub table of contents is a grid with fixed-maximum tracks, so its wrapping depends on the container and not on the words. Second, the stability suite no longer compares landmark positions with fonts blocked (a 6 px tolerance failed on a hero lead that is two lines in one font and three in the other, which moves the page by far less than the budget). It holds every font file back until the page has painted with the fallback, releases them, and asserts that the layout shifts Chromium scores stay under the 0.1 budget, on every launched route at 1440, 390 and 412 px wide. Recompute the numbers in `fallback-fonts.css` when a family or weight changes (`tests/unit/wp-15/fallback-fonts.test.ts` fails if a face is missing).

### I-13 Likely-LCP images

The home hero preload takes its `type` from the imported image (`src/lib/image-type.ts`); it had declared `image/svg+xml` for an AVIF, which a browser ignores. `audit:images` now fails a preload whose type does not match its file or that no `<img>` on the page uses. The program, playbooks, fundability, apply and contact insets and the three stage images sit in the first viewport on desktop and were `loading="lazy"`; they are now eager with `fetchpriority="high"` (one per page). On phones they stack below the copy, so the high priority costs one small AVIF that is fetched a little earlier than needed.

## Decisions made during WP-18 (claims and editorial fix-forward)

Source: `.plan/qa/claims-editorial.md`. The audit rules below live in `claims-denylist.json` and `scripts/audit-claims.mjs`, with unit tests in `tests/unit/wp-18/`.

### F-1 The About nav lead does not call WE a public benefit corporation

The About mega-menu lead read "A public benefit corporation building digital companies." with no gate, while the footer, About and Press pages hide the same wording behind `flags.pbcWording`. It now reads "A digital incubator for SaaS, run by World Enterprise Group Incorporated." The denylist rule `C-18-pbc` fails the audit on any built page that says "public benefit", "benefit corporation" or "PBC" while `flags.pbcWording` is off, and stops applying the moment the flag is turned on. The audit reads the flag from `src/data/flags.ts`, so the rule and the gate cannot disagree. The wording that exists only in source (`site.legalLine`, the claims ladder, the flag comment) is not rendered unless the flag is on.

### F-2 SAGE-PLAN 5.2 amendment: no "fundable company" outcome

Approved by the orchestrator. SAGE-PLAN 5.2 specified three strings that promise an outcome WE cannot deliver (C-05, "WE promises no funding"). They are replaced everywhere they occur:

| Where | Plan wording | Now |
|---|---|---|
| Program mega-menu lead (`nav.ts`) | "...from first idea to fundable company." | "...from first idea to first customers." |
| Grow description (`nav.ts`) | "Earn customers and become fundable" | "Earn your first customers and gather evidence" |
| Services mega-menu column heading (`nav.ts`, `lines.ts`) | "Become fundable" | "Learn and prepare" |

The site description (`site.ts`, meta description, JSON-LD) now ends "WE promises no funding." The scope sentence on every page is the single form "from first idea to first customers, with the evidence an investor will ask for". The home hero reads "Build the evidence a SaaS idea needs to be a company." (the audit proposed "...that a SaaS idea deserves to be a company", which wrapped to two more lines at 390 px and pushed the hero image below the first viewport; the shorter line keeps the fold test green). The denylist rule `C-05-fundable-outcome` catches "become fundable", "to a fundable company" and "fundable companies"; "Fundability" and a reader's question such as "will this make my company fundable?" do not match. The required-text rule `R-C05-no-funding-disclaimer` fails the audit when "WE makes no promise of funding." is missing from `/`, `/fundability/`, `/investors/`, `/program/grow/`, `/services/fundability-and-investor-readiness/` or `/pricing/`.

### F-3 FLAG-LIMITS removed; the photo disclosure follows the manifest

`flags.limitsConfirmed` had no reader anywhere (the "does not do" limits render by default under G-LEGAL), so a flag that looked like a gate was not one. It is deleted. Whether the operator has confirmed those statements is tracked in the WP-18 handoff, not in code, so nobody believes a switch protects them.

The footer shows "Illustrative images, some AI-generated. Figures shown are not real people, founders, clients or WE staff." with a link to the editorial policy, only when a slot in `src/assets/photo/manifest.json` has `source: "generated"`. Today none does (38 vector-fallback rasters and 9 composed SVG), so the footer is unchanged. The audit applies the same test: once any slot is generated, every built page must carry the line (`R-photo-disclosure`), and the alt text of a generated slot must describe an activity and never an identity or role (`Q-photo-alt`). `src/lib/photo-disclosure.ts` holds the line and the test for both the footer and the unit tests, so the footer and the audit cannot disagree. Whoever lands the first generated image (WP-12b) only has to write `source: "generated"` in the manifest.

## Owner decisions of 2026-10-09 (applied by WP-18)

The owner delegated both choices to the orchestrator on 2026-10-09. They supersede operator items P1-1 and P1-2 of the WP-18 handoff. Counsel reviews the Investor Introductions wording before the gh-pages release (see the handoff).

### F-4 Owner decision: hybrid pricing model (claim C-10)

The dedicated team seat stays the unit of work. Four packages, Spark, Launch, Accelerate and Studio (names, the company stage each is sized for and its depth, from `whitelab/template/KEY-VALUES.md` section 1), are pre-configured seat plans with a fixed scope. A founder picks a package or a custom seat plan, and seats change by notice either way (C-02). The site publishes no amount: `flags.seatPrice` stays off, and `/pricing/` says how to ask for the current rate (the contact form topic "Request the current seat rate"). The "not packages" denials on `/pricing/`, the FAQ and the program copy are replaced. `/pricing/` carries a package comparison table (package, stage, depth).

C-10 moves from excluded to publish, narrowed to what the owner approved: package names, stage fit and depth. The nine-milestone scheme, the phases, Delivery Hours, every fee, the rate card, the fee-to-equity election and the twelve-month term stay unpublished, and the site does not use the words "Milestones", "Raise-Ready", "Fundability Certification" or "Delivery Hours" for them. No seat count is published per package: KEY-VALUES gives none, so the page says WE confirms the seat plan in writing when the founder asks for the rate.

The twelve-month term is deliberately not stated. It is a fact of the agreement template, not an approved web claim, and "no automatic renewal" would sit uneasily beside "seats change by notice". It is an operator item in the handoff.

### F-5 Owner decision: Investor Introductions as a paid add-on (claim C-14)

WE offers introductions to investors as a separate, paid add-on named "Investor Introductions". The structure is chosen so the service is a flat-fee preparation and curation service and not a transaction-based one:

- A flat fee covers curation and preparation. It does not depend on any investment closing.
- No success fee, no equity or carried interest, no commission, no transaction-based compensation.
- WE does not negotiate terms, advise on securities or handle funds.
- Introductions are curated and limited, and made only after readiness criteria are met. The criteria map to the artifacts of Service Line F (readiness assessment, corporate and cap-table records, evidence index, financial model, data room, pitch materials).
- No guarantee of a meeting, a reply or funding. C-05 stays: WE makes no promise of funding.

The add-on is not part of any package. A short disclaimer is shown, verbatim, wherever the add-on is named:

> Introductions are a flat-fee service. WE is not a broker-dealer or investment adviser, takes no fee or stake tied to any investment, and cannot promise a meeting or funding.

The disclaimer sentence and the sentence "The fee does not depend on whether any investment closes." live in `src/components/blocks/introductions.ts`, and `IntroductionsDisclaimer.astro` and `InvestorIntroductionsOffer.astro` render them. Updated: `/investors/`, `/network/`, Service Line F, `/pricing/`, the FAQ, the Fundable topic page and the investor-choice article. The old "WE arranges no meetings" lines are gone, and so is the word "finder" from line F.

Claims ladder: C-14 moves from excluded to publish with guardrails, and still excludes an investor network, Demo Day outcomes and any success-based or guaranteed wording. Audit rules (`claims-denylist.json`, version 2):

| Rule | Kind | What it does |
|---|---|---|
| `C-14-investor-intros`, `C-14-intro-positive` | removed | They denied the add-on. |
| `C-14-investor-network` | rule | Fails on a claimed investor network. |
| `C-14-guaranteed-meetings` | rule | Fails on a promise of meetings, introductions or investor contact. Negations pass. |
| `C-14-success-based` | context rule | Fails on success-based, contingent, commission, finder, carried-interest and equity-for-introductions wording, in the built output. A marked element (`data-claim-allow="C-14-success-based"`) may quote the wording to deny it; JSON-LD cannot be marked, so the verbatim disclaimer is written not to match. |
| `R-C14-intro-disclaimer` | required | The verbatim disclaimer on `/investors/`, `/network/`, line F, `/pricing/` and `/faq/`. |
| `R-C14-intro-disclaimer-wherever-named` | required | The same disclaimer on every page whose `<main>` names the add-on (`whenMatches`), so a new page cannot name it without the disclaimer. |
| `R-C14-flat-fee-statement` | required | The flat-fee sentence on `/investors/`, line F and `/pricing/`. |

The unit tests in `tests/unit/wp-18/` pin every pattern with positive and negative cases, and check that the denylist text equals the component text. Three cross-lane tests encoded the old position and changed with it: `tests/unit/wp-02/services.test.ts` lets line F, and only line F, cite C-14; `tests/unit/wp-08/data.test.ts` counts 18 FAQ entries (the two added are `investor-introductions` and `packages`); `tests/unit/wp-11/network.test.ts` now requires the offer block and the negotiation limits on `/investors/` instead of the sentence "does not arrange meetings with investors". The bans on "guarantee", "client", "portfolio", "mentor" and "alumni" in those lanes are unchanged.

## Decisions made during WP-12b (photography pass, issue #22)

Inputs: `.plan/photo/{art-direction.md,shotlist.json,people-policy.json,model-scout.md}`. CI has no `.plan/`, so the tests read `.astro-magazine/media/shotlist-extract.json`, a compact extract (slot sizes, aspects, srcset widths, people class, proposed alt, subject briefs, the people caps) that records the sha256 of its two sources. Phase A (this change) is plumbing only: no image was generated and every slot is still a vector composition.

### P-1 Masters are 1K at 1x: the 2048 row of the shotlist is waived

The shotlist asked for 2048x1152 masters for the 16:9 bands (band-1, band-2, band-4) and 1536x864 for band-3, so that a 1024 CSS px band is shown at 2x. The chosen model, Boogu-Image-0.1-Turbo, is 1K-native (model scout, risk 3), so every 16:9 master is 1024x576 and the 4:3 cards stay 1024x768. A band therefore renders at 1x on a HiDPI screen: slightly soft on the largest displays, and in exchange there is no upscaling artefact and no second model. The waiver is a rule, not a list: a raster master is the shotlist size scaled to a long edge of at most `MODEL_MAX_EDGE` (1024, `src/assets/photo/slots.ts`); OG cards are composed from SVG at 1200x630 and exempt. `tests/unit/wp-12b/manifest.test.ts` applies that rule to every slot. `PROFILE_SIZE['hero-home']` stays 1024x576, so `tests/unit/foundation/slots.test.ts` is unchanged. The srcset for a band is therefore 640 and 1024 (the shotlist's 1536 and 2048 candidates are wider than the file, and astro:assets can only scale down). Revisit if a native-2K model (SenseNova-U1.5, Krea 2) is adopted: change `MODEL_MAX_EDGE`, `PROFILE_SIZE` and the `hero-home` widths together.

### P-2 One responsive `<img>`, sized by slot

`AvifPicture` is one `<img>` with an AVIF `srcset`, built by `photoImage()` (`src/components/media/photo-image.ts`) from `getImage()`. There is no `<picture>` wrapper: the site serves one format, and a wrapper would change the DOM that `.hero__frame > img` and `.card__image` select on. Each slot in `slots.ts` carries `widths` (card 512/768/1024, landscape 512/1024, band 640/1024) and a `sizes` attribute for the layout it sits in; a caller may pass its own `sizes`. `width` and `height` are the largest CSS display size, not the master size (512x384 for a card, 1024x576 for a band), because `audit:images` takes the 60 KB card or 120 KB band budget, and the 1024 cap, from the width attribute, and `src` is then the 512 file. The cards, the service line aside, the stage cards on `/program/who-its-for/` and the pricing band use `photoImage()`. The hero images stay plain masters: the editorial hero, the atlas hero and the home hero are the likely LCP, already `fetchpriority="high"` with no `loading`, and the only `<link rel="preload">` is the home hero's (an LCP image that is in the first HTML does not need a preload anywhere else). Astro's `priority` option is never forwarded: it sets `decoding="sync"`, which `audit:images` rejects. Not migrated, because the files are outside this lane: the home band (`src/pages/index.astro`, a plain master at 1024x576, inside the band budget).

### P-3 Manifest schema 2

Each manifest row now carries `kind`, `aspect`, `width`, `height`, `widths`, `people` (forbidden, optional or recommended, from the people policy), `figures`, `source` (`vector` or `generated`), `model`, `seed`, `prompt`, `promptSha256`, `generatedAt`, `alt`. The seed rule is unchanged (7000 + raster index, 7100 + OG index); a candidate adds 0, 500 (second object) or 1000 to 2500 (the four figure candidates). The old values `vector-fallback` and `svg-composed` became `vector`. `source: "generated"` is the one value that turns the footer disclosure on, so the tests fail on any other spelling. `assemble-manifest.mjs` carries generated rows over unchanged when the vector fallbacks are rebuilt.

### F-6 SAGE-PLAN 4.6 amendment: figures, chest-down, on the 13 allowed slots only

SAGE-PLAN 4.6 refuses "synthetic people" and "AI-generated faces". The photography pass keeps the refusal for faces, named people, founders, staff, clients and testimonials, and admits one narrow kind of image: an unnamed, illustrative figure photographed chest-down, with the head out of frame, working at a hand-built model or a notebook. Rules (`.plan/photo/people-policy.json`):

| Rule | Value |
|---|---|
| Slots that may carry a figure | the 13 `optional` or `recommended` slots: inset-program, inset-playbooks, svc-a, svc-b, svc-d, stage-dream, stage-build, stage-grow, pb-1, pb-2, pb-3, pb-5, research-4. The other 34 never do (about, team, contact, trust, pricing, fundability, apply, network, band-*, svc-c, svc-e, svc-f, svc-g, pb-4, research-1 to 3, the topic covers and the OG cards). |
| Recommended (5) | inset-playbooks, svc-b, stage-dream, stage-build, stage-grow. The 8 `optional` slots keep an object as their default; a figure is generated only if the owner opts in. |
| Cap | at most six figure images at launch; at most one per page, except the stage trio, which carries a figure on all three or on none |
| Framing | chest-down, no head or face in frame; no eye contact with the camera; at most two figures in a card or stage image |
| Scene | knitwear in navy, grey or white, no suits; no screens, handshakes, pointing or crowds |
| Alt text | describes the activity ("One person seen from the chest down, working at a tabletop model"), never an identity, role, employer or customer |
| Disclosure | the footer line from F-3 appears with the first generated slot |

Enforced by `tests/unit/wp-12b/manifest.test.ts` (the people class, the figure count per slot, page and site, the stage set, the alt text of a generated slot), by the claims audit rules `Q-photo-alt` and `R-photo-disclosure` (F-3), and by a human look at every render before it is committed. Figure candidates are generated four to a slot (seeds +1000 to +2500); the single-amber rule passed on only 3 of 10 figure scenes in testing.

## Decisions made during WP-40 (wave 7 foundation, issue #29)

Inputs: `.astro-magazine/plans/wave7.md` (the plan, with its overlap checker and self-test in `.astro-magazine/plans/wave7/`), the operator decisions DP-1 to DP-14 and Q-1 recorded in it. WP-40 is stage 0: it lands every frozen file the wave needs so the nine stage-1 packages can run on disjoint write sets. The contracts are in `docs/wave7-contracts.md`.

### W7-1 One home for package data

`src/data/packages.ts` holds the four packages: id, name, stage key, stage fit and depth, transcribed verbatim from the table in `pricing.mdx` (C-10). It holds no amount, no seat count and no term, because none is published (F-4, C-06). `tests/unit/wp-40/packages.test.ts` fails on a digit, a currency sign or the word "seat" in any field, and asserts equality with the pricing table until WP-42 renders the table from the module, after which it asserts the page imports the module. Consumers: WP-41 (llms.txt, Offer catalog), WP-42 (cards, picker), WP-43 (the form field), WP-44 (home teaser).

### W7-2 The `package` parameter is lenient on read and strict on write

A package is addressed by id in `?package=<id>` and in the form field `package`. Reading a query value trims and lowercases it and ignores anything unknown (a stale link must still open the page, and a query string is user input), so `parsePackageParam` returns `null` rather than throwing. The form field accepts the four ids plus `not-sure` and rejects everything else (WP-43). `not-sure` is never a package id. Pages render the same markup without the parameter, so a crawler and a no-JS visitor see no selection.

### W7-3 Markdown twins sit beside their page, and the allowlist enforces it

The twin of `/insights/<slug>/` is `/insights/<slug>.md`; of `/pricing/` is `/pricing.md`; of `/` is `/index.md`. `audit-dist.mjs` refuses a `.md` file outside `library/` unless the page it mirrors (`<path>/index.html`, or `index.html` for `index.md`) was built, and adds `llms.txt` and `llms-full.txt` to the known top-level files. The alternative, allowing `.md` under a fixed list of folders, would have needed an edit to a frozen file for every new content collection. The sibling invariant needs none, and it also fails a twin that outlives its page.

### W7-4 The machine layer is audited as plain text, with the page's route

`audit-claims.mjs` now walks `.txt` and `.md` as well as `.html` and `.xml`. A text file is scanned with link addresses and bare URLs removed (a slug is not copy), a twin stands for its page's route so a route allowance applies to both, and a `data-claim-allow` marker cannot exempt plain text: a twin or an llms file cannot quote forbidden wording even to deny it. The plan said the audit already scanned these files; it did not (its walker yielded only `.html` and `.xml`), so the extension is part of this package and the self-test and `tests/unit/wp-40/denylist.test.ts` prove it with an `llms.txt` fixture.

A required rule may carry `"ifBuilt": true`: a listed route that is not built is skipped, and a built one is held to the text. This lets WP-40 require the no-funding sentence and the Introductions disclaimer on `/llms.txt`, `/llms-full.txt` and `/program/how-we-decide/` before those files exist, so no package can ship them without the text and no package has to edit the denylist to add the requirement. A listed route may be a text file; a Markdown twin never stands in for the page of the same route.

### W7-5 Commercial-model wording is a context rule, and the disclaimer is exempt by shape

Claims-denylist version 3 adds six context rules (built output only, never applied to source): `W7-C09-no-fee`, `W7-C09-no-equity`, `W7-C09-free-of-charge` (no such statement about the commercial model: the fee-to-equity election exists in the agreement and is unpublished), `W7-response-time` (DP-5: no promise of a reply or decision time), `W7-application-counts` (no application count, no acceptance rate) and `W7-package-seat-count` (no seat count tied to a named package). The verbatim Investor Introductions disclaimer contains "takes no fee or stake tied to any investment", which is the one legitimate "no fee". The `no fee` rule exempts exactly that continuation with a lookahead, and the disclaimer is a mandatory negative case in the self-test and in the unit test, for every rule, in a page and in a text file. The patterns were tuned against the current build (99 built files, zero findings) and against advice that merely mentions a response time ("choose a response expectation you can meet, such as within one working day") or a cost ("praise costs nothing"), which a rule on the bare phrase would have caught. The unconditional `C-08-success-fee` still blocks the literal "success fee", so new copy about the add-on says "tied to any investment", as the disclaimer does.

### W7-6 New routes are registered ahead of their pages

Every wave 7 route has a `launch: true` row and an owner in `src/data/routes.ts` before its page exists, as WP-00 did for the first 90, so no page-owning package edits a frozen file. A launched row with no page is out of nav and sitemap and is a warning in `audit:ledger` and a skip in the e2e route sweeps; the page file makes it live with no further edit. `verify:release` treats the same row as an error unless `RELEASE_ALLOW` covers it, so the allowance is widened with the exact paths in the same change, and WP-50 flips an unbuilt optional route (WP-48's four rows) to `launch: false` with a reason. The opposite choice is the unsafe one: a built page whose row is `launch: false` is an error on the branch. Implemented in `.gitlab-ci.yml`: `RELEASE_ALLOW` is a literal variable (`expand: false`) listing the nine pending routes and the two machine files, each anchored at the end; a release tag and `gh-pages` set it to empty, so it cannot reach a release. WP-50 narrows it back to the form routes.

### W7-7 Ownership gains `exclude`, `gated` and `lanes`, and a test that the sets are disjoint

`check-ownership.mjs` polices a branch only against its own write set, so it cannot catch two packages that collide. Three additions close that. `exclude` carves files out of a broad glob in an assignment (WP-45 holds a layout and component sweep that must not reach `Card.astro`, `HeroAtlas.astro` or `HeroEditorial.astro`, which the photography lane owns); an exception that names the path overrides it, and the checker now enforces it. `gated` marks the two files the photography lane reserves (`src/pages/pricing/index.astro` for WP-42, `src/pages/program/who-its-for.astro` for WP-43), edited only on a branch rebased on a `demo` containing WP-12d phase B; each is also an exception. `lanes` records the static floor of the photography and release lanes. `tests/unit/wp-40/write-sets.test.ts` asserts the stage-1 sets are pairwise disjoint and clear of the frozen paths and both lanes, reading the lanes from `ownership.json` plus the registered WP-12* and WP-30 assignments so a later registration extends the check. Its seeded-collision case proves the check reports a conflict. W7-9 retires the wait: `gated` is now `lane_exceptions` and means only "a photography-lane file this package edits through an exception".

### W7-8 Order, and the operator decisions that bind the wave

DP-1: WP-30 (release) merges to `demo` first; WP-40 rebases on it before touching `.gitlab-ci.yml` or `package.json`, which both own. DP-2: AI crawlers are allowed with named groups in `robots.txt` (WP-41 implements; WP-40 supplies only the ledger rows and the denylist). DP-3: no navigation slimming. DP-4 to DP-14: the plan's defaults (no dark mode; no new selection criteria, response times or process stages; no named thesis; `sameAs` is GitHub only; no named look-alike companies; no SAFE calculator; framework pages optional; machine files proceed; commercial wording limited to C-10 and C-14; no persisted form or tool state; no email-first apply). Q-1: no benchmark allowlist, so visual benchmarks stay unverified and WP-45 works from the site's own tokens; no hook or settings change. WP-12c (wave 6) also edits `package.json`, the lockfile and three files wave 7 owns (`SeoHead.astro`, `BaseLayout.astro`, `src/pages/index.astro`), so stage 1 starts after WP-12c merges.

### W7-9 The photography gate on wave 7 is lifted: phase B rebases onto wave 7

Decision of 2026-10-10, taken by the tech lead under the operator's delegation. It reverses the gate in W7-7 and in section 5 of the plan, which held three groups of files until WP-12d phase B (photo generation) reached `demo`: `src/pages/pricing/index.astro` (WP-42), `src/pages/program/who-its-for.astro` (WP-43) and the hero edits of WP-50.

**Why.** Phase B photo generation is deferred because the only GPU node that serves it is an etcd member while etcd is at 2 of 3 members. The vector compositions already in every photo slot are the shipped imagery, so a page that waits for phase B waits for nothing the visitor can see, and holding two of the P0 conversion pages behind it would delay the wave for no benefit.

**Decision.**
- The two pages and the WP-50 hero edits are released now. WP-42 and WP-43 edit their file through the exception they already hold; its reason now cites this decision instead of the phase B wait. The `gated` field is retired (`lane_exceptions` in `ownership.json` and `wave7-writesets.json`). WP-50 registers its own hero exceptions one by one, as it does for every seam fix.
- Phase B, when it resumes, rebases onto wave 7. It does not block it. It inherits the new markup and replaces the vector slots under the photography lane's own contracts, which wave 7 does not change.
- Nothing else in the photography lane is released. `Card.astro`, `HeroAtlas.astro`, `HeroEditorial.astro`, `src/components/cards/**`, `src/components/media/**` and `src/assets/photo/**` stay excluded from WP-45 and from every other wave 7 package, and `tests/unit/wp-40/write-sets.test.ts` still fails a package that reaches them.
- The photography decisions (P-1 to P-3, F-3 and F-6) are untouched.

**Consequence.** Wave 7 and phase B will both touch the pricing and who-its-for pages in the markup around their image slots. Whoever lands second resolves the merge; the slots are the contract, and they are unchanged.

## Decisions made during WP-12c (responsive heroes and declared dependencies)

### P-4 The LCP heroes and the home band are responsive; the preload names the same srcset

`HeroEditorial`, `HeroAtlas`, `HomeHero` and the home band in `src/pages/index.astro` now render the output of `photoImage()` (P-2): an AVIF `srcset`, the slot's `sizes`, and the display size as `width` and `height`. The LCP images keep `fetchpriority="high"`, `decoding="async"` and no `loading`. `HomeHero` takes the image as a prop: the home page builds `band-1` once, hands it to the hero and derives the head preload from the same object (`preloadOfPhoto()` in `src/lib/image-type.ts`), so the `<img>` and the `<link rel="preload" as="image">` carry one `srcset` and one `sizes`. `SeoHead` writes them as `imagesrcset` and `imagesizes` (with `href` as the fallback for a browser that ignores them), so the browser starts one request, not two. `audit:images` fails a preload whose `imagesrcset` or `imagesizes` match no `<img>` on the page.

Smaller variants: none is committed. The slot table already lists them (`hero-home` 640 and 1024, `card-4x3` 512, 768 and 1024), and `getImage()` writes every width from the committed master at build time, so a replaced master (WP-12b phase B) gets its variants without a second step. The 640 variant stands in for the 480 and 768 widths the brief used as examples: `slots.ts` is frozen, and a 640 file serves a 390 px phone at 1x and the 32rem hero column at 1x. A phone at 2x or more takes the 1024 master.

Editorial heroes on a 4:3 slot now report 512x384 as `width` and `height` (the slot's display size), not the 1024x768 master. The media frame is absolutely positioned and `object-fit: cover`, so nothing moves; `audit:images` takes the 60 KB card budget for the 512 file instead of the band budget for the master.

### P-5 `satteri` and `@astrojs/markdown-satteri` are declared

`astro.config.mjs` and `src/lib/rehype-table-wrap.ts` import them, and `tests/unit/wp-16/table-wrap.test.ts` imports `satteri` itself, but both were only transitive dependencies of Astro. They are now `dependencies` pinned like the rest: `@astrojs/markdown-satteri` 0.4.3 and `satteri` 0.10.5, the latest stable versions of each and the versions the lockfile already resolved, so `npm install --package-lock-only` changed nothing else.

## Decisions made during WP-30 (release pre-stage, issue #20)

### R-1 The release mirror confirms; the mirror CronJob publishes

The launch-sequence `.mirror:github` template pushed gh-pages to GitHub with a long-lived `GITHUB_TOKEN` and `--force`, and ended with `exit 0` when the token was unset, so it had only ever "passed" by doing nothing. GitHub is already fed by the `weg-ghpages-mirror` CronJob (nebula `tools/weg-ghpages-mirror`, daily 03:23 UTC): a fast-forward-only copy of GitLab gh-pages for an allowlist that includes this repository, using a short-lived installation token of the GitHub App `focusapiary-mirror-sync`. A second writer with a PAT would add a long-lived credential and a force push to a branch that already has a safe writer.

Decision: this project holds no GitHub credential. The `mirror` job is manual, gh-pages only, blocked until `RELEASE_APPROVED` is the commit being released (a lowercase hex prefix of `CI_COMMIT_SHA`, at least 12 characters; `true` is refused so a stale variable cannot approve a later release), and then only reads: it passes when public GitHub gh-pages is at this commit and fails when it is not yet mirrored, ahead, diverged, missing or unreadable. `audit:claims` also writes `reports/counsel-review.md` from the built dist for counsel.

Consequences, stated plainly: the cron publishes whatever is on GitLab gh-pages regardless of CI, so the approval gate confirms and cannot prevent. The controls that prevent are the gh-pages protection (only the owner pushes, no force) and the strict GitHub Actions build (`RELEASE_ALLOW` empty). The runbook is `.astro-magazine/release/RELEASE.md`. The launch-sequence template is fixed separately to exit 1 when its variables are unset, with an explicit `GITHUB_MIRROR_EXTERNAL=true` opt-out, in DroidOpsInc/launch-sequence MR !274.

Tested by `tests/unit/wp-30` (the approval gate, the confirmation against local remotes, the job graph, the counsel extract, and the checklist against its sources).

### R-2 A release ships from a protected tag, not from the head of demo (team decision DP-1)

Wave 7 lands on `demo` while release 1 is being approved, so the head of `demo` is not a stable release. Release N is the tag `release-N` (candidates `release-N-rcM`), annotated and protected. The `mirror` job exists only on a pipeline for a `release-*` tag, and `scripts/ci/require-release-approval.sh` refuses a branch pipeline, a tag not named `release-*` and a tag that is not protected, on top of requiring `RELEASE_APPROVED` to name the commit. A release tag runs every qa job strictly and `verify:release` with `RELEASE_ALLOW` empty, as `gh-pages` does, so a candidate tag is red until the intake endpoint exists. The owner fast-forwards `gh-pages` to exactly the tagged commit, and the confirmation compares GitHub `gh-pages` with that commit. Tags are never moved: a wording change is a `demo` merge and the next candidate. The `release-*` pattern is a protected tag rule (create: Maintainers), added through the API on 2026-10-09 and checked with a GET of `protected_tags`; the `mirror` job refuses a tag that is not protected.

### R-3 One sentence of a Fundable article is corrected under a scoped exception

`src/content/insights/fundable/choosing-the-right-first-investors-for-a-saas-company.mdx` line 37 said "It does not describe an introduction service, because World Enterprise does not offer one." The same article, at line 77, describes Investor Introductions as a separate, paid add-on, and the claims guard (`R-C14-*`) had not caught the denial. By team decision the sentence is replaced with "It is about your judgment, whether or not you also use our paid Investor Introductions add-on, which is described below." The policy is unchanged: a flat fee, no success fee, no published amounts. WP-30 holds an ownership exception for that one file (`ownership.json`), limited to that sentence. A search of `src/content`, `src/pages`, `src/components`, `src/data` and `src/layouts` for other denials found none. Because the first release candidate tag, `release-1-rc1`, already carries the old sentence and tags are never moved (R-2), the corrected text ships in `release-1-rc2`.

## Decisions made during WP-12d (photo-generation rig, issues #22 and #27)

The rig lives in `scripts/photo/` (dev tooling: never imported by `src/`, never copied to `dist/`). Phase B is `scripts/photo/phase-b.sh --model boogu_image_turbo`, a QA pass, and `node scripts/photo/promote.mjs --from-qa`. Run end to end on `mage_flow_turbo` for three slots (an object, a figure, a band); no dry-run image was committed and no manifest row was flipped.

### P-6 Model quirks live in `models.json`, never in the prompt

The prompt is model-agnostic (art-direction section 7). Everything model-specific (router id, manifest name, size limit) is in `scripts/photo/models.json`; the default is `boogu_image_turbo`, and `mage_flow_turbo` is the stand-in that was serving during the dry run. The router accepts only exact `1024x768` and `1024x576`, so the runner requests the master size and never resizes up. Candidates sit in an uncommitted staging directory outside the repo (`PHOTO_STAGING`, default `~/.cache/we-photo-staging`); a candidate is skipped on resume only if its prompt hash still matches.

### P-7 Seeds, candidates, serial runs

Seed = 7000 + raster index (shotlist order) plus an offset: objects 0 and +500, figures +1000, +1500, +2000, +2500; `checkManifest` enforces it. The runner is strictly serial (four concurrent requests wedged the router), retries 5xx and network errors with 5/15/45/90 s backoff, waits 1, 3 or 5 minutes on 503/429, treats a frame under 30 KB as the wedged blank frame, and aborts after three consecutive failures. The key is read from `HARDMAGIC_INTERNAL_KEY` or Azure Key Vault (`omlab-secrets`, secret `hardmagic-internal-api-key`) and is never printed.

### P-8 Promotion is a batch, validated as a whole, and rolls back

`promote.mjs` encodes the chosen candidate at the slot's exact master size (crop-fill, never upscale, AVIF quality 80), rewrites the manifest rows (`source: "generated"`, model, seed, prompt, `promptSha256`, `generatedAt`, alt, bytes, quality), validates the whole manifest with the WP-12b `checkManifest`, writes, runs `tests/unit/wp-12b/`, and restores the files if they fail. A batch applies as a unit so the stage trio (all or none) and the six-figure cap stay satisfiable. `generation.status` is left `pending` for the owner to flip. Only the master is committed (decision P-2: Astro builds the srcset); the smaller widths exist only on the QA sheets. Promotion writes under `src/assets/photo/**`, which is the WP-12b write set.

### P-9 QA is a rubric plus a JSON result, over JPEG sheets

`scripts/photo/qa-rubric.md` and `qa-result.schema.json` define the check (copy match, palette with exactly one amber object, people policy, artifacts, crop safety at every srcset width). `qa-sheet.mjs` builds one JPEG per candidate (master with the safe zone drawn on, the page crops, each srcset width at its own pixel width), capped at 1600 px so the Read tool can open it (a PNG sheet reached 2.4 MB). `validateQaResult` makes a `pass` impossible with a failing check, a second amber object, a face, text, fingers or a malformed hexagon, and `selectFromQa` applies the figure policy.

### P-10 Dry-run findings that changed the prompts

1. **Figure framing**: "framed from the chest down" does not keep the head out of frame on `mage_flow_turbo`. Describing a close-up at table height of only forearms and hands, with the top edge cutting through the middle of the torso, removes the face but a chin can still reach the top edge. The `facesVisible` gate in QA is therefore mandatory, and all four figure candidates per slot are generated. Boogu has not been tried; verify the figure template on one slot first.
2. **Amber accent**: an accent described as part of the structure turns a whole part amber or duplicates it. Written as one small separate tile resting on a named surface it lands once. The templates now use that form.
3. **Hexagons**: the model draws octagons and heptagons for hexagonal plates; `malformedHexagons` is a QA check, not a prompt fix.
4. **Amber pre-filter**: hue 25 to 48 matches skin tones, so figure candidates always read `REVIEW`; it ranks object candidates only.

## Decisions made during WP-60 (wave 8 foundation, issue #40)

Inputs: `.astro-magazine/plans/wave8.md` (the plan, with its checker bundle in `.astro-magazine/plans/wave8/`) and `docs/wave8-contracts.md` (binding). Every decision below cites the CEO direction of 2026-10-10: make the site the most complete digital incubator site for startups, investors and partners, with a library of about 122 articles, gated briefs, investor and partner journeys, and a CRM-backed intake. D-20 to D-24 are the headline decisions; W8-1 to W8-29 are the plan decisions that carry them out.

### D-20 Library scale supersedes D-10 and EX-SCALE

**Decision.** The library grows to about 122 articles by editorial work. The route ledger and the tests scale by invariant (unique paths, known layouts and owners, one row per file), not by count. The counts 99, 95, 23 and 18 and the per-desk slug lists leave the tests.

**Why.** CEO direction of 2026-10-10. D-10 capped launch at 28 long-form items because the company had no evidence base beyond its method; the direction is to build the evidence base through sourced editorial work (W8-9), and a count in a test would make every article package edit a frozen file.

### D-21 Inbound investor and partner pages may launch without naming anyone

**Decision.** Amends D-12. Pages for investors and partners may launch without naming any company, person, event or date. The portfolio, delivery partners, founder stories and case studies stay L2 (`launch: false`) until a written record exists. The `/network/partners/` row loses `requires: ['companies']` and gains its own source.

**Why.** CEO direction of 2026-10-10. D-12 exists to prevent fabricated social proof; an inbound page that names nobody has none to fabricate, so it needs no register of names.

### D-22 Intake architecture

**Decision.** The browser posts JSON to one Azure Function endpoint behind the shared Front Door. The function writes to Dataverse with a managed identity and sends email through Azure Communication Services. There is no Logic App hop (contracts section 4).

**Why.** CEO direction of 2026-10-10 (a CRM-backed intake). The globalenterprise.com model is the reference; one function keeps the idempotency key, the Dataverse write and the status of a failed email in one place (W8-2, W8-3).

### D-23 Gated-brief rule

**Decision.** The full text of a brief lives outside every path the build reads (`infra/intake/briefs/`), is delivered only by an emailed short-lived private link, and is proven absent from `dist`, `llms-full.txt`, the Markdown twins and the Pagefind index by a sentinel audit that tests itself (contracts section 5, `scripts/audit-gated-briefs.mjs`).

**Why.** CEO direction of 2026-10-10 (gated briefs). A gate that the build can leak through is not a gate; exclusion by location plus an audit that finds its own planted sentinels is the only form that stays true as the site grows.

### D-24 CTA policy

**Decision.** Honest copy; one primary and at most one secondary action per band; no scarcity or urgency, no exit-intent, no popup, no modal, no sticky bar; no CTA on legal, form, thanks, search, styleguide or 404 pages (contracts section 6).

**Why.** CEO direction of 2026-10-10 (a customer journey with a call to action on every page family). The policy keeps the conversion work inside the truth policy (D-11, D-12) and the accessibility floor.

### W8-1 Separate wave 8 frozen list and test scope

Wave 8 write sets use a separate `frozen_paths_wave8` key (read by `scripts/check-ownership.mjs`; only the owners in `frozen_paths_wave8_owners`, WP-60, may touch it without a registered exception) and a wave 8 test scoped to `WP-6x`, `WP-7x`, `WP-8x` and `WP-9x`. The wave 7 write-set test filters `WP-4x` and `WP-50` and is untouched. One consequence: `tests/unit/wp-40/ownership.test.ts` sampled `src/layouts/BaseLayout.astro` as a file WP-45 may edit; wave 8 froze `src/layouts/**`, so the sample is now a block component (WP-45 is finished and its assignment is unchanged).

### W8-2 One endpoint, six form kinds

One endpoint (`PUBLIC_WE_INTAKE_API_URL`); the `form` field discriminates six kinds; the CSP already derives from the variable.

### W8-3 Idempotency and the order of side effects

`requestId` is the idempotency key (`we_requestid`). The server writes the engagement row to Dataverse before it answers 202; email and webhook run after, with retries; a failed email is a status, not a lost lead (WP-61).

### W8-4 Two names, no collision

The honeypot stays `website` (v1). The real organization URL field is `companyUrl`.

### W8-5 Gated briefs live outside `src`

Gated briefs live in `infra/intake/briefs/` (outside `src`, outside the `astro.config.mjs` globs, never imported). Open abstracts live in a new `briefs` collection and may not reproduce a body sentence (WP-63).

### W8-6 Mid-body CTAs are static HTML from one model

Mid-body CTAs are static HTML emitted by a hast plugin (`src/lib/rehype-mid-cta.ts`) from the same `CtaModel` as the component. A CTA whose target is not a live route is dropped (the `pickRelated` precedent), so no dead link can ship.

### W8-7 Two registries and a plain reader

`src/data/desks.ts`, `src/data/families.ts` and the plain `node:fs` reader `src/lib/content-files.ts` are the only sources for desks, slugs, owners, family slug lists and related-title maps. Invariants replace the counts and the per-desk slug lists.

### W8-8 Rubric and sources ledger as tests

An article rubric test runs over every file in `src/content/insights/**`. A sources ledger test fails on any source without a fetch record.

### W8-9 Source rule

Every source in an article, brief, glossary entry, comparison, industry page or tool explainer was fetched in the writing session, with URL and fetch time recorded. A claim that cannot be sourced is dropped, never softened.

### W8-10 `RELEASE_ALLOW` is narrowed, not widened

`RELEASE_ALLOW` on `demo` and `wp/*` tolerates the disabled form routes and, one anchored pattern per path, wave 8 pages that do not exist yet. It is empty on release tags and `gh-pages`. WP-99 removes the pending patterns when the last page lands.

### W8-11 Release-lane files are serialized

WP-60 adds one `include: local` line to `.gitlab-ci.yml` (guarded by `rules: exists`) after confirming no open wp/30 merge request; WP-99 commits the counsel entries to `RELEASE.md` on the same condition.

### W8-12 Concurrency

Up to 10 authoring agents at once and at most 5 branch pipelines at once (supersedes the v1 five-agent cap). Pools are checked as sets; the pipeline cap is enforced by the push-slot protocol (`.astro-magazine/plans/wave8/push-slot.sh`, tested by `tests/unit/wp-60/push-slot.test.ts`).

### W8-13 Two switches ship OFF

`flags.briefUpdates` (the optional updates checkbox) and `NURTURE_ENABLED` (the day 3, 10 and 21 sequence) ship OFF until the privacy notice covers CRM use and retention and counsel has reviewed the sequence.

### W8-14 Not ported from globalenterprise.com

The corporate-email gate (WE serves founders, who use personal addresses), Plausible and `data-track` attributes (D-14), and Turnstile (third-party). Spam control is the honeypot, a timing check, a per-address rate limit and a Front Door rate rule.

### W8-15 Copy bans beyond the denylist

No "free" in copy about WE; no "perks"; no "accelerator", "cohort", "mentor" or "alumni" in page copy (`C-13-peers`); no "investor network". The nav label "Partners and perks" becomes "Partners". The one exception is the comparison page whose subject is the word (DP-W8-15). WP-60 adds `W8-C13-own-peers` so the first-person form can never pass, even inside a marker.

### W8-16 Open briefs stay open

The four open research briefs and six library templates stay open. Gated briefs are new documents.

### W8-17 Empty portfolio

The portfolio collection stays empty unless the operator supplies a consent record (OP-PORTFOLIO). With no entry the investors page shows one fixed sentence and says nothing about forming groups or dates. The same rule governs the showcase-format page.

### W8-18 Legacy tests

One owner per test file, the package that rewrites what it pins; tests that pin two packages' files are owned by WP-60, which splits them verbatim. Photography and release lane tests are read-only (contracts section 12).

### W8-19 Fourteen desks, two optional fields

The four existing desks plus `funding`, `legal`, `team`, `ai`, `gtm`, `ops`, `starting`, `pathways`, `models` and `sectors`. Articles gain optional `segments` (the segment pages list matching articles from the collection) and `related` (a slug that is not live is dropped at build), and an optional `cta`.

### W8-20 One page-family registry

`src/data/families.ts` is the single registry of founder segments, industries, comparisons, journey pages and brief ids. WP-71 owns the generic route files and components; WP-72, 73, 74 and 75 author content in the `pages` collection only; ledger rows derive from the registry and stay inert until a page exists. Frontmatter for family pages is fixed in contracts section 8.2.

### W8-21 Rolling window and push protocol

Batches are authored locally with commits and pushed once per batch (8 to 10 articles for a content agent); each push holds one of five slots until its pipeline ends. This applies the CEO's concurrency instruction and overrides the habit of pushing after every commit for wave 8 packages.

### W8-22 Brand system stays inside its folders

No global brand stylesheet and no edit to the shared stylesheets; brand styles live inside `src/components/brand/**` and `src/components/families/**`, tokens only. Vector compositions are shipped imagery (W7-9); photography-lane files are not edited. Open Graph images reuse the nine existing cards through `ogSlot` (OP-OG).

### W8-23 Structured data stays package-local

Pages use the existing builders; a new JSON-LD node builder is package-local; no package edits shared `src/lib/seo*` or schema files. `FAQPage` and `DefinedTermSet` nodes come from `src/components/reference/jsonld.ts` (WP-77, import-only elsewhere).

### W8-24 Considerations, never outcomes

Sector, industry, segment and comparison content is "considerations for", never an outcome claim and never a claimed client. Comparison pages name categories, not products. Segment pages never state eligibility beyond `/program/who-its-for/` (OP-SEGMENTS). Marketplace and platform articles say plainly that WE builds SaaS.

### W8-25 The customer journey is a contract

Five stages, one map per audience, a primary and secondary call to action per page family, implemented by WP-62 and the WP-71 templates and proven by the WP-90 suite (contracts section 11). Every page in a map has a forward path.

### W8-26 `llms-full.txt` stays curated

`llms-full.txt` stays a curated key-page list (cap 262,144 bytes, the build throws past it), so article volume does not threaten it. WP-91 carries the cap as an acceptance criterion and decides which Markdown twins exist.

### W8-27 Entry gate

WP-60 starts only after `wp/41`, `wp/46` and `wp/49` are merged to `demo` or closed, and re-runs every checker on the real tree. If a branch is abandoned, the patterns that depend on it are removed from the JSON together with the matching pin acknowledgements.

### W8-28 Reference data grows by addition

Existing FAQ entries, glossary terms, readiness statement ids and the data-room checklist wording are kept verbatim; the tests that pin them stay green without edits.

### W8-29 Content packages add no route file

Packages that add pages author only files in the `pages` collection (plus their component folder). A page family with no template at merge time stays inert, so a package may merge before WP-71 without a dead route.

### W8-30 Frozen-file exceptions are registered once, ahead of the edits

WP-60 edits 14 frozen files across two merge requests. Rather than one exception per edit commit, all 14 are pre-registered in `ownership.json` with the first governance commit, each with a reason. An exception still unused when 60b merges is removed and the handoff says so.

### W8-31 What WP-60 fixed while building the foundation

Six calls that the contracts left open, recorded once so the packages that build on them do not re-decide.

1. **Schemas live in `src/lib/content-schemas.ts`.** `src/content.config.ts` imports `astro:content`, which plain-Node `node --test` cannot load, so the zod schemas moved to a module the article rubric, the families test and the schema tests can import. `content.config.ts` only binds loaders to them. Both files are in the frozen set and WP-60 owns both.
2. **The 18 articles written before wave 8 are pinned and waived for three rubric rules.** The originals carry related-rail links in the layout rather than body links, the Grow and Fundable ones have no "What this article cannot tell you" section, and five count 1,050 to 1,200 words by `countWords`. `article-rubric.test.ts` waives `cannot-tell-you`, `internal-links` and `words` for exactly the 18 files pinned by sha256 in `existing-articles.json`, and for nothing else. Every other rule applies to them, and a new article gets no waiver.
3. **Wave 8 claim ids are C-25 to C-29.** C-25 investor meeting with no promise, C-26 partner enquiry creates no partnership, C-27 a requested brief goes to the address given, C-28 form details answer the request as the privacy notice describes, C-29 the digital-incubator-for-SaaS positioning (C-01 to C-03 and C-05 together). All are `publish` and sourced to the CEO direction of 2026-10-10 and D-21.
4. **`W8-C13-own-peers` is a context rule with no marker and no path allowance.** It catches "our cohort", "WE mentors", "WE runs a cohort" and the like, and passes denials ("WE has no mentors"). It starts green on the demo build (133 files scanned, 0 findings) and has self-test cases in `scripts/audit-claims.mjs` and `tests/unit/wp-60/claims-w8.test.ts`.
5. **Pending family rows are tolerated by shape, not by path.** `RELEASE_ALLOW` gains one alternative for the five family path shapes (`/founders/<slug>/`, `/industries/...`, `/compare/...`, `/journey/...`, `/briefs/...`), because the registry launches about forty entries before their packages land. Any other missing launched route still fails; a release tag and gh-pages still allow nothing. WP-99 empties the list.
6. **The sources host allowlist is code in `tests/unit/wp-60/sources.ts`.** Government and regulator suffixes, standards and law bodies, instrument publishers, universities and vendor documentation hosts. A vendor documentation host never sources a statistic or a regulation. OP-HOSTS extends it by a decision that edits that file.

## Decisions made during WP-51 (wave 9 foundation, issue #72)

Wave 9 is the visual redesign ("Visual redesign: full-screen, UBF, galaxy visuals", milestone 1784). CEO direction of 2026-10-14: the site is fully responsive and full screen at 1920x1080 with no wasted side margin, uses the UBF framework and the other org frameworks heavily, and shows rather than tells (graphics, illustrations and three.js scenes: galaxy, launching, incubating). The contracts are in `docs/wave9-contracts.md`.

### W9-1 Wave 9 numbering, stages and governance

Wave 9 uses WP-51 to WP-57 (issues #72 to #78): the only contiguous range no earlier ownership test filters on. WP-58 and WP-59 stay spare for fix-forward splits. Stages: 0 WP-51 (governance and layout foundation), 1 WP-52 (visuals library), 2 WP-53 to WP-56 (page families, in parallel), 3 WP-57 (integration, the 1920 regression pass, exception cleanup, milestone close). Every assignment and every exception is registered once in this governance commit, ahead of the edits (W8-30); WP-57 removes the ones nobody used. Only WP-51 (now) and WP-57 (at close) edit `ownership.json`, `decisions.md` and `.astro-magazine/plans/wave9/**`. `tests/unit/wp-51/write-sets-wave9.test.ts` proves the wave 9 write sets disjoint and equal to `.astro-magazine/plans/wave9/writesets.json`.

### W9-2 Declared hand-offs inside wave 9

Two wave 9 packages may hold one path only when `.astro-magazine/plans/wave9/writesets.json` lists it as a hand-off from an earlier stage to a later one: the governance files and `src/data/claims.ts` (WP-51 to WP-57), and `tests/e2e/folds.spec.ts` (WP-51 edits `HERO_MODES`, then WP-53 edits the home first-viewport assertions through an exception). The four stage-2 page packages share nothing.

### W9-3 Stale claims are superseded where they overlap wave 9

The unmerged `origin/wp/62` (WP-62, #42), the photography branch `origin/wp/12b` (WP-12b, #22, fully merged) and the never-built WP-48 (#37) lose every path a wave 9 package now holds. WP-62 keeps the CTA system (`src/components/cta/**`, `src/data/cta/**`, `ContextualNext.astro`), the insights hub copy and its own tests; home, the founders hub, the wave 7 home tests (`tests/unit/wp-44/**`, `tests/e2e/wave7/wp-44/**`) and `tests/unit/wp-01/**` move to WP-53 and WP-55, and its counsel-checklist exception moves to WP-55 with the founders page. WP-48 keeps only its test and handoff paths; the framework pages move to WP-55, which absorbs #37. The wave 8 map mirrors the narrowed WP-62 set, and the one self-test case that named a moved path now names the insights hub copy. WP-12b keeps its write set; the photography-lane files wave 9 edits are reached through exceptions (W7-9 pattern). None of these branches is deleted.

### W9-4 Full-bleed layout: content frame 110rem, fluid gutters, readable prose

`--content-max: 110rem` (1760px, 80px of margin each side at 1920) and `--page-max` points to it, so every `.container` widens at once. Gutters are fluid, `clamp(1rem, 0.0769rem + 4.1026vw, 5rem)` (16px to 360, 60px at 1440, 80px at 1920). Section backgrounds run full bleed (`.band`). Paragraphs never widen: prose keeps `--prose-max` (46rem), also inside any `.prose` block that now sits in a widened container, and the `.split` grid sets a 40rem text column beside a visual. Every layout defaults to the wide frame, so pages benefit before their family package redesigns them; `MarketingLayout` gains `width?: 'content' | 'prose'` (default `'content'`), where `'content'` keeps the reading measure on text and lets figures, grids, tables and splits use the frame. The heading steps and the fluid rhythm keep their line to 1920 instead of stopping at 1440, with the 360 and 1440 values unchanged; the reading sizes keep their 1440 ceiling. The guide, legal, template and reference reading pages keep their centred 46rem column (pinned); the article rail moves to the frame's right edge. The media hero gives the visual 7/12 of the frame from 100rem only, so the 1440 fold is unchanged. The header widens with the frame; its nav breakpoints (1100, 1279.98 and 1280px) and the logo clamp do not move. Names `container--wide` and `--page-wide` stay forbidden.

### W9-5 D-16 revised: UBF pages are allowed

CEO direction of 2026-10-14 overrides the hub-only part of D-16. A dedicated UBF detail route, `/about/frameworks/ubf/` (the existing `launch: false` row), and further framework detail pages are allowed and wanted. The frameworks hub stays the entry point. Still binding from D-16 and C-19: structures and names from the org frameworks, paraphrased, with no efficacy claims and none of the banned source marketing lines. WP-55 owns the pages and holds a scoped exception on `src/data/routes.ts` to launch the row in the same merge request as the page, so `audit:ledger` and `verify:release` never see a launched route without a page. WP-55 absorbs WP-48 and closes #37.

### W9-6 Home hero: galaxy scene over a still poster

The home hero shows the galaxy scene (three.js, lazy, desktop-only) over a still poster. The poster is the LCP element and is what mobile, no-JS, reduced-motion, forced-colors and Lighthouse users see; the canvas is decoration (`aria-hidden`). `HomeLayout` already forwards `preloadImage` to `BaseLayout`, and WP-53 points it at the poster so the head preload and the hero image name the same source.

### W9-7 Dark visual bands under D-8

Dark "galaxy" bands are allowed: `--color-bg-inverse` (blue-night) with the `--color-band-deep-*` text, muted and link tokens, whose contrast pairs `audit:contrast` verifies. A dark band never carries the logo and the header is never placed over one; the header stays light. The site remains light-theme only.

### W9-8 three.js as a bundled, desktop-gated enhancement

`three` 0.186.1 (dependency) and `@types/three` 0.186.0 (dev dependency) are pinned exactly, added with `npm install --package-lock-only`. three is bundled and self-hosted (D-14) and only fetched behind the `<we-scene>` capability gate (min-width 64rem, fine pointer, no reduced motion, no forced colors, at least 4 cores and 4 GB, no save-data, a WebGL2 context). The CSP does not change: no blob workers, no data: or blob: images, no inline scripts, CSSOM custom properties instead of `style` attributes. The Lighthouse mobile preset never passes the gate, so the 10,240 B per-route JS budget holds.

### W9-9 1920 tests live in the wave 8 directories, and the counsel checklist moves with its copy

There is no 1920 Playwright project and adding one would need a release-lane CI edit. Wave 9 specs live in `tests/e2e/wave8/wp-NN/**`, set a 1920x1080 viewport in the spec and run only in the desktop wave 8 project. The shared assertions are `tests/e2e/wave8/wp-51/lib/full-width.ts`. A wave 9 package that edits a file quoted by `.astro-magazine/release/RELEASE.md` updates the quoted line numbers in the same commit through its scoped exception; WP-99 stays the release owner.

### W9-10 Claims C-07 and C-17 for the wave 9 visuals

Tech-lead decision on the brief, 2026-10-14. C-17 is published for the genericized figures only (the Dream, Build, Grow journey roadmap; a readiness scorecard with no weights or thresholds; the seat-and-steering flow with no amounts and no valuation cap); the original proposal figures stay off the site. C-07 is enabled for the equity concept only ("WE is paid per seat in cash, plus equity earned in arrears for steering"); percentages, caps, valuations and instrument terms stay excluded under C-08. `flags.seatPrice` stays off, so the seat builder ships unpriced. The internal `source` strings of the claims registry name no outside party; WP-57 repeats the scrub review before any gh-pages promotion.

### W9-11 Brand wording for the framework names

"G.R.O.W.T.H. phase" replaces the source name that used the barred word. S.M.A.R.T. expands to Specific, Measurable, Achievable, Relevant, Time-bound. A.N.D.R.O.I.D. uses "Implement". WE is a services provider and build partner, never an investor, fund or accelerator.

### W9-12 Positioning: an ongoing incubation and consulting firm, not a seat seller

CEO direction of 2026-10-14, later the same day; it supersedes the seat parts of W9-10. WE is an ongoing business incubation and consulting firm that a company brings on as a long-term partner with equity alignment: no cohorts, no demo day, no fixed batch, paced to the documented time it takes to build a business. WE is not presented as a seat seller or employer of record. Seat prices are never shown or emphasized; `flags.seatPrice` stays off. The team WE steers appears as part of the engagement (roles, a constellation visual), never as a priced cart. WP-54 is rescoped to services, the engagement model, tools and apply; `/pricing/` stays as a route and becomes the engagement-model page. WP-58 (issue #79, stage 2, one of the spare numbers of W9-1) holds the sales literature: `src/content/sales/**`, the `/who-we-work-with/` and `/why-it-takes-time/` route families, `src/components/sales/**`, `src/data/sales/**`, and scoped exceptions on `src/data/routes.ts`, `src/data/nav.ts`, `src/content.config.ts` and the CTA labels in `src/data/cta/index.ts` (with `tests/unit/wp-60/cta.test.ts`). Until the sales strategy lands, primary CTAs read "Start a conversation" or "Apply". C-07 is reworded to the engagement: paid for the ongoing engagement plus equity earned in arrears for steering, no numbers. The banned words still apply.

### W9-13 Sales direction: how WE works, why it takes time, who WE works with, one CTA hierarchy

CEO adoption of the sales strategy, 2026-10-14; it refines W9-12. The category is "long-horizon business incubation" (consulting in the description), for software-enabled and expertise-led companies. Ownership:

- WP-54 owns `/how-we-work/`, which replaces `/pricing/` (`/pricing/` is not indexable and points to `/how-we-work/`), and it is the single owner of the retirement of the public Spark, Launch, Accelerate and Studio packages: `src/data/packages.ts`, the package catalog node in `src/lib/schema.ts`, `JsonLd.astro`, `src/lib/llms.ts`, the required texts in `claims-denylist.json`, the Team Composer `?package=` hand-off, the apply form package select and their pinning tests, through scoped exceptions. No prices anywhere; start any month; a yearly checkpoint review. `/apply/` stays with WP-54, including the readiness-review intake wording and the `?situation=` preselect (SALES.md 6.4 interim: situation lines inside `message`, no forms-contract change).
- WP-58 owns `/why-it-takes-time/` (charts from its own `src/data/sales/**`), the `/who-we-work-with/` hub and its seven situation pages, the timeline brief `/briefs/real-timeline/` (one `families.ts` entry, the brief-request enum, `infra/intake/briefs/real-timeline.md`) and the C-29 wording of SALES.md 1.4. Each family updates the old "digital incubator" phrase on its own pages.
- WP-51 owns the CTA labels: the `apply` target, the header button, the hero, end-band and mobile-bar primaries read "Start a readiness review"; the secondaries are "See how long it really takes" (`/why-it-takes-time/`) and "See how WE works" (`/how-we-work/`); the utility is "Talk to WE"; the partner CTA is "Refer a founder". WP-51 registers its own exceptions on `src/data/cta/**`, `src/data/nav.ts` and the label pins in the follow-up that changes them. The header row has no room for the longer button beside a direct Pricing item from 1100 to 1500px, so Pricing leaves the top level; the compact row (16px nav) runs to 1500px and the button shows "Readiness review" below 1240px with the full label as its accessible name. The palette keeps "Apply" as the command name (hint: the button label); navigation links to `/apply/` in panels and the footer keep "Apply" (docs/wave9-contracts.md, section 8).
- WP-55 holds exceptions on `tests/unit/wp-40/ci.test.ts` (the UBF row launches; `/star/`, `/shift/` and `/android/` stay cut), `tests/unit/wp-41/facts.test.ts` (the package lines on `/about/facts/`) and `.astro-magazine/sources/wp-71.json` (the brand-story and press quote entries follow the new About copy).

C-07 is off until counsel clears it: every equity line marked "[GATED: C-07]" in the sales literature ships as its non-equity fallback, and every [CONFIRM] item ships in its conservative wording. Never name a competitor or a named program on the site; category comparisons only. Every statistic comes from `.astro-magazine/plans/wave9/statistics.json` (ST-01 to ST-41, generated from the proof library); a page records each figure it cites as a source record in its own `.astro-magazine/sources/wp-NN.json` with `source_id` set to the ST id, and never uses a figure from the register's `neverUse` list.
