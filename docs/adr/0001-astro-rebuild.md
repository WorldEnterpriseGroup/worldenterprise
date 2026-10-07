# ADR 0001: Rebuild the site as a static Astro project

Status: accepted. Date: 2026-10-06.

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

## Consequences

- Content authors cannot ship an unsourced claim by accident; they must change the registry first, which is reviewed.
- Navigation only shows routes that exist, so partial work never produces dead links.
- Foundation changes after G0 go through the single-writer rule recorded in `ownership.json`.
- The preview deploy is path based and uses `PAGES_BASE_PATH`; production has no base.
