# Forms go-live checklist

Status: prepared by WP-25 (issue #91) on 2026-10-16 for a decision by the CEO. It records the decisions; it makes none. Every form on the site stays disabled until the decisions below are taken and an engineer carries them out through a merge request.

Why the forms are off: a connected form collects personal data (names, email addresses, organization details, free-form messages). Doing that lawfully and honestly needs a chosen endpoint and processor, a privacy notice that states what happens to the data, consent wording, a retention period, spam protection and a tested error and success path. None of those is decided yet.

Source of truth for this list: the rendered `demo` build of 2026-10-16 (`data-mode="disabled"` on every form), `src/data/forms.ts` (`FORM_ROUTES`, `THANKS_PATHS`, the field rules), `docs/forms-contract.md` (version 2) and `docs/forms-contract.schema.json`.

## 1. Inventory: every form that would collect personal data

The wave 10 media-gap audit counted 26 `data-mode="disabled"` markers. They are 15 rendered forms: each of the 11 brief request forms is wrapped in a brief request panel that carries the same marker, so the 11 brief pages count twice (11 panels plus 15 forms is 26). A 16th form, the newsletter, is not rendered at all while it has no endpoint (its route `/newsletter/` is not emitted).

| # | Form (kind) | Route | Component | Thanks or confirmation |
|---|---|---|---|---|
| 1 | Apply, the readiness review (`apply`) | `/apply/` | `src/components/forms/ApplyForm.astro` (stepped) | `/apply/thanks/` |
| 2 | Contact (`contact`) | `/contact/` | `src/components/forms/ContactForm.astro` | In the page |
| 3 | Investor interest (`investor-interest`) | `/investors/interest/` | `src/components/forms/InvestorInterestForm.astro` | `/investors/interest/thanks/` |
| 4 | Partner enquiry (`partner-enquiry`) | `/network/partners/enquire/` | `src/components/forms/PartnerEnquiryForm.astro` | `/network/partners/enquire/thanks/` |
| 5 | Brief request: AI company diligence (`brief-request`) | `/briefs/ai-company-diligence/` | `src/components/forms/BriefRequestForm.astro` in `src/components/briefs/BriefRequestPanel.astro` | `/briefs/thanks/` |
| 6 | Brief request: Building an AI-native product | `/briefs/ai-native-build/` | same | `/briefs/thanks/` |
| 7 | Brief request: Company setup for founders | `/briefs/company-setup/` | same | `/briefs/thanks/` |
| 8 | Brief request: Spinning out a product | `/briefs/corporate-spinouts/` | same | `/briefs/thanks/` |
| 9 | Brief request: Early-stage diligence | `/briefs/early-stage-diligence/` | same | `/briefs/thanks/` |
| 10 | Brief request: Your first hundred customers | `/briefs/first-100-customers/` | same | `/briefs/thanks/` |
| 11 | Brief request: First hires for founders | `/briefs/first-hires/` | same | `/briefs/thanks/` |
| 12 | Brief request: Funding paths for founders | `/briefs/funding-paths/` | same | `/briefs/thanks/` |
| 13 | Brief request: Partnering with founders | `/briefs/partnering-with-founders/` | same | `/briefs/thanks/` |
| 14 | Brief request: A pre-seed evidence pack | `/briefs/pre-seed-evidence-pack/` | same | `/briefs/thanks/` |
| 15 | Brief request: The real timeline of a business | `/briefs/real-timeline/` | same | `/briefs/thanks/` |
| 16 | Newsletter (`newsletter`), not rendered today | `/newsletter/` (and a footer placement once enabled) | `src/components/forms/NewsletterForm.astro` | In place |

Not in scope, because they send nothing anywhere: the site search forms (`/search/`, the 404 page), the Team Composer (it hands a summary to Apply through the URL fragment and keeps nothing), the readiness check, runway, metrics, cap table and pricing-page tools (they compute in the browser, keep nothing and have no submit target), and the two styleguide demonstration forms.

## 2. What personal data each form would collect

Fields from `docs/forms-contract.md` section 3.2 (R required, O optional). Every form also sends `consent` (required, unticked by default), the honeypot `website` (must stay empty), `startedAt`, `submittedAt` and `page`; the five intake kinds also send `form`, `requestId` and `audience`.

| Form | Personal data | Business data |
|---|---|---|
| Apply | Name (R), email (R) | Company (O), stage (R), team roles in mind (O, sent in the legacy key `seats`), message (O), plus up to six optional readiness context answers folded into the message: situation, when the company started, years in the industry, how the company would pay for a team, expected build horizon, how the visitor heard about WE |
| Contact | Name (R), email (R), message (R, open text, may hold anything) | Company (O), audience (R, chosen), topic (R: general, request current terms, press, correction, information handling) |
| Investor interest | Name (R), email (R) | Firm (O), website (O), how they describe themselves (O: angel, fund, corporate, family office, other), sectors and stages (O), message (O). Never accreditation, amounts or fund size. |
| Partner enquiry | Name (R), email (R) | Organization (R), website (R), category (R), what it provides to founders and on what terms (R), message (O) |
| Brief request (each of 11) | Name (R), email (R) | Company (O), audience (R), stage (O), the brief id (fixed by the page). A second consent box for related emails exists in code behind `flags.briefUpdates`, which is off. |
| Newsletter | Email (R) | None |

Special categories: none is asked for. The open-text message fields (Apply, Contact, Investor interest, Partner enquiry) can receive anything a visitor types, so the notice and the retention decision should assume they may hold sensitive details.

## 3. Decisions needed

Each item lists the options neutrally. Constraints already recorded in the repository are noted where an option would conflict with them, so the decision can be taken knowingly.

### 3.1 Endpoint and processor

- **Option A: the intake service already built in this repository** (`infra/intake/`, an Azure Function writing to Dataverse and sending email through Azure Communication Services; `docs/intake-runbook.md`, `docs/forms-privacy-facts.md`). It ships inert; the operator inputs listed in the runbook are needed before it creates anything. Processor: Microsoft, on WE's behalf.
- **Option B: mail client fallback for Apply and Contact only** (`mailto` mode). No data reaches a server; the visitor's own mail client sends the message. Needs the `apply@` and `hello@` mailboxes to exist and be monitored. Brief request, investor interest, partner enquiry and newsletter have no mail fallback and would stay disabled.
- **Option C: a third-party form or CRM service.** Conflicts with decisions D-14 and W8-14 (no third-party scripts or services in the page) and with the CSP; it would need those decisions revisited first.
- **Option D: keep some or all forms disabled** and launch them in stages (for example Contact first).
- Sub-decisions: which forms go live together; who reads each kind of submission and where (mailbox, case system); the separate newsletter endpoint, or none.

### 3.2 Privacy notice text and route

- The notice lives at `/legal/privacy/` (`src/content/pages/legal/privacy.md`), linked from every form's consent line. It must name every field of every form that goes live, the processor, the storage location, retention and the visitor's rights and contact route.
- Options: adopt `docs/forms-privacy-facts.md` as the factual base if Option A is chosen; write a shorter notice for Option B; have counsel review either before launch (open item OP-COUNSEL).

### 3.3 Consent wording

- Today each form shows a required, unticked checkbox whose label is set per form (for example in `src/components/forms/copy.ts` and the form components). Decide the final wording per form and whether it is reviewed by counsel.
- Decide whether any form offers a second, optional consent for further email (the brief updates box behind `flags.briefUpdates`; the nurture sequence `NURTURE_ENABLED` in the intake service). Both are off; options are to keep them off, or to enable them after the notice states the use and retention.

### 3.4 Retention

- No retention period is stated anywhere in the repository (OP-RETAIN), and a unit test (`tests/unit/wp-10/`) forbids stating one until it is decided.
- Decide: how long submissions are kept per kind; how long suppression (unsubscribe) records are kept; how long a brief download link stays valid; who deletes data and how a visitor asks for deletion.

### 3.5 Spam protection

- Built today: a hidden honeypot field, a fill-time signal, per-address and per-email rate limits in the intake service, and a planned edge rate rule. No CAPTCHA and no third-party bot service (W8-14).
- Options: keep that set; add a stricter rate limit; add a challenge. A third-party challenge conflicts with W8-14 and the CSP; any challenge needs an accessible alternative (Section 508, WCAG 2.2).

### 3.6 CSP `connect-src` and `form-action`

- The policy is generated from the endpoint variables (`src/lib/csp.ts`, `buildCsp`): setting `PUBLIC_WE_INTAKE_API_URL` and `PUBLIC_WE_NEWSLETTER_API_URL` to absolute `https://` URLs adds their origins to `connect-src` and `form-action`; nothing else is opened. An `http://` value fails the build.
- Decide the production endpoint origin(s) and whether preview builds use a separate one. The endpoint's CORS allowlist must name exactly the site origin and, if used, the preview origin.
- Decide whether no-JavaScript visitors can submit (native form post, the default) or whether the endpoint requires JavaScript (`PUBLIC_WE_INTAKE_REQUIRES_JS=1`).

### 3.7 Accessibility of errors and success states

- Built today: an error summary linked to each field, inline field errors tied with `aria-describedby`, a polite live status region, focus moved to the summary on a failed submit, and thanks pages that render without JavaScript.
- Decide the wording of the failure, rate-limit and success messages, and require an assistive-technology pass (keyboard, screen reader, 200% zoom) on the endpoint build of each form before it goes live.

## 4. Files an engineer would change

Configuration (no code change for Option A):

- GitLab CI/CD variables for the build and `pages` jobs, and the GitHub repository variables read by `.github/workflows/pages.yml`: `PUBLIC_WE_INTAKE_API_URL`, `PUBLIC_WE_NEWSLETTER_API_URL`, optionally `PUBLIC_WE_INTAKE_REQUIRES_JS`.
- `src/data/site.ts`: `mailboxes.hello.confirmed` and `mailboxes.apply.confirmed` (Option B, or as a fallback beside Option A).
- `src/data/flags.ts`: `briefUpdates` (only if the second consent is approved).
- `infra/intake/` operator inputs and the manual `intake:*` jobs (`docs/intake-runbook.md`), including the CORS allowlist and, for the nurture sequence, `NURTURE_ENABLED`.

Copy and policy:

- `src/content/pages/legal/privacy.md` (the notice), with `docs/forms-privacy-facts.md` and `docs/forms-contract.md` section 7 kept in step, and the pins in `tests/unit/wp-10/` and `tests/unit/wp-61/privacy.test.ts` updated to the approved text.
- Consent labels: `src/components/forms/copy.ts` and the form components in `src/components/forms/`.
- Thanks pages if their promises change: `src/pages/apply/thanks.astro`, `src/pages/briefs/thanks.astro`, `src/pages/investors/interest/thanks.astro`, `src/pages/network/partners/enquire/thanks.astro` and their content entries under `src/content/pages/`.

Release gate:

- `.gitlab-ci.yml` `RELEASE_ALLOW`: its `^launched form route` pattern tolerates disabled forms on branch builds; the `verify:release` job on `gh-pages` runs with it empty, so a production build fails while any launched form is disabled. Remove the tolerance once every launched form is connected, or take the unconnected form routes out of launch in `src/data/routes.ts`.

Tests to run on the endpoint build: `tests/e2e/forms.spec.ts` (endpoint mode), `tests/e2e/modes.spec.ts` (default build), `tests/unit/wp-19/forms-plan.test.ts`, `tests/unit/wp-60/forms-schema.test.ts`, and the intake service suite (`intake:test`).

## 5. Decision record

| Decision | Options | Chosen | By | Date |
|---|---|---|---|---|
| Endpoint and processor | A, B, C, D (3.1) | Open | CEO | |
| Forms launched first | 3.1 | Open | CEO | |
| Privacy notice text, counsel review | 3.2 | Open | CEO, counsel | |
| Consent wording; second consent | 3.3 | Open | CEO, counsel | |
| Retention periods | 3.4 | Open | CEO | |
| Spam protection set | 3.5 | Open | CEO | |
| Endpoint origins; no-JavaScript submit | 3.6 | Open | CEO, engineering | |
| Error and success wording; AT sign-off | 3.7 | Open | CEO, accessibility lead | |
