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
| `PUBLIC_WE_INTAKE_API_URL` set (https) in GitHub repo variables and in GitLab CI variables | operator | section 5 |
| `PUBLIC_WE_NEWSLETTER_API_URL` set (https), only if the newsletter should launch | operator | section 5 |
| GitHub Pages source is "GitHub Actions" and the `github-pages` environment allows `gh-pages` | operator | section 4, step 2 |
| Counsel review of the Investor Introductions wording (the contradicting article sentence is already fixed) | counsel | section 8 |
| `hello@` and `apply@` mailboxes confirmed as existing and monitored | operator | section 7 |
| A monitored security mailbox, for `security.txt` | operator | section 6 |
| Terms of use sign-off (C-23) | counsel | section 9 |
| Public benefit corporation wording (FLAG-PBC), seat price publication (FLAG-PRICE) | owner, counsel | section 9 |
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
7. The `gh-pages` pipeline starts on the same commit. Watch it. Required green: the same jobs as the tag pipeline, with `verify:release` running with `RELEASE_ALLOW` empty. If `verify:release` is red with the two `launched form route` lines, `PUBLIC_WE_INTAKE_API_URL` is not visible to the pipeline (section 5): fix the variable and re-run the job.
8. Mirror to GitHub. Wait for the nightly run (03:23 UTC), or, for an immediate publish, an operator makes the "publish now" GitOps commit in nebula as documented for `weg-ghpages-mirror` (no `kubectl create job`). Then GitHub Actions `pages` runs: it rebuilds with the gate on and deploys only if every audit passes. Watch the run under Actions on GitHub.
9. Owner, confirmation. In GitLab, open the pipeline of the release tag (the `mirror` job exists only there), click the name of the `mirror` job (not the play icon), set the variable `RELEASE_APPROVED` to the commit being released (the full SHA, or at least its first 12 characters), and run it. The job:
   - refuses a branch pipeline, a tag not named `release-*` and a tag that is not protected;
   - refuses an empty value, `true`, anything not lowercase hex, fewer than 12 characters, and a SHA that is not this pipeline's commit (an approval for a different commit does not carry over);
   - then reads `github.com/WorldEnterpriseGroup/worldenterprise` without credentials and passes only if GitHub `gh-pages` is at the tagged commit. Not yet mirrored, GitHub ahead, diverged, unreadable and missing all exit 1. Re-run it after the mirror has run.
10. Verify live (section 10 has the list), and record the result on issue #20.

## 5. Variables, by name only

| Name | Set where | Value shape | Purpose |
|---|---|---|---|
| `PUBLIC_WE_INTAKE_API_URL` | GitHub repo variable and GitLab CI variable (protected) | absolute `https://` URL | Endpoint for the apply and contact forms. Without it a launched form is disabled and the release build refuses to ship. |
| `PUBLIC_WE_NEWSLETTER_API_URL` | GitHub repo variable and GitLab CI variable (protected) | absolute `https://` URL | Endpoint for the newsletter form. Without it the newsletter does not launch. |
| `PUBLIC_WE_INTAKE_REQUIRES_JS` | optional, same places | `1` | Set only if the intake endpoint cannot take a native form-encoded post (`docs/forms-contract.md`, section 8). |
| `RELEASE_APPROVED` | manual `mirror` job run on the release tag only | commit SHA, 12 or more hex characters | Approves exactly one commit. Do not store it as a project variable. |
| `GITHUB_REPO` | already set in `.gitlab-ci.yml` | `WorldEnterpriseGroup/worldenterprise` | Which public repository the confirmation reads. |

The GitHub variables feed `.github/workflows/pages.yml`. The GitLab variables feed the `verify:release` job on a release tag and on `gh-pages`. They must hold the same URLs. The CI test URLs in `.gitlab-ci.yml` (`intake.example.test`) are only for `e2e:forms` and never reach a release.

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

Counsel reviews the wording of release candidate `release-1-rc2` (commit `99e3f37`) before any push to `gh-pages` (claim C-14, owner decision of 2026-10-09). The quotes in the checklist below are verbatim at their cited lines in that commit. `release-1-rc1` is superseded and must not be reviewed or released. The structure the owner chose: a separate, paid add-on; a flat fee for curation and preparation that does not depend on any investment closing; no success fee, stake or transaction-based pay; WE negotiates no terms, gives no securities advice and handles no funds; a limited number of curated introductions, made only after the readiness criteria are met; no promise of a meeting, a reply or funding.

