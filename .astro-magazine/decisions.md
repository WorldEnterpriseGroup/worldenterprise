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
- **EX-SCALE.** Launch scale is 90 routes, 18 articles and 4 briefs (D-10, D-19), not the skill defaults of 150 and 8.

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
