# Public release runbook: demo to gh-pages to worldenterprise.org

Owner: WP-30 (release engineer), issue #20, decision R-1. Written 2026-10-09 against demo `cc84ffa` (pipeline 64693, green).

Nothing in this document has been run against production. Releasing is the owner's act: this runbook stages it so that the owner approves once, with everything else already checked.

## 1. What is ready and what is not

Ready, built and tested:

- The release path is a fast-forward of GitLab `gh-pages` to a green `demo` commit, then the existing mirror to GitHub, then a strict GitHub Actions build and deploy.
- The GitLab `mirror` job on `gh-pages` is manual, blocked until `RELEASE_APPROVED` names the commit, and read-only. It confirms the release reached GitHub. It holds no GitHub credential and cannot push.
- `audit:claims` writes `reports/counsel-review.md`, every sentence about investors as the built pages render it, for counsel.
- The counsel checklist in section 8 quotes every Investor Introductions sentence from the sources. A unit test fails if a quote drifts from its source or a new source file starts naming the add-on without being listed.

Waiting on the owner or an operator (names only, no values anywhere in Git):

| Item | Owner | Where it is described |
|---|---|---|
| `PUBLIC_WE_INTAKE_API_URL` set (https) in GitHub repo variables and in GitLab CI variables | operator | section 5 |
| `PUBLIC_WE_NEWSLETTER_API_URL` set (https), only if the newsletter should launch | operator | section 5 |
| GitHub Pages source is "GitHub Actions" and the `github-pages` environment allows `gh-pages` | operator | section 4, step 2 |
| Counsel review of the Investor Introductions wording | counsel | section 8 |
| `hello@` and `apply@` mailboxes confirmed as existing and monitored | operator | section 7 |
| A monitored security mailbox, for `security.txt` | operator | section 6 |
| Terms of use sign-off (C-23) | counsel | section 9 |
| Public benefit corporation wording (FLAG-PBC), seat price publication (FLAG-PRICE) | owner, counsel | section 9 |
| The push of a green `demo` commit to `gh-pages` | owner (Matthew Hackney) | section 4, step 5 |
| `RELEASE_APPROVED=<sha>` on the manual `mirror` job | owner | section 4, step 8 |

## 2. How a release travels, and where the real gates are

```
demo (GitLab, green) --push, fast-forward only--> gh-pages (GitLab)
   gh-pages pipeline: verify:static, audits, e2e, verify:release with no allowances, manual mirror job
gh-pages (GitLab) --weg-ghpages-mirror CronJob, daily 03:23 UTC, fast-forward only--> gh-pages (GitHub)
   GitHub Actions pages.yml: rebuild with PUBLIC_RELEASE=1 and no allowances, audit dist, deploy to Pages
```

Read this part before approving anything:

- GitHub is fed by the `weg-ghpages-mirror` CronJob (nebula, `tools/weg-ghpages-mirror`). It uses a short-lived installation token from the GitHub App `focusapiary-mirror-sync`, pushes only fast-forwards, skips and alerts on divergence, and has `worldenterprise` on its allowlist. That is why this project holds no GitHub credential and needs no `GITHUB_TOKEN`. The earlier handoff instruction to set `GITHUB_TOKEN` (wp-19) is obsolete.
- The cron copies whatever is on GitLab `gh-pages`. It does not look at CI. A CI approval therefore cannot stop it, and the `RELEASE_APPROVED` gate is a confirmation step, not the publish switch.
- The controls that do stop a bad publish are, in order: (1) only the owner can push `gh-pages` (the branch is protected, push is limited to Matthew Hackney, force push is off), so nothing goes live until that push; (2) the GitHub Actions build re-runs the release gate with `RELEASE_ALLOW` empty, so a launched form that is disabled, a missing launched route or leftover draft content fails the deploy; (3) the audits in the same workflow (dist allowlist, CSP coverage, route ledger, links, images).
- Because of (1): do not push `gh-pages` until the checklist in section 1 is finished. The push is the approved button.

## 3. Pre-flight against current demo

Run on 2026-10-09 against demo `cc84ffa` (pipeline 64693) and the WP-30 branch (pipeline 64723 and later).

