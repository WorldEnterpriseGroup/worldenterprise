---
title: "Onboarding is acquisition: time to first value"
description: Why the first session decides whether a signup becomes a customer, how to define the first value moment, and how to remove steps between signup and that moment.
topic: grow
publishedDate: 2026-10-06
noStatistics: true
sources:
  - id: nng-onboarding
    title: Onboarding Tutorials vs. Contextual Help
    publisher: Nielsen Norman Group
    url: https://www.nngroup.com/articles/onboarding-tutorials/
    accessed: 2026-10-06
  - id: pg-ds
    title: Do Things that Don't Scale
    publisher: Paul Graham
    url: https://paulgraham.com/ds.html
    accessed: 2026-10-06
evidence: [nng-onboarding, pg-ds]
relatedServices: [B, C]
relatedPlaybook: earn-your-first-customers
relatedTemplate: customer-interview-guide
---

Most founders treat acquisition and onboarding as two departments. Acquisition gets the visitor to sign up; onboarding is the "welcome" email and a product tour. For a first SaaS product this split is misleading. A signup that never reaches a useful result is not an acquired customer. It is a cost you paid for nothing. Onboarding is the last step of acquisition, and the clock on it starts the moment someone creates an account.

## Define "first value" before you design anything

Time to first value is the time between a person's first interaction with your product and the first moment they get the result they came for. The definition only works if you decide, in advance and in writing, what that result is. It is not "completed profile" or "watched the tour". It is an outcome the customer would describe in their own words.

A useful test is to finish this sentence from the customer's point of view: "I knew this was worth my time when I saw ____." For an invoicing product the blank might be "my first invoice sent and the payment link working". For an analytics product it might be "my own data on a chart I could share". For a scheduling tool it might be "a booking made by someone else, with no emails back and forth".

Write that sentence for your product. It is your activation event. If you have several customer types, you may have several, but start with one.

## Map the distance

Once the first value moment is named, draw the path from the signup form to it. Count every screen, field, wait, decision and external step. Be literal. Include the confirmation email, the password rules, the empty state that does not say what to do and the integration that needs an administrator you do not have.

| Stage | Question to ask | Typical friction to look for |
|---|---|---|
| Signup | Do I need every field now? | Fields the product does not use in the first session |
| Verification | Can the customer start before verifying? | A blocked screen while waiting for email |
| First screen | Does it say what to do next? | An empty dashboard with no direction |
| Setup | Is each step needed for first value? | Configuration that could wait |
| First task | Can the customer finish with their own data? | Sample data that hides the real experience |
| Result | Is the value visible and shareable? | A success state that does not show the outcome |

Every row is a place to remove something. In a young product the largest gains rarely come from adding a clever feature; they come from deleting steps that exist because they were convenient to build.

## What the research says about tutorials

Nielsen Norman Group's article on onboarding tutorials and contextual help makes a point that applies directly to small teams who are tempted to build a product tour. The article reports that users want to start using the product right away, that tutorials presented up front are hard to remember when they are needed and that help delivered in context, at the moment a user takes an action, works better. It also recommends making help easy to dismiss and to find again, and testing with users to learn where help is truly needed.

The practical reading for a founder is not "never write a tutorial". It is: do not put the explanation in front of the task. Put the task in front, and attach the explanation to the step where someone hesitates.

## Techniques that work at small scale

You do not need an onboarding platform for your first customers. You need a few decisions made deliberately.

### Ask only what you need to personalise

Each question at signup should change what happens next. If the answer to "company size" does not alter the first session, drop it for now and ask later, once the person has seen value. Questions you cannot yet act on are a tax on every signup.

### Start from a task, not a tour

Offer a single, clear first task on the first screen, phrased as an outcome: "Send your first invoice" rather than "Explore your dashboard". Provide a way to skip it, and make sure skipping does not leave a dead end.

### Use real data as soon as possible

Sample data is useful for a glance, but it delays the moment a customer sees the product work on their own problem. Where you can, let customers import, connect or type in real information in the first session, and make the import robust. Check what happens with messy files. Messy files are what customers have.

### Do it by hand for the first customers

Early on, you can shorten time to first value by doing setup for the customer. Paul Graham's essay on doing things that do not scale describes founders setting up early users personally. The same approach for a SaaS product means importing the data, configuring the account and sending a short message when the first result is ready. Do not hide that you did it. Do write down every step you performed, because that list is your backlog of onboarding work to automate.

### Write the first three emails as a conversation

A lifecycle email sequence is not necessary, but a short plain message from a named person on the team a few hours after signup, asking what the customer is trying to do, often yields more learning than a sequence of announcements. Reply to every answer. Treat answers as interview material.

## How to measure it without invented benchmarks

You can measure onboarding with three simple counts for any period you choose:

1. How many accounts were created.
2. How many of those reached the first value event.
3. For those that did, the elapsed time between signup and the event, reported as a median and with the range.

Keep the raw counts beside any percentage. With a small number of signups, a rate is easy to misread. If four of seven reached the event, say "four of seven", and list what happened to the other three. At this scale, individual stories are more informative than aggregates, so read the session of every account that did not reach the event.

We do not give a target for time to first value. A target only makes sense relative to the task: a bank transfer and a data migration are different jobs, and a good number for one is meaningless for the other. Use your own history as the comparison and aim to shorten it.

## A short review you can run this week

- Write the first value sentence in the customer's words.
- Walk through the signup path yourself with a fresh account and count the steps.
- Remove or defer one field, one screen or one wait.
- Watch (with permission) two people, or read two session recordings if you have consented to them, and note where they stopped.
- Ship the change. Compare the next group of signups to the previous group using the counts above.

## What this article does not know

We cannot say what your first value moment is, or how long it should take. We also do not claim that shorter onboarding always raises retention; a faster path to a shallow result can mislead customers. The point is narrower: the distance between signup and a real result is yours to measure, and in an early product it is usually longer than the team believes. Closing that distance is the cheapest acquisition work available, because the customer has already arrived.
