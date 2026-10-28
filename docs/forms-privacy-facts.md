# Forms privacy facts

Status: rewritten 2026-10-28 for the FormSubmit decision (RELEASE.md section 5). Consumers: `src/content/pages/legal/privacy.md` (the public notice copies these facts), the operator and counsel (OP-COUNSEL), WP-10 and WP-61 pins (`tests/unit/wp-10/truth.test.ts`, `tests/unit/wp-61/privacy.test.ts`).

This describes what the forms do as built. If they change, this file and the notice change in the same merge request. It states no retention period, because the operator has not supplied one (OP-RETAIN).

The Azure intake service in `infra/intake` (Function, Dataverse, Azure Communication Services, brief links, unsubscribe pages) is not used by the release. Nothing in the release posts to it. Its facts are kept in `docs/forms-contract.md` and `docs/intake-runbook.md` only as the description of an unused alternative, and they are not true of the site.

## What each form sends

Every form posts to FormSubmit (`https://formsubmit.co/info@worldenterprise.org`; with JavaScript through its `/ajax/` door as JSON, without JavaScript as a plain form post), and FormSubmit emails the submission to the shared mailbox info@worldenterprise.org. The notice names every field of every form. Fields beyond the field table that a form carries: `form`, `audience`, `consent`, `consentUpdates` (brief request only, and only when the flag offers it), `page` (with JavaScript only), and the FormSubmit controls `_subject`, `_template`, `_captcha`, `_honey` (the spam trap) and, on a native post to a form that has a thanks page, `_next`. The request id, the two client clocks and the old `website` spam trap and `redirect` field of the JSON contract are not sent.

| Form | Fields it collects |
|---|---|
| Apply | `audience`, `name`, `email`, `company`, `stage`, `seats`, `message`, `consent` |
| Contact | `audience`, `name`, `email`, `company`, `topic`, `message`, `consent` |
| Request a brief | `audience`, `name`, `email`, `company`, `stage`, `briefId`, `consent`, `consentUpdates` |
| Investor interest | `audience`, `name`, `email`, `company`, `companyUrl`, `investorKind`, `focus`, `message`, `consent` |
| Partner enquiry | `audience`, `name`, `email`, `company`, `companyUrl`, `partnerCategory`, `offer`, `message`, `consent` |
| Newsletter | `email`, `consent` |

The investor form never asks whether the visitor is accredited, how much they invest or how large a fund is. Nothing is collected until the submit control is pressed. No keystrokes are sent while typing.

## What the service stores

- **WE stores no database record.** Each submission is one email in the shared mailbox. There is no customer relationship management system, no contact or organization record and no status field.
- **FormSubmit** receives the submission and the visitor's network address and browser details as any server does, and handles them under its own terms and privacy policy. WE does not control its retention. The first submission to a new address needs one activation click by the mailbox owner.
- **Aliases.** hello@, apply@ and security@worldenterprise.org are aliases of info@worldenterprise.org (confirmed by the owner 2026-10-28), so mail to any of them arrives in the same mailbox.
- **No cookies** are set by the site, and the form sends none.

## Email

- WE sends no automatic email. A person at WE answers each message, sends a requested brief by email to the address given, and writes the newsletter from the shared mailbox.
- The site promises no delivery time for a brief or an answer.
- There is no unsubscribe link and no suppression record, because there is no automatic sending. A visitor who asks to stop receives no further email from WE.

## Logs

The site keeps no logs of form use. GitHub Pages and FormSubmit keep their own, as described in the notice.

## Retention

No period is stated anywhere in this repository. The notice says so. OP-RETAIN: the operator decides how long the emails are kept in the mailbox and supplies the wording; until then the wp-10 pin that forbids a stated period stays.

## Third parties

FormSubmit (formsubmit.co) forwards each submission to the mailbox. GitHub Pages hosts the static site and receives ordinary request data; WE receives none of it. There are no analytics, no advertising or tracking scripts, no cookies, no CAPTCHA and no bot-detection service run by WE.

## Open items

- **OP-RETAIN.** Retention period and its wording.
- **OP-COUNSEL.** Counsel review of the notice, in particular its naming of FormSubmit as the forwarding service.
- **OP-FLAGS.** `flags.briefUpdates` (the second consent box) remains off until the two items above are closed.
