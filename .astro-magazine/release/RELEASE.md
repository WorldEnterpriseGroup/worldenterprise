# Public release runbook: demo to gh-pages to worldenterprise.org

Owner: WP-30 (release engineer), issue #20, decision R-1. Written 2026-10-09 against demo `cc84ffa` (pipeline 64693, green).

Nothing in this document has been run against production. Releasing is the owner's act: this runbook stages it so that the owner approves once, with everything else already checked.

## 1. What is ready and what is not

Ready, built and tested:

- A release is a tag, not the head of `demo` (decision DP-1). Release N is the protected tag `release-N` (candidates are `release-N-rcM`); wave work keeps landing on `demo`. The path is: tag, then a fast-forward of GitLab `gh-pages` to exactly the tagged commit, then the existing mirror to GitHub, then a strict GitHub Actions build and deploy.
- The GitLab `mirror` job exists only on a pipeline for a `release-*` tag. It refuses a branch and an unprotected tag, is manual, is blocked until `RELEASE_APPROVED` names the commit, and is read-only. It confirms the release reached GitHub. It holds no GitHub credential and cannot push.
- `audit:claims` writes `reports/counsel-review.md`, every sentence about investors as the built pages render it, for counsel.
- The counsel checklist in section 8 quotes every Investor Introductions sentence from the sources. A unit test fails if a quote drifts from its source or a new source file starts naming the add-on without being listed.

Waiting on the owner or an operator (names only, no values anywhere in Git):

| Item | Owner | Where it is described |
|---|---|---|
| `PUBLIC_WE_INTAKE_API_URL` and `PUBLIC_WE_NEWSLETTER_API_URL` set (https, same values) in GitHub repo variables and, as `WE_RELEASE_INTAKE_API_URL` and `WE_RELEASE_NEWSLETTER_API_URL`, in GitLab protected CI variables, once the WE intake Azure Function is deployed and reachable (`docs/intake-runbook.md`, OP-AZURE to OP-FLAGS) | operator | section 5 |
| GitHub Pages source is "GitHub Actions" and the `github-pages` environment allows `gh-pages` | operator | section 4, step 2 |
| Investor Introductions wording: decided 2026-10-28 under CEO delegation (the contradicting article sentence was fixed earlier) | closed | section 8 |
| `hello@`, `apply@` and `security@` confirmed as aliases of the monitored `info@` mailbox (2026-10-28) | closed | sections 6 and 7 |
| Terms of use (C-23), public benefit corporation wording (FLAG-PBC), seat price (FLAG-PRICE), Focus Shifts: decided 2026-10-28 under CEO delegation to stay off | closed | section 9 |
| Protected tag rule `release-*` (create: maintainers only), then the owner chooses the release tag | operator, owner | section 4, steps 3 and 5 |
| The push of the tagged commit to `gh-pages` | owner (Matthew Hackney) | section 4, step 6 |
| `RELEASE_APPROVED=<sha>` on the manual `mirror` job of the tag pipeline | owner | section 4, step 9 |

## 2. How a release travels, and where the real gates are

```
demo (GitLab, wave work continues here) --tag--> release-N-rcM / release-N (protected tag, immutable)
   tag pipeline: verify:static, audits, e2e, verify:release with no allowances, manual mirror job
release tag commit --push, fast-forward only, owner--> gh-pages (GitLab)
   gh-pages pipeline: the same checks again on the same commit
gh-pages (GitLab) --weg-ghpages-mirror CronJob, daily 03:23 UTC, fast-forward only--> gh-pages (GitHub)
   GitHub Actions pages.yml: rebuild with PUBLIC_RELEASE=1 and no allowances, audit dist, deploy to Pages
```

Read this part before approving anything:

- GitHub is fed by the `weg-ghpages-mirror` CronJob (nebula, `tools/weg-ghpages-mirror`). It uses a short-lived installation token from the GitHub App `focusapiary-mirror-sync`, pushes only fast-forwards, skips and alerts on divergence, and has `worldenterprise` on its allowlist. That is why this project holds no GitHub credential and needs no `GITHUB_TOKEN`. The earlier handoff instruction to set `GITHUB_TOKEN` (wp-19) is obsolete.
- The cron copies whatever is on GitLab `gh-pages`. It does not look at CI. A CI approval therefore cannot stop it, and the `RELEASE_APPROVED` gate is a confirmation step, not the publish switch.
- The controls that do stop a bad publish are, in order: (1) only the owner can push `gh-pages` (the branch is protected, push is limited to Matthew Hackney, force push is off), so nothing goes live until that push; (2) the GitHub Actions build re-runs the release gate with `RELEASE_ALLOW` empty, so a launched form that is disabled, a missing launched route or leftover draft content fails the deploy; (3) the audits in the same workflow (dist allowlist, CSP coverage, route ledger, links, images).
- Because of (1): do not push `gh-pages` until the checklist in section 1 is finished. The push is the approved button. Creating a tag publishes nothing.
- A tag, not `demo`, is the unit of release (DP-1), so wave work that lands on `demo` during approval cannot change what ships. A tag is never moved or deleted: a change after counsel review is a merge to `demo` and a new candidate tag (`release-N-rc2`), and the earlier candidate is simply not used. The release tag must name the commit that is pushed to `gh-pages`, and the `mirror` job confirms GitHub `gh-pages` is at exactly that commit.

## 3. Pre-flight against current demo

Run on 2026-10-09. Demo `cc84ffa` is pipeline 64693. Its `verify:release` job (1119395) is green, but GitLab returned no trace or artifact for it, so the output below is from the same job on the WP-30 branch (pipeline 64723, job 1120231, commit `dbcbf46`). That commit changes only CI scripts, tests, ownership and docs relative to demo, so the site source and the release gate are identical.

| Check | Result |
|---|---|
| Demo pipeline 64693, all 17 jobs (`verify:static`, 7 audits, 5 e2e, `qa:lighthouse`, `verify:release`, `pages`) | green |
| `verify:release` on demo (RELEASE_ALLOW tolerates form routes) | passes with 2 tolerated problems, below |
| `astro check` | 0 errors, 0 warnings, 1 hint |
| WP-30 unit tests (`tests/unit/wp-30`) | 24 pass |

Tolerated on demo, red on a release tag and on `gh-pages` until `PUBLIC_WE_INTAKE_API_URL` is set (so a release candidate tag pipeline is red on `verify:release` until the operator provisions it, and its `mirror` job stays blocked):

```
allowed  launched form route /apply/ has form "intake" in disabled mode
allowed  launched form route /contact/ has form "intake" in disabled mode
```