| Check | Result |
|---|---|
| Demo pipeline 64693, all 17 jobs (`verify:static`, 7 audits, 5 e2e, `qa:lighthouse`, `verify:release`, `pages`) | green |
| `verify:release` on demo (RELEASE_ALLOW tolerates form routes) | passes with 2 tolerated problems, below |
| `astro check` | 0 errors, 0 warnings, 1 hint |
| WP-30 unit tests (`tests/unit/wp-30`) | 24 pass |

Tolerated on demo, red on `gh-pages` until `PUBLIC_WE_INTAKE_API_URL` is set:

```
allowed  launched form route /apply/ has form "intake" in disabled mode
allowed  launched form route /contact/ has form "intake" in disabled mode
```

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
| `/press/brand-kit/` | whitelab brand-usage sign-off |
| `/founders/stories/`, `/founders/portfolio/`, `/case-studies/`, `/network/partners/`, `/network/delivery-partners/`, `/about/team/`, `/careers/`, `/events/`, `/program/cohorts/`, `/program/demo-day/`, `/people/[slug]/` | real content exists (companies, people, dates, events) |

Not checkable from here, and left to the operator because the unauthenticated GitHub API answers 404 for them and the live domain is not reachable from the agent environment:

- The GitHub Pages source setting and the `github-pages` environment deployment-branch policy.
- The GitHub repo variable values (names are in section 5).
- The live state of `worldenterprise.org` before the release (record a baseline, section 10).

Observation for the owner: the public GitHub repository `WorldEnterpriseGroup/worldenterprise` has a `demo` branch (head `73cc378`, stale) that exposes the site source, alongside `main` and `gh-pages`. The mirror cron does not create it. Decide whether to delete it from GitHub before launch.

## 4. Release steps

Do these in order. A step that fails stops the release; fix forward, never force.

1. Settle the checklist in section 1. Counsel's answers on section 8 may change wording; any change goes through a normal `demo` merge and a new green pipeline, and the release SHA below is chosen after it.
2. Operator, GitHub settings (once): Settings, Pages, Source set to "GitHub Actions". Settings, Environments, `github-pages`, deployment branches allow `gh-pages`. Settings, Secrets and variables, Actions, Variables: the two variables in section 5.
3. Operator, GitLab settings (once): Settings, CI/CD, Variables: the two variables in section 5, scoped to protected branches so `gh-pages` sees them. No `GITHUB_TOKEN` is needed or wanted.
4. Choose the release commit: the head of `demo`, with a green pipeline on that exact SHA. Note it as `<sha>`. Confirm `gh-pages` (GitLab, `d7a65dd` today, the legacy site) is an ancestor of it:

   ```
   git fetch origin
   git merge-base --is-ancestor origin/gh-pages <sha> && echo fast-forward
   ```

5. Owner, the approved button. Matthew Hackney pushes the commit to `gh-pages` as a plain fast-forward:

   ```
   git push origin <sha>:gh-pages
   ```

   Never `--force`, never push `main`, never edit `CNAME`.
6. The `gh-pages` pipeline starts. Watch it. Required green: `verify:static`, the audits, the e2e jobs and `verify:release`, which on `gh-pages` runs with `RELEASE_ALLOW` empty. If `verify:release` is red with the two `launched form route` lines, `PUBLIC_WE_INTAKE_API_URL` is not visible to the pipeline (section 5): fix the variable and re-run the job.
7. Mirror to GitHub. Wait for the nightly run (03:23 UTC), or, for an immediate publish, an operator makes the "publish now" GitOps commit in nebula as documented for `weg-ghpages-mirror` (no `kubectl create job`). Then GitHub Actions `pages` runs: it rebuilds with the gate on and deploys only if every audit passes. Watch the run under Actions on GitHub.
8. Owner, confirmation. In GitLab, open the `gh-pages` pipeline, click the name of the `mirror` job (not the play icon), set the variable `RELEASE_APPROVED` to the commit being released (the full SHA, or at least its first 12 characters), and run it. The job:
   - refuses an empty value, `true`, anything not lowercase hex, fewer than 12 characters, and a SHA that is not this pipeline's commit (an approval for a different commit does not carry over);
   - then reads `github.com/WorldEnterpriseGroup/worldenterprise` without credentials and passes only if GitHub `gh-pages` is at this commit. Not yet mirrored, GitHub ahead, diverged, unreadable and missing all exit 1. Re-run it after the mirror has run.
9. Verify live (section 10 has the list), and record the result on issue #20.

