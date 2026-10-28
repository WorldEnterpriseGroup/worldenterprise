# Wave 8 handoff: what ships, what is blocked, and the order to launch

For the owner and the operator. Written for issue #49 (WP-99 integrator gaps G3 to G7). The site code lives on branch `demo`. Nothing here publishes anything: `gh-pages` and `main` are not touched by any step before the owner says the site is ready.

## 1. Where things stand

- 330 routes are live on `demo` and 321 ledger rows are launched. The launched routes all exist as pages: the route check reports no missing page.
- Five routes are deliberately not launched, and each has a reason in the ledger: `/newsletter/` (no newsletter endpoint), `/legal/terms/` (counsel claim C-23, flag `legalTerms` off), and `/star/`, `/shift/`, `/android/` (cut by WP-48). The cut list for the release is therefore empty: no route needs to be flipped to `launch:false` to release. The two held navigation links (`/newsletter/`, `/legal/terms/`) are dropped from the menus automatically while their rows stay unlaunched.
- The release gate is red on a release tag, on purpose. It reports two kinds of open item and allows neither. Do not add an allowance to make it green.

## 2. What the release gate says

`npm run verify:release` (`scripts/lib/release-gate.mjs`) builds the production site and then judges two lists against `RELEASE_ALLOW`:

1. What the build itself asserts: a launched route with no page, draft content, a launched form route in disabled mode.
2. The open human items, read from `.astro-magazine/release/RELEASE.md` section 8 (`scripts/lib/wave8/release-open-items.mjs`). A checklist entry counts as signed only when its box "Decided as written under CEO delegation" (or, after an outside review, "Counsel approves as written") is ticked. Every unsigned `CR-` entry and every unticked box of the sign-off block becomes a line starting `human item open:`.

It then prints "Why this gate is red" in plain words, followed by operator notes for items that do not stop a build but are still waiting (unconfirmed mailboxes, no security contact, the endpoint variables, the flags that are off). It writes the same to `reports/release-gate.json`.

Measured on the current tree with no endpoint and the section 8 boxes untouched:

| Run | Result |
|---|---|
| Release tag or `gh-pages` (`RELEASE_ALLOW` empty) | Fails. 15 `launched form route` lines plus 47 `human item open:` lines (44 CR entries and the 3 sign-off items): 62 blocking lines. |
| `demo` and branches (`RELEASE_ALLOW` = `^launched form route,^human item open:`) | Passes, and still prints every one of the 62 lines and the explanation, so nothing is hidden. |

The fifteen form routes that are disabled without the intake endpoint, none of them allowed on a release: `/apply/`, `/contact/`, `/investors/interest/`, `/network/partners/enquire/`, and the eleven brief pages under `/briefs/<id>/` (including the real timeline brief). One variable, `PUBLIC_WE_INTAKE_API_URL`, clears all fifteen together once the intake service exists.

The release-tag and `gh-pages` rule in `.gitlab-ci.yml` sets `RELEASE_ALLOW: ""` and the job is `allow_failure: false`. The `mirror` job needs `verify:release`. `.github/workflows/pages.yml` runs the same gate with `RELEASE_ALLOW: ''`. Unit tests in `tests/unit/wp-99/release-gate.test.ts` and `tests/unit/wp-40/ci.test.ts` fail if an allowance for pending pages or for anything else comes back, and one of them pins the flags off and the mailboxes unconfirmed. When counsel signs and the mailboxes are confirmed, that test is the one to update, in the same change that flips the values.

No flag was flipped. `legalTerms`, `pbcWording`, `seatPrice.published`, `focusShiftConfirmed` and `briefUpdates` stay off. No sign-off box in RELEASE.md was ticked by anyone but counsel, and none is ticked now.

## 3. The seams check

`node scripts/lib/wave8/seams.mjs` (add `--json` for a report) checks that the content families lead into each other. Six checks, all clean on the current tree:

