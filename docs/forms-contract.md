# Forms contract

Status: version 2, rewritten by WP-60 (wave 8) from the WP-03 version 1. Consumers: WP-10 (privacy notice must match section 7), WP-61 (the intake Function, section 5), the form components and every page that places them, WP-14 (tests), WP-30 (release). The binding extension is `docs/wave8-contracts.md` section 3; this document is the full text, and `docs/forms-contract.schema.json` is the machine-readable table, kept equal to `src/data/forms.ts` by `tests/unit/wp-60/forms-schema.test.ts`.

What version 2 adds: three kinds (`brief-request`, `investor-interest`, `partner-enquiry`), the `audience` and `requestId` fields, `Retry-After` on a `429`, idempotency, and the rule that `mailto` belongs to `apply` and `contact` only. The `newsletter` keeps its version 1 contract unchanged.

This site is static (GitHub Pages). It runs no server code. Every form submits to an external intake endpoint that is owned and operated outside this repository. This document is the interface between the two.

## 1. Forms in scope

| Form id | Route | Purpose | Uses endpoint |
|---|---|---|---|
| `apply` | `/apply/` | Application to the incubator | `PUBLIC_WE_INTAKE_API_URL` |
| `contact` | `/contact/` | General contact, seat rate requests, press, corrections, questions about information handling | `PUBLIC_WE_INTAKE_API_URL` |
| `newsletter` | `/newsletter/` and footer | Email subscription (WP-08, WP-03 ships `NewsletterForm`) | `PUBLIC_WE_NEWSLETTER_API_URL` |
| `brief-request` | `/briefs/<id>/` for each of the ten briefs in `src/data/families.ts` | Request a gated brief by email | `PUBLIC_WE_INTAKE_API_URL` |
| `investor-interest` | `/investors/interest/` | An investor asks to meet the companies WE incubates | `PUBLIC_WE_INTAKE_API_URL` |
| `partner-enquiry` | `/network/partners/enquire/` | A provider describes what it offers founders | `PUBLIC_WE_INTAKE_API_URL` |

The Team Composer (`/tools/team-composer/`) is not a form that submits anywhere. It builds a summary in the browser and hands it to the Apply form through the URL fragment (section 6).

## 2. Build-time configuration

| Variable | Meaning |
|---|---|
| `PUBLIC_WE_INTAKE_API_URL` | Absolute `https://` URL of the intake endpoint. Baked into the HTML at build. |
| `PUBLIC_WE_NEWSLETTER_API_URL` | Absolute `https://` URL of the newsletter endpoint. When unset the newsletter form is not rendered. |

`src/data/forms.ts` resolves each form to one mode:

| Mode | When | Behaviour |
|---|---|---|
| `endpoint` | the variable is set | The page posts to the endpoint (section 3). |
| `mailto` | no endpoint, and `site.mailboxes.*.confirmed` is `true`, and the form is `apply` or `contact` | The page opens the visitor's mail client with the answers prefilled. No data reaches a server. A brief request, an investor interest and a partner enquiry have no mailbox, so without an endpoint they are `disabled`. |
| `disabled` | neither | The form is shown with its submit control switched off and a plain statement that it is not connected yet. A production build (`PUBLIC_RELEASE=1`) fails while any launched form route is `disabled`. |

## 3. Request

`POST {endpoint}` with `Content-Type: application/json`, no cookies (`credentials: "omit"`), no `Referer` header (`referrerPolicy: "no-referrer"`), 15 second timeout.

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

Every key is always present for the five intake kinds, and a key the kind does not use is an empty string (`consentUpdates` is `false`). The `newsletter` body is the version 1 body: it carries no `requestId`, no `audience` and none of the version 2 keys.

### 3.1 Fields