## 5. Variables, by name only

| Name | Set where | Value shape | Purpose |
|---|---|---|---|
| `PUBLIC_WE_INTAKE_API_URL` | GitHub repo variable and GitLab CI variable (protected) | absolute `https://` URL | Endpoint for the apply and contact forms. Without it a launched form is disabled and the release build refuses to ship. |
| `PUBLIC_WE_NEWSLETTER_API_URL` | GitHub repo variable and GitLab CI variable (protected) | absolute `https://` URL | Endpoint for the newsletter form. Without it the newsletter does not launch. |
| `PUBLIC_WE_INTAKE_REQUIRES_JS` | optional, same places | `1` | Set only if the intake endpoint cannot take a native form-encoded post (`docs/forms-contract.md`, section 8). |
| `RELEASE_APPROVED` | manual `mirror` job run only | commit SHA, 12 or more hex characters | Approves exactly one commit. Do not store it as a project variable. |
| `GITHUB_REPO` | already set in `.gitlab-ci.yml` | `WorldEnterpriseGroup/worldenterprise` | Which public repository the confirmation reads. |

The GitHub variables feed `.github/workflows/pages.yml`. The GitLab variables feed the `gh-pages` `verify:release` job. They must hold the same URLs. The CI test URLs in `.gitlab-ci.yml` (`intake.example.test`) are only for `e2e:forms` and never reach a release.

A non-https value fails the build with a message naming the variable (`src/lib/endpoints.ts`). The CSP is built from the configured origins and `audit:csp` fails the deploy if a form origin is missing from `connect-src` or `form-action`.

### What happens when a variable is absent (checked in the code)

Intake (`/apply/`, `/contact/`; `src/data/forms.ts`, `src/components/forms/FormFrame.astro`):

1. Endpoint set: the form posts JSON to it, with a native post when the endpoint allows it.
2. Endpoint absent and the `apply@` mailbox confirmed (`site.mailboxes.apply.confirmed`): the form falls back to a mailto message to the confirmed mailbox.
3. Endpoint absent and no confirmed mailbox: the form renders disabled. A notice reads "This form is not connected yet" and "It is shown so you can see what WE asks for. It cannot be sent until WE connects it to an inbox, and the send button stays off until then." The submit button stays off.
4. In a release build (`PUBLIC_RELEASE=1`), state 3 on a launched route fails the build: `launched form route /apply/ has form "intake" in disabled mode` (and the same for `/contact/`). Both mailboxes are unconfirmed today, so the intake variable is a hard prerequisite.

Newsletter (`/newsletter/`): there is no mailto fallback. With no endpoint the form is disabled and the route is `launch: false`, so it is neither built nor linked, and the release is not blocked. Setting the variable launches it.

## 6. security.txt

`/.well-known/security.txt` launches only when `site.securityContact` in `src/data/site.ts` is set (today `null`, so the file is absent). An operator provides a monitored security mailbox, tests it from an outside address, and the value is added through a change request against `src/data/site.ts` (a frozen file; it needs an ownership exception row). `securityContactUri` in `src/lib/seo.ts` accepts `https:`, `mailto:` and `tel:` as written. Do not publish the file before the mailbox is monitored (claim C-22).

## 7. Mailbox confirmations

`hello@worldenterprise.org` and `apply@worldenterprise.org` are `confirmed: false` in `src/data/site.ts`. For each, an operator confirms that the mailbox exists, receives mail from an outside address, and has a named person who reads it. Then a change request sets `confirmed: true`. Effects: `hello@` is shown on the Contact page, and a confirmed mailbox becomes the mailto fallback for the intake forms. Nothing needs to be flipped if the intake endpoint is configured and the owner prefers not to publish an address.

## 8. Counsel review: Investor Introductions and investor wording

Counsel reviews this wording before any push to `gh-pages` (claim C-14, owner decision of 2026-10-09). The structure the owner chose: a separate, paid add-on; a flat fee for curation and preparation that does not depend on any investment closing; no success fee, stake or transaction-based pay; WE negotiates no terms, gives no securities advice and handles no funds; a limited number of curated introductions, made only after the readiness criteria are met; no promise of a meeting, a reply or funding.

How to read this checklist:

- Every quote is verbatim from the file named, at the line shown, and a unit test (`tests/unit/wp-30/release-doc.test.ts`) fails if a quote or its line drifts. The same test fails if any other file under `src` starts naming the add-on without appearing here.
- Some sentences on the page are assembled from a component and its constant, such as "A flat fee covers curation and preparation. The fee does not depend on whether any investment closes." The pieces are quoted separately.
- The authoritative text is what renders. The `audit:claims` job on every pipeline writes `reports/counsel-review.md` (job artifact): every sentence about investors or Investor Introductions in the built pages, with the page that carries it, plus the meta descriptions and structured data. Counsel signs the rendered text from that file for the exact release commit; this checklist is the map back to the sources.
- Related internal guardrails: rules `R-C14-*` in `claims-denylist.json`, tested in `tests/unit/wp-18`.

<!-- COUNSEL-CHECKLIST:START -->

#### CR-01. The disclaimer, verbatim (shown wherever the add-on is named)

Source: `src/components/blocks/introductions.ts:15`. Renders on: Every page that renders `IntroductionsDisclaimer`: /investors/, /network/, /pricing/, /services/fundability-and-investor-readiness/ and the Fundable article on choosing first investors. Also the /faq/ answer (below).

> L15: Introductions are a flat-fee service. WE is not a broker-dealer or investment adviser, takes no fee or stake tied to any investment, and cannot promise a meeting or funding.

- [ ] Counsel approves as written
- [ ] Counsel requires this change: ______

#### CR-02. The sentence that fixes the fee structure

Source: `src/components/blocks/introductions.ts:18`. Renders on: Inside the add-on block on /investors/, /network/, /pricing/ and /services/fundability-and-investor-readiness/.

> L18: The fee does not depend on whether any investment closes.

- [ ] Counsel approves as written
- [ ] Counsel requires this change: ______

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

- [ ] Counsel approves as written
- [ ] Counsel requires this change: ______

#### CR-04. Disclaimer box title (its accessible label reads "Investor Introductions disclaimer")

Source: `src/components/blocks/IntroductionsDisclaimer.astro:10`. Renders on: Same pages as the disclaimer.

> L10: About this service

- [ ] Counsel approves as written
- [ ] Counsel requires this change: ______

#### CR-05. Add-on block, heading and table caption

Source: `src/components/blocks/InvestorIntroductionsOffer.astro:26`. Renders on: Heading on all four pages that render the block; caption on the full variant.

> L26: Investor Introductions, an optional add-on
>
> L56: Readiness criteria for Investor Introductions, from the work in Service Line F

- [ ] Counsel approves as written
- [ ] Counsel requires this change: ______

#### CR-06. Add-on block, brief variant (/pricing/ and /network/)

Source: `src/components/blocks/InvestorIntroductionsOffer.astro:31`. Renders on: /pricing/ and /network/. The sentence after "A flat fee covers curation and preparation." is the fee sentence above, then the text continues.

> L31: Investor Introductions is a separate, paid add-on. It is not part of any package, and no package requires it. A flat fee covers curation and preparation.
>
> L32: WE curates and limits the introductions, and makes them only after the readiness
>
> L36: The structure and the readiness criteria are on the
>
> L37: and name the add-on.

- [ ] Counsel approves as written
- [ ] Counsel requires this change: ______

#### CR-07. Add-on block, full variant (/investors/ and /services/fundability-and-investor-readiness/)

Source: `src/components/blocks/InvestorIntroductionsOffer.astro:43`. Renders on: /investors/ and /services/fundability-and-investor-readiness/.

> L43: Investor Introductions is a separate, paid add-on for a company that has finished the readiness work in Service Line F. It is not part of any package, and no package requires it.
>
> L49: A flat fee covers curation and preparation: choosing which investors may fit your company, and preparing your materials for them.
>
> L51: WE curates the introductions and limits their number. It makes them only after the readiness criteria below are met, and it may defer the add-on until they are.
>
> L52: WE does not negotiate terms, advise on securities or handle funds. Terms and instruments stay between you, your counsel and the investor.
>
> L58: WE judges whether the criteria are met. Meeting them does not mean an introduction will be made, and each investor decides for themselves whether to reply.

- [ ] Counsel approves as written
- [ ] Counsel requires this change: ______

#### CR-08. Investors page, intro and limits

Source: `src/content/pages/investors/index.mdx:3`. Renders on: /investors/ (meta description and body).

