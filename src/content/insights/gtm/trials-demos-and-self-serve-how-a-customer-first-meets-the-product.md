---
title: "Trials, demos and self-serve: how a customer first meets the product"
seoTitle: "Trials, demos and self-serve: first contact"
description: "The mechanics of demos, pilots, trials and self-serve, what each asks you to build, and what a U.S. statute says about recurring online charges."
topic: gtm
publishedDate: 2026-10-10
noStatistics: true
segments: [technical-founders, solo-founders]
related: [pricing-a-first-saas-value-packaging-and-the-questions-to-ask, writing-a-landing-page-that-says-what-the-product-does]
sources:
  - id: stripe-trials
    title: Configure trial offers on subscriptions
    publisher: Stripe Documentation
    url: https://docs.stripe.com/billing/subscriptions/trials
    accessed: 2026-10-10
  - id: microsoft-plan-saas-offer
    title: Plan a SaaS offer for Microsoft Marketplace
    publisher: Microsoft Learn, Partner Center documentation
    url: https://learn.microsoft.com/en-us/partner-center/marketplace-offers/plan-saas-offer
    accessed: 2026-10-10
  - id: cornell-15-usc-8403
    title: "15 U.S. Code 8403 - Negative option marketing on the Internet"
    publisher: Legal Information Institute, Cornell Law School
    url: https://www.law.cornell.edu/uscode/text/15/8403
    accessed: 2026-10-10
evidence: [stripe-trials, microsoft-plan-saas-offer, cornell-15-usc-8403]
claimsUsed: []
draft: false
---

Before a buyer pays, they meet the product somehow. A person from your side may walk them through it, they may use it for a set period, or they may sign up and use it alone. Each of those is a design decision with consequences for what you build, what you can learn and what rules apply. Founders who write their own software often choose by instinct, usually the option that is cheapest to build. This article lays out the four common ways, the mechanics each one needs, and the questions to answer before choosing. It does not recommend one, and the terms "free trial" and "freemium" appear only as names of pricing models in general.

## Four doors

| Door | What the customer does | What you must build or decide | What you can learn |
|---|---|---|---|
| Guided demo | Watches you use the product, with their own examples | A script and sample data that look like their world | Which parts of the problem they react to |
| Pilot | Uses the product with your help on a real, bounded task | Scope, a success statement both sides agree, setup effort | Whether it works in their environment |
| Trial | Uses the product alone for a set period | Start and end rules, what happens at the end, access control | Whether they reach the first useful result without you |
| Self-serve | Signs up and uses it, with no conversation | Sign-up, onboarding, a way to ask for help, and often a pricing page | What a stranger does when nobody explains |

Most products end up with more than one door. A founder might use demos and pilots for larger buyers and a trial or self-serve path for individuals. The decision is which door suits which buyer, and the buyer types you wrote down in the [pricing article](/insights/pricing-a-first-saas-value-packaging-and-the-questions-to-ask/) are the place to start.

## Defining the terms

In this article, a trial means time-limited access to a product, with defined start and end rules. Freemium is the name some pricing models use for a plan that stays available alongside paid plans. Those are descriptions of models, not of any particular company's offer, and what a model should include is a decision for you and your advisors.

## Mechanics of a trial

If you choose a trial, each of these is a decision, and several have to be made in code.

- **How it starts.** Some trials ask for payment details at sign-up and some do not. Stripe's documentation on trial offers describes them this way: "Offer free or paid trials for items in a subscription." The option you choose changes who signs up and what you must tell them.
- **How long it lasts.** Choose a length by asking how long a buyer needs to reach the first useful result, using what you learned from the [sales call structure](/insights/founder-led-sales-calls-a-structure/) notes. This article gives no figure.
- **What happens at the end.** Stripe's documentation says: "When the trial ends, the subscription automatically transitions to the regular price or another price you configure." For a trial that has no payment method attached, it lists three options for what the platform does: it creates an invoice, it cancels, or it pauses. The cancel option "Cancels the subscription." and the pause option "Pauses the subscription until you resume it." Which one fits depends on your product and on what your customers have been told.
- **What your product does at each state.** A trial that ends in a pause or cancel needs your own code to remove or limit access. Stripe's documentation says the event for a paused subscription is a moment to "revoke the customer’s access to the product". Test each state with a throwaway account before any buyer sees it.
- **What you tell the customer, and when.** The same page describes an event sent before a trial ends and says: "Use this event to send your own reminder email." Whether to send a reminder, and what it says, is partly a compliance question, covered below.

