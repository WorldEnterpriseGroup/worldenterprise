---
title: "Security baseline for year one"
subtitle: "A reading guide to three public documents, and a sequencing analysis for the first twelve months of a software product."
description: "What a first-year SaaS security baseline can draw from OWASP ASVS, NIST SSDF and the AICPA Trust Services Criteria, and how to sequence the work."
publishedDate: 2026-10-06
version: "1.0"
methodology: "Reads the public pages for OWASP ASVS, NIST SP 800-218 and the AICPA Trust Services Criteria on 6 October 2026, records only what those pages state, and labels every sequencing recommendation as analysis."
limitations: "Source pages were read through a page summarizer, not line by line. ASVS requirement counts, the AICPA common-criteria structure and any newer SSDF revision were not verified, so the brief does not state them. It is not an audit and describes no control operated by World Enterprise."
sources:
  - { id: asvs-github, title: "OWASP Application Security Verification Standard (repository)", publisher: OWASP, url: "https://github.com/OWASP/ASVS", accessed: 2026-10-06 }
  - { id: asvs-site, title: "OWASP ASVS chapter listing", publisher: OWASP, url: "https://asvs.dev/", accessed: 2026-10-06 }
  - { id: ssdf, title: "NIST SP 800-218, Secure Software Development Framework (SSDF) Version 1.1", publisher: "National Institute of Standards and Technology", url: "https://csrc.nist.gov/pubs/sp/800/218/final", accessed: 2026-10-06 }
  - { id: tsc-2022, title: "2017 Trust Services Criteria (With Revised Points of Focus, 2022)", publisher: AICPA, url: "https://www.aicpa-cima.com/resources/download/2017-trust-services-criteria-with-revised-points-of-focus-2022", accessed: 2026-10-06 }
  - { id: soc2-topic, title: "SOC 2 audit and assurance topic page", publisher: AICPA, url: "https://www.aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-2", accessed: 2026-10-06 }
appendix: "Year-one sequencing checklist"
draft: false
---

## Summary

A young SaaS company does not need to adopt three frameworks. It needs a shared vocabulary for what "secure enough" means, a way to show a customer's reviewer that the work was done, and a sequence that does not stall product delivery. The three public documents covered here answer three different questions.

