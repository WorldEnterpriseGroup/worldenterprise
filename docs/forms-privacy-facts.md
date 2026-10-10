# Forms privacy facts

Status: authored by WP-61. Consumers: `src/content/pages/legal/privacy.md` (the public notice copies these facts), the operator and counsel (OP-COUNSEL), WP-10 and WP-61 pins (`tests/unit/wp-10/truth.test.ts`, `tests/unit/wp-61/privacy.test.ts`).

This replaces section 7 of `docs/forms-contract.md` for the six-form intake service. It describes what `infra/intake` does as built. If the service changes, this file and the notice change in the same merge request. It states no retention period, because the operator has not supplied one (OP-RETAIN).

## What each form sends

One endpoint (`POST https://intake.worldenterprise.org/api/intake`, alias `/api/newsletter` for the newsletter form) takes six forms. `docs/forms-contract.schema.json` is the machine-readable statement of which field each form requires, allows or forbids; the service loads it, so the browser and the service cannot drift. The notice names every field of every form. Fields beyond the matrix that every form carries: `form`, `audience`, `consent`, `consentUpdates` (brief request only, and only when the flag offers it), `website` (the spam trap), `startedAt`, `submittedAt`, `page`, and, on a native post without JavaScript, `redirect`.

| Form | Fields it collects |
|---|---|
| Apply | `requestId`, `audience`, `name`, `email`, `company`, `stage`, `seats`, `message`, `consent` |
| Contact | `requestId`, `audience`, `name`, `email`, `company`, `topic`, `message`, `consent` |
| Request a brief | `requestId`, `audience`, `name`, `email`, `company`, `stage`, `briefId`, `consent`, `consentUpdates` |
| Investor interest | `requestId`, `audience`, `name`, `email`, `company`, `companyUrl`, `investorKind`, `focus`, `message`, `consent` |
| Partner enquiry | `requestId`, `audience`, `name`, `email`, `company`, `companyUrl`, `partnerCategory`, `offer`, `message`, `consent` |
| Newsletter | `email`, `consent` |

The investor form never asks whether the visitor is accredited, how much they invest or how large a fund is. Nothing is collected until the submit control is pressed. No keystrokes are sent while typing.

## What the service stores

- **Where.** One `we_engagement` row per submission in WE's Dataverse environment (Dynamics 365), written before the service answers. The row holds the form fields above, the time of consent, the source page, a status (`received`, `delivered`, `delivery-failed`, `unsubscribed`), the delivery attempt count and times, the brief version sent, and a review flag for an ambiguous contact match.
- **Who.** A contact row for the person and, for a business email domain, an Account row for the organization; for a consumer email domain the Account is the person. Matching is by normalized email, never by name.
- **What it does not store.** The client network address. Raw tokens. The browser's user agent.
- **Unsubscribe token.** A random token goes into each email link. The row keeps an AES-256-GCM ciphertext of it and a hash for lookup, so the link can be rebuilt and verified without a usable token at rest. The encryption key is the Key Vault secret `worldenterprise-intake-unsubscribe-key` (name only, never a value in Git); the optional webhook signature uses `worldenterprise-intake-hmac-secret`.
- **Suppression.** An unsubscribe writes a suppression record keyed by a hash of the address. A suppressed address receives no later email from the service, and the matching contact is marked do-not-bulk-email in Dataverse.
- **Briefs.** Rendered briefs sit in a private blob container. The service mints a 48-hour read-only link for the requester. The link is never logged.

## Email

- Sent through Azure Communication Services Email from the sender address the operator provides (OP-MAIL). Open and click tracking is off.
- A brief the visitor asked for is a transactional email. It carries an unsubscribe link and RFC 8058 one-click headers.
- The unsubscribe link opens a confirmation page and changes nothing on GET. Only the page's POST unsubscribes, so a mail scanner that fetches links cannot unsubscribe anyone.
- A failed send leaves the row `delivery-failed`, raises an alert, and is retried by a timer. The site never promises a delivery time.
- The nurture sequence (day 3, 10 and 21) exists in code and is off. `NURTURE_ENABLED` stays `false` until the notice states the retention period and counsel has reviewed the sequence (OP-RETAIN, OP-COUNSEL).

## Logs

A log line carries an event name, the request id, the form, the status and a short hash of the client address. It never carries a body, an email address, a name, a token, a SAS link or a header. A test captures every log line over the whole request surface and fails if any such value appears. Rate-limit counters are keyed by hashes of the address and the email, and the storage lifecycle deletes them within a day.

## Retention

No period is stated anywhere in this repository. The notice says so. OP-RETAIN: the operator decides how long engagement rows, suppression records and brief links are kept and supplies the wording; until then the wp-10 pin that forbids a stated period stays, and `NURTURE_ENABLED` stays `false`.

## Third parties

Microsoft (Azure Functions, Storage, Communication Services, Dataverse) processes the data on WE's behalf. GitHub Pages hosts the static site and receives ordinary request data; WE receives none of it. There are no analytics, no advertising or tracking scripts, no cookies, no CAPTCHA and no third-party bot service.

## Open items

- **OP-RETAIN.** Retention period and its wording.
- **OP-COUNSEL.** Counsel review of the notice, the unsubscribe flow and the nurture sequence before any flag that sends marketing email is turned on.
- **OP-FLAGS.** `flags.briefUpdates` (the second consent box) and `NURTURE_ENABLED` remain off until the two items above are closed.
