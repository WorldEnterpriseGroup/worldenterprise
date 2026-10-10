---
title: Privacy notice
description: "What World Enterprise Incubator collects through its six forms, how records and emailed briefs work, and what the site does not do: no cookies, no analytics."
eyebrow: Legal
hero: H5
updated: 2026-10-10
claimsUsed: [C-01, C-18]
---

This notice describes what happens to information when you use worldenterprise.org. World Enterprise Group Incorporated ("WE"), a company registered in Delaware, is responsible for the information you send through this site.

## Browsing the site

This site sets no cookies. It loads no third-party scripts, no analytics, no advertising or tracking pixels and no fonts or images from other companies. The website itself keeps no record of your visits.

The site is hosted by GitHub Pages. Like any web host, GitHub receives technical data about each request, such as your network address and browser details, and handles it under its own terms and privacy statement. WE does not receive that data from GitHub.

## What a form collects

Nothing is collected until you press the submit button of a form. Nothing is sent while you type. The site has six forms: Apply, Contact, Request a brief, Investor interest, Partner enquiry and, where it is switched on, the newsletter form. A form sends only the fields below.

| Field | Sent as | Which forms | Why |
|---|---|---|---|
| Which form it is | `form` | all | So WE can route the message |
| A random request number | `requestId` | all except the newsletter | Your browser makes it when the page loads, so a repeated press of the button is recognized and handled once |
| Who you are writing as: startup, investor or partner | `audience` | Apply, Contact, Request a brief, Investor interest, Partner enquiry | So WE can route the message |
| Your name | `name` | all except the newsletter | To address you |
| Your email address | `email` | all | To reply to you, to send a brief you asked for, or to send the newsletter |
| Company or working name | `company` | Apply, Contact, Request a brief, Investor interest, Partner enquiry | Required for Partner enquiry, optional elsewhere |
| Website of your organization | `companyUrl` | Investor interest (optional), Partner enquiry | To see who the organization is |
| Stage of your idea | `stage` | Apply, Request a brief (optional) | To understand where you are |
| Team seats of interest | `seats` | Apply | Optional text, filled by the Team Composer if you use it |
| Topic | `topic` | Contact | To route the message |
| Your message | `message` | Apply (optional), Contact, Investor interest (optional), Partner enquiry (optional) | The substance of what you want to say. On Apply it can end with a line naming the package you were looking at |
| Which brief | `briefId` | Request a brief | To know which brief to send |
| Partner category | `partnerCategory` | Partner enquiry | To route the enquiry |
| What the organization offers founders | `offer` | Partner enquiry | The substance of the enquiry |
| How you describe yourself as an investor | `investorKind` | Investor interest (optional) | Angel, fund, corporate, family office or other. WE does not ask whether you are accredited, how much you invest, or how large your fund is |
| Sectors and stages you want to see | `focus` | Investor interest (optional) | The substance of your interest |
| Your consent | `consent` | all | You tick a box that links to this notice |
| Your consent to related emails | `consentUpdates` | Request a brief, only when WE offers it | A second box, unticked by default, for related briefs and articles |
| Hidden spam trap | `website` | all | A field people leave empty; automated senders fill it |
| Time you started and sent | `startedAt`, `submittedAt` | all | A weak signal to spot automated senders |
| Page it was sent from | `page` | all | So WE knows which form it was |
| Where to go afterward | `redirect` | all, only when you send a form without JavaScript | A hidden address on this site, which the service follows only if it is on its own list |

The newsletter form uses only `email`, `consent`, the spam trap, the two times and the page.

## Where it goes

A form posts your answers over an encrypted connection to an intake service at intake.worldenterprise.org, which is separate from this website. The form sends no cookies and does not tell the service which page you came from beyond the `page` field above. Where the intake service is not yet connected, the form says so and sends nothing.

The service writes each submission to WE's customer relationship management system, which is Microsoft Dataverse, part of Dynamics 365. The service validates what you sent and saves it there before it answers you. For each submission the system holds the fields in the table above, a contact record for you and, where you give a company or a business email address, an organization record. It also holds the time you consented, the page you sent it from, the status of any email WE sent you, the number of attempts to send it and, for a brief, which version was sent. It does not hold your network address.

WE uses what you send to answer you, to consider your application, to send a brief you asked for, to send you the newsletter if you asked for it, and to keep a record of the conversation. WE does not sell it and does not pass it to advertisers.

## Briefs sent by email

When you request a brief, the service emails you a link to it. The email is sent through Azure Communication Services. The brief is stored in a private location, the link is made for you and stops working after 48 hours, and the email says how to ask for the brief again. A brief you ask for is sent because you asked for it. Every email from the service carries an unsubscribe link.

The unsubscribe link opens a page that asks you to confirm. Opening the link does nothing by itself, so a mail program that scans links cannot unsubscribe you by accident. When you confirm, WE records that you unsubscribed and stops emailing that address from this service. The link carries a random token and no personal information. WE keeps an encrypted copy of that token with your record so it can check the link later.

## Protection against abuse

The spam trap and the time check are the controls used against automated senders. There is no CAPTCHA and no third-party bot-detection service.

The service also limits how often one address and one email can send the same form. For that it keeps a one-way scrambled form of the network address and of the email, never the originals, and it discards it shortly afterward.

The service's own logs record only the request number, the form, the result and the scrambled network address. They never contain your message, your email address, or the link sent to you.

## The Team Composer

The Team Composer runs in your browser. It stores nothing, sets no cookies and sends nothing. If you choose to continue to the Apply form, the roles you picked travel in the link you follow, in the part after the hash sign, which your browser does not send to any server.

## How long WE keeps it

WE has not yet set a period for how long it keeps what the service records. Until it does, the records stay in the customer relationship management system so that WE can answer you and keep a record of the conversation. When WE sets a period, this notice names it before the period takes effect.

## Your choices

You can ask what WE holds about you, ask for it to be corrected, or ask for it to be deleted. Use the contact page and choose the topic about how WE handles information. You can unsubscribe from emails at any time with the link in each one.

## Links to other sites

Some pages link to other websites, for example public standards and the WE organization on GitHub. Those sites have their own practices, and this notice does not cover them.

## Changes to this notice

If the site changes what it collects, this notice changes first and its date at the top is updated.
