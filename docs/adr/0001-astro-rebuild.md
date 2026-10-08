# ADR 0001: Rebuild the site as a static Astro project

Status: accepted. Date: 2026-10-06. Amended 2026-10-08 at integration (WP-15): decisions 8 to 10 and the consequences below.

## Context

The previous site was a purchased multi-page HTML template. It carried a commercial theme's CSS and scripts, had no content model, and could not enforce what the company is allowed to say. World Enterprise Incubator is a digital incubator for SaaS. Its copy must follow a claims ladder: nothing about clients, people, metrics or prices is published without a source.

## Decision

1. **Astro 7 static output.** Content collections with strict zod schemas, no server runtime, no UI framework. Interactivity is limited to progressive enhancement scripts and a few vanilla custom elements.
2. **Truth by construction.** A route ledger marks every route `launch` or not, a claims registry marks every claim `publish`, `softened` or `excluded`, and `claims-denylist.json` is scanned against the built output in CI. A route that would launch without its source or content fails the build.
3. **Hand-written layered CSS on OKLCH tokens.** `@layer reset, tokens, base, layout, components, utilities, pages, print`. Light theme only. Token pairs carry `@pair` annotations that `scripts/audit-contrast.mjs` checks against WCAG 2.2 AA.
4. **Template is inspiration only.** No template pixel, style, script or copy is shipped.
5. **Release topology.** Integration on `demo`, GitLab `verify:static` and the Playwright smoke as the quality gate, GitHub Actions `pages.yml` for the production deploy of `gh-pages`, with a forbidden-file gate and the `CNAME` copied into `dist`.
6. **Verification is CI-only.** Local work is limited to dependency install, type check and unit tests.
7. **Parallel delivery by ownership.** `.astro-magazine/ownership.json` assigns each work package a write set and freezes the foundation; `scripts/check-ownership.mjs` fails a work-package branch that strays.
8. **Security policy in the page.** GitHub Pages cannot send headers, so Astro's `security.csp` emits a hashed Content Security Policy as a per-page `<meta>` tag (`src/lib/csp.ts`). Script is `'self'` plus hashes (and `'wasm-unsafe-eval'` for Pagefind); only style attributes may be inline. `frame-ancestors`, `Permissions-Policy` and HSTS cannot be set on this host and are accepted limits.
9. **Quality gates are code.** The GitLab `qa` stage runs the audits (claims, images, links, route ledger, dist, static a11y, SEO, JSON-LD, tokens), the Playwright suites (routes, axe, menu, interaction, forms, layout stability), Lighthouse budgets and `verify:release` (a `PUBLIC_RELEASE=1` build in which a missing launched route, a draft or a disabled launched form fails). Jobs are advisory on `wp/*` and `demo` until `QA_STRICT=1`; on `gh-pages` they are strict and `mirror` needs all of them.
10. **One link rule.** Every internal link goes through `href()`, which is idempotent, so components resolve their own links and callers may pass either a site path or a resolved link.

## Consequences

- Content authors cannot ship an unsourced claim by accident; they must change the registry first, which is reviewed.
- Navigation only shows routes that exist, so partial work never produces dead links.
- Foundation changes after G0 go through the single-writer rule recorded in `ownership.json`.
- The preview deploy is path based and uses `PAGES_BASE_PATH`; production has no base.
- The release gate forgives only operator-gated items (the form endpoints, `security.txt`, the newsletter and the terms page), and only off `gh-pages`. Production cannot ship while one of them is open.
- Publication flags in `src/data/flags.ts` default OFF and are recorded in `.astro-magazine/decisions.md` (I-1) with the person who flips each.
- The route ledger (`src/data/routes.ts`) is the single list of pages: navigation, breadcrumbs, sitemap, the HTML site map and the link audit are generated from the routes that exist, so an unbuilt launched route is a failing gate, not a dead link.
