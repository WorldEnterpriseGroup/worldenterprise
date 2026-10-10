---
title: "Pricing a first SaaS: value, packaging and the questions to ask"
seoTitle: Pricing a first SaaS
description: "How to find where value sits in a first SaaS, package it into plans, and which questions to put to customers, billing platforms and advisors."
topic: gtm
publishedDate: 2026-10-10
noStatistics: true
segments: [technical-founders, first-time-founders]
related: [founder-led-sales-calls-a-structure, trials-demos-and-self-serve-how-a-customer-first-meets-the-product]
sources:
  - id: stripe-pricing-models
    title: Recurring pricing models
    publisher: Stripe Documentation
    url: https://docs.stripe.com/products-prices/pricing-models
    accessed: 2026-10-10
  - id: microsoft-plan-saas-offer
    title: Plan a SaaS offer for Microsoft Marketplace
    publisher: Microsoft Learn, Partner Center documentation
    url: https://learn.microsoft.com/en-us/partner-center/marketplace-offers/plan-saas-offer
    accessed: 2026-10-10
evidence: [stripe-pricing-models, microsoft-plan-saas-offer]
relatedServices: [C]
relatedPlaybook: earn-your-first-customers
claimsUsed: []
draft: false
---

Most technical founders price a first product by looking at what similar products charge and picking something slightly lower. That tells you where a competitor stands. It tells you nothing about what your own product is worth to a buyer, and it makes the price a guess that you defend. This article offers a different order of work: first work out where the value is, then package it into something a buyer can compare, then put the open questions to the people who can answer them. It contains no prices and no percentages, and it is not advice about what to charge.

It is a companion to the existing article on [pricing page fundamentals](/insights/pricing-page-fundamentals-for-a-first-saas/), which covers the page itself. This one covers the thinking that comes before it.

## Value comes before price

Value, for pricing purposes, is the difference a buyer sees between their situation with and without the product. You can only get that difference from the buyer, in their words, so the work begins in conversations and not in a spreadsheet. The question list in the [sales call structure article](/insights/founder-led-sales-calls-a-structure/) includes prompts about the current habit and what it costs the buyer. Your notes from those calls are the raw material here.

From the notes, build a short table for each type of buyer you have spoken to:

| Question | What to write |
|---|---|
| Who feels the problem? | A role, not a company |
| What happens when it goes wrong? | Their description, in their terms |
| Who approves spending on it? | A role, and any process they mentioned |
| What do they use today, and what do they pay for it? | The habit or tool, and whether it has a cost they can name |
| What would change for them if the problem went away? | In their words |

If most rows are empty for a buyer type, the gap is in your research, not in your price. Return to interviews. The [positioning statement](/insights/a-one-page-positioning-statement/) article explains how to keep those answers in one place.

## Find the unit that grows with value

A pricing unit is the thing you count when you charge. Stripe's documentation lists four recurring models: it describes flat rate as customers choosing "a service tier" and paying "a flat rate for it", per-seat as "Each pricing unit represents one user.", tiered as pricing where "The unit cost changes with quantity (volume-based pricing) or usage (graduated pricing).", and usage-based as "Charge customers based on their usage of your product or service." The page is vendor documentation for Stripe's own products, so it describes how those models are built on that platform, not which one is right for you.

A useful test is to ask, for each candidate unit, whether the buyer would agree that more of it means more value to them. Users, projects, records, messages and API calls are all possible units. Check each one against the interview notes:

- Does the buyer already count it? A unit the buyer tracks is easier to explain.
- Does it grow when the buyer gets more value, or only when they do more work?
- Can you measure it reliably, and can the buyer verify your count?
- Could the buyer avoid paying by changing behavior in a way that does not reduce the value they get?

The last question is easy to forget. A unit that can be gamed without reducing value, such as sharing a login across a team, will turn pricing into an argument.

## Package for the decision, not for the feature list

