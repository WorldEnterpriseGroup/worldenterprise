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
- **EX-CSP-META.** GitHub Pages cannot set headers. CSP and referrer policy are delivered through `<meta>` tags; `frame-ancestors`, `Permissions-Policy` and HSTS cannot be enforced and are accepted as limits (R-12).
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
Nav hides routes that do not exist, so before Wave 1 the menu is empty. The verify build sets `PUBLIC_NAV_FIXTURE=1` so the browser tests can exercise the real menu. It is never set for preview or production.

### W-10 og:image omitted while the slot is a placeholder
BaseLayout emits no og:image until WP-12 replaces the placeholder (FLAG-OG), rather than advertising a decorative graphic.

### W-11 Wordmark sized by width
The wordmark ratio is 14:1, so the header and footer logos are sized by width instead of the 36/30 px height in the brand spec.

### W-12 Ownership gate image
`check:ownership` runs on the full `node:24` image because it needs `git` and the runners are non-root (no `apk`). It only runs on `wp/*` branches and was verified against a seeded out-of-scope change on a throwaway branch.

### W-13 Styleguide and fixtures are kept out of the sitemap
`/styleguide/` is a dynamic route emitted only when `PUBLIC_STYLEGUIDE=1`, marked noindex, and filtered from the sitemap along with any `/fixture-` URL. Fixture routes use the last segment of the glob id because fixtures sit in `_fixtures/`.