| Document | The question it helps answer | Kind of document |
|---|---|---|
| OWASP ASVS | What must the application itself do, and how is that tested? | Verification requirements for web applications and services [(ASVS)](#source-asvs-github) |
| NIST SP 800-218 (SSDF) | How should the way we make software reduce vulnerabilities? | High-level development practices [(SSDF)](#source-ssdf) |
| AICPA Trust Services Criteria | How will an outside CPA describe our controls to a customer? | Criteria for evaluating and reporting on controls [(TSC)](#source-tsc-2022) |

The sections that follow describe what each document says, using only what the public pages stated on the retrieval date, then give a labelled analysis of how to sequence the work across twelve months.

## What each document says

### OWASP ASVS

The ASVS describes itself as "a comprehensive set of security requirements for designing, developing, and testing modern web applications and services." Version 5.0.0 was released in May 2025 and was the current release on the retrieval date; the project is licensed CC BY-SA 4.0 [(ASVS repository)](#source-asvs-github). Requirement identifiers follow a chapter.section.requirement pattern, for example v5.0.0-1.2.5. The project site lists 17 chapters, from V1 Encoding and Sanitization to V17 WebRTC [(ASVS site)](#source-asvs-site).

The standard defines three verification levels. This brief does not state requirement counts per level: a count read from the project's data file could not be confirmed, so it is left out.

### NIST SP 800-218, the SSDF

SP 800-218 is described as "high-level secure software development practices that can be integrated into each SDLC implementation" and as providing "a common vocabulary for secure software development." The page shows Version 1.1, February 2022, which supersedes the April 23, 2020 white paper CSWP 13 [(SSDF)](#source-ssdf). The page lists Souppaya, Scarfone and Dodson as authors. Whether a newer revision exists was not checked beyond this page, so no statement is made either way.

### AICPA Trust Services Criteria

The AICPA publishes the criteria as "2017 Trust Services Criteria (With Revised Points of Focus, 2022)"; the page is dated September 30, 2023 [(TSC)](#source-tsc-2022). The five categories are Security, Availability, Processing Integrity, Confidentiality and Privacy, and the stated purpose is to "evaluate and report on controls." A SOC 2 engagement is a CPA attestation built on those criteria [(SOC 2 page)](#source-soc2-topic). The structure of the common criteria and their full text were not in the retrieved material, so this brief does not describe them.

## Analysis: how the three fit together

This section is analysis by World Enterprise Editorial. It is a reasoned reading of the documents above, not a statement made by them.

1. **ASVS is a test plan.** Because it is written as verifiable requirements for applications and services, it gives engineers and testers something concrete to check a release against.
2. **The SSDF is a process vocabulary.** Because it is high-level and meant to fit any development lifecycle, it is useful for naming the habits of a team (how code is reviewed, how releases are made, how vulnerabilities are handled) rather than for line-by-line checking.
3. **The Trust Services Criteria are a reporting frame.** They matter when a customer asks for assurance from an independent party. A SOC 2 report is an attestation about controls, not a statement that a product is secure, and it is a different thing from a verification level in ASVS.

A practical consequence follows. Choose an ASVS level for the product, write the team's habits in SSDF vocabulary, and decide separately and later whether an attestation engagement is worth its cost. Starting with an attestation, before the product has a baseline to attest to, inverts the order.

## Analysis: a year-one sequence

The sequence below is a recommendation. Quarters are a planning device, not a requirement of any standard.

**Quarter 1, decide and inventory.** Pick the ASVS level that matches the data the product holds and the customers it targets, and record the reasoning. List the application's components, third-party services and the people with access to production. Without an inventory, none of the later steps can be scoped.

**Quarter 2, build the habits.** Write down how changes are reviewed, how releases are made and who can approve them, using SSDF vocabulary so the description is portable between customers. Begin verifying new work against the ASVS chapters that match what is being made.

**Quarter 3, verify and fix.** Run a structured pass of the application against the selected ASVS requirements, record gaps with owners, and fix the highest-risk gaps first. Keep the record: it is the evidence a customer's reviewer will ask for.

**Quarter 4, decide on assurance.** With a recorded baseline and a body of evidence, decide whether the customer base justifies an attestation engagement against the Trust Services Criteria, and which of the five categories are in scope. The right categories depend on what the product promises its customers.

## Methodology

On 6 October 2026 the public pages listed under Sources were retrieved and read. Quotations are reproduced as returned by the retrieval tool. Each factual statement in the first section carries a source reference. Statements in the two analysis sections are marked as analysis and carry no reference because they are conclusions, not reported facts. Where a detail could not be confirmed it is omitted and named under Limitations.

## Limitations

- The pages were read through an automated summarizer, so wording was not re-checked against the raw page source.
- ASVS requirement counts per level were not verified and are not stated.
- The AICPA common-criteria structure and the text of the criteria were not read.
- Whether NIST has issued a newer SSDF revision was not established.
- Frameworks change; treat versions and dates as of 6 October 2026.
- This brief says nothing about controls operated by World Enterprise Group Incorporated or by any other company, and it is not legal, audit or compliance advice.

## Appendix: year-one sequencing checklist

The checklist is part of the analysis. Each row names a deliverable you can show a customer's reviewer.

| Quarter | Deliverable | Lens | Evidence to keep |
|---|---|---|---|
| 1 | Chosen ASVS level with a written reason | ASVS | A dated decision record |
| 1 | Inventory of components, services and production access | SSDF | A maintained list with an owner |
| 2 | Written description of review and release practice | SSDF | A page of the team handbook |
| 2 | New work checked against matching ASVS chapters | ASVS | Review notes linked to changes |
| 3 | Structured pass against the chosen level | ASVS | A gap register with owners and dates |
| 3 | Fixes for the highest-risk gaps | ASVS | Closed items in the gap register |
| 4 | Decision on an attestation engagement and its categories | TSC | A dated decision record |
