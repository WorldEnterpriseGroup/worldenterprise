# Integration report (WP-15, gate G2)

Branch `wp/15`, issue #17, 2026-10-08. Every check below ran in CI; locally only `npm ci`, `astro sync`, `astro check` and `node --test` ran (402 unit tests, 0 failing). Decisions I-1 to I-13 are in `.astro-magazine/decisions.md`; the work log is `.astro-magazine/handoffs/wp-15.md`.

## Gate G2

| Criterion (plan 8.4) | Status | Evidence |
|---|---|---|
| Route ledger fully satisfied | met | 90 rows, 88 launched, 88 built. `/newsletter/` and `/legal/terms/` are `launch:false` (operator-gated) and appear in no list. `audit:ledger` passes. |
| Collisions zero | met | `audit:seo` fails on a duplicate title or meta description among indexable pages; `audit:ledger` fails on a built page the ledger does not list, a `launch:false` route that was built, or a robots meta that disagrees with the ledger. Both pass. |
| Orphans zero | met | `audit:links`: 0 errors, 0 warnings. No broken link, no pending route, and no built ledger route without an inbound link (the form success page `/apply/thanks/` is exempt: it is the 303 target of the no-JS post). |
| `verify:release` green | met | The only problems it reports are the two launched forms with no endpoint (`/apply/`, `/contact/`), matched by `RELEASE_ALLOW=^launched form route`. No flagged claim is published; every flag in `src/data/flags.ts` is OFF. |
| Demo pipeline green | met | wp/15 pipeline 64205: all 17 jobs passed, including `verify:release`. The pipeline of the fast-forward to `demo` is recorded on issue #17. |

## What integration changed

- Applied every queued request to frozen files (route state, sitemap and `lastmod`, per-page CSP, `og:image`, nav and footer, flags, QA wiring); the list is in `handoffs/wp-15.md`.
- Resolved the link graph: nav, footer, breadcrumbs, sitemap and the HTML site map are generated from the routes that exist, so an unbuilt launched route fails `audit:ledger` and `verify:release` and never becomes a dead link.
- Deleted the draft fixtures, the superseded smoke suite and `src/pages/[guide].astro`; one seat role list (`src/data/seat-roles.ts`) feeds four pages.
- Made the QA suites strict (`QA_STRICT=1`, decision I-10) after wp/15 pipeline 64205 (sha e0c03fe) passed every qa job: verify:static, check:ownership, seven audit jobs, the six e2e suites (routes, a11y, menu, interaction, forms, stability), Lighthouse (8 routes, 0 over budget, CLS 0.000 to 0.007) and verify:release.

## QA triage

Every advisory failure was read from the CI logs and fixed at its cause; none was waved through.

| Finding | Cause | Fix |
|---|---|---|
| `/trust/` overflowed at 390 px | visually-hidden table spans escaped `.table-wrap` | contained in `.table-wrap` |
| Playbook pages CLS 0.25 | the five-cell trail wrapped to two rows when the web font loaded | connector narrowed so the row fits with either font |
| Security-baseline brief CLS 0.158 at Lighthouse's phone | Astro's `local("Arial")` and `local("Times New Roman")` fallbacks do not resolve on Linux and Android, so text swapped from an unscaled generic font | metric fallback faces (`src/styles/fallback-fonts.css`, I-12); measures 0.000 |
| `/program/` CLS 0.143 at 412 px | a trailing contents entry fit one line in the fallback font and wrapped in the web font | hub contents on fixed grid tracks |
| Font-swap test failing on `/` | the old landmark test was too strict for a paragraph on a line-break edge | replaced by `tests/e2e/layout-shift.spec.ts`, which holds the font files back until after first paint and scores the swap as Chromium does, on every launched route at 1440, 390 and 412 px |
| Home hero preload ignored | `type="image/svg+xml"` declared for an AVIF | type derived from the imported image; `audit:images` fails a mismatched or unused preload (I-13) |
| Likely-LCP images lazy-loaded | eight insets and stage images | eager with `fetchpriority="high"` (I-13) |

Not reproduced in recent pipelines, so left alone: header utility bar overflow at 390 px, `/insights/` at 720 px, `/apply/` at 35 px, `.btn--primary` contrast (the overflow suite names the element if one returns).

## Findings for the hardening wave

1. **Flaky first attempts.** Pipeline 64205 had 7 first attempts that failed and passed on the retry: 4 tests hit the 45 s timeout in the same slow minute on the runner (three in `e2e:stability`, one in `e2e:routes`, then about a second on retry) and 3 mobile full-page screenshots in `e2e:routes` ended in `Protocol error (Page.captureScreenshot): Unable to capture screenshot` (`/resources/`, `/network/`, `/fundability/investor-updates/`). Because every qa job now blocks, CI retries went from 1 to 2 (`playwright.config.ts`); a real defect fails every attempt. If the screenshot error persists, cap the screenshot height in `tests/e2e/routes.spec.ts`.
2. **Artifact upload and cache.** GitLab returned HTTP 500 on artifact upload for two earlier pipelines and marked e2e jobs failed although every test passed; a re-run cleared it. The qa jobs also log `FATAL: mkdir ../../../cache: permission denied` when saving the npm cache (non-fatal; the runner's cache volume is not writable). Both are runner issues for the platform owner.
3. **Implicit grid tracks.** About 40 grid rules size their rows or columns implicitly. A wrapping row of text items can flip at one viewport width when the font swaps (the cause of the `/program/` shift). Fixed tracks, as in `.toc__list`, remove the class of defect; the swap test now catches a new one.
4. **Inline style attributes.** 14 elements set custom properties in `style` attributes. This is the accepted CSP exception EX-CSP-STYLE-ATTR; moving them to classes lets `style-src` drop `'unsafe-inline'` for attributes.
5. **CSP is meta-only.** GitHub Pages cannot send headers, so `frame-ancestors`, `report-uri` and `sandbox` do not apply (EX-CSP-NO-HEADERS, EX-NO-REPORTING). A host that can set headers should send the same policy as a header.
6. **AVIF `og:image`.** Some social scrapers do not render AVIF (FLAG-OG). The photography pass (issue #22) is the place to add a PNG or JPEG card.
7. **Deferred visual work.** `FaqGroups` is not yet replaced by `FaqList` (no visual gate would catch a regression), the services hub and `/network/` keep their current hero rather than `hero="console"`, and the `artifacts` content field is not added (marked not needed for release).

## Operator-owned

Nothing below is a code task; each stays off until the operator acts.

- Forms endpoint `PUBLIC_WE_INTAKE_API_URL` (`/apply/` and `/contact/` render disabled until it exists) and `PUBLIC_WE_NEWSLETTER_API_URL` (`/newsletter/`).
- `site.securityContact` for `/.well-known/security.txt`; `site.mailboxes.*.confirmed` for hello@ and apply@.
- `/legal/terms/` after counsel sign-off (`flags.legalTerms`); `flags.pbcWording`, `flags.limitsConfirmed`, `flags.focusShiftConfirmed`, `flags.seatPrice.published`.
- OP-RETAIN (how long submissions are kept, to be written into the privacy notice) and OP-REPLY (the reply process on `/apply/thanks/`), both in `docs/forms-contract.md`.