| Field | Type | Rules |
|---|---|---|
| `form` | `"apply"`, `"contact"`, `"newsletter"`, `"brief-request"`, `"investor-interest"` or `"partner-enquiry"` | Required. |
| `requestId` | UUID v4 string | Required for every kind except `newsletter`. The browser generates it with `crypto.randomUUID()` when the page loads and again after a success. A failed send keeps it, so a retry is the same request. It is the idempotency key. A native no-JavaScript post carries an empty field and the server generates the id. |
| `audience` | `"startup"`, `"investor"`, `"partner"`, `"corporate"` or `""` | Required and fixed by kind. `apply` takes `startup`, `investor-interest` takes `investor`, `partner-enquiry` takes `partner`, `contact` takes any of the four, `brief-request` takes a value from the audience list of that brief in `src/data/families.ts`, `newsletter` is empty. A mismatch is a `422` with a field error on `audience`. |
| `name` | string | Required on the five intake kinds, 1 to 120 characters after trimming. |
| `email` | string | Required, one address, at most 254 characters. |
| `company` | string | At most 120 characters. Required on `partner-enquiry`, optional on the others that carry it. |
| `stage` | `"idea"`, `"validating"`, `"building"`, `"launched"` or `""` | Required on `apply`, optional on `brief-request`, empty elsewhere. |
| `seats` | string | `apply` only, optional, at most 500 characters. Free text from the Team Composer or typed by the visitor. |
| `topic` | `"general"`, `"seat-rate"`, `"press"`, `"correction"`, `"information"` or `""` | Required on `contact`, empty elsewhere. |
| `message` | string | At most 4000 characters. Required on `contact`, optional on `apply`, `investor-interest` and `partner-enquiry`, empty on `brief-request`. On `apply` the script may append one line, `Package interest: <package name>` or `Package interest: not sure yet`, after the visitor's text and a blank line (section 8, "The Apply stepper"). The line counts toward the 4000 characters. |
| `briefId` | slug | Required on `brief-request`, empty elsewhere. Must be one of the ten ids in `src/data/families.ts`. |
| `companyUrl` | https URL, at most 300 characters | Required on `partner-enquiry`, optional on `investor-interest`, empty elsewhere. This is the real organization website. The honeypot stays `website`, so the two never collide. |
| `partnerCategory` | `"tooling-saas"`, `"cloud-credits"`, `"legal"`, `"finance-accounting"`, `"delivery"`, `"ecosystem"` or `"other"` | Required on `partner-enquiry`, empty elsewhere. |
| `offer` | string, at most 1500 | Required on `partner-enquiry`: what the organization provides to founders and on what terms. Empty elsewhere. |
| `investorKind` | `"angel"`, `"fund"`, `"corporate"`, `"family-office"`, `"other"` or `""` | Optional on `investor-interest`, empty elsewhere. WE never asks for accreditation status, amounts, fund size or return targets. |
| `focus` | string, at most 1000 | Optional on `investor-interest`: the sectors and stages the investor wants to see. Empty elsewhere. |
| `consent` | boolean | Must be `true`. The visitor ticks a box that links to the privacy notice. Scope: WE may use these details to answer this request. |
| `consentUpdates` | boolean | Default `false`. `brief-request` only, and only while `flags.briefUpdates` shows the checkbox (the flag is off). Scope: WE may email related briefs and articles. |
| `website` | string | Honeypot. Must be empty. A non-empty value means automation. |
| `startedAt`, `submittedAt` | ISO 8601 UTC strings | Client clock. Informational only; never trust for security. Use `submittedAt - startedAt` as a weak bot signal. |
| `page` | string | Path of the page that sent the form. |

### 3.2 The required matrix

R is required, O is optional, `-` means the field must be empty. A `-` field is never rendered, so a value there means the page was altered and the client reports it instead of sending it. The newsletter needs `email` and `consent` and nothing else.

| Field | apply | contact | brief-request | investor-interest | partner-enquiry |
|---|---|---|---|---|---|
| name, email | R | R | R | R | R |
| company | O | O | O | O | R |
| stage | R | - | O | - | - |
| seats | O | - | - | - | - |
| topic | - | R | - | - | - |
| message | O | R | - | O | O |
| briefId | - | - | R | - | - |
| companyUrl | - | - | - | O | R |
| partnerCategory, offer | - | - | - | - | R |
| investorKind, focus | - | - | - | O | - |
| audience | R | R | R | R | R |
| consent | R | R | R | R | R |
| requestId | R | R | R | R | R |