> L3: What WE does for companies preparing to raise, and what it does not do. WE offers no securities, runs no raise for a company and promises no funding.
>
> L22: It is not a fund, a broker-dealer, an investment adviser or a marketplace, and this page is written to make that plain to anyone who arrives from an investor's side.
>
> L28: A company that has finished the readiness work can also buy Investor Introductions. It is a separate, paid add-on with a flat fee, and it is described in full below.

- [ ] Counsel approves as written
- [ ] Counsel requires this change: ______

#### CR-09. Investors page, "The limits of WE's role" list and the investor paragraph

Source: `src/pages/investors/index.astro:25`. Renders on: /investors/.

> L25: WE does not offer, sell or place securities, and takes no part in any financing.
>
> L26: WE does not negotiate terms, advise on securities or handle funds.
>
> L27: WE does not advise investors or recommend any company as an investment, and an introduction is not an endorsement.
>
> L29: WE does not promise or predict a meeting, a reply or funding for any company.
>
> L68: An introduction through the add-on above is not an endorsement or a recommendation to invest. You decide whether to reply, and you do your own diligence.

- [ ] Counsel approves as written
- [ ] Counsel requires this change: ______

#### CR-10. Network page, card and callout

Source: `src/pages/network/index.astro:69`. Renders on: /network/.

> L69: WE prepares evidence and offers curated introductions as a paid add-on. It offers no securities and promises no funding.
>
> L88: WE makes no promise of funding. Investor Introductions is a separate, paid add-on, and no part of the network is a route to funding.

- [ ] Counsel approves as written
- [ ] Counsel requires this change: ______

#### CR-11. Network page, body

Source: `src/content/pages/network/index.mdx:34`. Renders on: /network/.

> L34: There is no logo wall, no client list, no investor network and no partner program or perks scheme.
>
> L34: Investor Introductions is a paid add-on for one company at a time. It is not a membership of any network.

- [ ] Counsel approves as written
- [ ] Counsel requires this change: ______

#### CR-12. Pricing page, body and FAQ

Source: `src/content/pages/pricing/pricing.mdx:52`. Renders on: /pricing/.

> L52: This page lists no amounts. WE shares the current rate for a package, a custom seat plan or the add-on when you ask, so the figure you receive is the one that applies today.
>
> L58: Not on this page. WE shares the current rate for a package, a custom seat plan or the add-on when you ask for it.
>
> L69: Is Investor Introductions part of a package?
>
> L70: No. It is a separate, paid add-on with a flat fee. The fee does not depend on whether any investment closes.

- [ ] Counsel approves as written
- [ ] Counsel requires this change: ______

#### CR-13. Service Line F, what the line does not cover

Source: `src/content/services/fundability-and-investor-readiness.mdx:15`. Renders on: /services/fundability-and-investor-readiness/.

> L15: Offering, selling or placing securities, or acting as a broker-dealer or investment adviser.
>
> L16: A promise that any investor will meet, read or reply to you.

- [ ] Counsel approves as written
- [ ] Counsel requires this change: ______

#### CR-14. Service Line F, FAQ

Source: `src/content/services/fundability-and-investor-readiness.mdx:72`. Renders on: /services/fundability-and-investor-readiness/ (page and FAQ JSON-LD).

> L72: Does WE find investors for me?
>
> L72: Not as part of this line, which prepares evidence and does not approach investors. Investor Introductions is a separate, paid add-on, described above, for companies that meet its readiness criteria.

- [ ] Counsel approves as written
- [ ] Counsel requires this change: ______

#### CR-15. Fundable desk introduction

Source: `src/content/pages/insights/topic-fundable.mdx:3`. Renders on: /insights/ Fundable desk page (meta description and body).

> L3: No promise of funding, no securities advice and no promised meetings.
>
> L14: Investor Introductions is a separate, paid add-on, not part of this desk. Introductions are a flat-fee service. WE is not a broker-dealer or investment adviser, takes no fee or stake tied to any investment, and cannot promise a meeting or funding.

- [ ] Counsel approves as written
- [ ] Counsel requires this change: ______

#### CR-16. Article: choosing the right first investors for a SaaS company

Source: `src/content/insights/fundable/choosing-the-right-first-investors-for-a-saas-company.mdx:77`. Renders on: The article page (body, and the disclaimer box at its end).