The Microsoft Marketplace documentation shows how the work can be split when a platform is involved. For one listing option it says: "You manage the trial experience, including the transition to paid outside of the marketplace." And for trials configured in the platform it states: "Customers can cancel before the trial ends to avoid converting to a paid subscription." Both are descriptions of one vendor's product on the date this article was read, quoted to show what questions a platform may answer for you and what it leaves to you.

## Mechanics of a demo and a pilot

A demo needs less engineering and more preparation. Build a dataset that resembles the buyer's work, so that you are not explaining which fields are placeholders. Keep a short list of the three things you will show and the one question you will ask after each. Rehearse the opening so that the first thing the buyer sees is their own example.

A pilot needs a written scope. Before starting, both sides should agree in writing on what the buyer will do, what you will do, what counts as the pilot working, what data is shared and what happens when it ends. The agreement itself, including who owns what and how data is handled, is a contract question for counsel, not something this article can draft.

## Mechanics of self-serve

A self-serve path means a stranger should reach a useful result without you. That puts weight on onboarding: the first screen after sign-up, the first task, and the first moment the product does something the person wanted. The earlier article on [onboarding as acquisition](/insights/onboarding-is-acquisition-time-to-first-value/) covers that sequence, and the [landing page article](/insights/writing-a-landing-page-that-says-what-the-product-does/) covers what the visitor reads before signing up.

Instrument one event that marks the first useful result, in plain terms such as "created first project" or "sent first invoice", and record where people stop. A log that names the step where a sign-up stalled is worth more than a count of sign-ups. Keep a visible way to ask for help, and read every message that arrives on a new path, since each one tells you what the product failed to explain.

## What the online negative option statute says

When a customer is charged automatically after a trial, a U.S. statute may apply. Section 8403 of Title 15 of the U.S. Code is headed "Negative option marketing on the Internet". Its text begins: "It shall be unlawful for any person to charge or attempt to charge any consumer for any goods or services" in an Internet transaction that uses a negative option feature, unless conditions are met. The statute points to the FTC's Telemarketing Sales Rule, 16 C.F.R. part 310, for the meaning of "negative option feature". Among the conditions, the seller:

1. "provides text that clearly and conspicuously discloses all material terms of the transaction" before "obtaining the consumer's billing information";
2. "obtains a consumer's express informed consent before charging the consumer's credit card"; and
3. "provides simple mechanisms for a consumer to stop recurring charges from being placed on the consumer's credit card".

Those are excerpts, and the statute contains more, including definitions. The statute refers to a "consumer", which raises the question of whether it applies to a business buyer, to a sole proprietor or to a company where one person signs up for a team. That is a question for counsel, and so is the question of which wording and flow would meet the conditions for a trial that converts to a paid plan. The statute also operates alongside other laws, including state rules and rules in other countries, which this article does not cover. Stripe's page links to its own page on trial compliance for its customers, and a platform's guidance is a place to start reading, not a substitute for advice.

## Questions to answer before choosing

- Who is the buyer, and do they decide alone or with others?
- How much setup does the product need before it shows value? A product that needs data or integration may not suit a stranger using it alone.
- Can you support people who sign up without talking to you, and how will you know when they are stuck?
- What would you need to learn from a first contact, and which door shows it?
- What does the platform you use for billing support, and what is left to your code?
- What have you told customers about charges, and does the flow match what you told them?

Write the answers next to each buyer type. If a type has no good door, the gap is useful information: it may mean the product is not ready for that buyer, or that a different buyer fits better. The [glossary](/glossary/) defines terms such as activation and time to first value, which are the usual names for the moments this article describes.

## What this article cannot tell you

This article does not tell you which door to use, how long a trial should be, whether an entry tier will help you, or what any of these will do for sign-ups or revenue. The four-door table and the question list are an editorial method, not a framework from a named body. Descriptions of platform behavior come from Stripe and Microsoft documentation as read on 2026-10-10, and platforms change their products. The statute is quoted in part and applies to facts this article cannot see. It is general information, not legal or financial advice, and nothing here replaces a qualified lawyer's view on charging customers automatically, on terms and consent, or on laws outside the United States.