Line numbers in this checklist track the current demo branch; the text counsel reviews for release 1 is this file and its sources as they stand at tag release-1-rc2 (99e3f37).

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

#### CR-08. Investors page, content file (rewritten for the investor journey)

Source: `src/content/pages/investors/index.mdx:3`. Renders on: /investors/ (meta description and body).

> L3: Ask to meet a company WE incubates. The founder decides what to share. WE makes no promise of funding, and nothing here is an offer of securities.
>
> L16: WE is a long-horizon business incubation and consulting firm. Investors can ask to meet the companies WE incubates.
>
> L18: WE asks each founder first. A company appears on this site only when its founder has agreed in writing.

New wording that needs counsel review (OP-COUNSEL): all three lines. The sentence "WE makes no promise of funding." inside L3 is the claim C-05 wording counsel already reviewed. The wave 7 paragraphs of this file (under "Read this first" and the old "What WE does") are no longer rendered.

- [ ] Counsel approves as written
- [ ] Counsel requires this change: ______

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

- [ ] Counsel approves as written
- [ ] Counsel requires this change: ______

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

- [ ] Counsel approves as written
- [ ] Counsel requires this change: ______

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

- [ ] Counsel approves as written
- [ ] Counsel requires this change: ______

#### CR-24. Readiness criteria page, introduction (new wording, OP-COUNSEL; the disclaimer renders below it from the shared block)

Source: `src/content/pages/investors/readiness-criteria/index.mdx:3`. Renders on: /investors/readiness-criteria/.

> L3: The evidence WE expects before it curates any introduction, and a twelve-statement self-check a founder can run first. WE judges whether they are met.
>
> L13: These are the criteria WE judges before it curates any introduction. A company that wants Investor Introductions, a separate, paid add-on, meets them first.

Both lines are new wording that needs counsel review (OP-COUNSEL).

- [ ] Counsel approves as written
- [ ] Counsel requires this change: ______

#### CR-25. Readiness criteria page, the criteria table (no copy of its own: it renders CR-03)

Source: `src/pages/investors/readiness-criteria/index.astro:17`. Renders on: /investors/readiness-criteria/.

> L17: const rows = INTRODUCTIONS_READINESS.map((c) => [c.artifact, c.inPlace]);

This file holds no sentence. It builds the table from the shared readiness criteria quoted in CR-03, so counsel reads the table there. It is listed because it names the add-on's constant (the unit test lists every file under `src` that does). The page's own sentences are in CR-24.

- [ ] Counsel approves as written
- [ ] Counsel requires this change: ______

#### CR-10. Network page, card and callout

Source: `src/pages/network/index.astro:76`. Renders on: /network/.

> L76: WE prepares evidence and offers curated introductions as a paid add-on. It offers no securities and promises no funding.
>
> L108: WE makes no promise of funding. Investor Introductions is a separate, paid add-on, and no part of the network is a route to funding.

- [ ] Counsel approves as written
- [ ] Counsel requires this change: ______

#### CR-11. Network page, body

Source: `src/content/pages/network/index.mdx:40`. Renders on: /network/.

> L40: There is no logo wall, no client list and no investor network.
>
> L40: Investor Introductions is a separate, paid add-on. It is not a membership of any network.

- [ ] Counsel approves as written
- [ ] Counsel requires this change: ______

#### CR-12. Pricing page, body and FAQ

Source: `src/content/pages/pricing/pricing.mdx:22`. Renders on: /pricing/.

> L22: This page lists no amounts. WE shares the current rate for a package, a custom seat plan or the add-on when you ask, so the figure you receive is the one that applies today.
>
> L47: Not on this page. WE shares the current rate for a package, a custom seat plan or the add-on when you ask for it.
>
> L64: Is Investor Introductions part of a package?
>
> L65: No. It is a separate, paid add-on with a flat fee. The fee does not depend on whether any investment closes.

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

Source: `src/content/pages/insights/topic-fundable.mdx:3`. Renders on: /insights/topic/fundable/ (meta description and body).

> L3: No promise of funding, no securities advice and no promised meetings.
>
> L14: Investor Introductions is a separate, paid add-on, not part of this desk. Introductions are a flat-fee service. WE is not a broker-dealer or investment adviser, takes no fee or stake tied to any investment, and cannot promise a meeting or funding.

- [ ] Counsel approves as written
- [ ] Counsel requires this change: ______

#### CR-16. Article: choosing the right first investors for a SaaS company (the first quote was rewritten to match the add-on, see "Resolved conflict" above)

