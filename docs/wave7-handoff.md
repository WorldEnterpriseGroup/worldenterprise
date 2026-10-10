# Wave 7 handoff

Written by WP-60 (wave 8 foundation) as the absorbed WP-50 scope (issue #39). Wave 7 (issue #29) closed with WP-41, WP-46 and WP-49 merged to `demo`; WP-50 was folded into wave 8 and WP-48 stays deferred (issue #37). This file is the short list of what wave 7 left standing and where each item went. The per-package detail is in `.astro-magazine/handoffs/wp-40.md` to `wp-49.md`, and the shared contract is `docs/wave7-contracts.md`.

## What wave 7 delivered

- Machine layer (WP-41): `llms.txt`, `llms-full.txt`, Markdown twins, `audit:geo`, the JSON-LD validator and the `robots.txt` policy.
- Transparency and craft (WP-42 to WP-46): pricing components, the home counter, the visual system, the command palette and the layout-shift fixes.
- Founder tools (WP-49): the `/tools/` hub, the metrics calculator and the Team Composer, each with a `WebApplication` node (contracts section 9).
- Wave 7 CI (WP-40): `e2e:wave7`, `audit:geo` and the narrowed `RELEASE_ALLOW` of decision W7-6.

## Carry-over and where it went

| Item | Raised by | Disposition |
| --- | --- | --- |
| `WebApplication` JSON-LD contract lived only in a validator and a test | WP-41 | Folded into `docs/wave7-contracts.md` section 9 (WP-60). |
| `src/styles/motion.css` wrote `animation` plus `animation-timeline` as a shorthand that some engines drop | WP-45 | Fixed by WP-60: every scroll-driven rule uses longhands, and the reveal moves without fading. A unit test in `tests/unit/wp-13/design-system.test.ts` keeps it so. |
| `RELEASE_ALLOW` still tolerated nine pending routes and two machine files | WP-40 | Narrowed by WP-60 per `docs/wave8-contracts.md` section 10. |
| WP-48's four rows (`/about/frameworks/ubf/`, `/star/`, `/shift/`, `/android/`) | WP-48 | Set to `launch: false` with a reason; WP-48 stays deferred (issue #37). |
| `lighthouserc.json` listed only the first-wave pages | WP-50 | Candidates extended to the tool, service, insight, library and program pages that exist; WP-99 completes the rest. |
| Mechanical check that each claim sentence is a literal substring of its document | WP-70 notes | Wave 8 desks and `tests/unit/wp-60/sources-ledger.test.ts` (contracts section 9). |
| AI-crawler user-agent names in `robots.txt` need checking against each vendor's documentation | WP-41 | Open. Listed in `.astro-magazine/handoffs/wp-41.md`; owner is the machine-layer package (WP-91). |
| 14 insights and the pages whose text lives in `.astro` components have no Markdown twin | WP-41 | Open. Owner: WP-91. |
| The research brief defines only NRR, simple CAC and CLV; six calculator metrics read as conventions with public references | WP-49 | Open. A content decision for the research desk; the calculator copy stays as written until then. |
| The Team Composer breadcrumb reads "Resources" while the tool pages say "Tools" | WP-49 | Open. It is WP-42's file; the tools hub package aligns it. |
| The palette's result-type chips cover only the first 50 matches | WP-46 | Accepted. The status line says so; a corpus that outgrows it wants a Pagefind filter on a type field (a build change). |

## Evidence

The `e2e:wave7` job runs on `demo`. Wave 7 specs were never run locally (rule); the pipeline results for the merged branches are on the `demo` pipelines named in the merge commits.