The same table is committed as `docs/forms-contract.schema.json` and generated from `src/data/forms.ts` (`UPDATE_SCHEMA=1 node --test tests/unit/wp-60/forms-schema.test.ts` rewrites it; the test fails on drift). The intake Function's tests read that JSON, so the browser and the Function cannot disagree about a field.

The server must validate every field again. Client validation is a convenience.

## 4. Response

| Status | Body | Client behaviour |
|---|---|---|
| `200`, `201`, `202`, `204` | empty or `{ "ok": true }` | Success. A form with a thanks route goes there: `apply` to `/apply/thanks/`, `brief-request` to `/briefs/thanks/`, `investor-interest` to `/investors/interest/thanks/`, `partner-enquiry` to `/network/partners/enquire/thanks/`. `contact` and `newsletter` confirm in the page. A thanks page promises no response time and no outcome. A repeated `requestId` answers `200` with the original outcome. |
| `400`, `422` | `{ "ok": false, "errors": { "<field>": "<message>" } }` | The error summary lists the messages, each linked to its field. Unknown field keys are shown in the summary only. |
| `429` | any, with `Retry-After` in whole seconds | "Too many messages were sent from this connection", with the wait in minutes when `Retry-After` is a number of seconds, and a general "wait a few minutes" when it is missing or a date. |
| any other status, network failure, timeout (15 s) | any | Generic failure message, the entered answers stay on the page, and the `mailto:` fallback is offered only when a mailbox is confirmed. |

Response bodies are parsed defensively. A body that is not JSON never breaks the client.

## 5. Server obligations (B-2, owned outside this repository)

1. **CORS.** Answer the `OPTIONS` preflight and the `POST` with `Access-Control-Allow-Origin` set to a single allowed origin from an allowlist: `https://worldenterprise.org` in production and the GitLab Pages preview origin for preview builds. Never `*`. Allow header `Content-Type`. Do not set `Access-Control-Allow-Credentials`.
2. **Origin check.** Reject a request whose `Origin` header is not on the allowlist.
3. **Rate limiting.** 5 per hour per client address and 5 per hour per email address, per kind. Return `429` with `Retry-After`.
4. **Honeypot.** When `website` is non-empty, return `200` and discard the request silently.
5. **Content types.** Accept `application/json`. Also accept `application/x-www-form-urlencoded` with the same field names (`consent` present means true), because the no-JavaScript path is a native form post (section 8). For a form-encoded post, answer `303 See Other` with `Location` set to the kind's thanks page on success. The hidden `redirect` field carries that URL; honour it only when it equals one of the four thanks paths on the server's own allowlist.
6. **No PII in URLs and logs of bodies.** Do not log message bodies. Do not put values in query strings.
7. **No cookies.** The endpoint sets none.
8. **Idempotency.** A `requestId` seen before returns the original outcome with `200` and causes no second write and no second email. A native post with an empty `requestId` gets one generated.
9. **Delivery.** The endpoint forwards each accepted submission to the monitored mailbox or case system the operator names. The operator decides where submissions are stored and for how long (open item OP-RETAIN below).

## 6. Team Composer handoff

The Team Composer links to `/apply/#team=<role>:<count>,<role>:<count>`. Role ids: `product-design`, `front-end`, `back-end`, `qa`, `devops-security`, `brand`, `growth-support`, `operations`, `delivery-lead`. Counts are whole numbers from 1 to 99. The Apply page reads the fragment in the browser and writes a readable sentence into the `seats` field. A fragment is never sent to a server. Without JavaScript the Composer submits a plain `GET` to `/apply/` with `?<role>=<count>` and the Apply page reads the same values from the query string.

## 7. Privacy facts (WP-10 copies these into the privacy notice)

- The site sets no cookies, loads no third-party scripts and runs no analytics (decision D-14).
- Forms collect only the fields in section 3. Nothing is collected until the visitor presses the submit control. No keystrokes are sent while typing.
- Submitted data goes to the intake endpoint, over HTTPS, then to the monitored mailbox or case system the operator names.
- The honeypot and the fill-time check are the only automation controls. There is no CAPTCHA and no third-party bot service.
- The Team Composer keeps nothing: no storage, no cookies, nothing sent anywhere. Its summary exists only in the open page and, if the visitor chooses to continue, in the URL fragment of the link they follow.
- The consent checkbox is required, unticked by default and links to `/legal/privacy/`.

