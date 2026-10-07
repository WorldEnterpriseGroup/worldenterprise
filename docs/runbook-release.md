# Release runbook

Status: skeleton written by WP-00; completed by WP-30 (release engineer).

1. Release preflight runs in CI on `demo` (`scripts/release-preflight.mjs`, added by WP-30).
2. An operator go/no-go is recorded before any production configuration change.
3. Release is a fast-forward push of `demo` to `gh-pages`. Never force-push `gh-pages` and never push `main`.
4. GitLab runs `verify:static`, then `mirror` pushes `gh-pages` to GitHub. GitHub Actions (`pages.yml`)
   rebuilds, runs the forbidden-file gate, copies `CNAME` into `dist` and deploys.
5. Rollback: re-run the last green `pages.yml` run, or revert the release range on `demo` and push `demo:gh-pages`.