> L77: Investor Introductions is a separate, paid add-on, and nothing else in our program depends on it. Whether or not you use it, expect to do much of the approaching yourself, through your own network, your own outreach and public channels.
>
> L77: Whatever route you use, be accurate about your company, and be careful about what you say regarding an offering.
>
> L77: Ask your counsel what you may say, to whom, and how, before you start.

- [ ] Counsel approves as written
- [ ] Counsel requires this change: ______

#### CR-17. FAQ entry (also in the FAQPage JSON-LD of /faq/)

Source: `src/data/faq.yaml:57`. Renders on: /faq/.

> L57: Does WE introduce founders to investors?
>
> L58: Yes, as a separate paid add-on called Investor Introductions, for companies that have completed the readiness work in Service Line F. WE curates and limits the introductions, and charges a flat fee that does not depend on whether any investment closes. Introductions are a flat-fee service. WE is not a broker-dealer or investment adviser, takes no fee or stake tied to any investment, and cannot promise a meeting or funding.

- [ ] Counsel approves as written
- [ ] Counsel requires this change: ______

<!-- COUNSEL-CHECKLIST:END -->

Counsel sign-off:

- [ ] Every item above approved, or its change made and the checklist regenerated from the new sources
- [ ] `reports/counsel-review.md` for the release commit read in full
- [ ] Counsel name, date and release SHA recorded on issue #20

## 9. Terms, public benefit wording and price

All three stay off until the named person signs. Flags live in `src/data/flags.ts` and are flipped only by a change request.

- Terms of use (claim C-23): `flags.legalTerms` is `false`, so `/legal/terms/` is not launched. Counsel signs the terms text; then the flag is set and the route appears. The site works without it.
- Public benefit corporation wording (FLAG-PBC): `flags.pbcWording` is `false`. Set it only after the owner and counsel confirm the entity status; it lets the footer and About page say "Delaware public benefit corporation".
- Seat price (claim C-06, FLAG-PRICE): `flags.seatPrice.published` is `false` and `monthlyRate` must stay `null` while it is. No amount is published. Pricing is by request.
- Focus Shifts (FLAG-FOCUS): `flags.focusShiftConfirmed` is `false`. Leave it until operations confirm.

## 10. Verify live, and record a baseline

Before step 5, record: the head SHA of GitLab and GitHub `gh-pages` (`d7a65dd` today), the current Pages deployment (Settings, Pages, and the last `github-pages` deployment in Environments), and a few saved pages of the live site. This is the rollback target.

After step 8, check each on `https://worldenterprise.org`:

- Home, `/apply/`, `/contact/`, `/pricing/`, `/investors/`, `/network/`, `/services/fundability-and-investor-readiness/` respond 200 and show the release wording from section 8.
- `/robots.txt`, `/sitemap-index.xml`, `/rss.xml` respond. `/.well-known/security.txt` responds only if section 6 was done.
- Submit one test application and one contact message through the live forms and confirm they arrive in the inbox the endpoint feeds. Submit with the browser console open and confirm no CSP violation.
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

Then the same chain runs (pipeline, mirror, Actions). For an immediate GitHub update use the "publish now" route in step 7.

First release: there is no earlier green `pages` run to re-run. The baseline is the legacy site (`d7a65dd`, the tree currently on `gh-pages`). To roll back, restore that tree with the permanent path (`<good-sha>` is `d7a65dd`), and also set Settings, Pages, Source back to "Deploy from a branch", `gh-pages`, root, because the legacy tree has no `package.json` and the workflow cannot rebuild it. Check what the Pages source is today (section 3) and write it down before the release, so the rollback restores exactly it.

If the problem is a wording problem found after launch, a fix forward through `demo` and a new push is usually faster than a rollback; the pipeline path above is the same.

## 12. Known risks, said plainly

- The mirror cron publishes whatever is on GitLab `gh-pages` regardless of CI results, and the `RELEASE_APPROVED` gate cannot stop it. The push to `gh-pages` is the real gate, which is why section 2 asks that it wait.
- The GitHub strict build is the safety net for form and route problems, and the audits in `pages.yml` cover the output files. They do not read wording. Wording is covered only by section 8 and the claims audit.
- The stale GitHub `demo` branch (section 3).
- This runbook cannot see the GitHub Pages and environment settings or the live site. Section 4 steps 2 and 9 are the operator's check of them.
