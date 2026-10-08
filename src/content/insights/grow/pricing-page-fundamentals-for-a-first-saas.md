---
title: "Pricing page fundamentals for a first SaaS"
seoTitle: Pricing page fundamentals
description: How to build a clear pricing page for a first SaaS product - choosing a pricing model, stating what is included, and making the page readable and accessible.
topic: grow
publishedDate: 2026-10-06
noStatistics: true
sources:
  - id: stripe-pricing-models
    title: Recurring pricing models
    publisher: Stripe Documentation
    url: https://docs.stripe.com/products-prices/pricing-models
    accessed: 2026-10-06
  - id: w3c-wcag22
    title: Web Content Accessibility Guidelines (WCAG) 2.2
    publisher: W3C
    url: https://www.w3.org/TR/WCAG22/
    accessed: 2026-10-06
evidence: [stripe-pricing-models, w3c-wcag22]
relatedServices: [C, A]
relatedPlaybook: build-repeatable-growth
relatedTemplate: one-page-problem-brief
---

A pricing page has one job: to let a prospective customer decide whether to continue, without having to ask you anything. It is also the page where vague positioning is exposed. If you cannot say plainly who each plan is for and what it includes, the page will show it. This article covers the decisions that come before the design, the contents a first pricing page needs and the accessibility basics that are easy to get right early and expensive to retrofit.

## Decide the unit of value first

Before choosing plan names or layout, decide what the customer is actually paying for. Stripe's documentation on recurring pricing models lists four patterns that cover most subscription software:

| Model | What the customer pays for | When it tends to fit |
|---|---|---|
| Flat rate | A fixed price for a defined service tier | One product, similar customers, simple value story |
| Per seat | A price for each user who needs access | Value grows with the number of people using it |
| Tiered | A unit cost that changes with quantity or usage | Value grows with volume and large customers expect scale terms |
| Usage-based | A charge based on what the customer uses | Usage varies widely and tracks the value delivered |

The "when it tends to fit" column is our editorial judgment, not a statement from the Stripe documentation, and it is a starting hypothesis, not a rule.

A helpful question is: as the customer gets more value, what grows? People, records, projects, volume, or nothing in particular? The thing that grows with value is a candidate for your pricing unit. A unit that does not track value invites arguments, because the customer feels the price rises while the benefit does not.

Pick one model for your first page. Hybrid models, such as a base fee plus usage, are common later, but each additional variable is another thing to explain, test and support.

## What an early pricing page needs

A first pricing page does not need a comparison matrix with thirty rows. It needs the following, in roughly this order.

### A plain statement of who each plan is for

Name the buyer for each plan in a short phrase: "For a single founder running their own client work" is more useful than "Starter". Plan names can be playful, but the first line under each name should be literal.

### What is included, written as outcomes

List what the customer can do on the plan, not just limits. "Send invoices to your clients and track who has paid" tells the reader more than "Invoicing module". Then give the limits that matter, in the same units the customer thinks in.

### What happens at the edge

State what occurs when someone exceeds a limit: do they get blocked, charged more or asked to move up? Hidden overage rules are the most common source of billing complaints, and they are avoidable by writing a sentence.

### How billing works

Say when the customer is charged, how they cancel and what happens to their data afterwards. These are not legal terms; they are the practical answers a careful buyer looks for. Keep the formal terms in your agreement, and link to it.

### A next step that matches the buyer's stage

A self-serve buyer wants a start button. A buyer who needs approvals wants a way to talk to a person or get a document for their finance team. A first SaaS often has both kinds of buyer; offer both clearly, without hiding the price behind a form unless you have a real reason.

### Answers to the questions you already hear

Each customer conversation produces questions about price. Write them on the page with direct answers. This is the most reliable content you have, because it comes from real objections.

## Test the page with real readers

Before launch, ask three people who match your buyer to look at the page for two minutes and then tell you, without scrolling back, what each plan costs, who it is for and what they would do next. Where their answers differ from what you intended, change the page, not the reader. Repeat after any significant edit. This takes an afternoon and finds problems that no amount of internal review will, because you already know what the page means.

## Be honest about what you do not yet know

At an early stage, you may not know the right price. That is normal. Two practices keep the page honest while you learn.

First, treat the current price as a hypothesis and write down why you chose it. When customers react, you can compare what happened with what you expected. Second, avoid inventing urgency or false scarcity. Countdown timers and "only a few spots left" notices with no true limit damage trust, and they do not tell you anything about the real price.

If you change prices, decide in advance how existing customers will be treated and say so. A change handled with notice and a clear explanation is a minor event. A change discovered on an invoice is a support problem and a trust problem.

## Make the page readable and accessible

Pricing pages are heavy on tables, icons and calls to action, which are exactly the places where accessibility problems collect. WCAG 2.2, the W3C recommendation for web accessibility, is the reference to design against. A few of its requirements show up on nearly every pricing page:

- **Text contrast.** Body text and plan descriptions need enough contrast with their background. Light gray text on white is a common failure.
- **Not relying on color alone.** If a "recommended" plan is marked only by a colored border, a person who cannot see the color misses it. Add a text label.
- **Table structure.** A comparison table should use real table headers so that a screen reader can announce which plan and which feature a cell belongs to.
- **Keyboard use.** Every plan selector, toggle between monthly and annual and button should be reachable and usable with a keyboard, with a visible focus indicator.
- **Target size.** WCAG 2.2 adds a success criterion on the size of pointer targets, so buttons and toggles should not be tiny.

Built in from the start, these cost little. Retrofitted into a page full of nested divs, they cost much more. Treat them as part of the definition of done.

## A launch checklist for the page

1. Each plan has a one-line statement of who it is for.
2. The pricing unit is named and explained in one sentence.
3. Every limit appears in the units the customer uses.
4. The page says what happens at a limit, how billing works and how to cancel.
5. The comparison table uses real headers and does not depend on color alone.
6. Two real customer questions are answered on the page.
7. A way to reach a person is visible.
8. The reason for the current price is written down somewhere you will find it later.

## What this article does not know

We have not given price points, discount norms or conversion benchmarks, because no public primary source we have reviewed would apply to your market, and an invented benchmark would mislead. The table of models is a way to organize the decision, not a prediction of which one will perform best for you. The only reliable evidence on what your customers will pay comes from asking them to pay, which is why the conversation log from your first customers belongs next to this page.