## 8. No-JavaScript behaviour

Every form is a real `<form method="post">`, in every mode, with native `required`, `type="email"` and `maxlength`. A form with no method would submit as a GET query string and put the visitor's name, email and message in the URL, the browser history and the server log, so the method is never omitted.

`planForm` in `src/data/forms.ts` decides what a form permits before JavaScript runs:

| Mode | `action` | Submit button in the markup | Without JavaScript |
|---|---|---|---|
| `endpoint`, intake, `PUBLIC_WE_INTAKE_REQUIRES_JS` unset | the endpoint | enabled | The browser validates natively and posts form-encoded data to the endpoint. This works only when the endpoint implements obligation 5 of section 5. |
| `endpoint`, intake, `PUBLIC_WE_INTAKE_REQUIRES_JS=1` | none | disabled | A note says the form needs JavaScript and names the mailbox if one is confirmed. |
| `endpoint`, newsletter | none | disabled | The same note. The newsletter has no native POST contract and no mailbox. |
| `mailto` | none | disabled | A note says the form cannot prefill an email without JavaScript and names the mailbox. |
| `disabled` | none | disabled | The form states that it is not connected yet. The button stays off. |

The client script (`src/scripts/forms.ts`) removes `disabled` when it mounts, for every mode except `disabled`, after its submit handlers are attached. So the only way to send a form without JavaScript is the native POST to a confirmed https endpoint. `tests/unit/wp-19/forms-plan.test.ts` checks every combination, and the e2e suites check the built pages with JavaScript off (`tests/e2e/forms.spec.ts` for the endpoint build, `tests/e2e/modes.spec.ts` for the default build).

### The Apply stepper (WP-43)

`/apply/` is one server-rendered `<form method="post">` in which every fieldset is in the DOM. Without JavaScript all of them are visible, the stepper bar, the Back and Next buttons and the package select are `hidden`, and the form behaves exactly as the table above says. When `src/scripts/forms.ts` mounts, `src/components/apply/stepper.ts` groups the fieldsets into four steps (About you, About the idea, Team and package, Review), shows a progress list with a live status line, adds Back and Next, validates one step at a time with the same validators, and moves focus to the step heading. A failed submit returns the visitor to the earliest step that holds an error. The stepper mounts in every mode, including `disabled`, where the submit button stays disabled and nothing is sent.

- **The package choice never adds a payload key.** The key set of section 3 is fixed. The package select has no `name`, so a native post cannot carry it, and it is revealed by the script only. The script folds the choice into `message` as the last line, `Package interest: <package name>` (names from `src/data/packages.ts`) or `Package interest: not sure yet`. A server reads it, if it wants it, as free text.
- **`?package=` is read leniently.** `/apply/?package=<id>` preselects one of `spark`, `launch`, `accelerate`, `studio` or `not-sure`. An unknown, empty or repeated value is ignored, and the page opens as usual. The query string is never written back (docs/wave7-contracts.md section 1).
- **Nothing is persisted.** Answers and the current step live in memory only: no `localStorage`, `sessionStorage`, cookie, IndexedDB or history entry. A reload starts the form again.
- **Focus.** Next and Back move focus to the new step heading (`tabindex="-1"`). Pressing Enter in a field on a step other than the last one means Next, not submit. On a phone the progress bar is sticky, and every control carries a `scroll-margin-block-start` larger than the bar, so a focused field is never covered (WCAG 2.2, 2.4.11).
- **Review.** The last step lists the answers with a Change button per group. The consent checkbox sits on that step, so the visitor agrees to the privacy notice only after seeing what is sent.

## 9. Open items for the operator

- **B-2.** Create the endpoint and the mailboxes `apply@` and `hello@`, then set the repository variables and flip `site.mailboxes.*.confirmed` through a change request.
- **OP-RETAIN.** Decide how long submissions are kept and write it into the privacy notice. Nothing in this repository states a retention period.
- **OP-REPLY.** Confirm the reply process described on `/apply/thanks/`: a person at WE reads each application and replies to the address given. No response time is promised on the site.