| Check | Result |
|---|---|
| Articles reach reference pages | 134 articles on 14 desks; 23 article bodies link to `/tools/`. |
| Playbook closing bands resolve | 10 playbooks, every closing band links to live routes. |
| Insights reach every desk | 14 desks listed, each a built topic page. |
| Home audience strip | 4 links, all built. |
| Segments reach reading paths | 8 segments, each with a reading list. |
| Briefs reach desks | 11 briefs, each tied to a desk. |

Known gap, stated plainly: no playbook end band names a brief (0 of 10), and no article body links to `/briefs/` (0 of 134). The playbook end band is the Apply link plus tools. Readers reach the briefs through the hub, the segment pages and the desk pages, not from a playbook. That is a content decision for a later wave, not a defect in the release, and the seams test pins the current count so a change is noticed.

## 4. Navigation and Lighthouse

- The navigation as it ships (7 sections, 90 distinct links, footer and utility links) is recorded as the `shipped` block of `tests/unit/foundation/fixtures/nav-snapshot.json`. `tests/unit/wp-99/nav-final.test.ts` fails when a route is added, cut or renamed without regenerating it. Regenerate with `node scripts/lib/wave8/nav-final.mjs --write` and review the diff.
- `lighthouserc.json` measures 55 routes instead of 15: one article for each of the 14 desks, the briefs hub and all eleven brief pages, one hub and one page for each of the founder, industry, comparison, journey and playbook families, the FAQ, investors, partners, and the Team Composer and Evidence Room tools. Budgets are unchanged: LCP 2500 ms, CLS 0.1, TBT 200 ms. `tests/unit/wp-99/lighthouse-routes.test.ts` fails when a candidate is not a live route or when a desk has no measured article. Expect `qa:lighthouse` to run longer (about 21 s per route).

## 5. Tests added for this work

- Unit, `tests/unit/wp-99/`: `seams.test.ts`, `release-gate.test.ts`, `nav-final.test.ts`, `lighthouse-routes.test.ts`.
- End to end, `tests/e2e/wave8/wp-99/`, at 1440x900 and 390x844, with no skips:
  - `release-honesty.spec.ts`: each of the fifteen form routes is in disabled mode, shows "This form is not connected yet" and has a disabled send button; `/newsletter/` is not built.
  - `nav-seams.spec.ts`: the desktop mega menu opens from the keyboard, closes on Escape and returns focus, and every panel link is a built page; the phone drawer opens from Menu and closes on Escape; the home audience strip, the insights desk list and a segment reading list link only to built pages; one page of each family loads clean and does not overflow.

## 6. Human blockers

None of these can be done by an agent. Each blocks the release or a part of it.

1. Release wording sign-off. Closed 2026-10-28 under CEO delegation, not by outside counsel: RELEASE.md section 8 has CR-01 to CR-44 and a 3-item sign-off block, all ticked "Decided as written under CEO delegation, 2026-10-28 (not reviewed by outside counsel)". If outside counsel later reviews an entry, its box becomes "Counsel approves as written" with the date, and the gate reads either wording. Terms of use (`flags.legalTerms`), public benefit wording (`flags.pbcWording`), the seat price and Focus Shifts ship only after the named person signs in section 9.
2. Mailboxes. Closed 2026-10-28: `hello@`, `apply@` and `security@` are aliases of the monitored shared mailbox `info@worldenterprise.org`, so `confirmed: true` and `securityContact` is `security@worldenterprise.org` in `src/data/site.ts` (RELEASE.md sections 6 and 7).
3. Forms backend (WP-61). No third-party form relay is allowed (CEO, 2026-10-28). The backend is the WE intake Azure Function (`infra/intake`, runbook `docs/intake-runbook.md`), which stores each submission in Dataverse and Dynamics 365 and notifies `info@worldenterprise.org` through an Azure Logic App and Azure Communication Services, all in WE's Microsoft tenant. `PUBLIC_WE_INTAKE_API_URL` and `PUBLIC_WE_NEWSLETTER_API_URL` are set in GitLab CI and GitHub, with the same https URLs, once it exists. Until then the briefs, investor interest and partner enquiry routes are disabled and the gate fails on a release. `/apply/` and `/contact/` fall back to their confirmed mailbox.
4. GitHub Pages source. It is still the legacy "Deploy from a branch" source. It must be switched to "GitHub Actions" (Settings, Pages), with the `github-pages` environment allowing the `gh-pages` branch. Record the current setting first so a rollback restores exactly it (RELEASE.md section 11).
5. The CEO says "ready". Only then does anyone push `gh-pages`, and only after that does the owner set `RELEASE_APPROVED` on the `mirror` job. Nothing in this handoff does either.

