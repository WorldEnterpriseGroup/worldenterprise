# Release runbook

The release runbook is `.astro-magazine/release/RELEASE.md`. It covers the path from `demo` to `gh-pages` to GitHub Pages, the approval gate, the GitHub and GitLab variables (names only), what the forms do without an endpoint, `security.txt`, the mailbox and terms sign-offs, the counsel checklist for the Investor Introductions wording, the pre-flight results and the rollback plan.

In one paragraph: the owner pushes a green `demo` commit to `gh-pages` as a fast-forward (never force, never `main`, never `CNAME`). GitLab verifies it. The nightly `weg-ghpages-mirror` CronJob copies `gh-pages` to GitHub with a short-lived GitHub App token, and GitHub Actions rebuilds it strictly and deploys. The manual `mirror` job in the `gh-pages` pipeline does not publish; it needs `RELEASE_APPROVED=<commit sha>` and confirms that GitHub has the commit.