Packaging is how you group what you offer into plans. The purpose of a plan is to make one buyer's choice easy, so each plan should map to a type of buyer from your table above. Three questions help:

1. **What separates one buyer type from another?** A single user and a team of ten do not need the same thing. The difference between plans should be something a buyer in the lower plan can see and understand why they would want.
2. **What belongs in every plan?** Anything a buyer needs to get the first result should be in all of them. A plan that cannot deliver the core outcome frustrates the buyer and teaches you nothing.
3. **What would you have to support differently?** Support, security reviews and custom integrations cost you time. A plan boundary is a natural place to mark that.

Keep the number of plans small enough that you can describe each one in a sentence. Plans you cannot describe will confuse buyers and will confuse you when you read the notes later.

### Platforms may constrain the choices

Where you sell can limit how you package. The Microsoft Marketplace documentation for SaaS publishers is an example. It says: "SaaS offers can use one of two pricing models with each plan". It also says "All plans in the same offer must use the same pricing model." Those are rules of one platform, quoted here as an illustration of a general point: before you finalize plans, read the billing documentation of every channel you intend to sell through, because the model you choose may be fixed once an offer is live. The same page states: "After you publish your offer, you can't change the pricing model." Check the current version of any platform's rules, because they are documents that their publishers can revise. Marketplaces as a channel are covered in a separate article on [marketplaces and partner channels](/insights/marketplaces-and-partner-channels-when-a-listing-helps/).

## Questions to ask, and of whom

**Of customers.** Ask what they pay for the current approach and who approves it. Ask what would make the purchase easy to approve, for example a monthly or annual arrangement, an invoice, or a trial. Ask what they would compare you with. Avoid asking "how much would you pay?", which invites a guess. A better version is "what do you pay for this today, and who signed off?"

**Of yourself.** What does it cost you to serve one more customer? What support will each plan need? What is the smallest arrangement that still covers the cost of keeping the product running? Those are arithmetic questions about your own numbers, and no outside source can answer them.

**Of the billing platform.** Which pricing models does it support? Can a customer change plans, and what happens to billing when they do? How are trial periods represented? The details change from platform to platform, so read the current documentation instead of relying on a summary. How a trial is structured is covered in the article on [trials, demos and self-serve](/insights/trials-demos-and-self-serve-how-a-customer-first-meets-the-product/).

**Of an accountant and a lawyer.** Questions about taxes on software sales, invoicing rules in the countries where your customers are, subscription terms, refunds and cancellation, and what your agreement should say are professional questions. This article takes no position on them. They belong with a qualified advisor who knows where you and your buyers are.

## Treat the first price as a hypothesis

Whatever you choose, write down why. A line in a notes file is enough: "Unit is X because buyers said Y; plan boundary is Z because of W." When customers respond, you can compare what happened with what you expected and change the right thing. If you later change the price or the plans, decide beforehand how existing customers will be told, because a change they learn about from an invoice is a different experience from one they were told about.

Keep a record of every pricing conversation: what was proposed, what the buyer said, and why. After a handful, read the log for patterns. A buyer type that always asks the same question is telling you something about the packaging. A buyer type that always asks for something you do not offer is telling you about a gap. The [glossary](/glossary/) explains terms such as ARR and churn that show up in later conversations with investors and advisors, and the [metrics calculator](/tools/metrics-calculator/) lets you work with your own figures once you have them.

## What this article cannot tell you

This article cannot tell you what to charge, which pricing model suits your product, how a given buyer will react, or what any competitor's price should mean for yours. It gives no price points or percentages because none from outside your own market would apply. The model descriptions come from two vendors' documentation, read on 2026-10-10, and describe those vendors' products as they stood on that date. The five-row value table, the packaging questions and the questions by audience are an editorial method, not a framework from a source. Tax, invoicing, contract and consumer-law questions depend on where you and your customers are, so take them to a qualified professional. This is general information as of 2026-10-10, not legal or financial advice. Nothing here is a forecast of sales or revenue.
