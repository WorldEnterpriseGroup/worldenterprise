# WP-71 brand consistency audit: findings in files WP-71 does not own

Audit code: `tests/unit/wp-71/support/brand-audit.ts` (rules), `tests/unit/wp-71/brand-audit.test.ts` (static run and self-tests), `tests/e2e/wave8/wp-71/brand-audit.spec.ts` (rendered run, CI only). WP-99 re-runs both on the final build.

## Result on this branch (merged with `origin/demo` 23f3f8c)

| Scope | Findings |
|---|---|
| Files WP-71 owns (`src/components/families/**`, `src/components/brand/**`) | 0 |
| `src/components/tools/**` (WP-76's folder, 2 files) | 0 |
| Folders named in the issue that do not exist yet (`journey`, `segments`, `segment`, `industries`, `industry`, `compare`, `investors`, `investor`, `partners`, `partner`, `briefs`, `cta`) | not audited; the test skips an absent folder and lists it, so each is covered the run after its owner creates it |
| `npm run audit:tokens` over the whole tree | 0 violations |

No finding is open, so nothing is routed yet. The static test fails on any finding in a folder WP-71 does not own unless this file names it as `path:line`, so a finding cannot go unrouted. When a finding appears, add a row here:

| File and line | Rule | Owner (package, or WP-99 for links and navigation text) | Status |
|---|---|---|---|
| none | | | |

## Rules the static audit enforces

| Rule | What it flags |
|---|---|
| `raw-colour`, `important`, `magic-spacing` | The repository's own `auditCss` over every `<style>` block: a hex, `rgb()`, `hsl()`, `oklch()` or named colour, `!important` outside reduced motion, and a px or rem spacing literal outside the `--sp-*` scale. |
| `hard-coded-colour` | A hex or functional colour in markup or frontmatter (an SVG `fill="#abc"`, a `data-*` colour, a string in a `.ts` file). Comments, entities (`&#8217;`) and anchors (`#source-a`) are ignored. |
| `inline-style` | A `style=` attribute or `define:vars` (the CSP forbids both). |
| `second-lockup` | Any file other than `src/components/brand/Lockup.astro` that imports the wordmark asset or the lockup component. The header and footer own the real lockups. |
| `dark-band-logo` | A file with a dark band (`on-inverse`, `bg-inverse`, `hero--console`) that mentions a logo, a wordmark or a lockup; and a `Lockup.astro` that lost its `assertLockupGround` guard. |
| `shared-card` | `src/components/families/**` importing `ui/Card.astro` (a family card is neutral by construction). |
| `own-button` | A raw `<button>` or a hand-written `btn` class in an audited folder; actions come from the shared `Button`. |

Self-tests plant each violation in a string (a hard-coded colour in a style block, in markup and in an SVG attribute; a second lockup by component and by asset; a logo on a dark band; the shared Card; a hand-built button) and assert the audit reports it, and that comments, entities and anchors are not mistaken for colours.

## Rules the rendered audit enforces (CI, one sample page per family)

One `h1`; heading levels never skip downward; one lockup in the header and none in `main` or inside `.on-inverse`; no `style` attribute and no hard-coded SVG paint in `main`; every `.btn` is a link or a button and no class-less `<button>` stands in for one; every gap and vertical padding of the family and brand components is one of the `--sp-1` to `--sp-10` values (measured through a probe, so it follows the tokens); a focus outline of at least 2px on the first interactive element; axe at WCAG 2.2 AA; no console error, uncaught exception or third-party request. Samples are the first built route under `/founders/`, `/industries/`, `/compare/`, `/journey/`, `/investors/`, `/network/partners/`, `/briefs/`, `/resources/`, `/about/brand-story/` and `/press/`; a family with nothing built yet is named in the test title as pending and skipped. A final test asserts `/press/brand-kit/` is not built, not linked from `/press/`, and absent from the sitemap and `llms.txt` while its ledger row stays `launch: false`.
