# WP-14 change requests

## To WP-15

1. Remove the superseded smoke suite (the `e2e/` directory, version-controlled with git). `playwright.config.ts` no longer reads it.
2. Set the CI/CD variable `QA_STRICT=1` (or edit `.qa-rules` in `.gitlab-ci.yml`) once the findings in `wp-14.md` are closed. That makes every qa job blocking on wp/* and demo. gh-pages is already strict.
3. Narrow `RELEASE_ALLOW` in `.gitlab-ci.yml` as launch routes, content and forms land. At release it must be empty; gh-pages already forces that.
4. `package.json` is frozen for WP-14. Optional script names so jobs and people share one spelling: `audit:images`, `audit:links`, `audit:ledger`, `audit:a11y`, `audit:dist`, `qa:lighthouse`, `verify:release`, each mapped to the script the matching job calls. `linkinator` is unused and can be removed.
5. WP-09 request W15-1 (sitemap filter and `lastmod`) clears the two sitemap findings; `audit-seo` is wired with `--sitemap=warn`, drop the flag then.

## To the owners of the findings

Listed with evidence in `wp-14.md` under Findings: header utility bar overflow at 390 px (chrome), footer links to unbuilt routes (`/newsletter/`, `/insights/topic/`, `/legal/`, `/careers/`), `button.btn--primary` contrast (WP-08, WP-13), CLS on the security baseline brief (WP-07), `/insights/` overflow at 720 px (WP-05), long insight titles (WP-05, WP-06).

## Notes for every WP

- A route you own that is launched in the ledger but not built is skipped by the e2e suites and warned by the audits, so you can merge in any order. After you merge, your routes are tested at once: run nothing locally, read the `e2e:*` artifacts of the branch pipeline.
- The home-hero test starts when `src/components/home/HomeHero.astro` exists. WP-01 keep `h1#home-title`, `.lead`, `a.btn--primary`, `img[fetchpriority=high]` inside `.home-hero`.
- Forms tests need `form[data-intake-form]` with `[name=name|email|stage|topic|message|consent]`, `[data-submit]`, `[data-error-summary]`, `[data-status]` and `input[name=website]` inside `.hp[inert]` (as WP-03 ships them).
