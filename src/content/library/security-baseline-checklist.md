---
title: Security baseline checklist
description: A first-year security checklist for early-stage SaaS teams covering access, code, data, vendors and response, written as questions about your own product.
kind: checklist
instructions: Answer each question for your own product with yes, no or partly, name an owner and a date for every no, and review the list every quarter.
updated: 2026-10-06
---

## How to use this checklist

This is a self-assessment for your own team. It does not certify anything. It maps loosely to public references such as OWASP ASVS and the NIST Secure Software Development Framework; read those documents for the full detail. Answer honestly. An open item with an owner is better than a closed item nobody checked.

Answer key: **Y** yes, **P** partly, **N** no.

## 1. Accounts and access

| Question | Answer | Owner | Date |
|---|---|---|---|
| Does every person have their own account on every system, with no shared logins? | | | |
| Is multi-factor authentication required on email, source control, cloud and the admin console? | | | |
| Can you remove a leaver's access to every system on the day they leave? | | | |
| Do people have only the access their work needs? | | | |
| Are secrets kept in a secrets manager, not in code or chat? | | | |

## 2. Code and build

| Question | Answer | Owner | Date |
|---|---|---|---|
| Is every change reviewed by a second person before release? | | | |
| Do automated tests run before every release? | | | |
| Do you scan dependencies for known vulnerabilities? | | | |
| Do you know which open-source components your product contains? | | | |
| Can you roll back a release quickly? | | | |

## 3. Data

| Question | Answer | Owner | Date |
|---|---|---|---|
| Do you know what personal and sensitive data you hold, and where? | | | |
| Is data protected while stored and while moving between systems? | | | |
| Are backups taken, protected and tested by restoring one? | | | |
| Do you collect only the data you need? | | | |
| Is there a way to delete a customer's data on request? | | | |

## 4. Product security

| Question | Answer | Owner | Date |
|---|---|---|---|
| Is user input validated and output encoded to prevent injection? | | | |
| Are sessions and password resets handled by a well-maintained library? | | | |
| Is access to each customer's data checked on the server for every request? | | | |
| Have you tested the product for the most common web risks? | | | |

## 5. Vendors

| Question | Answer | Owner | Date |
|---|---|---|---|
| Do you keep a list of vendors that touch customer data? | | | |
| Have you read each vendor's security and privacy terms? | | | |
| Do you know how a vendor would tell you about an incident? | | | |

## 6. Logging and response

| Question | Answer | Owner | Date |
|---|---|---|---|
| Do you log sign-ins, permission changes and admin actions? | | | |
| Does someone own incident response, and do they know the first three steps? | | | |
| Can customers reach you to report a security concern? | | | |
| Have you run a short practice of your response plan? | | | |

## Review

- \[ \] Every N and P has an owner and a date.
- \[ \] The checklist is dated and stored with your other company records.
- \[ \] The next review is on the calendar.