Update of 2026-10-17 (issue #106, demo `33355b7`): the wave 8 forms add more launched routes behind the same endpoint, so with the variable unset `verify:release` lists 15 `launched form route` lines (`/apply/`, `/contact/`, `/investors/interest/`, `/network/partners/enquire/` and the eleven `/briefs/<id>/` squeeze pages: the ten briefs and the timeline brief `/briefs/real-timeline/`), not two. The count of 16 first written here was the number of keys in `FORM_ROUTES` in `src/data/forms.ts`, which includes `/newsletter/`; that route is `launch: false` while its endpoint is unset, so it is not a launched form route. Measured on demo `5616017` by filtering `routes` for `launch` and a form in `disabled` mode: 15 lines, 11 of them under `/briefs/`. They all clear together once `PUBLIC_WE_INTAKE_API_URL` is set. The earlier three `launch:true route does not exist` lines for the `/industries/`, `/compare/` and `/journey/` hubs were a bug in `src/lib/route-core.ts` (the glob loader stores the hub entry `industries/index` as `industries`), fixed on `wp/106-release-prep`. The strict GitHub build also runs `audit:links --strict`, where an orphan route is an error: it now exempts ledger rows with `indexable: false`, which are the form success pages and `/pricing/`.

Update of 2026-10-28 (issue #122, demo `d7f1aff4`, dry run of the strict gate). Read from the `verify:release` job of that pipeline and from `scripts/lib/wave8/release-open-items.mjs` run against the section 8 text on demo:

- `verify:release` lists 13 `launched form route` lines, all `has form "intake" in disabled mode`: `/investors/interest/`, `/network/partners/enquire/` and the eleven `/briefs/<id>/` pages. `/apply/` and `/contact/` are not listed because both mailboxes are confirmed and they fall back to mailto (section 5). These 13 are the only problems the strict gate has today, and one variable, `PUBLIC_WE_INTAKE_API_URL`, clears all of them.
- `human item open:` lines: 0. All 44 CR entries and the three sign-off boxes of section 8 are ticked, so `humanItemProblems` returns nothing.
- Missing launched routes: 0. Draft content: 0.
- Not blocking, listed by the gate as operator notes: `PUBLIC_WE_NEWSLETTER_API_URL` unset (`/newsletter/` stays `launch: false`), and `flags.legalTerms`, `flags.pbcWording`, `flags.seatPrice.published`, `flags.focusShiftConfirmed` and `flags.briefUpdates` off, as decided in section 9.
- `gh-pages` (GitLab and GitHub, `d7a65dd`) is an ancestor of demo, so the push in step 6 is a fast-forward. `release-*` is a protected tag pattern (create: Maintainers) and `gh-pages` accepts pushes from Matthew Hackney only, no force.
- GitHub today: Pages `build_type` is `legacy` (source `gh-pages`, `/`, cname `worldenterprise.org`); the `github-pages` environment already allows the `gh-pages` branch; the repository has no Actions variables, and GitLab CI has no `PUBLIC_WE_*` variable, so neither intake URL is set anywhere (intended until the forms are proven). `.github/workflows/pages.yml` is not on GitHub yet: it arrives with the first fast-forward of `gh-pages`.

Expected warning, not a defect: `audit:links` (non-strict, on demo) used to list `/pricing/` as an orphan. It is deliberate (decision W9-13, WP-54): `/how-we-work/` replaced the packages page, `/pricing/` stays only as a noindex pointer for old links and bookmarks, leaves the sitemap, search and the llms files, and no page links to it while `flags.seatPrice` is off. Do not add a link to it.

Warnings and hints, none blocking:

- `astro check` hint at `src/pages/styleguide.astro:212` (unreachable code in an `onsubmit` attribute). The styleguide is not built in a release.
- `npm ci` notice that `esbuild@0.28.2` has an install script not yet covered by `allowScripts`. Informational.
- The runner prints `FATAL: mkdir ../../../cache: permission denied` when it saves the npm cache after a successful job. The job still passes. It is a runner mount problem, not a project problem.
- Cluster degradation (worker nodes down) can stall jobs on "Uploading artifacts". Retry once.

Routes that are intentionally not launched and will not ship until their condition is met (they are not failures):

| Route | Condition |
|---|---|
| `/newsletter/` | `PUBLIC_WE_NEWSLETTER_API_URL` set |
| `/legal/terms/` | `flags.legalTerms` true after counsel sign-off (C-23) |
| `/.well-known/security.txt` | `site.securityContact` set |
| `/press/brand-kit/` | brand-owner usage sign-off |
| `/founders/stories/`, `/founders/portfolio/`, `/case-studies/`, `/network/partners/`, `/network/delivery-partners/`, `/about/team/`, `/careers/`, `/events/`, `/program/cohorts/`, `/program/demo-day/`, `/people/[slug]/` | real content exists (companies, people, dates, events) |

Not checkable from here, and left to the operator because the unauthenticated GitHub API answers 404 for them and the live domain is not reachable from the agent environment:

- The GitHub Pages source setting and the `github-pages` environment deployment-branch policy.
- The GitHub repo variable values (names are in section 5).
- The live state of `worldenterprise.org` before the release (record a baseline, section 10).

Owner decision, 2026-10-09: the public GitHub repository `WorldEnterpriseGroup/worldenterprise` has a `demo` branch (head `73cc378`, stale) that exposes the site source, alongside `main` and `gh-pages`. The mirror cron does not create it. The owner chose to keep it. Nobody on the release path touches it, and release steps do not depend on it.

## 4. Release steps

Do these in order. A step that fails stops the release; fix forward, never force.

1. Settle the checklist in section 1. Counsel's answers on section 8 may change wording; any change goes through a normal `demo` merge and a new candidate tag (`release-N-rc2`), never through moving a tag.
2. Operator, GitHub settings (once): Settings, Pages, Source set to "GitHub Actions". Settings, Environments, `github-pages`, deployment branches allow `gh-pages`. Settings, Secrets and variables, Actions, Variables: the two variables in section 5.
3. Operator, GitLab settings (once): Settings, CI/CD, Variables: the two variables in section 5, protected, so they reach the protected release tag and `gh-pages` pipelines and nothing else. No `GITHUB_TOKEN` is needed or wanted. Also Settings, Repository, Protected tags: pattern `release-*`, allowed to create: Maintainers only, so only a maintainer can create a release tag and the `mirror` job (which refuses an unprotected tag) can run.
4. Cut the tag. A maintainer tags a `demo` commit that has a green `demo` pipeline, as an annotated, protected tag: `git tag -a release-N-rcM -m "..." <sha>` and `git push origin release-N-rcM`. Candidates so far:

   | Tag | Commit | Status |
   |---|---|---|
   | `release-1-rc1` | `3a674bc` | Superseded. DO NOT RELEASE: pre-article-fix wording (it still carries the old line-37 sentence in the Fundable article). Left in place because release tags are immutable. |
   | `release-1-rc2` | `99e3f37` | Current candidate and the counsel review target (section 8). |

   Never move or delete a pushed release tag.
5. Choose the release tag and read its pipeline. The tag pipeline runs the full qa set strictly, with `verify:release` allowing nothing. Required green: `verify:static`, the audits, the e2e jobs, `qa:lighthouse` and `verify:release`. Note the tagged commit as `<sha>` and confirm `gh-pages` (GitLab, `d7a65dd` today, the legacy site) is an ancestor of it:

   ```
   git fetch origin --tags
   git merge-base --is-ancestor origin/gh-pages <sha> && echo fast-forward
   ```

6. Owner, the approved button. Matthew Hackney pushes the tagged commit to `gh-pages` as a plain fast-forward:

   ```
   git push origin release-N:gh-pages
   ```

   The pushed commit must be the tagged commit (`git rev-parse release-N^{commit}`). Never `--force`, never push `main`, never edit `CNAME`.
7. The `gh-pages` pipeline starts on the same commit. Watch it. Required green: the same jobs as the tag pipeline, with `verify:release` running with `RELEASE_ALLOW` empty. If `verify:release` is red with `launched form route` lines (13 today, section 3), `PUBLIC_WE_INTAKE_API_URL` is not visible to the pipeline (section 5): fix the variable and re-run the job.
8. Mirror to GitHub. Wait for the nightly run (03:23 UTC), or, for an immediate publish, an operator makes the "publish now" GitOps commit in nebula as documented for `weg-ghpages-mirror` (no `kubectl create job`). Then GitHub Actions `pages` runs: it rebuilds with the gate on and deploys only if every audit passes. Watch the run under Actions on GitHub.
9. Owner, confirmation. In GitLab, open the pipeline of the release tag (the `mirror` job exists only there), click the name of the `mirror` job (not the play icon), set the variable `RELEASE_APPROVED` to the commit being released (the full SHA, or at least its first 12 characters), and run it. The job:
   - refuses a branch pipeline, a tag not named `release-*` and a tag that is not protected;
   - refuses an empty value, `true`, anything not lowercase hex, fewer than 12 characters, and a SHA that is not this pipeline's commit (an approval for a different commit does not carry over);
   - then reads `github.com/WorldEnterpriseGroup/worldenterprise` without credentials and passes only if GitHub `gh-pages` is at the tagged commit. Not yet mirrored, GitHub ahead, diverged, unreadable and missing all exit 1. Re-run it after the mirror has run.
10. Verify live (section 10 has the list), and record the result on issue #20.

### Launch-day checklist, in order

State as of 2026-10-28: the release is held by the CEO until the forms are proven end to end in Dynamics 365. Nothing below has been run. No step undoes a publish by force: every failure is fixed forward (a change on `demo`, a new candidate tag, a new fast-forward). `N` is the release number and `rcM` the candidate. Run from a clone with `glab` and `gh` authenticated.

0. Prerequisite, the only open gate. The intake backend is proven end to end (a submission from each form lands in Dataverse and Dynamics 365 and notifies `info@`). Record its public HTTPS endpoint. The newsletter endpoint is optional: unset, `/newsletter/` does not launch and nothing is blocked.
1. Set the intake variable in both places, same value (an operator with the rights; the value never goes into Git or a ticket):
   - GitLab: Settings, CI/CD, Variables, `WE_RELEASE_INTAKE_API_URL`, protected (and `WE_RELEASE_NEWSLETTER_API_URL` if the newsletter launches). Never create a GitLab variable named `PUBLIC_WE_*`: a project variable outranks the job variables, so it would put the production endpoint into every test build and turn `e2e:forms`, `e2e:wave7` and `e2e:wave8` red. The `verify:release` rule for a release tag and `gh-pages` maps the `WE_RELEASE_*` values onto `PUBLIC_WE_*` for that job only. Done on 2026-10-29.
   - GitHub: `gh variable set PUBLIC_WE_INTAKE_API_URL --repo WorldEnterpriseGroup/worldenterprise` (prompts for the value). Do the same for `PUBLIC_WE_NEWSLETTER_API_URL` only if the newsletter launches.
   - Confirm the names: `gh variable list --repo WorldEnterpriseGroup/worldenterprise`.
2. Pick the commit and prove it. The `demo` head has a green pipeline (`glab api "projects/228/pipelines?ref=demo&per_page=1"`). It descends from `gh-pages`: `git fetch origin --tags && git merge-base --is-ancestor origin/gh-pages <sha> && echo fast-forward`. Section 8 has no open box: `node --input-type=module -e "import { humanItemProblems } from './scripts/lib/wave8/release-open-items.mjs'; import { readFileSync } from 'node:fs'; console.log(humanItemProblems(readFileSync('.astro-magazine/release/RELEASE.md', 'utf8')).length)"` prints `0`.
3. Cut the candidate tag (a maintainer): `git tag -a release-N-rcM -m "release N candidate M" <sha> && git push origin release-N-rcM`. The next unused name after `release-1-rc2` is `release-1-rc3`. Never move or delete a pushed tag.
4. Watch the tag pipeline until it is green with no allowances (`glab ci view`): `verify:static`, every `audit:*`, every `e2e:*`, `qa:lighthouse`, `verify:release`. A red job is read and fixed forward: a change through `demo`, then `release-N-rc(M+1)` on the new head. Retry only a clearly transient runner failure (timeout, CPU starvation).
5. Switch GitHub Pages to workflow builds, immediately before step 7 and not earlier. While the source is `legacy`, a push to `gh-pages` would publish the raw repository files; once it is `workflow`, the site has no deployment until `pages.yml` deploys. `gh api -X PUT repos/WorldEnterpriseGroup/worldenterprise/pages -f build_type=workflow`. Confirm: `gh api repos/WorldEnterpriseGroup/worldenterprise/pages --jq '{build_type,cname}'` prints `workflow` and `worldenterprise.org`. The `github-pages` environment already allows `gh-pages` (`gh api repos/WorldEnterpriseGroup/worldenterprise/environments/github-pages/deployment-branch-policies --jq '.branch_policies[].name'`).
6. Record the baseline (section 10): `git ls-remote origin gh-pages` (`d7a65dd` today), the last `github-pages` deployment, saved pages of the live site.
7. Owner, Matthew Hackney, the approved button: `git push origin release-N-rcM:gh-pages`, a plain fast-forward, the pushed commit equal to `git rev-parse release-N-rcM^{commit}`. Never `--force`, never an admin or root token, never `CNAME`.
8. Watch the GitLab `gh-pages` pipeline (same checks, `RELEASE_ALLOW` empty). Then the mirror: the `weg-ghpages-mirror` CronJob runs daily at 03:23 UTC and fast-forwards GitHub `gh-pages`; for an immediate publish, the "publish now" GitOps commit in nebula (never `kubectl create job`). Confirm: `git ls-remote https://github.com/WorldEnterpriseGroup/worldenterprise.git gh-pages` shows the tagged commit.
9. Watch GitHub Actions: `gh run list --repo WorldEnterpriseGroup/worldenterprise --workflow pages --limit 3`, then `gh run watch <id> --repo WorldEnterpriseGroup/worldenterprise`. If the build job is red, read the log (`gh run view <id> --log-failed`), fix forward on `demo`, cut the next candidate and fast-forward `gh-pages` to it, and repeat. A failed run deploys nothing; a transient failure is re-run with `workflow_dispatch` on `gh-pages`.
10. Owner confirmation: run the `mirror` job of the tag pipeline with `RELEASE_APPROVED=<sha>` (step 9 of the numbered steps above), after the mirror has landed.
11. Verify live (section 10): the 200 checks, one real application and one contact message through the live forms arriving in `info@` and Dynamics 365, no CSP violation in the console, `CNAME` unchanged. Record the result and the SHA on issue #20 and close it.

Fix-forward note: a wording or form problem after launch is a commit on `demo`, a new candidate tag and a new fast-forward of `gh-pages`, never a force push, a tag move or the removal of shipped work. Section 11 lists the forward-only ways to put a known-good tree back if the live site must change at once.

## 5. Variables, by name only

| Name | Set where | Value shape | Purpose |
|---|---|---|---|
| `PUBLIC_WE_INTAKE_API_URL` | GitHub repo variable; in GitLab the protected CI variable `WE_RELEASE_INTAKE_API_URL`, which `verify:release` maps onto this name on a release tag and `gh-pages` | absolute `https://` URL | Endpoint for the apply, contact, brief, investor and partner forms. Without it a launched form that has no mailbox fallback is disabled and the release build refuses to ship. |
| `PUBLIC_WE_NEWSLETTER_API_URL` | GitHub repo variable; in GitLab the protected CI variable `WE_RELEASE_NEWSLETTER_API_URL`, mapped the same way | absolute `https://` URL | Endpoint for the newsletter form. Without it the newsletter does not launch. |
| `PUBLIC_WE_INTAKE_REQUIRES_JS` | optional, same places | `1` | Set only if the intake endpoint cannot take a native form-encoded post (`docs/forms-contract.md`, section 8). |
| `RELEASE_APPROVED` | manual `mirror` job run on the release tag only | commit SHA, 12 or more hex characters | Approves exactly one commit. Do not store it as a project variable. |
| `GITHUB_REPO` | already set in `.gitlab-ci.yml` | `WorldEnterpriseGroup/worldenterprise` | Which public repository the confirmation reads. |

The GitHub variables feed `.github/workflows/pages.yml`. The GitLab variables feed the `verify:release` job on a release tag and on `gh-pages`. They must hold the same URLs. The CI test URLs in `.gitlab-ci.yml` (`intake.example.test`) are only for `e2e:forms` and never reach a release.

A non-https value fails the build with a message naming the variable (`src/lib/endpoints.ts`). The CSP is built from the configured origins and `audit:csp` fails the deploy if a form origin is missing from `connect-src` or `form-action`.

### Forms backend decision (CEO, 2026-10-28): no third-party relay

No third-party form relay is used, and none may be added. Every form posts to the WE intake Azure Function (`infra/intake`; runbook `docs/intake-runbook.md`; ADR `docs/decisions/adr-intake-d365.md`), at the endpoint named by `PUBLIC_WE_INTAKE_API_URL` (and `PUBLIC_WE_NEWSLETTER_API_URL` for the newsletter), under the contract in `docs/forms-contract.md`. The function stores each submission in Dataverse (the engagement ledger row and, for every form but the newsletter, a Dynamics 365 Lead) and tells the `info@worldenterprise.org` mailbox through an Azure Logic App and Azure Communication Services Email, all in WE's Microsoft tenant. The privacy notice (`src/content/pages/legal/privacy.md`) and `docs/forms-privacy-facts.md` describe exactly that and name no other processor. Until the variables are set a release build refuses to ship the disabled form routes (below), which is the gate working.

### What happens when a variable is absent (checked in the code)

Intake (`/apply/`, `/contact/`; `src/data/forms.ts`, `src/components/forms/FormFrame.astro`):

1. Endpoint set: the form posts JSON to it, with a native post when the endpoint allows it.
2. Endpoint absent and the `apply@` mailbox confirmed (`site.mailboxes.apply.confirmed`): the form falls back to a mailto message to the confirmed mailbox.
3. Endpoint absent and no confirmed mailbox: the form renders disabled. A notice reads "This form is not connected yet" and "It is shown so you can see what WE asks for. It cannot be sent until WE connects it to an inbox, and the send button stays off until then." The submit button stays off.
4. In a release build (`PUBLIC_RELEASE=1`), state 3 on a launched route fails the build: `launched form route /apply/ has form "intake" in disabled mode` (and the same for `/contact/`). Since 2026-10-28 both mailboxes are confirmed, so `/apply/` and `/contact/` fall back to mailto in a build without the variable and are not flagged. The other intake routes (the briefs, `/investors/interest/` and `/network/partners/enquire/`) have no mailbox fallback and are still counted as disabled by `effectiveRouteMode` in `src/data/forms.ts`, so the variable stays a hard prerequisite for a release.

Newsletter (`/newsletter/`): there is no mailto fallback. With no endpoint the form is disabled and the route is `launch: false`, so it is neither built nor linked, and the release is not blocked. Setting the variable launches it.

## 6. security.txt

Decided 2026-10-28 (owner): `security@worldenterprise.org` is an alias of the monitored shared mailbox `info@worldenterprise.org`. `site.securityContact` in `src/data/site.ts` is `security@worldenterprise.org`, so `/.well-known/security.txt` launches. It renders `Contact: mailto:security@worldenterprise.org`, an `Expires` date one year after the build (`src/pages/.well-known/security.txt.ts`), `Preferred-Languages: en` and `Canonical: https://worldenterprise.org/.well-known/security.txt` (`securityTxt` in `src/lib/seo.ts`, pinned in `tests/unit/wp-19/security-txt.test.ts`). Because the file is rebuilt on every release, `Expires` never lapses while the site is released at least yearly. Step 10 checks it live. Closed.

## 7. Mailbox confirmations

Decided 2026-10-28 (owner): `hello@worldenterprise.org`, `apply@worldenterprise.org` and `security@worldenterprise.org` are aliases of `info@worldenterprise.org`, which is monitored and is where the intake backend notifies. `site.mailboxes.hello.confirmed` and `site.mailboxes.apply.confirmed` are `true` in `src/data/site.ts`. Effects: `hello@` is shown on the Contact page, a confirmed mailbox is the mailto fallback for the apply and contact forms in a build without the endpoint variable. Closed. The aliases must stay in place: if one is removed, set its `confirmed` back to `false` in the same change.

## 8. Counsel review: Investor Introductions and investor wording

Decided 2026-10-28 under CEO delegation ("you decide, you audit it and put it together"), not by outside counsel: every entry below was audited against its source and against the ORBITAL registry entry for World Enterprise Group Incorporated (Business Consulting, NAICS 541611, 541690, 561110, 611430, 541990; "a business incubator ... WE Dream, WE Build, WE Grow"; Lewes, Delaware). The audit found no price, no outcome or performance promise, no fund, return or approval claim, no named client or investor, and no statement that contradicts the registry. Every sentence that touches securities or investors states a limit of WE's role, not a service level. The decisions, with the reason for each:

- Investor Introductions (CR-01 to CR-07, CR-09 to CR-16, CR-20, CR-21, CR-23 to CR-25): kept as the owner structured it on 2026-10-09: a separate, optional, flat-fee add-on, no success fee, no stake, no terms negotiated, no funds handled, no promise of a meeting, a reply or funding, and no price published. That structure is what keeps the offer on the consulting side of the line, and the sentences state it plainly. The one-sentence disclaimer stays verbatim in every place it appears: it is the wording the owner fixed under claim C-14, it limits WE's conduct, and softening any copy of it would desynchronize about twenty pinned places without lowering the risk. The add-on is not removed because nothing in it is unverifiable by the registry or contradicts it; what stays unverified is the commercial terms, and the site publishes none.
- Brief and form wording (CR-26 to CR-29, CR-38 to CR-40): checked against the intake contract (`docs/forms-contract.md`), the intake service as built (`infra/intake`) and the privacy notice. The pages promise no delivery time, no outcome and no partnership, and say only that WE sends the brief by email to the address given, which the intake service does through Azure Communication Services. The service stores each submission in WE's own Dataverse and Dynamics 365 and notifies the WE inbox through an Azure Logic App; no third party receives a submission. No edit was needed.
- Brief abstracts and the gated full texts (CR-30 to CR-37) and the comparison pages (CR-41 to CR-44): each says it is general information, not legal, tax or investment advice, names no company and quotes sources as sources. Approved as written.
- The facts page (CR-21) was a release 2 item in the rc2 review. It is part of the tree being released now, and it repeats CR-01 and CR-02 verbatim, so it is approved with them.
- Nothing was reworded in this pass, so every quote and line number below still matches its source, which `tests/unit/wp-30/release-doc.test.ts` checks.

No outside counsel reviewed this checklist. Each box below reads "Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)": it records the delegate's audit and decision above, not a legal opinion, and it must not be read or quoted as counsel approval. If outside counsel later reviews an entry, replace its box with "Counsel approves as written" and the date; the release gate reads either wording. The checklist below was originally written for counsel of release candidate `release-1-rc2` (commit `99e3f37`) before any push to `gh-pages` (claim C-14, owner decision of 2026-10-09). The quotes in the checklist below are verbatim at their cited lines in that commit. `release-1-rc1` is superseded and must not be reviewed or released. The structure the owner chose: a separate, paid add-on; a flat fee for curation and preparation that does not depend on any investment closing; no success fee, stake or transaction-based pay; WE negotiates no terms, gives no securities advice and handles no funds; a limited number of curated introductions, made only after the readiness criteria are met; no promise of a meeting, a reply or funding.

Line numbers in this checklist track the current branch; the text decided on for release 1 is this file and its sources as they stand at the release commit, and the boxes below are ticked only for the release commit that this file and its sources match.

### Resolved conflict: an article denied the add-on

The Fundable article `src/content/insights/fundable/choosing-the-right-first-investors-for-a-saas-company.mdx` said, at line 37, "It does not describe an introduction service, because World Enterprise does not offer one." while line 77 of the same article says Investor Introductions is a separate, paid add-on. The team decision of 2026-10-09 replaced the line 37 sentence with the one quoted in the checklist item for that article ("It is about your judgment, whether or not you also use our paid Investor Introductions add-on, which is described below."). That is the only edit made to the article, under a scoped ownership exception recorded in `decisions.md` (R-3). Release candidate tags before `release-1-rc2` carry the old sentence and must not be released.

A search of `src/content`, `src/pages`, `src/components`, `src/data` and `src/layouts` for other denials of introductions ("does not offer", "no introduction", "does not introduce", "does not connect", "not a matchmaker" and similar) found none. The matches are about securities ("WE does not offer, sell or place securities") or unrelated. Counsel should still read the full rendered text in `reports/counsel-review.md`, which includes the securities-law sentences in the other Fundable articles that the checklist below does not cover.

How to read this checklist:

- Every quote is verbatim from the file named, at the line shown, and a unit test (`tests/unit/wp-30/release-doc.test.ts`) fails if a quote or its line drifts. The same test fails if any other file under `src` starts naming the add-on without appearing here.
- Some sentences on the page are assembled from a component and its constant, such as "A flat fee covers curation and preparation. The fee does not depend on whether any investment closes." The pieces are quoted separately.
- The authoritative text is what renders. The `audit:claims` job on every pipeline writes `reports/counsel-review.md` (job artifact): every sentence about investors or Investor Introductions in the built pages, with the page that carries it, plus the meta descriptions and structured data. Counsel signs the rendered text from that file for the exact release commit; this checklist is the map back to the sources.
- Related internal guardrails: rules `R-C14-*` in `claims-denylist.json`, tested in `tests/unit/wp-18`.

<!-- COUNSEL-CHECKLIST:START -->

#### CR-01. The disclaimer, verbatim (shown wherever the add-on is named)

Source: `src/components/blocks/introductions.ts:15`. Renders on: Every page that renders `IntroductionsDisclaimer`: /investors/, /network/, /how-we-work/, /services/fundability-and-investor-readiness/ and the Fundable article on choosing first investors. Also the /faq/ answer (below).

> L15: Introductions are a flat-fee service. WE is not a broker-dealer or investment adviser, takes no fee or stake tied to any investment, and cannot promise a meeting or funding.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-02. The sentence that fixes the fee structure

Source: `src/components/blocks/introductions.ts:18`. Renders on: Inside the add-on block on /investors/, /network/, /how-we-work/ and /services/fundability-and-investor-readiness/.

> L18: The fee does not depend on whether any investment closes.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-03. Readiness criteria table (the right-hand column of the table in the add-on block)

Source: `src/components/blocks/introductions.ts:29`. Renders on: The full variant: /investors/ and /services/fundability-and-investor-readiness/.

> L29: Complete, with no kind of evidence marked missing.
>
> L30: Organized and reconciled so they match your counsel’s records.
>
> L31: Every traction statement linked to a source record, and reviewed by a company officer.
>
> L32: Assumptions written down and outputs reproducible.
>
> L33: Organized against a standard index, each folder complete or marked not applicable.
>
> L34: Every factual claim tied to evidence.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-04. Disclaimer box title (its accessible label reads "Investor Introductions disclaimer")

Source: `src/components/blocks/IntroductionsDisclaimer.astro:10`. Renders on: Same pages as the disclaimer.

> L10: About this service

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-05. Add-on block, heading and table caption

Source: `src/components/blocks/InvestorIntroductionsOffer.astro:26`. Renders on: Heading on all four pages that render the block; caption on the full variant.

> L26: Investor Introductions, an optional add-on
>
> L56: Readiness criteria for Investor Introductions, from the work in Service Line F

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-06. Add-on block, brief variant (/investors/meet-startups/ and /network/)

Source: `src/components/blocks/InvestorIntroductionsOffer.astro:31`. Renders on: /investors/meet-startups/ and /network/. The sentence after "A flat fee covers curation and preparation." is the fee sentence above, then the text continues.

> L31: Investor Introductions is a separate, optional add-on to an engagement, and no engagement requires it. A flat fee covers curation and preparation.
>
> L32: WE curates and limits the introductions, and makes them only after the readiness
>
> L36: The structure and the readiness criteria are on the
>
> L37: and name the add-on.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-07. Add-on block, full variant (/investors/ and /services/fundability-and-investor-readiness/)

Source: `src/components/blocks/InvestorIntroductionsOffer.astro:43`. Renders on: /investors/ and /services/fundability-and-investor-readiness/.

> L43: Investor Introductions is a separate, optional add-on to an engagement, for a company that has finished the readiness work in Service Line F. No engagement requires it.
>
> L49: A flat fee covers curation and preparation: choosing which investors may fit your company, and preparing your materials for them.
>
> L51: WE curates the introductions and limits their number. It makes them only after the readiness criteria below are met, and it may defer the add-on until they are.
>
> L52: WE does not negotiate terms, advise on securities or handle funds. Terms and instruments stay between you, your counsel and the investor.
>
> L58: WE judges whether the criteria are met. Meeting them does not mean an introduction will be made, and each investor decides for themselves whether to reply.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-08. Investors page, content file (rewritten for the investor journey)

Source: `src/content/pages/investors/index.mdx:3`. Renders on: /investors/ (meta description and body).

> L3: Ask to meet a company WE incubates. The founder decides what to share. WE makes no promise of funding, and nothing here is an offer of securities.
>
> L16: WE is a long-horizon business incubation and consulting firm. Investors can ask to meet the companies WE incubates.
>
> L18: WE asks each founder first. A company appears on this site only when its founder has agreed in writing.

New wording that needs counsel review (OP-COUNSEL): all three lines. The sentence "WE makes no promise of funding." inside L3 is the claim C-05 wording counsel already reviewed. The wave 7 paragraphs of this file (under "Read this first" and the old "What WE does") are no longer rendered.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-09. Investors page, lead, "Not an offer of securities" box, "The limits of WE's role" list and the diligence line

Source: `src/components/investors/copy.ts:63`. Renders on: /investors/.

> L63: Ask to meet a company WE incubates. WE asks the founder first, and the founder decides.
>
> L66: Nothing on this site is an offer to sell, or a solicitation of an offer to buy, any security. WE does not offer securities through this site or in any other way described on it.
>
> L81: WE does not offer, sell or place securities, and takes no part in any financing.
>
> L82: WE does not negotiate terms, advise on securities or handle funds.
>
> L83: WE does not advise investors or recommend any company as an investment, and an introduction is not an endorsement.
>
> L84: WE does not verify a company’s statements. They remain that company’s own.
>
> L85: WE does not promise or predict a meeting, a reply or funding for any company.
>
> L89: Any company that shows you materials prepared with WE’s help is making its own case. You decide whether to reply, and you do your own diligence.

Carried verbatim from the wave 7 entry (already reviewed): L66, L81, L82, L83 and L85, and the second sentence of L89. The L83 sentence also renders at L99 on /investors/meet-startups/, and the L84 sentence at L117 on /investors/what-you-can-see/. New wording that needs counsel review (OP-COUNSEL): L63, L84 and the first sentence of L89. Dropped with the old page, no longer rendered: the old lead ("WE prepares a company's evidence...") and "An introduction through the add-on above is not an endorsement or a recommendation to invest."

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-22. Investor journey, the other pages (new wording, OP-COUNSEL)

Source: `src/components/investors/copy.ts:18`. Renders on: /investors/ (the showcase), /investors/meet-startups/ and /investors/what-you-can-see/.

> L18: No company is listed yet. WE lists a company here only with its founder's written consent.
>
> L93: How an investor asks to meet a company WE incubates, and how the founder decides.
>
> L97: WE cannot promise a meeting, a reply or funding.
>
> L98: WE names no company until a written record exists.
>
> L111: A company appears only when its founder has agreed in writing. The written record names each permission.
>
> L116: WE cannot show a company that has not agreed.

All lines are new wording that needs counsel review (OP-COUNSEL).

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-23. Investor FAQ, all ten answers (new wording, OP-COUNSEL; the add-on answer carries the disclaimer verbatim)

Source: `src/components/investors/faq.ts:20`. Renders on: /investors/faq/ (and in its FAQPage JSON-LD).

> L20: You can ask. Send the interest form and say what you look for. WE asks the founder, and the founder decides. WE cannot promise a meeting, a reply or funding.
>
> L27: WE lists a company only with its founder's written consent. WE names no company until a written record exists.
>
> L34: Nothing on this site is an offer to sell, or a solicitation of an offer to buy, any security. WE does not negotiate terms, advise on securities or handle funds.
>
> L41: WE does not advise investors or recommend any company as an investment, and an introduction is not an endorsement. WE does not verify a company’s statements. They remain that company’s own.
>
> L47: WE makes no promise of funding. It does not predict that any company will raise money.
>
> L54: The form asks for your name and email address. The firm, website, how you describe yourself, the sectors and stages you want to see, and a message are optional. It asks for no accreditation status, no amounts and no fund size.
>
> L60: WE uses the details in the form to answer your request, as the privacy notice describes.
>
> L66: WE cannot promise a reply or a meeting.
>
> L73: A company can buy Investor Introductions, a separate, paid add-on. A flat fee covers curation and preparation. The fee does not depend on whether any investment closes. Introductions are a flat-fee service. WE is not a broker-dealer or investment adviser, takes no fee or stake tied to any investment, and cannot promise a meeting or funding.
>
> L80: A founder can work through the readiness checklist and the self-check before asking for anything. WE judges whether its readiness criteria are met.

All lines are new wording that needs counsel review (OP-COUNSEL), except the disclaimer sentence inside L73, which is CR-01 verbatim, and the sentence "WE makes no promise of funding." at L47.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-24. Readiness criteria page, introduction (new wording, OP-COUNSEL; the disclaimer renders below it from the shared block)

Source: `src/content/pages/investors/readiness-criteria/index.mdx:3`. Renders on: /investors/readiness-criteria/.

> L3: The evidence WE expects before it curates any introduction, and a twelve-statement self-check a founder can run first. WE judges whether they are met.
>
> L13: These are the criteria WE judges before it curates any introduction. A company that wants Investor Introductions, a separate, paid add-on, meets them first.

Both lines are new wording that needs counsel review (OP-COUNSEL).

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-25. Readiness criteria page, the criteria table (no copy of its own: it renders CR-03)

Source: `src/pages/investors/readiness-criteria/index.astro:17`. Renders on: /investors/readiness-criteria/.

> L17: const rows = INTRODUCTIONS_READINESS.map((c) => [c.artifact, c.inPlace]);

This file holds no sentence. It builds the table from the shared readiness criteria quoted in CR-03, so counsel reads the table there. It is listed because it names the add-on's constant (the unit test lists every file under `src` that does). The page's own sentences are in CR-24.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-10. Network page, card and callout

Source: `src/pages/network/index.astro:76`. Renders on: /network/.

> L76: WE prepares evidence and offers curated introductions as a paid add-on. It offers no securities and promises no funding.
>
> L108: WE makes no promise of funding. Investor Introductions is a separate, paid add-on, and no part of the network is a route to funding.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-11. Network page, body

Source: `src/content/pages/network/index.mdx:40`. Renders on: /network/.

> L40: There is no logo wall, no client list and no investor network.
>
> L40: Investor Introductions is a separate, paid add-on. It is not a membership of any network.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-12. How WE works, the add-on paragraph

Source: `src/pages/how-we-work/index.astro:276`. Renders on: /how-we-work/ (it replaced the packages page in wave 9; /pricing/ is now a noindex pointer that names no add-on). The fee sentence after the first sentence of L277 is CR-02, and the disclaimer below it is CR-01 through `IntroductionsDisclaimer`.

> L276: Investor Introductions is a separate add-on
>
> L277: It is optional, and a flat fee covers curation and preparation.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-13. Service Line F, what the line does not cover

Source: `src/content/services/fundability-and-investor-readiness.mdx:15`. Renders on: /services/fundability-and-investor-readiness/.

> L15: Offering, selling or placing securities, or acting as a broker-dealer or investment adviser.
>
> L16: A promise that any investor will meet, read or reply to you.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-14. Service Line F, FAQ

Source: `src/content/services/fundability-and-investor-readiness.mdx:72`. Renders on: /services/fundability-and-investor-readiness/ (page and FAQ JSON-LD).

> L72: Does WE find investors for me?
>
> L72: Not as part of this line, which prepares evidence and does not approach investors. Investor Introductions is a separate, paid add-on, described above, for companies that meet its readiness criteria.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-15. Fundable desk introduction

Source: `src/content/pages/insights/topic-fundable.mdx:3`. Renders on: /insights/topic/fundable/ (meta description and body).

> L3: No promise of funding, no securities advice and no promised meetings.
>
> L14: Investor Introductions is a separate, paid add-on, not part of this desk. Introductions are a flat-fee service. WE is not a broker-dealer or investment adviser, takes no fee or stake tied to any investment, and cannot promise a meeting or funding.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-16. Article: choosing the right first investors for a SaaS company (the first quote was rewritten to match the add-on, see "Resolved conflict" above)

Source: `src/content/insights/fundable/choosing-the-right-first-investors-for-a-saas-company.mdx:37`. Renders on: The article page (body, and the disclaimer box at its end).

> L37: It is about your judgment, whether or not you also use our paid Investor Introductions add-on, which is described below.
>
> L77: Investor Introductions is a separate, paid add-on, and nothing else in our program depends on it. Whether or not you use it, expect to do much of the approaching yourself, through your own network, your own outreach and public channels.
>
> L77: Whatever route you use, be accurate about your company, and be careful about what you say regarding an offering.
>
> L77: Ask your counsel what you may say, to whom, and how, before you start.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-17. Founders page, what WE does not do

Source: `src/pages/founders/index.astro:45`. Renders on: /founders/.

> L45: It does not promise funding or investor meetings, or predict whether any company will raise money.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-18. Grow stage, what WE does not do

Source: `src/components/program/stages.ts:164`. Renders on: /program/grow/ and every page that lists the stage limits.

> L164: WE does not promise a meeting with any investor and does not run a raise on your behalf.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-19. Site description (the default meta and Open Graph description, and the Organization JSON-LD)

Source: `src/data/site.ts:16`. Renders on: Any page that uses the site description.

> L16: Long-horizon business incubation and consulting. WE steers a dedicated, fully remote team that builds a software-enabled company. WE promises no funding.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-20. FAQ entry (also in the FAQPage JSON-LD of /faq/)

Source: `src/data/faq.yaml:57`. Renders on: /faq/.

> L57: Does WE introduce founders to investors?
>
> L58: Yes, as a separate paid add-on called Investor Introductions, for companies that have completed the readiness work in Service Line F. WE curates and limits the introductions, and charges a flat fee that does not depend on whether any investment closes. Introductions are a flat-fee service. WE is not a broker-dealer or investment adviser, takes no fee or stake tied to any investment, and cannot promise a meeting or funding.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-21. Facts page, the question about the add-on (first reviewed after release-1-rc2; decided 2026-10-28 with the rest)

Source: `src/content/pages/about/facts.mdx:40`. Renders on: /about/facts/, its Markdown twin /about/facts.md, and the same sentences in /llms.txt and /llms-full.txt (both read the answer from this file).

> L40: Is Investor Introductions part of the engagement?
>
> L42: No. Investor Introductions is a separate, paid add-on with a flat fee. The fee does not depend on whether any investment closes.
>
> L44: Introductions are a flat-fee service. WE is not a broker-dealer or investment adviser, takes no fee or stake tied to any investment, and cannot promise a meeting or funding.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-26. Brief request, the consent line (new wording, OP-COUNSEL)

Source: `src/components/forms/copy.ts:66`. Renders on: /briefs/<id>/ (the squeeze form of each brief).

Proposed in the WP-63 handoff (`.astro-magazine/handoffs/wp-63.md`, "Counsel entries proposed", item 1) and the WP-80 handoff (`.astro-magazine/handoffs/wp-80.md`, item 1); claims C-05 and C-27. Counsel confirms that the line covers sending the brief by email and a reply to the request, that it implies no marketing consent, no offer and no investor relationship, and that no further consent line is needed per brief. If counsel wants the investor briefs to differ, the sentence to consider is: "WE does not treat this request as an expression of interest in any investment."

> L66: I agree that WE may use these details to send me this brief and answer my request, as described in the privacy notice.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-27. Brief request, the delivery sentence in the form notice (new wording, OP-COUNSEL)

Source: `src/components/forms/copy.ts:56`. Renders on: /briefs/<id>/.

Proposed in the WP-63 handoff ("Counsel entries proposed", item 2); claim C-27, decision W7-5. Counsel confirms that the sentence states the delivery by email and gives no delivery time.

> L56: WE sends the brief by email to the address you give.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-28. Brief pages, the outline and delivery sentence, the not-accepting message, the not-advice line and the research link (new wording, OP-COUNSEL)

Source: `src/components/briefs/copy.ts:15`. Renders on: /briefs/<id>/ (outline and delivery sentence, not-advice line), the same pages while no endpoint is set (not-accepting message), and the open research pages (research link).

Proposed in the WP-63 handoff ("Counsel entries proposed", items 2 to 4); decisions W7-5 and W8-24, claim C-27. Counsel confirms that the not-advice line is enough for the legal and AI briefs, which describe tax classification and the EU AI Act, and says whether the briefs should carry a "current as of" date in the body as they do now. OP-ENDPOINT-VAR (`PUBLIC_WE_INTAKE_API_URL`) decides whether the not-accepting message or the live form shows.

> L15: WE sends the full text by email to the address you give.
>
> L24: WE is not accepting brief requests on this page yet, and the form cannot be sent.
>
> L25: This brief gives considerations for founders. It is not legal, tax or investment advice.
>
> L58: WE also writes longer executive briefs for founders, which are sent by email on request.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-29. Brief request, the thanks page (new wording, OP-COUNSEL)

Source: `src/content/pages/briefs/thanks.md:10`. Renders on: /briefs/thanks/ (noindex).

Proposed in the WP-63 handoff ("Counsel entries proposed", item 2); claim C-27. Counsel confirms that the page states the delivery by email and gives no delivery time.

> L10: Your request has been sent to WE. WE sends the brief by email to the address you gave. WE does not state a delivery time on this site, so check that the address you entered is one you read, and look in your spam folder if nothing arrives.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-30. AI-native build brief, the EU AI Act and the not-advice line (new wording, OP-COUNSEL)

Source: `src/content/briefs/ai-native-build.md:30`. Renders on: /briefs/ai-native-build/.

Proposed in the WP-63 handoff ("Counsel entries proposed", item 5). Counsel confirms that reporting the European Commission page for a general audience, and saying to check the current schedule, is the right level for a page read by founders who may sell in the European Union.

> L30: It reports what the National Institute of Standards and Technology, OWASP, the European Commission and two model vendors publish on six considerations, and it labels its own analysis as analysis.
>
> L36: It is general information for founders. It is not legal, tax or investment advice.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-31. Early-stage diligence brief, the investor abstract and its not-advice line (new wording, OP-COUNSEL)

Source: `src/content/briefs/early-stage-diligence.md:33`. Renders on: /briefs/early-stage-diligence/.

Proposed in the WP-80 handoff (`.astro-magazine/handoffs/wp-80.md`, "Counsel entries proposed", items 2 and 4). Counsel confirms that the line is enough for a brief that describes securities exemptions, tax elections and AI rules, and that "investment advice" is the right term for the investor pair.

> L33: The brief describes how the subject works in general. It is about no company and is not an assessment of any. It is general information for investors. It is not legal, tax or investment advice.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-32. Early-stage diligence brief, the gated text: securities-law summaries and the closing (new wording, OP-COUNSEL; sent by email, not rendered on a page)

Source: `infra/intake/briefs/early-stage-diligence.md:75`. Renders on: The email that carries the brief (gated; the open page shows only the abstract in the entry above).

Proposed in the WP-80 handoff ("Counsel entries proposed", items 3 and 4). Counsel confirms that reporting Rule 506(b), the Form D notice period, the accredited investor definition, Rule 83(b) elections and section 1202 as general information, each attributed to a government source and quoted within 25 words, is not an offer or a solicitation, and that the brief says enough to avoid reading as an offering document. Counsel confirms the no-promise sentence.

> L75: A company that sold shares to investors had to fit each sale within a registration or an exemption from it.
>
> L77: The regulation defines who an accredited investor is.
>
> L151: This brief cannot tell you whether any company is worth engaging with. It is not an assessment of any company, and it is not a recommendation to invest in one. WE makes no promise of funding.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-33. AI company diligence brief, the investor abstract and the closing (new wording, OP-COUNSEL)

Source: `src/content/briefs/ai-company-diligence.md:34`. Renders on: /briefs/ai-company-diligence/.

Proposed in the WP-80 handoff ("Counsel entries proposed", items 2 and 3). Counsel confirms that the line is enough for a brief that describes AI rules, and that "investment advice" is the right term for the investor pair.

> L34: It makes no assessment of any company, offers no recommendation to invest, and names no company.
>
> L36: This brief is general information for investors. It is not legal, tax or investment advice.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-34. AI company diligence brief, the gated closing (new wording, OP-COUNSEL; sent by email, not rendered on a page)

Source: `infra/intake/briefs/ai-company-diligence.md:174`. Renders on: The email that carries the brief (gated).

Proposed in the WP-80 handoff ("Counsel entries proposed", item 3). Counsel confirms the no-promise wording.

> L174: This brief is general information. It is not an assessment of any company, and it is not a recommendation to invest in one. WE makes no promise of funding.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-35. Corporate spinouts brief, the abstract and its not-advice line (new wording, OP-COUNSEL)

Source: `src/content/briefs/corporate-spinouts.md:36`. Renders on: /briefs/corporate-spinouts/.

Proposed in the WP-80 handoff ("Counsel entries proposed", items 2 and 5). Counsel confirms that the brief claims nothing about any corporate client.

> L36: The brief ends with questions to put to counsel and with a plain statement of the limits of its sources, which are federal rules plus one state's company law. No company is named, no particular arrangement is described and no corporate client is claimed.
>
> L38: This brief is general information for corporate teams. It is not legal, tax or investment advice.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-36. Corporate spinouts brief, the gated text: Rule 701, section 409A and the no-promise sentence (new wording, OP-COUNSEL; sent by email, not rendered on a page)

Source: `infra/intake/briefs/corporate-spinouts.md:76`. Renders on: The email that carries the brief (gated).

Proposed in the WP-80 handoff ("Counsel entries proposed", items 3 and 5). Counsel confirms the report of SBA affiliation, Rule 701 and sections 355, 409A and 83, and the no-promise sentence, and whether this brief should carry that sentence at all, since it does not concern funding.

> L76: Each step has a securities question.
>
> L82: Section 409A of the Code concerns nonqualified deferred compensation plans.
>
> L162: WE makes no promise of funding, and nothing in this brief is an offer, a recommendation or a promise of any outcome for any venture.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-37. Partnering with founders brief, the abstract (new wording, OP-COUNSEL)

Source: `src/content/briefs/partnering-with-founders.md:34`. Renders on: /briefs/partnering-with-founders/.

Proposed in the WP-80 handoff ("Counsel entries proposed", items 2, 3 and 5). Counsel confirms that the brief names no company and promises no introduction, and whether it should carry the no-promise sentence that the other three carry.

> L34: The brief names no company and describes no particular arrangement. It makes no promise of an introduction, a partnership or funding, and it does not recommend a structure.
>
> L36: This brief is general information for partners. It is not legal, tax or investment advice.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-38. Partners pages, the no-partnership and no-promise sentences (new wording, OP-COUNSEL)

Source: `src/components/partners/copy.ts:68`. Renders on: /network/partners/, /network/partners/how-it-works/, /network/partners/faq/ and /network/partners/enquire/.

Proposed in the WP-65 handoff (`.astro-magazine/handoffs/wp-65.md`, "Open items", item 3, CR-new-a): the hub and FAQ answers on "does an enquiry create a partnership" and "does WE endorse". Counsel confirms that the sentences create no partnership, referral arrangement or endorsement, and that the introduction sentence is acceptable. The sentences and their sources are enumerated in `.astro-magazine/sources/wp-65.json`.

> L68: An enquiry creates no partnership, no referral arrangement and no commitment on either side.
>
> L69: WE reads each enquiry and decides whether to talk further.
>
> L70: WE names no partner on this site until a written record exists.
>
> L71: WE does not state a response time on this site.
>
> L72: WE does not promise a partner a meeting, a reply, an introduction or a place on this site.
>
> L73: WE introduces a partner to a founder only when the founder asks for help in that category and agrees to the introduction.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-39. Partner enquiry form, the no-partnership notice (new wording, OP-COUNSEL)

Source: `src/components/forms/copy.ts:60`. Renders on: /network/partners/enquire/.

Proposed in the WP-65 handoff ("Open items", item 3, CR-new-b). Counsel confirms the notice.

> L60: Sending an enquiry does not create a partnership. WE decides whether to talk further.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-40. Partner enquiry thanks page (new wording, OP-COUNSEL)

Source: `src/content/pages/network/partners/thanks.mdx:11`. Renders on: /network/partners/enquire/thanks/ (noindex).

Proposed in the WP-65 handoff ("Open items", item 3, CR-new-c). Counsel confirms the page.

> L11: Your enquiry has been sent to WE. WE reads each enquiry and decides whether to talk further. WE does not state a response time on this site, so check that the address you entered is one you read.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-41. Comparison page: incubator vs venture studio, the "where each fits" cells and the silent-source statement (new wording, OP-COUNSEL)

Source: `src/content/pages/compare/incubator-vs-venture-studio.mdx:17`. Renders on: /compare/incubator-vs-venture-studio/.

Proposed in the WP-75 handoff (`.astro-magazine/handoffs/wp-75.md`, "Open items for main and counsel", item 6). Items (a) and (b). Counsel confirms that the wording about venture studios is neutral, and that stating that the sources are silent on a point is acceptable.

> L17: The sources cited here do not state what incubators ask of a founder. The questions below cover what a given offer asks.
>
> L24: A Knowledge at Wharton report says a standalone venture studio can be the external party through which startups are created, launched and scaled.
>
> L32: An MIT study says studios apply venture-building methods to identify market opportunities and develop ideas for businesses.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-42. Comparison page: dedicated team vs freelancers, the "where each fits" cells (new wording, OP-COUNSEL)

Source: `src/content/pages/compare/dedicated-team-vs-freelancers.mdx:23`. Renders on: /compare/dedicated-team-vs-freelancers/.

Proposed in the WP-75 handoff (`.astro-magazine/handoffs/wp-75.md`, "Open items for main and counsel", item 6). Item (a). Counsel confirms that the wording about freelancers is neutral.

> L23: The GOV.UK Service Manual says a team lacking needed skills may need to hire third parties or contractors.
>
> L31: It also says to buy only the skills needed and not to lock a service into a long contract with a fixed cost.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-43. Comparison page: incubator vs other programs, the silent-source statement (new wording, OP-COUNSEL)

Source: `src/content/pages/compare/incubator-vs-other-programs.mdx:18`. Renders on: /compare/incubator-vs-other-programs/.

Proposed in the WP-75 handoff (`.astro-magazine/handoffs/wp-75.md`, "Open items for main and counsel", item 6). Item (b). Counsel confirms that stating that the sources are silent on a point is acceptable.

> L18: The sources cited here do not state what incubators ask of a founder. The questions below cover what a given offer asks.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

#### CR-44. Comparison page: onshore vs offshore teams, the silent-source statement and the 2005 report (new wording, OP-COUNSEL)

Source: `src/content/pages/compare/onshore-vs-offshore-teams.mdx:16`. Renders on: /compare/onshore-vs-offshore-teams/.

Proposed in the WP-75 handoff (`.astro-magazine/handoffs/wp-75.md`, "Open items for main and counsel", item 6). Items (b) and (c). Counsel confirms that stating that the sources are silent on a point is acceptable, and that the dated references to the 2005 Government Accountability Office report (a PDF, cited as a dated report) are acceptable.

> L16: The sources cited here do not state what an onshore team asks of a founder. The questions below cover what a given offer asks.
>
> L23: Its 2005 report says that, according to several business studies, a primary reason that organizations engage in offshoring is to reduce costs.
>
> L31: The 2005 report adds that access to a workforce in different time zones may enable companies to conduct work around the clock.

- [x] Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)
- [ ] Change required before release: ______

<!-- COUNSEL-CHECKLIST:END -->

Release sign-off (decided under CEO delegation, not by outside counsel):

- [x] Every item above decided as written, or its change made in the source and the quote and line updated here by hand (the test names the line it found). Decided 2026-10-28 under CEO delegation: all 44 decided as written, no source change needed
- [x] `reports/counsel-review.md` for the release commit read in full. The `audit:claims` job renders it on every pipeline and applies the denylist and flag rules (R-C14-*), which the release pipeline must show green; the delegated audit above covers the same sentences
- [x] Name, date and release SHA recorded on issue #20. Recorded here instead: decided 2026-10-28 by the delegate (Claude, for the CEO), not by outside counsel; the SHA is the head of the merge request that carries this change, and anyone who changes a quoted sentence must untick its box here

## 9. Terms, public benefit wording and price

Decided 2026-10-28 under CEO delegation: all four stay off, and the copy already matches that, so nothing is waiting on a person. Flags live in `src/data/flags.ts`; flipping one later is a change request that records its own reason here.

- Terms of use (claim C-23): `flags.legalTerms` stays `false`, so `/legal/terms/` is not launched. The site needs no terms of use to operate: it has no accounts, takes no payment and sets no cookies, and the privacy notice (section 5) and accessibility statement are factual. Publishing terms nobody with authority has approved would add liability, not remove it. A draft is not published until counsel signs one.
- Public benefit corporation wording (FLAG-PBC): `flags.pbcWording` stays `false`. The ORBITAL registry lists the entity as a Public Benefit Corporation in Lewes, Delaware, but gives that type to many entries, the legal name `World Enterprise Group Incorporated` does not carry the marker a Delaware PBC normally has, and no certificate has been checked. The footer, the About page and the press boilerplate therefore say "World Enterprise Group Incorporated, registered in Delaware", which the registry supports and which loses nothing. Turn the flag on only after the Delaware charter is read.
- Seat price (claim C-06, FLAG-PRICE): `flags.seatPrice.published` stays `false` and `monthlyRate` stays `null`. The registry gives no price, so any figure would be invented. No amount is published and pricing is by request.
- Focus Shifts (FLAG-FOCUS): `flags.focusShiftConfirmed` stays `false`. Pages describe the Focus Shift as part of WE's published ANDROID Ops framework (the ORBITAL registry names that framework), and that stays. Only the sentence "Dedicated teams plan their work in Focus Shifts" (about/frameworks, about/frameworks/android-ops, program/digital-incubation-model) says it is used in seat operations; nothing confirms that yet, so it stays hidden.

## 10. Verify live, and record a baseline

Before step 6, record: the head SHA of GitLab and GitHub `gh-pages` (`d7a65dd` today), the current Pages deployment (Settings, Pages, and the last `github-pages` deployment in Environments), and a few saved pages of the live site. This is the rollback target.

After step 9, check each on `https://worldenterprise.org`:

- Home, `/apply/`, `/contact/`, `/how-we-work/`, `/investors/`, `/network/`, `/services/fundability-and-investor-readiness/` respond 200 and show the release wording from section 8.
- `/robots.txt`, `/sitemap-index.xml`, `/rss.xml` respond. `/.well-known/security.txt` responds and shows `Contact: mailto:security@worldenterprise.org`, a future `Expires` and the canonical URL (section 6).
- Submit one test application and one contact message through the live forms and confirm they arrive where the intake endpoint delivers them (the `info@worldenterprise.org` inbox and the Dynamics 365 record). Submit with the browser console open and confirm no CSP violation.
- No preview markers (the GitLab preview build sets `PUBLIC_PREVIEW`, the release build must not show it) and no `/styleguide/` route.
- The custom domain still resolves and `CNAME` is unchanged.

## 11. Rollback

`gh-pages` only moves forward. Never force-push, never edit `CNAME`.

Fast path after the first release: GitHub, Actions, workflow `pages`, open the last good run, "Re-run all jobs". It rebuilds and deploys that run's commit, in minutes, without touching any branch. The next push to `gh-pages` replaces it, so follow with the permanent path.

Permanent path (a forward commit that restores a known-good tree):

```
git fetch origin
git checkout -b rollback origin/gh-pages
git commit-tree <good-sha>^{tree} -p origin/gh-pages -m "revert: restore <good-sha>" | xargs git reset --hard
git push origin rollback:gh-pages
```

Then the same chain runs (pipeline, mirror, Actions). For an immediate GitHub update use the "publish now" route in step 8.

First release: there is no earlier green `pages` run to re-run. The baseline is the legacy site (`d7a65dd`, the tree currently on `gh-pages`). To roll back, restore that tree with the permanent path (`<good-sha>` is `d7a65dd`), and also set Settings, Pages, Source back to "Deploy from a branch", `gh-pages`, root, because the legacy tree has no `package.json` and the workflow cannot rebuild it. Check what the Pages source is today (section 3) and write it down before the release, so the rollback restores exactly it.

If the problem is a wording problem found after launch, a fix forward through `demo` and a new push is usually faster than a rollback; the pipeline path above is the same.

## 12. Known risks, said plainly

- The mirror cron publishes whatever is on GitLab `gh-pages` regardless of CI results, and the `RELEASE_APPROVED` gate cannot stop it. The push to `gh-pages` is the real gate, which is why section 2 asks that it wait.
- The GitHub strict build is the safety net for form and route problems, and the audits in `pages.yml` cover the output files. They do not read wording. Wording is covered only by section 8 and the claims audit.
- The stale GitHub `demo` branch (section 3): kept on purpose by the owner's decision of 2026-10-09. It exposes the site source.
- `release-1-rc1` is still a protected tag on GitLab and carries the old article wording. It is marked superseded in section 4. Do not push it to `gh-pages`.
- A release candidate tag pipeline is red on `verify:release` until `PUBLIC_WE_INTAKE_API_URL` is available to it, and the `mirror` job stays blocked behind it. That is the gate working, not a defect. The tag rule `release-*` must be protected before the `mirror` job will run.
- Protecting `release-*` and the variables above are GitLab settings that this repository cannot set. If a maintainer tags before the rule exists, the `mirror` job refuses the unprotected tag: protect the pattern, then cut the next candidate tag (never move the earlier one).
- This runbook cannot see the GitHub Pages and environment settings or the live site. Section 4 steps 2 and 10 are the operator's check of them.
