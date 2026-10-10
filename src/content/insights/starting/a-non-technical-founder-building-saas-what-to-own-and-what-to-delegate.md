---
title: "A non-technical founder building SaaS: what to own and what to delegate"
seoTitle: Non-technical founders: own and delegate
description: "If you cannot write the code yourself, the decisions, accounts and records to keep in your own hands, and the work you can hand to a technical team."
topic: starting
publishedDate: 2026-10-10
noStatistics: true
sources:
  - id: gds-contractors
    title: Working with contractors or third parties
    publisher: GOV.UK Service Manual, Government Digital Service
    url: https://www.gov.uk/service-manual/the-team/working-contractors-third-parties
    accessed: 2026-10-10
  - id: gds-roles
    title: What each role does in a service team
    publisher: GOV.UK Service Manual, Government Digital Service
    url: https://www.gov.uk/service-manual/the-team/what-each-role-does-in-service-team
    accessed: 2026-10-10
  - id: usc-204
    title: "17 U.S. Code section 204, Execution of transfers of copyright ownership"
    publisher: Legal Information Institute, Cornell Law School
    url: https://www.law.cornell.edu/uscode/text/17/204
    accessed: 2026-10-10
evidence: [gds-contractors, gds-roles, usc-204]
relatedPlaybook: build-and-ship-v1
relatedTemplate: seed-data-room-checklist
segments: [non-technical-founders]
related: [a-technical-founders-blind-spots-selling-pricing-and-saying-no, founders-inside-a-company-intellectual-property-and-employment-agreements]
---

*This article is general information, not legal or financial advice. It was written on October 10, 2026 and describes United States sources only. Ask your own counsel what applies to you.*

If you are not the person who writes the code, you will still be accountable for what the code does. You choose the problem, answer to the customers and carry the risk, and someone else makes most of the technical decisions. This arrangement works when it is clear which decisions stay with you and which you hand over. It goes wrong in a predictable way: the founder hands over everything that looks technical, including things that are really about ownership, access and direction.

This article sorts the work into two lists. It names no agency, freelancer or platform, because the principle is the same whoever builds. For a comparison of the three common ways to staff the work, see the [research brief on dedicated teams, agencies and freelancers](/research/dedicated-team-agency-or-freelancers/), which sets out criteria without recommending one.

## What to own

Own what you could not easily replace if the people building the product left tomorrow. There are six things on that list.

### 1. The problem and the order of work

What the product is for, who it is for, and what gets built first are business decisions, even when they are expressed as technical tickets. The GOV.UK Service Manual, written for public services, describes the product manager role as the person who makes sure the service "will meet user needs", prioritizes the work in each sprint and accepts work as complete. You do not need that job title, but you need someone to do those three things, and if the builders do all three themselves, they are marking their own work.

Write down what "done" means in terms of the user, not the code. "A new customer can invite a colleague and the colleague can see the shared report" is an acceptance statement you can check yourself. "The invitation service is implemented" is not. The [build and ship v1 playbook](/playbooks/build-and-ship-v1/) and the [cut line test](/insights/cutting-an-mvp-the-cut-line-test/) show how to set the scope.

### 2. The accounts

Every account that the business depends on should be in the company's name, with you as an owner. That means the code repository, the cloud hosting account, the domain name and its registrar, the app store or marketplace accounts, the payment processor, the email service and any analytics or error-tracking tools. The pattern that causes trouble later is an early builder setting up an account under a personal login "to get started," and nobody moving it.

You do not need to understand the systems to check this. You need to be able to log in, see the list of people with access, and remove one of them. If you cannot, the first request to the builders is to fix that.

### 3. The records of who can reach what

Keep a short register: system, account holder, who has access, what level, and the date each was last reviewed. The GOV.UK guidance on working with contractors states the principle in one sentence: contractors and suppliers "should only be given necessary access to the information and systems they need to do their job". The page adds: "Appropriate processes should be in place to remove access when it is no longer required." Treat that as a standard for your own register. The [IP, contracts and access](/insights/ip-contracts-and-access-diligence-for-small-engineering-teams/) article describes the register in more detail.

### 4. The written agreement about who owns the work

When someone other than you writes the code, ownership depends on paperwork. Section 204 of the U.S. Copyright Act says that a transfer of copyright ownership "is not valid unless an instrument of conveyance, or a note or memorandum of the transfer, is in writing" and signed by the owner of the rights. For a non-technical founder, the practical consequence is a question to put to counsel before work begins: what does the agreement with each builder say about who owns the output, and what is signed?

This article does not say what the agreement should contain, and it does not describe other countries' rules, which differ. Keep the signed copy where you can find it. The [seed data room checklist](/library/seed-data-room-checklist/) includes a place for it.

### 5. The customer relationship and the data

The customers, their contact details and what they have told you belong in a system you control. If the builders hold the only copy of the customer list, or if the product's data can only be exported by asking them, you have delegated something you should have kept. Ask for a regular export in a format you can open, and test that you can open it.

### 6. The ability to ask the second question

You do not need to read the code. You need to be able to ask a question, understand the answer well enough to ask a second one, and notice when the answer has not been given. That is a skill you can build. The simplest method is to ask for explanations in the form of consequences: "What happens to a customer if this fails?" "What would it cost to change this later?" When a builder uses a term you do not know, ask what it means. A good builder will welcome the question, and a team that resents it is telling you something.

## What to delegate

Delegate the work that needs the skill you do not have, and that a competent person can do within limits you set.

- **Implementation.** Writing, testing and deploying the software, within a scope you have approved.
- **Technical options.** Ask for two or three ways to solve a problem with the trade-offs in plain terms, then decide. You are choosing among options, not designing them.
- **Routine operations.** Monitoring, fixing faults and applying updates, with a report you can read.
- **Specialist review.** Security and accessibility checks, where an outside specialist is better placed than the people who built it.

### Terms worth setting when you delegate

The same Service Manual page makes some points that apply to any outside builder. It advises you to "only buy the skills you need and not to lock your service into a long contract with a fixed cost", and to work only with contractors or suppliers who are "prepared to pass on their expertise." It also says to make sure "you have a plan to pass knowledge from contractors to the rest of your team", and suggests documentation, pairing and sessions in which contractors share what they know.

For a non-technical founder, that last point is the most important one. If the knowledge of how the product works sits in one person's head, you depend on that person. Ask for the documentation to be kept up to date as part of the work, and ask for a short walkthrough when the team changes.

## A weekly check

A simple routine keeps the boundary in view. Once a week, ask the builders for three things: what was completed in terms of the user, what is blocked and why, and what decision they need from you. Then confirm for yourself that you can still log in to each account and that the register is current. Fifteen minutes is enough when nothing is wrong, and the habit is what lets you notice when something is.

## What this article cannot tell you

This article rests on one set of UK public-service guidance about teams and contractors, one section of the U.S. Copyright Act and reasoning. It does not measure how non-technical founders fare, and the guidance was written for government projects, so its terms are borrowed as method for a small company. The article does not tell you which arrangement suits you (that is the research brief's subject), what a contract should say, or whether a particular person or firm is competent. It gives no view on cost, on offshore or onshore teams, or on the law of any state or country outside the single statute cited. A reader outside the United States should expect ownership and employment rules to differ. Ask counsel about the agreements, and check each source's current text before relying on it.