Source: `src/content/insights/fundable/choosing-the-right-first-investors-for-a-saas-company.mdx:37`. Renders on: The article page (body, and the disclaimer box at its end).

> L37: It is about your judgment, whether or not you also use our paid Investor Introductions add-on, which is described below.
>
> L77: Investor Introductions is a separate, paid add-on, and nothing else in our program depends on it. Whether or not you use it, expect to do much of the approaching yourself, through your own network, your own outreach and public channels.
>
> L77: Whatever route you use, be accurate about your company, and be careful about what you say regarding an offering.
>
> L77: Ask your counsel what you may say, to whom, and how, before you start.

- [ ] Counsel approves as written
- [ ] Counsel requires this change: ______

#### CR-17. Founders page, what WE does not do

Source: `src/pages/founders/index.astro:44`. Renders on: /founders/.

> L44: It does not promise funding or investor meetings, or predict whether any company will raise money.

- [ ] Counsel approves as written
- [ ] Counsel requires this change: ______

#### CR-18. Grow stage, what WE does not do

Source: `src/components/program/stages.ts:164`. Renders on: /program/grow/ and every page that lists the stage limits.

> L164: WE does not promise a meeting with any investor and does not run a raise on your behalf.

- [ ] Counsel approves as written
- [ ] Counsel requires this change: ______

#### CR-19. Site description (the default meta and Open Graph description, and the Organization JSON-LD)

Source: `src/data/site.ts:16`. Renders on: Any page that uses the site description.

> L16: Long-horizon business incubation and consulting. WE steers a dedicated, fully remote team that builds a software-enabled company. WE promises no funding.

- [ ] Counsel approves as written
- [ ] Counsel requires this change: ______

#### CR-20. FAQ entry (also in the FAQPage JSON-LD of /faq/)

Source: `src/data/faq.yaml:57`. Renders on: /faq/.

> L57: Does WE introduce founders to investors?
>
> L58: Yes, as a separate paid add-on called Investor Introductions, for companies that have completed the readiness work in Service Line F. WE curates and limits the introductions, and charges a flat fee that does not depend on whether any investment closes. Introductions are a flat-fee service. WE is not a broker-dealer or investment adviser, takes no fee or stake tied to any investment, and cannot promise a meeting or funding.

- [ ] Counsel approves as written
- [ ] Counsel requires this change: ______

#### CR-21. Facts page, the question about the add-on (Release 2 scope: not in release-1-rc2; counsel reviews it with the next candidate)

Source: `src/content/pages/about/facts.mdx:40`. Renders on: /about/facts/, its Markdown twin /about/facts.md, and the same sentences in /llms.txt and /llms-full.txt (both read the answer from this file).

> L40: Is Investor Introductions part of the engagement?
>
> L42: No. Investor Introductions is a separate, paid add-on with a flat fee. The fee does not depend on whether any investment closes.
>
> L44: Introductions are a flat-fee service. WE is not a broker-dealer or investment adviser, takes no fee or stake tied to any investment, and cannot promise a meeting or funding.

- [ ] Counsel approves as written
- [ ] Counsel requires this change: ______

<!-- COUNSEL-CHECKLIST:END -->

Counsel sign-off:

- [ ] Every item above approved, or its change made in the source and the quote and line updated here by hand (the test names the line it found)
- [ ] `reports/counsel-review.md` for the release commit read in full
- [ ] Counsel name, date and release SHA recorded on issue #20

## 9. Terms, public benefit wording and price

All three stay off until the named person signs. Flags live in `src/data/flags.ts` and are flipped only by a change request.

- Terms of use (claim C-23): `flags.legalTerms` is `false`, so `/legal/terms/` is not launched. Counsel signs the terms text; then the flag is set and the route appears. The site works without it.
- Public benefit corporation wording (FLAG-PBC): `flags.pbcWording` is `false`. Set it only after the owner and counsel confirm the entity status; it lets the footer and About page say "Delaware public benefit corporation".
- Seat price (claim C-06, FLAG-PRICE): `flags.seatPrice.published` is `false` and `monthlyRate` must stay `null` while it is. No amount is published. Pricing is by request.
- Focus Shifts (FLAG-FOCUS): `flags.focusShiftConfirmed` is `false`. Leave it until operations confirm.

## 10. Verify live, and record a baseline

Before step 6, record: the head SHA of GitLab and GitHub `gh-pages` (`d7a65dd` today), the current Pages deployment (Settings, Pages, and the last `github-pages` deployment in Environments), and a few saved pages of the live site. This is the rollback target.

After step 9, check each on `https://worldenterprise.org`:

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
