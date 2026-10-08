---
title: "Support at five customers, not fifty"
seoTitle: Support at five customers
description: "How to run customer support with a handful of customers: one inbox, a written log, and a weekly review that turns each question into a product decision."
topic: grow
publishedDate: 2026-10-06
noStatistics: true
sources:
  - id: govuk-user-support
    title: Helping people to use your service
    publisher: GOV.UK Service Manual, Government Digital Service
    url: https://www.gov.uk/service-manual/helping-people-to-use-your-service
    accessed: 2026-10-06
  - id: pg-ds
    title: Do Things that Don't Scale
    publisher: Paul Graham
    url: https://paulgraham.com/ds.html
    accessed: 2026-10-06
evidence: [govuk-user-support, pg-ds]
relatedServices: [C, D]
relatedPlaybook: earn-your-first-customers
relatedTemplate: customer-interview-guide
---

With five customers, support is not a function. It is a conversation, and it is one of the best sources of product insight you will ever have. With fifty customers it starts to need a system. This article is about the first stage: how to handle support when the whole customer base fits in your head, what to record so that you are ready for the next stage and what not to build yet.

## Treat support as research, not overhead

Every question a customer sends you is evidence that something in your product, documentation or onboarding did not do its job. At five customers you can read each one with attention. Paul Graham's essay on doing things that do not scale argues that the personal attention small companies can give early users is an advantage large companies cannot match. Support is the most direct way to use it.

That does not mean answering instantly at all hours. It means answering well, and keeping a record so that a pattern is visible when it appears.

## The minimum setup

You do not need a help desk platform with queues and macros. You need three things.

### One place where requests arrive

Pick a single address or form for support and send everything there. If customers can reach you by email, chat, direct message and phone, you will lose requests between them. Tell customers the one place, and when someone uses another channel, copy the request into the main one.

Use a shared mailbox, not a personal inbox, so that more than one person can read it when the team grows or when you are away.

### A written log

Keep a simple table, in a spreadsheet or a shared document, with one row per request. The columns below are enough.

| Column | What to record |
|---|---|
| Date received | When the request arrived |
| Customer | Who sent it |
| Type | Question, bug, request, billing, other |
| What they were trying to do | In their words, not yours |
| Cause | Product, documentation, onboarding, customer environment, unknown |
| Response | What you did and when |
| Follow-up | A change made to the product or docs, if any |

"What they were trying to do" is the column most teams skip and the one that matters most. A bug report says what broke. The goal tells you what the customer needs.

### A promise you can keep

Decide how quickly you will respond and say so. The UK Government Digital Service's service manual, in its guidance on helping people use a service, covers managing user support in terms of estimating demand, setting target levels and measuring performance. At five customers you do not need a formal model, but you do need the same discipline in miniature: choose a response expectation you can meet, such as "within one working day", state it in your onboarding message and measure whether you met it.

A modest promise that you keep is better than a fast one you break.

## How to respond well

Answer the question that was asked, then check the goal behind it. If a customer asks how to export a report, answer, and then ask what they plan to do with the export. The reply may reveal a missing feature or a better way to meet their need.

Write in plain language. Avoid the shorthand of your own product. Name the screen and the button, and when it helps, include a short screen recording or screenshot.

When the answer is "that is a bug", say so, say what you will do and tell the customer when it is fixed. Customers forgive defects more readily than silence.

When the answer is "the product does not do that", say so as well. Offer a workaround if there is one and record the request. Do not promise a feature to keep a customer happy. A promise you do not keep is worse than a clear no.

## Turn the log into decisions every week

Once a week, read the log from start to finish. This takes a short time at five customers and keeps you close to the product. Ask four questions.

1. **What did customers try to do that took them more than one message to resolve?** Those are candidates for a product or documentation fix.
2. **Which causes repeat?** Two requests with the same cause in a week deserve a change. A single request deserves a note.
3. **What did we explain more than once?** Turn the explanation into a help article, an inline hint or a better label.
4. **What did we promise?** Check that each promise has an owner and a date.

Write down one change you will make this week as a result. A log that never produces a change is a diary.

## What not to build yet

Resist the pull of tooling that fits a different size of company.

- **Do not build a knowledge base with fifty articles.** Write the three articles that answer the three questions you have actually had. Add more when the log shows a repeated question.
- **Do not buy a platform for automated routing.** With five customers, you are the router.
- **Do not set up a chatbot to deflect questions.** You would be removing the conversations that teach you the most, and an automated reply cannot yet know what your product does badly.
- **Do not measure satisfaction scores.** The sample is too small for a score to mean anything. Read the messages instead.

## Signs it is time for a system

Support starts to need more structure when you notice any of these:

- You can no longer remember the last conversation with each customer.
- Requests sit unanswered because nobody knows whose turn it is.
- The same question arrives from different customers within a few days, and the answer is not written anywhere.
- You are afraid to take a day off.

When two or more of these apply, introduce an owner for each request, a status for each row in the log and a short internal rule for who covers when you are away. Move to a help desk tool only when the spreadsheet is the bottleneck. By then you will know what you need from one, because the log will show you.

## Be clear about security and privacy in support

Support messages often contain personal data, account details and sometimes screenshots with confidential information. Even at five customers, set simple rules. Ask customers not to send passwords or secret keys. Do not paste customer data into public tools. Limit who can read the support mailbox. Where your product handles customers' personal data, check your own obligations with your counsel; this article is not legal advice.

## What this article does not know

We have not given response-time targets or staffing ratios, since they depend on your product, your customers' needs and your market, and we have no public primary source that would apply generally. The point is narrower: while the customer base is small, keep support personal, write everything down and use the writing to improve the product. The habits you build at five customers are the ones that make fifty manageable.
