---
title: "A technical founder's blind spots: selling, pricing and saying no"
seoTitle: "Technical founders: blind spots"
description: "Three kinds of work a builder can overlook when starting a SaaS company: selling before building, setting a price on purpose, and keeping an explicit no list."
topic: starting
publishedDate: 2026-10-10
noStatistics: true
sources:
  - id: gds-needs
    title: Learning about users and their needs
    publisher: GOV.UK Service Manual, Government Digital Service
    url: https://www.gov.uk/service-manual/user-research/start-by-learning-user-needs
    accessed: 2026-10-10
  - id: gds-priorities
    title: Deciding on priorities
    publisher: GOV.UK Service Manual, Government Digital Service
    url: https://www.gov.uk/service-manual/agile-delivery/deciding-on-priorities
    accessed: 2026-10-10
  - id: gds-roles
    title: What each role does in a service team
    publisher: GOV.UK Service Manual, Government Digital Service
    url: https://www.gov.uk/service-manual/the-team/what-each-role-does-in-service-team
    accessed: 2026-10-10
evidence: [gds-needs, gds-priorities, gds-roles]
relatedServices: [C]
relatedPlaybook: earn-your-first-customers
relatedTemplate: mvp-cut-line-worksheet
segments: [technical-founders]
related: [a-non-technical-founder-building-saas-what-to-own-and-what-to-delegate, what-a-first-time-founder-should-settle-first]
---

If you can build the product yourself, you start a SaaS company with a real advantage: nothing has to wait for a hiring decision, a quote or a specification. The same advantage hides a trap. Because building is the work you can do at any hour and see the result of immediately, it quietly becomes the work you do instead of the harder work around it. This article is about three pieces of that surrounding work, and how to make each one visible: selling, pricing and saying no.

None of this is a claim that technical founders are worse at business. It is a description of where attention tends to go when the main skill is making software, and a set of habits for putting it back.

## Selling is not what happens after the product is finished

A builder's instinct is to finish the product and then find customers. The risk is that you finish a product for a problem nobody described to you. The GOV.UK Service Manual, written for public services, states the dependency bluntly in its guidance on learning about users: "If you do not understand who they are or what they need from your service, you cannot build the right thing." The context is government, but the logic is the same for a company: building comes after understanding, and understanding comes from talking to people.

The same guidance contains a sentence every technical founder can use as a rule: "Treat any opinions or suggestions that do not come from users as assumptions that have to be proven by doing research." Your own view of what the product needs is an opinion. So is your co-founder's, and so is the view of a friend who works in the industry. They may be right, and they are still assumptions until a person with the problem confirms them.

### What selling looks like before there is a product

Selling early does not mean persuading anyone. It means asking someone with the problem to commit to something, and noting what they commit to. The commitments, from smallest to largest, are roughly these:

- They agree to a conversation about how they handle the problem today.
- They share a real example, such as a document, a spreadsheet or a screenshot of the workaround.
- They agree to try an early version and give feedback.
- They agree to pay for it, or to sign something that says they intend to.

Each step is evidence of a different strength. A kind remark is not on the list. The [customer discovery interviews](/insights/customer-discovery-interviews-without-false-positives/) article explains how to run the first kind of conversation without steering it, and the [founder-led sequence for your first ten customers](/insights/your-first-ten-customers-a-founder-led-sequence/) covers what comes after. The [earn your first customers playbook](/playbooks/earn-your-first-customers/) puts the steps in order.

A practical test of whether you are selling or building: look at your calendar for the last two weeks. How many hours went to conversations with people who might use the product, and how many to the product? There is no correct ratio, and the point is only that the first number is a choice you can see.

## Pricing is a product decision, not a billing detail

Technical founders often treat price as something to fill in once the product works. It is a design decision with consequences that are hard to reverse, because customers remember what they were first told.

Four questions carry most of the weight, and none needs a number to answer.

1. **Who pays, and who uses it?** In a company, the person who experiences the problem is often not the person who approves the purchase. Your price page speaks to the second person.
2. **What is the unit of price?** A seat, a usage amount, a flat plan or an outcome. The unit tells customers what they are expected to grow into. Choose one that rises as the customer gets more value, not as your costs rise.
3. **What is included, and what changes the price?** Write the line between plans in terms a customer can check, not in terms of your architecture.
4. **How will you change it?** Decide now whether early customers keep their first price and for how long, and say so.

Setting a price also tells you something. If you cannot say what a customer would pay and why, you probably do not yet know what problem the product solves for them, which sends you back to the conversations above. The [pricing page fundamentals](/insights/pricing-page-fundamentals-for-a-first-saas/) article covers how the answers show up on a page.

One habit helps more than any framework: ask the question out loud in the first conversation. "What do you pay for this today, in money or in time?" is the nearest thing to market data a company with no customers can get.

## Saying no is a skill with a written form

A technical founder can usually build whatever a customer asks for, and that is exactly the problem. When nothing is too hard, every request becomes a yes, and the product becomes the sum of the loudest requests.

The GOV.UK Service Manual's guidance on prioritizing offers a method that fits a very small team. It describes breaking the backlog into "must haves", "should haves", "could haves" and "will not haves", and defines the last group as "low priority things that the team has agreed not to do." The value of the last category is that it is written down. A "will not do" list turns a no from a mood into a record, and gives you something to show a customer when you decline.

The same guidance makes two further points worth borrowing. Prioritizing should happen regularly, "for example, weekly", and should draw on "performance analysis, user research and input from stakeholders" rather than on whoever spoke last. It also warns against filling the backlog with features alone: "As well as user stories for new features, your backlog is likely to contain other types of work, like support tickets or tasks to address technical debt." For a small company, that reminder is about discipline: the plan has to leave room for support, repair and the unglamorous work that keeps the first customers.

To make this concrete:

- Keep a single list of requests, with the name of the person who asked and the problem behind the request.
- Once a week, move each item into do now, do later, or will not do. Record the reason in one line.
- When a customer asks for something on the "will not do" list, tell them the answer and the reason, and note whether it changes your view.

The [cut line test](/insights/cutting-an-mvp-the-cut-line-test/) describes how to draw the line for a first release, and the [cut line worksheet](/library/mvp-cut-line-worksheet/) gives you the blank form. Both are about scope for a release; the same habit applies to every release after it.

## Separate the roles in your head

The service manual also lists the roles a service team needs. Its description of a product manager includes making sure the service "will meet user needs", prioritizing what is worked on in each sprint, and accepting work as complete. You do not need a person for each role, but a solo builder holds all of them at once, and the roles can conflict. The person who wants to ship is not the person who checks that the result meets the need.

One way to keep the roles visible is to book them. Put one block a week in your calendar for each of three hats: the builder, the seller and the person who decides what the product is for. When the product-owner hour keeps getting canceled, that tells you something.

## What this article cannot tell you

This article rests on three pages of UK public-service guidance and on reasoning, not on data. It does not measure how technical founders spend their time or how they fare, and it makes no claim that these habits lead to a result for a particular company. The service manual was written for government teams, so its examples (users of public services, sprints, stakeholders) are borrowed as method, not as proof about startups. The article does not name a price, a pricing model that suits your product, or a number of customers to talk to, because the sources say nothing on those points. It also does not cover the legal side of selling, such as contracts and taxes, which depend on your jurisdiction and your counsel's advice. Check the current version of each page before relying on a quotation.
