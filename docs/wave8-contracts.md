# Wave 8 contracts

Status: revision 2, written by the wave 8 planner (sage, 2026-10-10) after the CEO scope expansion of the same day. WP-60 commits this file as `docs/wave8-contracts.md` and registers it as frozen (`frozen_paths_wave8`). Consumers: every wave 8 package (WP-60 to WP-99). Companion documents: `docs/forms-contract.md` (v2, WP-60), `docs/wave7-contracts.md` (still binding where this file is silent) and `.astro-magazine/plans/wave8.md` (the plan; section numbers below are this file's).

Authority: CEO direction of 2026-10-10 (decisions D-20 to D-24 and W8-1 to W8-29 in the plan). Where this file and a package issue disagree, this file wins, and the package opens a question through its handoff instead of deviating.

Contents: 0 Truth and copy rules | 1 Audiences, routes, ledger and navigation | 2 Desks and articles | 3 Forms contract v2 | 4 Intake architecture | 5 Gated briefs | 6 CTA contract | 7 Portfolio entry schema | 8 Page families and reference data | 9 Sources, claims, handoffs and tests | 10 Release gate and `RELEASE_ALLOW` | 11 Customer journey | 12 Legacy tests | 13 Rules for every package and the push protocol

## 0. Truth and copy rules (binding on every new sentence)

1. No amounts, seat counts, response-time promises, application counts, acceptance rates, invented portfolio entries, logos, testimonials, statistics about WE, or named people or companies without written consent on record (D-12 as amended by D-21).
2. The hybrid seats-plus-packages pricing stays unpublished. Investor Introductions is a flat-fee add-on with no success fees: the verbatim disclaimer (`INTRODUCTIONS_DISCLAIMER`) and "WE makes no promise of funding." stay wherever the add-on or investors are discussed.
3. The words "no fee", "no fees", "no equity", "free of charge", "no stake" and "equity-free" never describe the commercial model (rules from claims-denylist v3). In copy about WE (its terms, program, briefs, tools, partner offers, cloud credits, anything WE gives or sells) the bare word "free" is never used. In general subject matter an article, glossary entry or comparison may name a pricing model or market practice ("free trial", "free tier", "freemium") as a description of how companies price, never on a page whose subject is WE's terms; the phrases the denylist blocks everywhere ("free of charge", "completely free", "totally free", "at no cost", "costs nothing to apply") are never used. Phrase "founder-first terms" positively ("terms are written down before any introduction") and never as an absence ("no pay-to-play").
4. Never write the literal string "success fee" (rule `C-08-success-fee` is unconditional). Never write "investor network", "network of investors", "our investors" (rule `C-14-investor-network`). Investors "ask to meet the companies WE incubates"; WE does not "have" a network of them.
5. No "perks" in any label, heading or nav entry. The existing nav label "Partners and perks" is replaced by "Partners".
6. Every new sentence is traceable: page copy through a sentence ledger in `.astro-magazine/sources/wp-NN.json` (each sentence maps to a claim id, an existing page and line, or a decision), articles, briefs, glossary entries and every explainer through a claim ledger (section 9). A unit test fails on an unmapped sentence or on a source URL with no fetch record.
7. No analytics, cookies, third-party scripts or tracking attributes (D-14). `data-cta` and `data-form` attributes exist for tests only and carry no identifiers.
8. Light theme only; dark bands never carry the logo (D-8). All images AVIF, nothing in the photography lane is edited.
9. US spelling, "WE" in capitals for the company, sentence-case headings, no exclamation marks.
10. No durations about WE's process, and never the literal "30/60/90" (the program pages promise none, C-16, DP-W8-16). The journey pages describe a sequence. Where the program pages are silent, a page lists questions a founder can ask; it does not describe what WE does.
11. Sector, industry, segment and comparison pages are "considerations", never an outcome claim, never a claimed client, never a statement of eligibility beyond `/program/who-its-for/`. Comparison pages compare categories, never products or companies, and never describe WE's fee or equity model in either direction.
12. The company is "a digital incubator for SaaS": dedicated offshore team seats steered by WE, fully remote, no promise of funding. Nothing says WE builds marketplaces, hardware or services for a client, and nothing says WE selects, funds or places companies in groups.

### 0.1 Denylist traps for WE-facing copy, verified against `claims-denylist.json` v3

New copy runs through `scripts/audit-claims.mjs` on the built output (html, xml, txt and md, including `llms-full.txt` and the `.md` twins). These rules bite wave 8 content and are the reason several instructions below exist:

| Rule | What it blocks | Consequence for wave 8 |
|---|---|---|
| `C-13-peers` (context rule, `markerAllowed`) | cohort, cohorts, mentor, mentors, alumni, peer session, accelerator, accelerators, anywhere except `/faq/`, `/research/early-stage-saas-metrics-definitions/` and the two llms files | Do not use these words in page copy, article text or labels. The partner category is "Ecosystem and community programs". A generic third-party or analytics use inside an article (for example "cohort analysis" in the retention article) is wrapped in `<span data-claim-allow="C-13-peers">`, listed in the package sources file with its reason, and counted by WP-99. WP-60 adds the first-person rule `W8-C13-own-peers` (no marker allowed) so that "our cohort", "WE mentors" and the like can never pass even inside a marker. The one page whose subject is the word, `/compare/incubator-vs-other-programs/`, gets one narrow `allowPaths` entry, which covers its Markdown twin because the audit maps a twin to its page route (DP-W8-15); every list that links to it uses a label without the word (section 8.1); no other path is allowed. |
| `C-08-valuation-cap`, `C-08-discount-rate`, `C-08-pro-rata`, `C-08-mfn` | SAFE mechanics, unless the text sits inside an element carrying `data-generic-definition`, as `src/content/guides/safe-explained.mdx` does | Funding, legal, model, glossary, comparison and cap-table copy that must name these terms uses `.mdx` (or the list component) and puts each definition in a `<p data-generic-definition>`, defining the term generically from the cited primary source and never describing WE. The abbreviation "MFN" is blocked as well; write "most favored nation". |
| `C-08-tranche` | the word "tranche", no exception | Never used, not even in a glossary. |
| `C-18-pbc` | public benefit, benefit corporation, PBC | The entity-choice article covers LLC and C corporation and says other forms exist. It does not discuss benefit corporations. |
| `C-05-fundable-outcome` | "to become fundable", "fundable company" | Fundable-desk copy says "preparing evidence for investors" and never states fundability as an outcome WE delivers. "Fundability" and a question form pass. |
| `C-13-funding-raised` | "portfolio companies", "funding raised", "raised $" | The portfolio component, the investors pages and the sector pages never use "portfolio companies". |
| `C-13-testimonial`, `C-13-trusted-by`, `C-13-as-seen-in` | testimonial wording, trusted by, as seen in | No social proof of any kind. |
| `C-14-investor-network`, `C-14-guaranteed-meetings`, `C-14-success-based` (`markerAllowed`), `C-08-success-fee`, `C-08-no-success-fee` | an investor network, promised meetings or introductions, finder's fees, commissions, contingent or success-based pay, the literal "success fee" | Investor copy: "ask to meet the companies WE incubates", "WE cannot promise a meeting or funding". A negation passes the meetings rule, but the literal "success fee" never appears, not even in a negation, so the disclaimer wording "takes no fee or stake tied to any investment" is the only form used. |
| `W7-C09-no-fee`, `W7-C09-no-equity`, `W7-C09-free-of-charge` (all `markerAllowed`) | no fee, fee-free, no equity, non-dilutive, no stake, free of charge, at no cost, completely free, costs nothing to apply | Never about the commercial model. Articles may say a grant is "non-dilutive" only inside a quoted source definition marked `data-claim-allow="W7-C09-no-equity"` with the source named; otherwise write "does not require giving up shares" about the grant, never about WE. |
| `W7-response-time`, `W7-application-counts`, `W7-package-seat-count` (all `markerAllowed`) | reply within N days, acceptance rates, application counts, seat counts per package | No timing promises on any form page or thanks page. |
| `C-16-time-to-mvp` | "MVP in N weeks", 10x, guaranteed growth | No outcome or time promises in articles or briefs. |
| `Q-spelling`, `Q-we-case` | British spellings (programme, organisation, colour, behaviour, licence, judgement, catalogue), "We coordinate/steer/build" | US spelling: "program", "organization", "license", "judgment". "WE" always in capitals. A program whose official name is British-spelled is named by its acronym or described. |
| Required rules `R-C05-no-funding-disclaimer`, `R-C14-intro-disclaimer`, `R-C14-flat-fee-statement`, `R-C14-intro-disclaimer-wherever-named`, `R-W7-C05-no-funding-disclaimer` | Required text on listed routes: "WE makes no promise of funding." on `/`, `/fundability/`, `/investors/`, `/program/grow/`, `/services/fundability-and-investor-readiness/`, `/pricing/` (and `/program/how-we-decide/` and both llms files); the verbatim `INTRODUCTIONS_DISCLAIMER` on `/investors/`, `/network/`, the fundability service page, `/pricing/`, `/faq/`, and on any page whose `<main>` names the add-on ("investor introductions", "introductions to or with investors", "introduce ... to investors"); "The fee does not depend on whether any investment closes." on `/investors/`, the fundability service page and `/pricing/` | WP-64's rebuilt `/investors/` keeps all three sentences. WP-65's rewrite of `/network/` keeps the verbatim disclaimer. WP-62's home and program copy keep "WE makes no promise of funding." on `/` and `/program/grow/`. Every new page whose main content names the add-on (the interest page, the meet-startups page, the investor FAQ, any article, brief or FAQ answer that says "investor introductions") carries the disclaimer; writers avoid the phrase unless the page needs it. |

### 0.2 Denylist traps in generic text (articles, briefs, glossary, sector and comparison pages)

The rules do not know whether a sentence is about WE or about the world. Text that is correct and general still trips them. Each row gives the pattern and the remedy; "marker" means the rule is `markerAllowed` and a `data-claim-allow` wrapper with a sources-file entry is the last resort, never for a sentence about WE.

| Rule | Generic sentences that trip it | Remedy |
|---|---|---|
| `C-15-soc2-certified`, `C-15-iso-certified`, `C-15-hipaa-compliant` (no marker) | "SOC 2 Type II", "SOC 2 compliant", "ISO 27001 certified", "HIPAA compliant" or "HIPAA-certified", even when describing someone else | Write "a SOC 2 report", "an ISO/IEC 27001 certificate", "HIPAA requirements", "covered by HIPAA". Describe frameworks as frameworks and never as something WE holds. |
| `C-11-years` (no marker) | "20 years", "twenty years", "two decades", "20+ years" (a patent term, a statute of limitations, a license history) | Write "a 20-year term" (hyphenated) or restate the rule without the phrase. |
| `C-06-currency-per-seat`, `C-06-seat-rate-figure` (no marker) | "$10/month", "$20 per month", "$5 a month", "seats at $15" in a pricing-model example | Use words ("a monthly price", "a per-seat price") or omit the figure. |
| `C-24-security-controls` (no marker) | "encrypted at rest and in transit", "we use MFA", "least-privilege access is enforced" | Write "encrypted when stored and when sent"; never claim a control for WE. |
| `W7-response-time` (marker) | "you will hear back within 30 days", "you will respond within one month", "within two days you will receive a decision" (an 83(b) deadline, a data-subject request) | Write "no later than 30 days after the transfer", "the deadline is", "the regulation allows one month". |
| `W7-application-counts` (marker) | "acceptance rate", "admission rate", "N% of applicants", "received N applications" (a grant program or another incubator) | Describe how a program selects, never a rate or a count. |
| `C-14-success-based` (marker) | "carried interest", "finder's fee", "contingent fee", "commission on", "percentage of the money raised" (an article on how funds or placement agents work) | Wrap the generic explanation in the marker, name the primary source in the sources file, never write it about WE. |
| `C-12-premier`, `C-12-industry-leaders`, `C-12-revolutionary`, `C-12-market-dominance`, `C-12-scientific-approach` (no marker) | superlatives and boilerplate | Plain, specific language. |
| `C-10-package-tiers` (no marker) | "package tier", "nine-milestone" | Write "tiered plans" or "packages". |
| `C-14-demo-day-outcomes`, `C-14-guaranteed-funding` (no marker) | demo day results, guaranteed funding or a raise | Never. |

Marker discipline: `data-claim-allow` and `data-generic-definition` are escape hatches. A package may use them only for generic third-party or analytics wording, records every use (file, rule, reason, source) in the `markers` list of its sources file (section 9), and WP-99 counts them over `dist` and reports the total in the wave handoff. No marker ever sits on a sentence about WE.

## 1. Audiences, routes, ledger and navigation

### 1.1 Audiences

Audience ids: `startup`, `investor`, `partner`, `corporate` (constant `AUDIENCES` and type `Audience`, defined in the frozen `src/data/families.ts` and imported by `src/data/forms.ts` and `src/data/cta/index.ts`, so no package that owns a consumer owns the definition). `corporate` is a company that wants to build a new software product or spin one out. Pages do not restrict access by audience; the ids drive the audience lens in the navigation, the brief registry, the form rules, the CTA map and the journey maps (section 11).

### 1.2 Routes

Rows WP-60 pre-registers as `launch: true` (pending until their page exists, a warning on branches, an error at `verify:release`). Layouts reuse existing ones: no new layout is created. `Owner` is the package that owns the route file or, for content families, the content. A path ending `/` is a page.

**Articles and desks**

| Path | Layout | Indexable | Owner | Notes |
|---|---|---|---|---|
| `/insights/topic/<desk>/` for `funding`, `legal`, `team`, `ai`, `gtm`, `ops`, `starting`, `pathways`, `models`, `sectors` | ArticleHub | yes | desk owner (section 2) | Ten new desks from `src/data/desks.ts`; a desk route is pending until the desk holds one article, so a cut desk leaves no dead route |
| `/insights/<slug>/` | ArticleLayout | yes | desk owner | Derived from the files in `src/content/insights/**`, never hand-listed |

**Briefs** (owner WP-63 for the system, hub and thanks; brief files by registry owner, section 5)

| Path | Layout | Indexable | Notes |
|---|---|---|---|
| `/briefs/` | HubLayout | yes | Hub grouped by audience; the open research briefs are linked from it |
| `/briefs/<id>/` for the ten ids of section 5 | MarketingLayout | yes | Squeeze page; abstract open; counts as a form page for D-24 |
| `/briefs/thanks/` | FormLayout | no | `noindex`, generic text, no brief title read from the query string |

**Investors** (owner WP-64)

| Path | Layout | Indexable | Journey stage |
|---|---|---|---|
| `/investors/` | MarketingLayout | yes | awareness; exists, rebuilt |
| `/investors/meet-startups/` | MarketingLayout | yes | consideration |
| `/investors/what-you-can-see/` | MarketingLayout | yes | consideration |
| `/investors/readiness-criteria/` | MarketingLayout | yes | consideration |
| `/investors/showcase-format/` | MarketingLayout | yes | consideration |
| `/investors/faq/` | MarketingLayout | yes | consideration |
| `/investors/interest/` | FormLayout | yes | conversion (`investor-interest` form) |
| `/investors/interest/thanks/` | FormLayout | no | onboarding |

**Partners** (owner WP-65)

| Path | Layout | Indexable | Journey stage |
|---|---|---|---|
| `/network/partners/` | MarketingLayout | yes | awareness; the row exists as L2 with `requires: ['companies']`, D-21 removes the requirement |
| `/network/partners/categories/` | MarketingLayout | yes | consideration |
| `/network/partners/how-it-works/` | MarketingLayout | yes | consideration |
| `/network/partners/faq/` | MarketingLayout | yes | consideration |
| `/network/partners/enquire/` | FormLayout | yes | conversion (`partner-enquiry` form) |
| `/network/partners/enquire/thanks/` | FormLayout | no | onboarding |

**Page families** (route files WP-71; content owners in section 8.1)

| Path | Layout | Indexable | Content owner |
|---|---|---|---|
| `/founders/` | MarketingLayout | yes | WP-62 (hub, exists, rebuilt) |
| `/founders/<segment>/` for the eight segment slugs | MarketingLayout | yes | WP-73 |
| `/industries/`, `/industries/<vertical>/` for the seven vertical slugs | HubLayout, MarketingLayout | yes | WP-74 |
| `/compare/`, `/compare/<pair>/` for the seven pair slugs | HubLayout, MarketingLayout | yes | WP-75 |
| `/journey/`, `/journey/after-you-apply/`, `/journey/first-months/`, `/journey/onboarding-checklist/` | HubLayout, MarketingLayout | yes | WP-72 |
| `/resources/` | HubLayout | yes | WP-72 (exists, rebuilt) |
| `/about/brand-story/` | MarketingLayout | yes | WP-71 |
| `/press/brand-kit/` | MarketingLayout | no (`launch: false`, reason: needs the brand-owner usage sign-off, OP-BRAND) | WP-71 |

**Tools** (owner WP-76): `/tools/` (exists, hub) and `/tools/runway-calculator/`, `/tools/pricing-page-checker/`, `/tools/cap-table-explainer/`, in the layout of the existing `/tools/team-composer/` page (WP-49). The tool registry WP-49 created is extended additively.

Unchanged and still L2: `/network/delivery-partners/` (`requires: ['companies']`), `/founders/portfolio/`, `/founders/stories/`, `/case-studies/`. The partners page names delivery partners as a category only. The slug `portfolio` and `stories` are reserved and cannot be a segment slug.

### 1.3 Ledger rules (WP-60, replaces the exact-count tests)

- `INSIGHT_SLUGS`, the desk rows, the family rows, `DESK_LABELS`, the related-title maps and the topic enum are all derived from two registry modules, `src/data/desks.ts` and `src/data/families.ts`, and from the files in the collections through `src/lib/content-files.ts` (a plain `node:fs` directory read in the style of `src/lib/page-files.ts`, so `routes.ts` still imports under plain Node for `scripts/lib/export-ledger.mjs`).
- Invariants replace counts: every row path is unique, ends with `/` (or is a machine route), has a known layout and owner; every insight file has exactly one row; every row's desk exists; every `launch: true` row has a page, or is `generated`, or is inert-pending (and listed); indexable rows equal rows minus the declared noindex set.
- `RouteOwner` gains `WP-60` to `WP-99`. Article rows take the owner from `desks.ts`. The 18 articles that exist today keep their files byte for byte (`tests/unit/wp-60/existing-articles.test.ts` pins their sha256) and take the desk owner in the ledger.
- A family row derives from the registry and is pending until its `pages` entry exists; the row's `launch` flag is the registry's `launch` flag, which WP-99 may flip to cut a page (section 8.1).

### 1.4 Navigation information architecture (WP-60 builds it, WP-99 finishes it)

`src/data/nav.ts` stays the only source. Rules: no existing item is removed or reordered; every addition is hidden until its route is live (route-state); the label "Partners and perks" becomes "Partners" and points at `/network/partners/`; `aria-current="page"` on the active link; the keyboard tests (`e2e:menu`) stay green.

| Addition | Where | Entries |
|---|---|---|
| Audience lens | A new `audiences` panel after Network, label "For you" (WP-60 may choose another placement and records the reason) | For startups: Apply, Founder segments (`/founders/`), What happens after you apply, Briefs, Tools. For investors: For investors (`/investors/`), Meet the startups, What you can see, Express interest. For partners: Partner with WE (`/network/partners/`), Categories, How it works, Enquire. For corporate teams: Corporate innovators (`/founders/corporate-innovators/`), the `corporate-spinouts` brief, Contact. |
| Topics column | Resources panel | One link per desk with at least one article, from `desks.ts` |
| Briefs, Industries, Compare | Resources panel | `/briefs/`, `/industries/`, `/compare/` |
| Journey | Program panel | `/journey/` and `/journey/after-you-apply/` next to "How it works" |
| Partners | Network panel | `/network/partners/` (replaces the L2 "Partners and perks") |

The command palette (WP-91) and the footer carry the same new routes. A page that is `launch: false` or has no page file appears in none of them.

## 2. Desks and articles

`src/data/desks.ts` (WP-60) is the only place a desk is defined:

```ts
export type DeskId =
  | 'dream' | 'build' | 'grow' | 'fundable'
  | 'funding' | 'legal' | 'team' | 'ai' | 'gtm'
  | 'ops' | 'starting' | 'pathways' | 'models' | 'sectors';

export interface DeskDefinition {
  readonly id: DeskId;
  readonly name: string;      // 'Funding and capital'
  readonly blurb: string;     // one sentence, no promise of outcomes
  readonly owner: 'WP-66' | 'WP-67' | 'WP-68' | 'WP-69' | 'WP-81' | 'WP-82' | 'WP-83' | 'WP-84' | 'WP-85' | 'WP-88' | 'WP-89';
  readonly order: number;
}
```

| id | Name | Scope sentence (must hold in `blurb`) | Writer |
|---|---|---|---|
| `starting` | Starting out | Where you begin depends on who you are: first-time, technical, non-technical, solo, student, second-career, corporate and global founders. | WP-83 |
| `dream` | Dream | Decide what to build, and whether to build it, before any code exists. | WP-82 |
| `build` | Build | Scope, staff and ship a first release without over-building. | WP-82 |
| `grow` | Grow | Win the first customers and keep them. | WP-85 |
| `fundable` | Fundable | Prepare evidence that survives diligence. No promise of funding. | WP-67 |
| `funding` | Funding and capital | Understand the money you can raise or borrow, before you ask for it. | WP-66 |
| `legal` | Legal and company basics | The company, equity, IP and privacy basics to ask your counsel about. Not legal advice. | WP-67 |
| `team` | Team and hiring | Hire, onboard and run a small team, in-house or remote. | WP-68 |
| `ai` | AI-native building | Build and operate a product that depends on a model, with the risks stated. | WP-69 |
| `gtm` | Go-to-market | Position, price and reach your first customers. | WP-81 |
| `pathways` | Pathways | The routes into a company and the routes to capital, side by side. | WP-84 |
| `models` | Business models | How B2B SaaS, vertical SaaS, marketplaces, platforms and developer products work, and what each asks of a first company. | WP-85 |
| `sectors` | Sectors | Considerations for building software in fintech, healthtech, edtech and climate tech. General information, not a claim of experience. | WP-88 |
| `ops` | Operations and wellbeing | Run the company and look after the founder, in general terms and without advice. | WP-89 |

`fundable` means preparing evidence for investors; `funding` means understanding the instruments. `grow` means onboarding, retention and feedback; `gtm` means positioning, pricing, channels and sales. The desk pages are `src/content/pages/insights/topic-<id>.mdx`, written by the desk's own package; the four that exist today are edited only to keep the introduction accurate.

Article file rules (all enforced by `tests/unit/wp-60/article-rubric.test.ts` over every file in `src/content/insights/**`):
- Path `src/content/insights/<desk>/<slug>.md(x)`; the desk folder equals frontmatter `topic`; the slug is unique across all desks.
- Body 1,200 to 1,800 words (`countWords` from `src/components/insights/articles.ts`).
- Frontmatter as the existing schema: `title`, optional `seoTitle`, `description` (50 to 160), `topic`, `publishedDate`, `sources` (at least 2 real sources, or `noStatistics: true`), `evidence`, `relatedServices`, `relatedPlaybook` and `relatedTemplate` when a live route exists, `claimsUsed`, `draft: false`. Three optional fields are new:
  - `segments`: slugs from the `segments` family of section 8.1 (usually one to three). The segment pages list matching articles from the collection, so no page is hand-edited.
  - `related`: slugs of other articles. A slug that is not live is dropped at build (the `pickRelated` precedent), so a package can name an article another package has not merged yet.
  - `cta`: optional override of the CTA resolution (section 6), `{ variant, briefId? }`. It is not the `ctas` hero buttons of the `pages` collection, which are unchanged.
- Required H2 "What this article cannot tell you" (state the limits: jurisdiction, date, size of company, what the sources do not cover).
- At least three internal links to live routes (an article in the same desk, a playbook, template, guide, tool, the glossary or a brief squeeze page).
- No `cover` (photography lane). No statistics about WE. No outcome or time promises (`C-16-time-to-mvp`). No legal, tax or investment advice: legal and funding articles say what a document or instrument is and what to ask counsel; they never say what the reader should do.
- A statistic needs a source in the page; a regulatory or legal statement needs a primary source (a statute, agency or standards-body page). Sections 0.1 and 0.2 list the sentences that trip the claims audit.

## 3. Forms contract v2 (extends `docs/forms-contract.md`, which WP-60 rewrites as v2)

One endpoint, as today: `PUBLIC_WE_INTAKE_API_URL`. The `form` field discriminates. The CSP derives from that variable (`src/lib/csp.ts`), so no CSP change is needed. The newsletter keeps its own variable and contract.

### 3.1 Request

`POST {endpoint}`, `Content-Type: application/json`, `credentials: "omit"`, `referrerPolicy: "no-referrer"`, 15 s timeout. Unchanged from v1.

```json
{
  "form": "brief-request",
  "requestId": "6f1c2d3e-8a4b-4c5d-9e0f-1a2b3c4d5e6f",
  "audience": "startup",
  "name": "Ada Example",
  "email": "ada@example.org",
  "company": "",
  "stage": "",
  "seats": "",
  "topic": "",
  "message": "",
  "briefId": "funding-paths",
  "companyUrl": "",
  "partnerCategory": "",
  "investorKind": "",
  "focus": "",
  "offer": "",
  "consent": true,
  "consentUpdates": false,
  "website": "",
  "startedAt": "2026-10-12T14:00:00.000Z",
  "submittedAt": "2026-10-12T14:00:41.000Z",
  "page": "/briefs/funding-paths/"
}
```

All v1 fields keep their v1 meaning and limits. New or changed:

| Field | Type | Rule |
|---|---|---|
| `form` | `"apply"`, `"contact"`, `"newsletter"`, `"brief-request"`, `"investor-interest"` or `"partner-enquiry"` | Required. |
| `requestId` | UUID v4 string | Required for every kind except `newsletter`. Generated in the browser with `crypto.randomUUID()` when the page loads, regenerated after a success. It is the idempotency key (`we_requestid`). A no-JavaScript native post carries a build-time-empty field and the server generates the id. |
| `audience` | `"startup"`, `"investor"`, `"partner"`, `"corporate"` or `""` | Required and fixed by kind: `apply` requires `startup`; `brief-request` requires a value from the audience list of that brief's registry entry (section 5; the page presets it, and shows a select only for a brief with more than one audience); `investor-interest` requires `investor`; `partner-enquiry` requires `partner`; `contact` takes any of the four (a select with four entries); `newsletter` is empty. The server rejects a mismatch with a 422 field error on `audience`. |
| `briefId` | slug | Required on `brief-request`, empty elsewhere. Must be in the registry the server loads from the rendered briefs (the ten ids in section 5). |
| `companyUrl` | https URL, at most 300 characters | Required on `partner-enquiry`, optional on `investor-interest`, empty elsewhere. This is the real organization website. The honeypot stays `website` (v1); the two names never collide. |
| `partnerCategory` | `"tooling-saas"`, `"cloud-credits"`, `"legal"`, `"finance-accounting"`, `"delivery"`, `"ecosystem"` or `"other"` | Required on `partner-enquiry`. |
| `offer` | string, at most 1500 | Required on `partner-enquiry`: what the organization provides to founders and on what terms. |
| `investorKind` | `"angel"`, `"fund"`, `"corporate"`, `"family-office"`, `"other"` or `""` | Optional on `investor-interest`. It records how the investor describes themselves. WE never asks for accreditation status, amounts, fund size or return targets. |
| `focus` | string, at most 1000 | Optional on `investor-interest`: the sectors and stages the investor wants to see. |
| `company` | string, at most 120 | Required on `partner-enquiry`; optional on `investor-interest` (the firm), `brief-request`, `apply`, `contact`. |
| `stage` | v1 values or `""` | Optional on `brief-request`. |
| `consent` | boolean | Must be `true`. Scope: WE may use these details to answer this request, as the privacy notice describes (`/legal/privacy/`). |
| `consentUpdates` | boolean | Default `false`. Rendered only when `flags.briefUpdates` is `true` (flag added by WP-60, OFF). Scope: WE may email related briefs and articles. Only `brief-request` carries it. |

Required matrix (R = required, O = optional, - = must be empty):

| Field | apply | contact | brief-request | investor-interest | partner-enquiry |
|---|---|---|---|---|---|
| name, email | R | R | R | R | R |
| company | O | O | O | O | R |
| stage | R | - | O | - | - |
| seats, topic | seats O / topic - | seats - / topic R | - | - | - |
| message | O | R | - | O | O |
| briefId | - | - | R | - | - |
| companyUrl | - | - | - | O | R |
| partnerCategory, offer | - | - | - | - | R |
| investorKind, focus | - | - | - | O | - |
| audience | R (`startup`) | R | R (per brief) | R (`investor`) | R (`partner`) |
| consent | R | R | R | R | R |
| requestId | R | R | R | R | R |

Client validation mirrors this table in `src/data/forms.ts` (`validate(kind, values)`). The same table is committed as `docs/forms-contract.schema.json` (WP-60) and kept in sync by `tests/unit/wp-60/forms-schema.test.ts` (it fails on drift; `UPDATE_SCHEMA=1` regenerates the file). WP-61's server tests read that JSON, so the browser and the Function cannot drift apart.

### 3.2 Response

Unchanged from v1 (`200/201/202/204` success, `400/422` JSON field errors, `429`, anything else generic failure). Additions: `429` carries `Retry-After`; a repeated `requestId` returns the original outcome with `200` and causes no second email.

On success: `apply` goes to `/apply/thanks/`; `brief-request` to `/briefs/thanks/`; `investor-interest` to `/investors/interest/thanks/`; `partner-enquiry` to `/network/partners/enquire/thanks/`; `contact` keeps its in-page confirmation. A thanks page promises no response time and no outcome.

### 3.3 Server obligations added to v1 section 5

1. **Single-origin CORS and Origin check** as v1. Allowlist: `https://worldenterprise.org` and the preview origin.
2. **Rate limits**: 5 per hour per client address and 5 per hour per email address, per kind (blob lease counters as in the globalenterprise intake). `429` with `Retry-After`.
3. **Honeypot**: non-empty `website` returns `200` and discards.
4. **Content types**: JSON, plus `application/x-www-form-urlencoded` with a `303 See Other` to the kind's thanks page. The hidden `redirect` field is honored only when it equals one of the four thanks paths on the server allowlist.
5. **Idempotency** on `requestId`.
6. **Durable write first**: validate, write the engagement row to Dataverse, then respond `202`. Side effects (the brief email, the optional webhook) run after the write, with retries; a failed email sets `we_status` to `delivery-failed` and raises an alert. The site never claims a delivery time.
7. **No cookies, no body logging, no PII in URLs.** Log request id, kind, status and a hashed client address only.
8. **Not ported from the globalenterprise intake**: the corporate-email gate, Plausible and `data-track` attributes, Turnstile.

### 3.4 No-JavaScript behavior

Every form is a real `<form method="post">`. `planForm` in `src/data/forms.ts` gains the three kinds with the v1 table unchanged (`endpoint`, `mailto`, `disabled` modes). `mailto` mode applies to `contact` and `apply` only: a brief request, an investor interest and a partner enquiry have no mailbox fallback, so with no endpoint they are `disabled`, and the page says so plainly. `FORM_ROUTES` lists `/briefs/<each of the ten ids>/`, `/investors/interest/` and `/network/partners/enquire/`, registered once by WP-60 so no content package edits the frozen file; `verify:release` fails on a release tag while any of them is `disabled` (the `RELEASE_ALLOW` rule, section 10). The form-route tests ignore a `FORM_ROUTES` entry whose ledger row is `launch: false`, so a cut brief needs no edit to that list.

### 3.5 Components (all written by WP-60; packages only place them)

`src/components/forms/BriefRequestForm.astro` (prop `briefId`), `InvestorInterestForm.astro`, `PartnerEnquiryForm.astro`. Each is a thin wrapper over the existing `FormFrame`, `Field`, `Choice`, `Fieldset`, `ErrorSummary`, `FormStatus` and `HoneypotField`, with the consent text and the required disclaimers fixed inside the component so a page cannot drop them:
- `BriefRequestForm`: consent line, optional updates checkbox (flag), and the sentence "WE sends the brief by email to the address you give." No promise of delivery time.
- `InvestorInterestForm`: the sentence "WE makes no promise of funding." and the verbatim `INTRODUCTIONS_DISCLAIMER` when the add-on is mentioned on the page; consent line.
- `PartnerEnquiryForm`: the sentence "Sending an enquiry does not create a partnership. WE decides whether to talk further."

## 4. Intake architecture (D-22)

Browser, JSON `fetch` to `https://intake.worldenterprise.org/api/intake` (one route), an Azure Function (Flex Consumption, Node 24) behind the shared Front Door profile (`taodoor-standard`, Terraform in FocusApiary/infrastructure, a domain and route added by merge request), a managed identity that writes to Dataverse and sends mail through Azure Communication Services. No Logic App hop.

Dataverse (created only through IaC and the designated workflow, never by hand): a WE business unit and owner team; an Account row per organization (upsert on normalized email domain only for non-consumer domains, otherwise a person-level Account); the custom table `we_engagement` with columns `we_requestid` (alternate key), `we_kind`, `we_audience` (`startup`, `investor`, `partner`, `corporate`), `we_briefid`, `we_stage`, `we_partnercategory`, `we_investorkind`, `we_sourcepage`, `we_consent_at`, `we_consentupdates`, `we_status` (`received`, `delivered`, `delivery-failed`, `unsubscribed`) and the free-text fields; an application user with the minimum table privileges (create, read, write on `we_engagement` and read/write on Account only).

Brief delivery: the Function reads the brief registry (a `briefs.json` blob published by the render job: id, version, title, audience list for the ten briefs), mints a user-delegation SAS (48 hours) for the rendered file in a private container, and sends the ACS email with the link and a scanner-safe unsubscribe (the link opens a confirmation page and unsubscribes only on the page's POST, so mail scanners that fetch links do not unsubscribe anyone). The day 3, 10 and 21 nurture runs from a timer, behind `NURTURE_ENABLED`, which stays `false` until the privacy notice states CRM use and retention (OP-RETAIN) and counsel has reviewed the sequence.

Key Vault `omlab-secrets` names (names only, never values): `worldenterprise-intake-unsubscribe-key`, `worldenterprise-intake-hmac-secret` (optional webhook), `worldenterprise-intake-acs-endpoint` if the endpoint is not injected by IaC. Mail and Dataverse use the managed identity, so there are no client secrets.

Brief deploy pipeline lives in `infra/intake/ci.yml`, included from `.gitlab-ci.yml` with `include: local` guarded by `rules: exists` (the include is added once by WP-60; WP-61 never edits `.gitlab-ci.yml`). It runs the function unit tests, the brief renderer (Markdown to HTML and PDF), the gated-brief audit, and, on `demo` only and only when the operator inputs exist, the deploy. The GitHub mirror receives only the `gh-pages` branch (decision R-2), so nothing under `infra/` reaches GitHub.

## 5. Gated-brief storage and exclusion contract (D-23)

### 5.1 The ten briefs

| `briefId` | Audience | Desks | Owner | Core |
|---|---|---|---|---|
| `funding-paths` | `startup` | funding | WP-63 | yes |
| `company-setup` | `startup` | legal | WP-63 | yes |
| `ai-native-build` | `startup` | ai | WP-63 | yes |
| `first-100-customers` | `startup` | gtm, grow | WP-79 | yes |
| `pre-seed-evidence-pack` | `startup` | fundable | WP-79 | no (cut line 4.6) |
| `first-hires` | `startup` | team | WP-79 | no |
| `early-stage-diligence` | `investor` | fundable | WP-80 | no |
| `ai-company-diligence` | `investor` | ai | WP-80 | no |
| `partnering-with-founders` | `partner` | pathways | WP-80 | no |
| `corporate-spinouts` | `corporate` | pathways | WP-80 | no |

This table is the `briefs` family of the registry (section 8.1). The file name, the `briefId` of the forms contract, the registry id and the collection entry id are the same string.

### 5.2 Source and open abstract

**Source.** `infra/intake/briefs/<briefId>.md`, owned by the brief's owner. Front matter:

```yaml
id: funding-paths                    # equals the file name and the briefId in the forms contract
title: ...
version: "1.0"
updated: 2026-10-20
audience: [startup]                  # equals the registry audience list
sentinel: "<one distinctive sentence of at least 12 words that appears verbatim in the body and nowhere in src, dist or docs>"
sources:                             # every URL fetched in-session; same record shape as section 9
  - { id, title, publisher, url, accessed }
```

Body: Markdown, 2,500 to 4,000 words, H2 sections, an "About the evidence" section and a "What this brief cannot tell you" section. No images. At least six distinct sources fetched in-session.

**Open abstract.** `src/content/briefs/<briefId>.md` in a new `briefs` collection (schema added by WP-60 in `src/content.config.ts`): `title`, `subtitle`, `description` (50 to 160), `topics` (one or two desk ids), `audience` (array of `Audience`, equal to the registry list), `outline` (array of section titles, no sentences from the body), `updated`, `claimsUsed`, `draft`. Body: the abstract, at most 300 words, written separately from the brief. The abstract may describe what the brief covers and the questions it answers; it may not reproduce a sentence of the body, nor share a run of ten words with it.

**Exclusion by location.** The full text is outside every path the build reads: `astro.config.mjs` globs only `src/content/**` for collections; `tsconfig` and `test:unit` cover `src` and `tests/unit`; nothing under `infra/` is imported by the site. The render job in WP-61 turns each brief into a private blob (`briefs/<briefId>/v<version>/<briefId>.pdf` and `.html`).

### 5.3 Audit (WP-60 builds the script, the brief owners supply the briefs)

`scripts/audit-gated-briefs.mjs --dist dist --briefs infra/intake/briefs`:
1. For each brief take its `sentinel` plus three probe sentences chosen deterministically (the longest sentence of at least 12 words in each of the 25 percent, 50 percent and 75 percent positions of the body).
2. Normalize (lower case, collapsed whitespace, curly quotes folded) and search every text file in `dist`: `.html`, `.xml`, `.txt`, `.md`, `.json`, including `llms.txt`, `llms-full.txt`, every `.md` twin, `sitemap*.xml`, `rss.xml`, and the Pagefind fragments.
3. Pagefind fragments are gzip-compressed (verified on the current build: each `pagefind/fragment/*.pf_fragment` is a gzip stream whose payload begins `pagefind_dcd` followed by JSON `{"url","content",...}`), so a raw grep finds nothing either way. The audit gunzips every fragment, drops the 12-byte `pagefind_dcd` prefix and searches the decoded `content`. It also requires `pagefind/pagefind-entry.json` and at least one fragment to exist, so the check cannot pass because the index was never built.
4. The audit must prove itself: `--self-test` builds a temporary dist containing a planted sentinel in an HTML page, an `.md` twin, `llms-full.txt` and a gzip fragment, and fails unless every plant is found. The unit test runs the self-test on every pipeline; the CI job `audit:gated` runs the real audit (a `rules: exists: infra/intake/briefs/*.md` guard keeps it inert until a brief exists).
5. The gated source is also scanned with the claims denylist (`scripts/audit-claims.mjs --source infra/intake/briefs`), because it never reaches `dist` where the normal scan runs.
6. Open research briefs under `/research/` stay open and are not in `infra/`.

## 6. CTA contract (D-24, W8-25)

### 6.1 Policy, types and components

Policy: honest copy; one primary action and at most one secondary per band; no scarcity or urgency language, countdowns, "limited" claims, fake counts or social proof; no exit-intent, no popup, no modal, no sticky bar, no autofocus, no animation that moves content after load. A CTA names what happens next ("Request the brief", "Ask to meet the startups", "Tell WE about your company") and never promises an outcome. No CTA on legal pages, thanks pages, form pages (the form is the action, which includes the brief squeeze pages), `/search/`, `/styleguide/`, the sitemap page or 404. A thanks page and a squeeze page still carry plain, forward links inside the page content (section 11), which are not bands.

`src/data/cta/index.ts` (WP-60 writes the types and a default map; WP-62 owns the directory afterwards):

```ts
import type { Audience } from '../families';   // defined once, in the frozen registry (section 8.1)
export type CtaVariant = 'apply' | 'brief' | 'investor-interest' | 'partner-enquiry' | 'tools' | 'contact';
export type CtaPlacement = 'end' | 'mid' | 'aside';

export interface CtaAction { readonly label: string; readonly href: string }   // href is a ledger path; unit-tested to be a launched route

export interface CtaModel {
  readonly id: string;                 // stable, e.g. 'brief:funding-paths'
  readonly audience: Audience;
  readonly variant: CtaVariant;
  readonly heading: string;            // sentence case, at most 70 characters
  readonly body: string;               // one or two sentences, passes the claims denylist
  readonly primary: CtaAction;
  readonly secondary?: CtaAction;
  readonly note?: string;              // an honest qualifier, for example "WE makes no promise of funding."
}

export interface ResolveInput {
  readonly path: string;               // '/insights/some-article/'
  readonly collection: 'pages' | 'insights' | 'guides' | 'playbooks' | 'services' | 'library' | 'research' | 'briefs' | 'faq' | 'glossary';
  readonly topic?: string;             // desk id for insights
  readonly frontmatterCta?: { readonly variant: CtaVariant; readonly briefId?: string };
}
export function resolveCta(input: ResolveInput): CtaModel | null;   // pure, no Astro imports
```

Resolution order: frontmatter `cta`, then the exact route table, then the surface table of 6.2 by collection, desk and path prefix, then layout default, then `null`. Each cell of the table lists candidates in order; the first candidate whose target is live is used, so a cut brief falls back to the next candidate. A secondary equal to the primary is dropped. A band with no live primary renders nothing.

**Components.** `src/components/cta/CtaBand.astro` (props `{ model?: CtaModel; audience?: Audience; variant?: CtaVariant; briefId?: string; placement?: CtaPlacement; headingLevel?: 2 | 3 }`, renders a `<section class="cta" data-cta="end" aria-labelledby>` using the ContextualNext pattern: heading, body, up to two links styled as `Button`); `CtaAside.astro` (a compact variant for the aside placement); `AudienceStrip.astro` (four links: startups, investors, partners, corporate teams, for the home page and hubs). Each layout in `src/layouts/` has a named slot `cta-end` and an optional `cta-mid` insertion point (WP-60), filled by default with `<CtaBand {...resolveCta(...)} />`.

**Mid-body placement is static HTML from the hast plugin, not a component.** A Satteri hast plugin cannot render an Astro component, so the plugin (`src/lib/rehype-mid-cta.ts`, registered in `astro.config.mjs` next to `tableWrapPlugin` by WP-60) emits plain nodes built from the same `CtaModel`: `<aside class="cta-inline" data-cta="mid" aria-label="Next step"><p class="cta-inline__title">...</p><p>...</p><p><a class="btn btn--secondary" href="...">...</a></p></aside>`. It uses a `<p>` for the title, not a heading, so the heading outline of the page is untouched. Rules: only for documents whose frontmatter lets `resolveCta` return a model with a `mid` variant (the plugin reads `ctx.data.astro.frontmatter`); only when the body has at least 900 words; inserted after the first block-level boundary at or after 50 percent of the text, never between a heading and its first paragraph, never inside a list, table, blockquote, figure or code block, never in the first 20 or last 10 percent; at most one per document. If the Satteri context offers no insert operation, WP-60 falls back to a marker element that the layout fills, and records the finding in its handoff. A unit test asserts that the plugin output and `CtaBand` render the same label and href for the same model, so the two surfaces cannot drift.

**Dead targets fail closed.** A CTA action whose `href` is not a live route is dropped, in the component and in the plugin alike (the `pickRelated` precedent in `src/components/insights/related.ts`), so `audit:links` never sees a dead link. The liveness predicate is a pure function over the ledger and a plain `node:fs` page listing (`src/lib/page-files.ts` precedent), so the hast plugin can use it without Astro runtime imports. This is also why WP-62 merges after WP-63, WP-64, WP-65 and WP-71: before they land its bands would correctly render nothing for their variants.

Styles for the CTA live in `src/components/cta/cta.css`, imported by the components, tokens only (`src/styles/tokens.css`); no edit to the shared stylesheets.

### 6.2 Default map per surface

The map is data in `src/data/cta/`; WP-62 refines the copy and may change a mapping through the data file only, within the policy. A unit test over the family registry fails if a registry family or a legacy surface has no entry, or an entry has no primary or more than one secondary. "Hub" = `/insights/`, `/library/`, `/playbooks/`, `/guides/`, `/resources/`, `/glossary/`, `/faq/`, `/research/`. Targets: apply `/apply/`; brief hub `/briefs/`; tools hub `/tools/`; contact `/contact/`; journey `/journey/after-you-apply/`; investor interest `/investors/interest/`; partner enquiry `/network/partners/enquire/`.

| Surface | Stage | Primary (first live candidate) | Secondary | Mid band (documents of 900 words or more) |
|---|---|---|---|---|
| Home `/` | awareness | apply | brief hub | none (the audience strip is the band) |
| Program pages, `/program/how-we-decide/` | consideration | apply | journey | none |
| `/pricing/` | consideration | apply | contact | none |
| Services (seven lines) | consideration | contact | apply | none |
| `/founders/` hub | awareness | apply | brief hub | none |
| Segment pages (seven) | consideration | apply | the segment's brief or tool by frontmatter `cta`, else brief hub | none |
| `/founders/corporate-innovators/` | consideration | brief `corporate-spinouts`, then contact | contact | none |
| Articles, desk `funding` | awareness | brief `funding-paths`, then apply | apply | apply |
| Articles, desk `legal` | awareness | brief `company-setup`, then apply | apply | apply |
| Articles, desk `team` | awareness | brief `first-hires`, then apply | apply | apply |
| Articles, desk `ai` | awareness | brief `ai-native-build`, then apply | apply | apply |
| Articles, desks `gtm`, `grow`, `dream`, `models` | awareness | brief `first-100-customers`, then apply | apply | apply |
| Articles, desk `fundable` | awareness | brief `pre-seed-evidence-pack`, then apply | apply | apply |
| Articles, desks `starting`, `pathways` | awareness | brief `company-setup` (`starting`) or `funding-paths` (`pathways`), then apply | apply | apply |
| Articles, desk `build` | awareness | brief `ai-native-build`, then apply | apply | apply |
| Articles, desk `sectors` | awareness | apply | `/industries/`, then brief hub | apply |
| Articles, desk `ops` | awareness | tools hub | apply | apply |
| Playbooks | consideration | apply | tools hub | none |
| Guides | consideration | tools hub | apply | apply |
| Library templates | consideration | tools hub | none | none |
| Tools hub `/tools/` | consideration | apply | brief hub | none |
| Tool pages | consideration | brief by frontmatter `cta` (runway to `funding-paths`, pricing checker to `first-100-customers`, cap-table explainer to `company-setup`), then apply; team composer: apply | apply, or contact for the team composer | none |
| Research (open briefs) | awareness | brief hub or the brief named in frontmatter, then apply | apply | none |
| Hubs (list above) | awareness | apply | brief hub | none |
| `/briefs/` hub | awareness | apply | none | none |
| `/briefs/<id>/`, `/briefs/thanks/` | conversion, onboarding | none (form page, thanks page) | none | none |
| `/industries/`, vertical pages | awareness, consideration | apply | `/insights/topic/sectors/`, then brief hub | none |
| `/compare/`, pair pages | consideration | apply | `/program/how-it-works/` | none |
| `/journey/` | awareness | apply | journey | none |
| `/journey/after-you-apply/` | consideration | apply | `/journey/first-months/` | none |
| `/journey/first-months/` | consideration | apply | `/journey/onboarding-checklist/` | none |
| `/journey/onboarding-checklist/` | onboarding | apply | tools hub | none |
| `/investors/` and the investor content pages | awareness, consideration | investor interest | brief `early-stage-diligence`, then none | none |
| `/investors/interest/`, `/investors/interest/thanks/` | conversion, onboarding | none (form page, thanks page) | none | none |
| `/network/` | awareness | apply | partner enquiry | none |
| `/network/operators/` | consideration | apply | contact | none |
| `/network/partners/` and the partner content pages | awareness, consideration | partner enquiry | brief `partnering-with-founders`, then none | none |
| `/network/partners/enquire/`, `/network/partners/enquire/thanks/` | conversion, onboarding | none | none | none |
| About, brand story, manifesto, frameworks, trust, press | awareness | apply | contact | none |
| Legal pages, `/apply/`, `/apply/thanks/`, `/contact/`, `/newsletter/`, `/search/`, `/styleguide/`, sitemap page, 404 | any | none | none | none |

## 7. Portfolio entry schema (D-12 as amended by D-21)

The `portfolio` collection stays, with the schema below (WP-60 writes it into `src/content.config.ts`; the folder `src/content/portfolio/` is empty at the end of wave 8 unless the operator supplies a consent record, OP-PORTFOLIO).

```ts
const portfolio = z.strictObject({
  company: z.string().min(1).max(120),                         // as the founder wants it shown
  website: z.url().optional(),
  oneLine: z.string().min(10).max(160).optional(),            // founder-approved words
  stage: z.enum(['idea', 'validating', 'building', 'launched']).optional(),
  consent: z.literal(true),                                    // a draft without consent cannot parse
  consentRecord: z.strictObject({
    recordedOn: z.coerce.date(),
    scope: z.array(z.enum(['name', 'description', 'website', 'investor-introductions'])).min(1),
    reference: z.string().min(1),                              // pointer into the private consent register, never the document itself
  }),
  source: z.strictObject({
    kind: z.enum(['founder-written', 'agreement', 'public-record']),
    reference: z.string().min(1),
  }),
  draft: z.boolean().default(false),
});
```

Rules: no metrics, no logos, no founder names, no valuations or amounts exist in the schema, so they cannot be added without a counsel-reviewed schema change. A field renders only if its scope is in `consentRecord.scope` (`description` gates `oneLine` and `stage`; `website` gates `website`; `name` is always required). The component `src/components/investors/PortfolioShowcase.astro` (WP-64) renders only `getPublished('portfolio')` entries. With zero entries the investors page shows exactly: "No portfolio is published yet. WE lists a company here only with its founder's written consent." A statement that groups of companies are forming is not published: it is a claim about people and dates that no source supports yet, and the word would also trip the `C-13-peers` rule. The empty state stands until the operator supplies a source and counsel clears new wording (OP-COHORT). `/investors/showcase-format/` describes the field list and consent scopes in prose and a table and contains no example company, no placeholder name and no sample metric: an illustrative company that looks real is an invented portfolio. `/founders/portfolio/` remains L2.

## 8. Page families and reference data

### 8.1 The registry, `src/data/families.ts` (WP-60)

The registry is the only hand-edited list of founder segments, industries, comparisons, journey pages and brief ids. Ledger rows, nav links, sitemap entries, hub cards and tests derive from it. A content package adds a page by adding a file in the `pages` collection whose slug is already in the registry; it never edits the registry. Only WP-60 (stage 0) and WP-99 (to flip `launch`) edit it.

```ts
export const AUDIENCES = ['startup', 'investor', 'partner', 'corporate'] as const;
export type Audience = (typeof AUDIENCES)[number];

export type FamilyId = 'segments' | 'industries' | 'compare' | 'journey' | 'briefs';

export interface FamilyEntry {
  readonly slug: string;            // the file name in the pages collection, or the brief id
  readonly path: string;            // derived: '/founders/first-time-founders/'
  readonly label: string;           // short label for nav, cards and the palette, at most 40 characters
  readonly order: number;
  readonly owner: string;           // the content owner package, for example 'WP-73'
  readonly core: boolean;           // false = first cut within the family (plan 4.6)
  readonly launch: boolean;         // true by default; WP-99 flips a cut entry and records a reason
  readonly reason?: string;         // required when launch is false
  readonly blockedWord?: string;    // set on the one entry whose slug or title holds a word `C-13-peers` blocks (below)
}
export interface SegmentEntry extends FamilyEntry { readonly short: string }          // 'first-time'
export interface BriefEntry extends FamilyEntry { readonly audience: readonly Audience[]; readonly desks: readonly DeskId[] }
```

| Family | Folder in `pages` | Slugs (core first, then the first cut) |
|---|---|---|
| `segments` | `src/content/pages/founders/` | `first-time-founders` (first-time), `technical-founders` (technical), `non-technical-founders` (non-technical), `solo-founders` (solo), `corporate-innovators` (corporate), `student-founders` (student), `second-career-founders` (second-career), `global-remote-founders` (global); all core; the article tables use the short names |
| `industries` | `src/content/pages/industries/` | core: `fintech`, `healthtech`, `edtech`, `climate-tech`; first cut: `legaltech`, `logistics`, `proptech` |
| `compare` | `src/content/pages/compare/` | core: `incubator-vs-other-programs`, `incubator-vs-venture-studio`, `dedicated-team-vs-agency`, `dedicated-team-vs-freelancers`; first cut: `build-vs-buy`, `onshore-vs-offshore-teams`, `bootstrapping-vs-outside-funding` |
| `journey` | `src/content/pages/journey/` | `after-you-apply`, `first-months`, `onboarding-checklist` (all core); the hub is `index.mdx` |
| `briefs` | `src/content/briefs/` | the ten ids of 5.1 (core: the first four) |

The one entry that carries a blocked word. `incubator-vs-other-programs` has `blockedWord: 'accelerator'` and the label "Incubators and other startup programs". Every generated surface (the `/compare/` hub card, the navigation, the palette, the footer, the sitemap page, the feeds, the llms lists) renders such an entry from its `label` alone and never from its description or title, so the word appears only on the page itself, in its Markdown twin and in the two llms files that the rule already allows. WP-60 adds `allowPaths` for the page (its Markdown twin maps to the same route) (DP-W8-15) and for no other path.

Q-7, measured on 2026-10-10 with `scan()` on fixtures: the audit does not read an `href` attribute (a link in a page or in a Markdown twin is clean, and so is a link address in `llms.txt`), but it does read a URL in JSON-LD (`"item"` and `"url"`), in `<meta property="og:url">` (a `<link rel="canonical">` is not read), in `<loc>` of `sitemap*.xml` and in `<link>` and `<guid>` of a feed, and `\baccelerators?\b` matches inside `incubator-vs-accelerator` because `-` ends a word. A sitemap or a feed cannot carry an `allowPaths` entry without exempting the whole file. So the slug was renamed to `incubator-vs-other-programs` in the registry before any page existed, and no further `allowPaths` entry was added. A unit test asserts that no generated list carries the word and that no registry slug trips a rule.

Invariants (`tests/unit/wp-60/families.test.ts`): every slug is unique within its family and across the reserved slugs (`portfolio`, `stories`, `index`); every `pages` file in a family folder has a registry entry (a file with no entry fails; an entry with no file is pending, not an error); every `segments` value in an article is a registry slug; the `launch: false` entries have a reason; a brief entry's `audience` equals its abstract's `audience`.

### 8.2 Frontmatter of a family page

The `pages` schema gains one optional object, `family`, a discriminated union on `id`. All other `pages` fields are unchanged and still strict: the top-level `pages` schema gains `family` and nothing else. The page body is optional MDX for prose around the structured fields; templates render the structured fields in a fixed order, so a page cannot omit a section or reorder one. Template-fixed sentences (marked below) are not authored and cannot be dropped. Sources live inside the `family` object, not at the top level (so the strict `pages` schema stays as it is): `family.sources` is an array of `{ id, title, publisher, url, accessed }` (the article source shape, every URL fetched in-session and recorded in the package sources file, section 9), required with at least two entries for `industries` and `compare`, optional for `segments` and `journey`. A `sourceId` anywhere in the family object names an `id` in `family.sources`, and the schema refinement fails on an unknown one. A family page's JSON-LD is `WebPage`, never `Offer`, `Product` or `Review`.

**`segments`**

```yaml
family:
  id: segments
  slug: first-time-founders          # equals the file name and a registry slug
  whoFor: "..."                      # 1 to 3 sentences, 80 to 400 characters: the reader's situation, never eligibility
  challenges:                        # 3 to 5 items
    - { title: "...", text: "..." }  # title at most 60 characters, text 40 to 260; each maps to a ledger claim
```
Template: renders `whoFor`, `challenges`, the reading path (articles whose `segments` field lists the slug; zero, one or many), and the primary and secondary action of 6.2. Fixed sentence: "This page describes a situation. It is not an eligibility rule." No other statement about who WE accepts.

**`industries`**

```yaml
family:
  id: industries
  slug: fintech
  buyer: "..."                       # who buys and who decides, in general terms, 1 to 3 sentences
  perimeter:                         # 3 to 6 items: the regulatory or standards perimeter, general terms
    - { title: "...", text: "...", jurisdiction: "US federal", asOf: 2026-10-12, sourceId: "..." }
  dataQuestions: ["..."]             # 3 to 6 questions to settle about data handling
  salesCycle: "..."                  # considerations, no numbers, no durations
  sources:                           # at least 2; each perimeter item's sourceId names one of them
    - { id: "...", title: "...", publisher: "...", url: "https://...", accessed: 2026-10-12 }
```
Template fixed sentence: "This page is about considerations. It does not describe any WE company or result."

**`compare`**

```yaml
family:
  id: compare
  slug: incubator-vs-other-programs
  sides:                             # exactly two, the same fields for each
    - { name: "...", whatItIs: "...", whoItFits: "...", asksOfFounder: "...", askThis: ["..."] }
    - { name: "...", whatItIs: "...", whoItFits: "...", asksOfFounder: "...", askThis: ["..."] }
  whereEachFits: ["...", "..."]      # one situation for each side, in the same order as `sides`
  definitions:                       # at least 2
    - { term: "...", text: "...", sourceId: "..." }
  sources:                           # at least 2; every statement about the other category cites one
    - { id: "...", title: "...", publisher: "...", url: "https://...", accessed: 2026-10-12 }
```
Both `sides` take the same fields, so the template is neutral by construction; the neutrality unit test (WP-75) also compares word counts. A side names a category, never a product or company. WE appears only through sentences that already exist on a program page, never through its fees or equity.

**`journey`**

```yaml
family:
  id: journey
  slug: after-you-apply              # or 'index' for the hub
  stage: consideration               # awareness | consideration | conversion | onboarding | advocacy
  step: 2                            # optional, 1 to 5, the position in PROGRAM_STEPS
  questions: ["..."]                 # questions a founder can ask at this step
  checklist:                         # onboarding-checklist only
    - { id: "problem-brief", text: "...", href: "/library/..." }   # href optional and fail-closed
```
Template: an ordered `JourneyList` with no durations; the step titles equal `PROGRAM_STEPS` in `src/components/program/steps.ts`. The `checklist` is guidance, never stated as a condition of applying.

### 8.3 Claims rules by family

| Family | Rule |
|---|---|
| Segments | No number about applicants, acceptance, outcomes or time. No requirement for applying that `/program/who-its-for/` does not state. No discount or preference for a segment. A question about a segment that the program pages do not answer goes to the handoff (OP-SEGMENTS). |
| Industries and sector articles | A regulatory or standards statement is fetched in-session from a primary source, with jurisdiction and date. No client, partner or customer named. WE does not "serve", "specialize in" or hold a certification, attestation or compliance for any industry (`C-15-*`, section 0.2). No currency amounts or percentages that are not inside a quoted source. |
| Compare | Categories only. Every statement about the other category cites a source fetched in-session. SAFE-mechanics terms carry the generic-definition marker. A situation where the other side fits better than WE is named on every page. No superlatives, no second-person recommendation of a side. |
| Journey | Derived from `PROGRAM_STEPS` and the program pages. No added step, no duration, no outcome. A step with no support is a question for the operator (OP-PROCESS), not a sentence. |
| Investors | No amounts, accreditation, fund size, return target, success fee or investor network. Readiness criteria only restate statements that exist on a linked page (OP-CRITERIA). |
| Partners | No company named, no discount or saving claimed, no "free" or "perks". Evaluation criteria are stated only when the operator confirms them (OP-PARTNER). |
| Glossary and FAQ | Definitions are general and neutral; an answer about WE restates a claim id, an existing page and line, or a decision; "accelerator", "cohort", "mentor" and "perks" are not used in new entries. |

### 8.4 Reference data: glossary, FAQ, resources

The two YAML files grow by additions only (W8-28): every existing entry is kept byte for byte (a unit test pins the originals) and a correction goes to the handoff. New optional fields; the 18 FAQ entries and the existing glossary terms parse unchanged. Validated by `tests/unit/wp-60/reference-data.test.ts`.

`src/data/glossary.yaml` (collection `glossary`): the existing fields `id`, `term`, `definition`, `group`, `claimsUsed`, `related`, `draft`, plus
- `genericDefinition` (boolean, default false): the list component wraps the definition in `data-generic-definition`; required for `valuation cap`, `discount rate`, `pro rata` and `most favored nation`.
- `claimAllow` (array of rule ids, default empty): the component wraps the definition in `data-claim-allow` for each id; allowed values are `C-13-peers` (the retention sense of "cohort"), `C-14-success-based`, `W7-C09-no-equity`; each use is recorded in the sources file.
- `seeAlso` (array of ledger paths): a link renders only when the route is live.
Groups: the seven that exist today (Funding, Finance and metrics, Legal and contracts, Customers and product, Product delivery, Security and accessibility, WE vocabulary) and three new ones, Go-to-market, Team and hiring, AI and data. The definition is one to three sentences, 10 to 80 words. There are no per-term routes: each term has a stable anchor (`anchorId` in `src/components/reference/jsonld.ts`) on `/glossary/`.

`src/data/faq.yaml` (collection `faq`): the existing fields `id`, `question`, `answer`, `group`, `claimsUsed`, `related`, `draft`, plus
- `audience` (`startup`, `investor`, `partner`, `corporate`, optional): absent means general and renders first, under "For everyone"; the page then groups by audience and, inside each, by `group`.
- `seeAlso` (array of ledger paths), fail-closed as above.
An answer is one to four sentences. `group` is a non-empty string; the four existing groups (About WE, The seat model, Applying and cost, Scope and limits) stay, and WP-78 fixes the list of new groups in its own test.

`/resources/` (WP-72): lists the library, guides, playbooks, templates, tools, briefs hub, research, glossary and FAQ grouped by where a founder is (before you apply, while you build, when you raise). The lists derive from the registries and the liveness predicate; a page that does not exist is not listed.

`FAQPage` and `DefinedTermSet` nodes come only from `src/components/reference/jsonld.ts` (WP-77 owns the file; every other package imports it and a change is additive, covered by a snapshot test).

## 9. Sources, claims, handoffs and tests

**Source rule (articles, briefs, glossary entries, comparisons, industries, tool explainers).** Every entry in a document's `sources` was fetched in the writing session. The package's sources file `.astro-magazine/sources/wp-NN.json` records each fetch:

```json
{
  "wp": "WP-66",
  "fetches": [
    { "id": "irs-83b", "url": "https://www.irs.gov/...", "title": "...", "publisher": "Internal Revenue Service",
      "fetchedAt": "2026-10-13T09:41:07Z", "status": 200, "tool": "WebFetch" }
  ],
  "documents": [
    { "path": "src/content/insights/legal/<slug>.mdx", "claims": [
      { "id": "A1", "sentence": "...", "kind": "statistic|regulation|definition|paraphrase", "sourceId": "irs-83b", "locator": "heading or paragraph", "quote": "at most 25 words, verbatim" }
    ] }
  ],
  "markers": [
    { "path": "src/content/insights/grow/retention-basics.mdx", "rule": "C-13-peers", "reason": "generic retention term", "sourceId": "..." }
  ]
}
```

`tests/unit/wp-60/sources-ledger.test.ts` fails when: a frontmatter source URL (the top-level `sources`, and `family.sources` on a family page, read as one list with a source named in both counted once) has no fetch record; a fetch is not status 200; `accessed` differs from the fetch date; a document that carries claims (a non-empty `claims` array) has fewer than 2 distinct sources and is not `noStatistics` (a document with only `sentences`, or with `claims: []`, is a page and is held to the sentence rules instead); a claim names an unknown `sourceId`; a statistic or regulation claim lacks a `quote`; a `data-claim-allow` or `data-generic-definition` marker in a file has no entry in `markers`; a fetch URL host is not on the host allowlist kept in the test. The allowlist is the OP-HOSTS decision, kept in `tests/unit/wp-60/sources.ts` and extended only by a further decision. It holds government and regulator suffixes (`.gov`, `.gov.uk`, `.europa.eu`, `.canada.ca` and the other national agency suffixes), each also matching its bare apex; standards and law bodies (`iso.org`, `nist.gov`, `w3.org`, `ietf.org`, `owasp.org`, `law.cornell.edu`, `ico.org.uk` and the rest); the publishers of the instruments and methods an article describes (`ycombinator.com`, `nvca.org`, `opensource.org`, `spdx.org` and the rest), classed as standards; scholarly hosts (`arxiv.org`, `proceedings.neurips.cc`, `aclanthology.org`), which never source a regulation; universities (`.edu`, `.ac.uk`); and, for attributed vendor claims only, vendor documentation hosts. A listed host also matches its subdomains, the path and file type are never read, a blog, a news site, an aggregator and Wikipedia are not on it, and the fetch `tool` is any non-empty string.

**Sentence ledger, desk pages and ids.** A `sentences[]` entry names a `page` as `<repo path>` or `<repo path>#<h2-slug>`: the file exists and, when a heading is given, the file holds an H2 with that slug (a bare path is valid for a page with no H2). A `claim` is an id in `src/data/claims.ts`; a `decision` is an id that `.astro-magazine/decisions.md` records (`D-nn`, `W8-nn`). A claim that cannot be sourced is dropped from the text, never softened into an unsourced statement. WP-99 spot-checks ten percent of the quotes by fetching the page again.

**Sentence ledger (page copy).** For pages and components (WP-62 to WP-65, WP-71 to WP-75, the abstracts and squeeze pages of the briefs, the FAQ and the glossary): `documents[].sentences[]` each map to `{ claim: 'C-nn' }`, `{ page: 'path#heading' }` or `{ decision: 'D-nn' }`. A unit test per package fails on an unmapped sentence (the WP-43 pattern, `tests/unit/wp-43/sources.test.ts`). A file that holds page copy needs `"fetches": []` when it quotes no outside source, so `sources-ledger.test.ts` reads it; a document with `sentences` may be a component or a data module (the file must exist), and `checkSentences` in `tests/unit/wp-60/sources.ts` fails a sentence with no mapping or with two, a claim that is not `C-nn`, a decision that is not an id, a page without `#heading` or that does not exist. A control label that states no fact about WE is mapped as `{ label: true }` (seven words at most, the WP-43 `ui_label` precedent). WP-60's own ledger and its enumerating test are `.astro-magazine/sources/wp-60.json` and `tests/unit/wp-60/copy-ledger.test.ts`: copy them for a package's modules.

**Handoff.** `.astro-magazine/handoffs/wp-NN.md`: what changed, decisions made, open questions, operator inputs, and (WP-63, WP-64, WP-65, WP-75, WP-80, WP-61) the proposed counsel text for the next release (CR entries). The counsel register file is in the release lane, so those packages never edit it; WP-99 commits the entries after confirming that no wp/30 merge request is open. Article packages also record, per title, slug, mark, desk, word count, source count, claims-audit result and any substitution.

**Tests.** Unit tests only in `tests/unit/wp-NN/**`, e2e only in `tests/e2e/wave8/wp-NN/**` (run by the `e2e:wave8` job, projects `wave8-desktop-1440x900` and `wave8-mobile-390x844`, enabled by `E2E_WAVE8`). Function tests live in `infra/intake/tests/**` and run in the `intake:test` job from `infra/intake/ci.yml`.

**Quality bars for every page package.** `npm run check`, `test:unit`, `check:ownership`, the full qa set and `verify:static` green; Lighthouse 1.0 on all four categories and axe zero violations on the package's routes; CLS under 0.1; no new third-party request; touch targets at least 24 px; keyboard-only completion of every form; no-JavaScript behavior per section 3.4.

## 10. Release gate and `RELEASE_ALLOW`

On `demo` and `wp/*` branches `RELEASE_ALLOW` tolerates (a) the disabled launched form routes (`^launched form route`, unchanged: every form route is disabled until the endpoint exists) and (b) while a wave 8 page does not exist yet, one anchored pattern per pending path (`^launch:true route does not exist: (<paths>)$`), the W7-6 pattern. WP-60 first removes the wave 7 patterns (their pages exist, and WP-48's four rows become `launch: false` with a reason), then adds the wave 8 pending paths. WP-99 removes the wave 8 pending paths when the last page lands, leaving `^launched form route` only; a page the integrator cut is flipped to `launch: false` first, so it needs no pattern. A release tag and `gh-pages` set `RELEASE_ALLOW` to empty, so the release needs every wave 8 page built and the intake endpoint configured (`PUBLIC_WE_INTAKE_API_URL` set for the release build). With one endpoint variable, every form route flips together. The brand kit page stays `launch: false` and is not a failure.

## 11. The customer journey as a contract (W8-25)

### 11.1 Stages

| Stage | Meaning | What the site owes the visitor |
|---|---|---|
| awareness | The visitor lands, often from search or an assistant, on a content page | A useful page first; one honest next step; no gate |
| consideration | The visitor weighs WE | The facts the program pages already state, what WE cannot promise, an honest comparison, the process in order |
| conversion | The visitor acts: apply, request a brief, express interest, enquire, contact | A form that says what happens next and keeps the truth policy |
| onboarding | The visitor has acted | A thanks page with plain forward links; the checklist and the library; no promise of timing |
| advocacy | The visitor passes the site on | Nothing that is not true: a pass-it-on section, the consent-gated showcase (L2 until a consent record exists), the partner enquiry; no testimonial, share count, referral reward or review |

### 11.2 The four maps

One map per audience. A page is listed once per stage it serves; routes are in section 1.2. "CTA" is the primary and secondary action of 6.2.

| Stage | Startup | Investor | Partner | Corporate innovator |
|---|---|---|---|---|
| Awareness | `/`, `/founders/`, a segment page, an article, `/industries/`, `/compare/`, `/glossary/`, `/resources/` | `/investors/`, `/insights/topic/fundable/`, `/fundability/` | `/network/partners/`, `/network/` | `/founders/corporate-innovators/`, `/insights/topic/pathways/` |
| Consideration | `/program/how-it-works/`, `/program/who-its-for/`, `/program/dedicated-teams/`, `/pricing/`, `/journey/`, `/journey/after-you-apply/`, `/journey/first-months/`, `/faq/`, a compare page | `/investors/meet-startups/`, `/investors/what-you-can-see/`, `/investors/readiness-criteria/`, `/investors/showcase-format/`, `/investors/faq/`, brief pages `early-stage-diligence` and `ai-company-diligence` | `/network/partners/categories/`, `/network/partners/how-it-works/`, `/network/partners/faq/`, brief page `partnering-with-founders` | `/program/who-its-for/`, `/compare/incubator-vs-venture-studio/`, `/compare/dedicated-team-vs-agency/`, brief page `corporate-spinouts` |
| Conversion | `/apply/`, a brief squeeze page, `/contact/` | `/investors/interest/` | `/network/partners/enquire/` | brief request `corporate-spinouts`, `/contact/` (audience corporate) |
| Onboarding | `/apply/thanks/`, `/briefs/thanks/`, `/journey/onboarding-checklist/`, `/playbooks/`, `/library/`, `/tools/` | `/investors/interest/thanks/`, then `/investors/what-you-can-see/` | `/network/partners/enquire/thanks/` | `/briefs/thanks/`, then `/journey/after-you-apply/` |
| Advocacy | the pass-it-on section of `/journey/`; the consent-gated showcase when it exists | the consent-gated showcase when it exists | the pass-it-on link on `/network/partners/` | the pass-it-on section of `/journey/` |

### 11.3 Rules

1. **No dead end.** Every page in a map has a forward path: a band (6.2) or, on a page where D-24 forbids a band, plain links in the page content (a thanks page links to the next useful page; a squeeze page links to the related briefs and the apply page; the form page links back to the explanation).
2. **Click depth.** Every conversion page is reachable from `/` in at most three navigations by visible links. Opening or hovering a menu panel does not count; following its link does.
3. **One primary, at most one secondary** per page family (6.2). The stage sets the pairing: awareness pages offer the brief or the apply action; consideration pages offer apply and the next step in order; conversion pages offer only the form; onboarding pages offer the next useful page.
4. **No scarcity, no promise.** No stage promises a result, a timing, a meeting or funding (section 0).
5. **A cut page is skipped, not faked.** A map step whose route is `launch: false` is skipped by the suite and listed in its output; the previous page's fail-closed secondary drops the link.
6. **The honest limits are part of the map.** Advocacy for startups, investors and partners is limited to what section 11.1 allows; the maps contain no testimonial step.

### 11.4 Implementation and proof

WP-62 implements the CTA map and the audience strip; WP-71 supplies the family templates; WP-72 writes the journey pages; WP-90 encodes the four maps in `tests/e2e/wave8/journeys/maps.ts` and walks each by clicking visible links (no `goto` after the first page), asserting at every page the stage's primary and secondary href, a forward link, the click depth of rule 2 and, with a mocked endpoint, the thanks page; a disabled-endpoint variant proves each form says plainly that it is not yet accepting requests and offers `mailto` only on `contact` and `apply`. A unit test asserts that every page in a map is in the ledger and every registry family appears in at least one map.

## 12. Legacy tests (W8-18)

The suite has 125 test files on `demo` (148 once the wave 7 branches add theirs). Several pin facts that wave 8 changes on purpose. The rule is one owner per test file, the package that rewrites what the test pins:

| Legacy test | What it pins that changes | Owner |
|---|---|---|
| `tests/unit/foundation/**`, `wp-03/**`, `wp-04/**`, `wp-05/**`, `wp-06/**`, `wp-08/**`, `wp-19/**`, `wp-40/**` | ledger counts (99, 95, 23, 18), per-desk slug lists, exact playbook and guide counts, forms field lists, the wave 7 write-set filter | WP-60 (converted to invariants; WP-86 and WP-87 add their own tests in their own folders) |
| `tests/unit/wp-11/**` and `tests/unit/wp-18/**` | page-specific blocks for `/investors/` (disclaimer, "Not an offer of securities", `InvestorIntroductionsOffer`, flat-fee wording) and for the founders table; shared invariants (denylist, spelling, route owners) | WP-60: moves the investors block verbatim to `tests/unit/wp-64/legacy-investors-page.test.ts` and the founders block verbatim to `tests/unit/wp-62/legacy-founders-page.test.ts` (seed files; the test count before and after is equal), and keeps the invariants |
| `tests/unit/wp-43/**` | apply stepper, program decision sentences | WP-60 (it owns the apply pages and the forms script) |
| `tests/unit/wp-10/**` | privacy notice: every form field named, no retention period, no cookies, no analytics | WP-61 (it rewrites `privacy.md`; the retention pin changes only when the operator supplies a period, OP-RETAIN). `tests/unit/wp-10/truth.test.ts` also scans the about and press folders; WP-71 writes there and keeps it green |
| `tests/unit/wp-07/**` | open research briefs, `RESEARCH_SLUGS` | WP-63 |
| `tests/unit/wp-01/**`, `tests/unit/wp-44/**` | home and program sentences, home FAQs | WP-62 |
| `tests/unit/wp-49/**`, `tests/e2e/wave7/wp-49/**` | the team composer and evidence room tools | WP-76 |
| `tests/unit/wp-41/**`, `tests/unit/wp-46/**` | llms, twins, palette | WP-91 (additions only) |
| Photography lane (`wp-12b`, `wp-12c`, `wp-12d`), release lane (`wp-30`) | hero and image markup, release path | Read-only for wave 8. If one fails because of your change, change your change. |
| Every other file (`wp-02`, `wp-09`, `wp-13`, `wp-15`, `wp-16`, `wp-17`, `wp-42`, `wp-45`, `shared`, `url.test.ts`) | directory-wide invariants or pages no wave 8 package edits | Read-only constraints. `wp-45/pinned-props.test.ts` allows new optional props and new components only, so WP-60 keeps every layout and component API additive. |

If a read-only test must change, the package raises it in its handoff and the orchestrator grants one `exceptions` entry for that single file (the WP-43 and WP-44 precedent), serialized so only one package holds it at a time. No package edits a legacy test it does not own on its own authority.

Entry actions for WP-60 (a hard gate, recorded in its handoff): (1) WP-41, WP-46 and WP-49 are merged to `demo` or closed; (2) re-run the coverage, pins, overlap, self-test and prose checkers on the post-wave-7 tree (`.astro-magazine/plans/wave8/`), and register any file those branches added that a wave 8 package must edit (candidates: `src/components/geo/**` for `llms-full.txt` and `.md` twin inputs of the new routes, `src/components/nav/**` and the palette entries, `src/pages/tools/**` and `src/components/tools/**` for CTA targets); (3) update `wave8-writesets.json` and re-run the checkers until each reports zero; (4) record the observed duration of the first three pipelines.

## 13. Rules for every package and the push protocol

Mirror of plan 4.2 and 4.3; the plan holds the rationale and the budgets.

1. A package edits only files in its registered write set (`check:ownership` enforces it on `wp/*`). A file outside the set is requested from the orchestrator, not edited.
2. Frozen files and the wave 8 frozen additions belong to WP-60 (stage 0) and WP-99 (stage 2, through declared exceptions). `src/data/cta/**` and `src/components/cta/**` belong to WP-60 until 60b merges, then to WP-62. Page-family route files and components belong to WP-71.
3. Layout and component APIs stay additive (`wp-45`).
4. Internal links point only at routes that exist on `demo` when the branch merges. To reach a later page use the fail-closed mechanisms: `related`, `segments`, the CTA map, registry-driven lists.
5. Existing reference content (FAQ, glossary, readiness statements, the 18 articles) is never edited except by an orchestrator-approved correction (W8-28).
6. Never run builds locally; CI builds. Local checks are the node unit tests where the worktree has dependencies, the ownership check and the checker bundle.
7. Concurrency: at most 10 authoring agents and at most 5 branch pipelines at once. Author in local commits; merge `origin/demo`; push once per batch through `bash .astro-magazine/plans/wave8/push-slot.sh push wp/NN` run as a background command; the script holds one of five `flock` slots under the git common directory from the push until the pipeline ends. Fix and re-push through the slot again (two fix pushes in the budget). After the merge, `push-slot.sh watch demo`. `push-slot.sh status` shows occupancy. If the script cannot run, the orchestrator hands out push turns by message, five at a time.
8. Secrets by name only (Key Vault `omlab-secrets`, `worldenterprise-intake-<purpose>`); never a value in Git, an issue or a log.
9. Every package ends with a handoff and a sources file (section 9). A package is done when its acceptance criteria are met, its pipeline is green and its merge request is merged; the orchestrator closes the issue.
