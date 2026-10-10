# Forms contract

Status: authored by WP-03. Consumers: WP-10 (privacy notice must match section 7), the backend owner (B-2), WP-14 (tests), WP-30 (release).

This site is static (GitHub Pages). It runs no server code. Every form submits to an external intake endpoint that is owned and operated outside this repository. This document is the interface between the two.

## 1. Forms in scope

| Form id | Route | Purpose | Uses endpoint |
|---|---|---|---|
| `apply` | `/apply/` | Application to the incubator | `PUBLIC_WE_INTAKE_API_URL` |
| `contact` | `/contact/` | General contact, seat rate requests, press, corrections, questions about information handling | `PUBLIC_WE_INTAKE_API_URL` |
| `newsletter` | `/newsletter/` and footer | Email subscription (WP-08, WP-03 ships `NewsletterForm`) | `PUBLIC_WE_NEWSLETTER_API_URL` |

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
| `mailto` | no endpoint, and `site.mailboxes.*.confirmed` is `true` | The page opens the visitor's mail client with the answers prefilled. No data reaches a server. |
| `disabled` | neither | The form is shown with its submit control switched off and a plain statement that it is not connected yet. A production build (`PUBLIC_RELEASE=1`) fails while any launched form route is `disabled`. |

## 3. Request

`POST {endpoint}` with `Content-Type: application/json`, no cookies (`credentials: "omit"`), no `Referer` header (`referrerPolicy: "no-referrer"`).

```json
{
  "form": "apply",
  "name": "Ada Example",
  "email": "ada@example.org",
  "company": "Working name or company",
  "stage": "validating",
  "seats": "Product design x1; Back end x2",
  "topic": "",
  "message": "Free text.",
  "consent": true,
  "website": "",
  "startedAt": "2026-10-06T14:00:00.000Z",
  "submittedAt": "2026-10-06T14:02:41.000Z",
  "page": "/apply/"
}
```

| Field | Type | Forms | Rules |
|---|---|---|---|
| `form` | `"apply"`, `"contact"` or `"newsletter"` | all | Required. Newsletter fills only `email`, `consent`, `website`, `startedAt`, `submittedAt` and `page`; other fields are empty strings. |
| `name` | string | both | Required, 1 to 120 characters after trimming. |
| `email` | string | both | Required, one address, at most 254 characters. |
| `company` | string | both | Optional, at most 120 characters. |
| `stage` | `"idea"`, `"validating"`, `"building"`, `"launched"` or `""` | apply | Required on apply, empty on contact. |
| `seats` | string | apply | Optional, at most 500 characters. Free text produced by the Team Composer or typed by the visitor. |
| `topic` | `"general"`, `"seat-rate"`, `"press"`, `"correction"`, `"information"` or `""` | contact | Required on contact, empty on apply. |
| `message` | string | both | Required on contact, optional on apply, at most 4000 characters. On apply the script may append one line, `Package interest: <package name>` or `Package interest: not sure yet`, after the visitor's text and a blank line (section 8, "The Apply stepper"). The line counts toward the 4000 characters. |
| `consent` | boolean | both | Must be `true`. The visitor ticks a box that links to the privacy notice. |
| `website` | string | both | Honeypot. Must be empty. A non-empty value means automation. |
| `startedAt`, `submittedAt` | ISO 8601 UTC strings | both | Client clock. Informational only; never trust for security. Use `submittedAt - startedAt` as a weak bot signal. |
| `page` | string | both | Path of the page that sent the form. |

The server must validate every field again. Client validation is a convenience.

## 4. Response

| Status | Body | Client behaviour |
|---|---|---|
| `200`, `201`, `202`, `204` | empty or `{ "ok": true }` | Success. Apply redirects to `/apply/thanks/`. Contact shows an in-page confirmation. |
| `400`, `422` | `{ "ok": false, "errors": { "<field>": "<message>" } }` | The error summary lists the messages, each linked to its field. Unknown field keys are shown in the summary only. |
| `429` | any | Generic "too many requests, try again later" message. |
| any other status, network failure, timeout (15 s) | any | Generic failure message, the entered answers stay on the page, and the `mailto:` fallback is offered only when a mailbox is confirmed. |

Response bodies are parsed defensively. A body that is not JSON never breaks the client.

## 5. Server obligations (B-2, owned outside this repository)

1. **CORS.** Answer the `OPTIONS` preflight and the `POST` with `Access-Control-Allow-Origin` set to a single allowed origin from an allowlist: `https://worldenterprise.org` in production and the GitLab Pages preview origin for preview builds. Never `*`. Allow header `Content-Type`. Do not set `Access-Control-Allow-Credentials`.
2. **Origin check.** Reject a request whose `Origin` header is not on the allowlist.
3. **Rate limiting.** Per client address and per email address. Return `429`.
4. **Honeypot.** When `website` is non-empty, return `200` and discard the request silently.
5. **Content types.** Accept `application/json`. Also accept `application/x-www-form-urlencoded` with the same field names (`consent` present means true), because the no-JavaScript path is a native form post (section 8). For a form-encoded post, answer `303 See Other` with `Location: https://worldenterprise.org/apply/thanks/` on success. The hidden `redirect` field carries that URL; honour it only when it is on the server's own allowlist.
6. **No PII in URLs and logs of bodies.** Do not log message bodies. Do not put values in query strings.
7. **No cookies.** The endpoint sets none.
8. **Delivery.** The endpoint forwards each accepted submission to the monitored mailbox or case system the operator names. The operator decides where submissions are stored and for how long (open item OP-RETAIN below).

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

- **The package choice never adds a payload key.** The intake schema in section 3 is closed. The package select has no `name`, so a native post cannot carry it, and it is revealed by the script only. The script folds the choice into `message` as the last line, `Package interest: <package name>` (names from `src/data/packages.ts`) or `Package interest: not sure yet`. A server reads it, if it wants it, as free text.
- **`?package=` is read leniently.** `/apply/?package=<id>` preselects one of `spark`, `launch`, `accelerate`, `studio` or `not-sure`. An unknown, empty or repeated value is ignored, and the page opens as usual. The query string is never written back (docs/wave7-contracts.md section 1).
- **Nothing is persisted.** Answers and the current step live in memory only: no `localStorage`, `sessionStorage`, cookie, IndexedDB or history entry. A reload starts the form again.
- **Focus.** Next and Back move focus to the new step heading (`tabindex="-1"`). Pressing Enter in a field on a step other than the last one means Next, not submit. On a phone the progress bar is sticky, and every control carries a `scroll-margin-block-start` larger than the bar, so a focused field is never covered (WCAG 2.2, 2.4.11).
- **Review.** The last step lists the answers with a Change button per group. The consent checkbox sits on that step, so the visitor agrees to the privacy notice only after seeing what is sent.

## 9. Open items for the operator

- **B-2.** Create the endpoint and the mailboxes `apply@` and `hello@`, then set the repository variables and flip `site.mailboxes.*.confirmed` through a change request.
- **OP-RETAIN.** Decide how long submissions are kept and write it into the privacy notice. Nothing in this repository states a retention period.
- **OP-REPLY.** Confirm the reply process described on `/apply/thanks/`: a person at WE reads each application and replies to the address given. No response time is promised on the site.