## 7. Launch steps, in order

A step that fails stops the release. Fix forward, never force, never move a tag.

1. Counsel finishes section 8 of RELEASE.md. Any wording change goes through a normal merge to `demo` and a new candidate tag.
2. Operator provisions the intake service (WP-61) and sets `PUBLIC_WE_INTAKE_API_URL` as a GitHub repository variable and as a protected GitLab CI variable, with the same https URL. Optionally set `PUBLIC_WE_INTAKE_REQUIRES_JS` and `PUBLIC_WE_NEWSLETTER_API_URL` as described in RELEASE.md section 5.
3. Operator confirms the mailboxes and the security contact (section 6 above). A change request updates `src/data/site.ts`, with its ownership exception, and updates the pinned test in `tests/unit/wp-99/release-gate.test.ts`.
4. Operator sets GitHub Pages source to "GitHub Actions" and allows `gh-pages` in the `github-pages` environment. Operator checks the GitLab protected-tag rule for `release-*` (Maintainers only).
5. Merge the sign-off to `demo`: the ticked section 8 boxes and any approved flag change. Wait for a green `demo` pipeline on that commit.
6. A maintainer cuts a candidate tag on that commit, for example `release-1-rc3`, as an annotated protected tag. Do not move or delete `release-1-rc1` or `release-1-rc2`.
7. Read the tag pipeline. Required green: `verify:static`, the audits, the e2e jobs, `qa:lighthouse` and `verify:release` with `RELEASE_ALLOW` empty. If `verify:release` still prints `launched form route` lines, the intake variable is not visible to the pipeline. If it prints `human item open:` lines, read which CR entry or sign-off item is open and send it back to counsel. The output says which.
8. Confirm `gh-pages` is an ancestor of the tagged commit: `git merge-base --is-ancestor origin/gh-pages <sha> && echo fast-forward`.
9. Record the rollback baseline (RELEASE.md section 10): the head SHA of GitLab and GitHub `gh-pages`, the current Pages deployment and the Pages source setting.
10. The CEO says ready.
11. The owner pushes the tagged commit to `gh-pages` as a plain fast-forward: `git push origin release-N:gh-pages`. Never `--force`, never `main`, never `CNAME`.
12. Watch the `gh-pages` pipeline. The same checks run again on the same commit.
13. Mirror to GitHub: the nightly CronJob at 03:23 UTC, or the documented "publish now" GitOps commit. Watch the GitHub Actions `pages` run, which rebuilds with the gate on.
14. The owner opens the release tag pipeline, runs the `mirror` job manually with `RELEASE_APPROVED` set to the full commit SHA (at least 12 hex characters), and re-runs it after the mirror has run until it passes.
15. Verify live, section 8 below, and record the result on issue #20.

A rehearsal of steps 6 and 7 with a candidate tag is safe after sign-off: creating a tag publishes nothing.

## 8. Live checks (RELEASE.md section 10)

After step 14, on `https://worldenterprise.org`:

- Home, `/apply/`, `/contact/`, `/how-we-work/`, `/investors/`, `/network/` and `/services/fundability-and-investor-readiness/` respond 200 and show the release wording from section 8.
- `/robots.txt`, `/sitemap-index.xml` and `/rss.xml` respond. `/.well-known/security.txt` responds only if the security contact was set.
- Submit one test application and one contact message through the live forms and confirm they arrive in the inbox the endpoint feeds. Do it with the browser console open and confirm there is no CSP violation.
- No preview markers (the build must not show `PUBLIC_PREVIEW`) and no `/styleguide/` route.
- The custom domain still resolves and `CNAME` is unchanged.

Rollback is in RELEASE.md section 11: re-run the last good `pages` workflow, or restore a known-good tree with a forward commit. `gh-pages` only moves forward.
