---
title: "Accessibility at launch"
subtitle: "What WCAG 2.2, Section 508 and the DOJ web rule for state and local government say, and why late fixes cost more than early ones."
description: "A source-based reading of WCAG 2.2, Section508.gov and the DOJ ADA Title II web rule, with a labelled analysis of why accessibility belongs in launch scope."
publishedDate: 2026-10-06
version: "1.0"
methodology: "Reads the W3C WCAG 2.2 Recommendation, the Section508.gov laws page and the ADA.gov web rule page on 6 October 2026, corroborates rule dates with secondary summaries, and labels all cost reasoning as analysis."
limitations: "The Federal Register text of the DOJ rules could not be read, so rule dates are reported per DOJ and need verifying against the current rule. Only the first part of the WCAG text was read. Not legal advice, and private-sector obligations under ADA Title III are outside the sources."
sources:
  - { id: wcag22, title: "Web Content Accessibility Guidelines (WCAG) 2.2", publisher: W3C, url: "https://www.w3.org/TR/WCAG22/", accessed: 2026-10-06 }
  - { id: s508, title: "Laws and policies", publisher: Section508.gov, url: "https://www.section508.gov/manage/laws-and-policies/", accessed: 2026-10-06 }
  - { id: ada-rule, title: "Fact sheet and resources on the 2024 web rule under Title II of the ADA", publisher: "U.S. Department of Justice, ADA.gov", url: "https://www.ada.gov/resources/2024-03-08-web-rule/", accessed: 2026-10-06 }
  - { id: fr-2024-07758, title: "Federal Register document 2024-07758 (final rule; identified, text not read)", publisher: "Office of the Federal Register", url: "https://www.federalregister.gov/d/2024-07758" }
  - { id: fr-2026-07663, title: "Federal Register document 2026-07663 (understood to be the 2026 interim final rule; text not read)", publisher: "Office of the Federal Register", url: "https://www.federalregister.gov/d/2026-07663" }
appendix: "WCAG 2.2 additions and obligation map"
draft: false
---

## Summary

Accessibility obligations come from different places and apply to different organisations, which is why teams misjudge them. WCAG is a technical standard published by the W3C. Section 508 binds US federal agencies. The Department of Justice web rule under Title II of the ADA binds state and local governments. A private software company is usually not directly named by any of the three, but it meets all three through customers, procurement and the standard's role as the common yardstick.

The rest of this brief reports what the sources state, flags what could not be verified, and then gives a labelled analysis of why accessibility belongs in launch scope.

## What the sources say

### WCAG 2.2

WCAG 2.2 is a W3C Recommendation dated December 12, 2024 [(WCAG 2.2)](#source-wcag22). It adds success criteria to 2.1, with these levels as the page returned them:

- 2.4.11 is Level AA: a focused component is not entirely hidden by author-created content.
- 2.4.12 is Level AAA, the stricter form of the same idea.
- 2.4.13 is Level AAA and concerns the focus indicator, with a 3:1 contrast requirement.
- 2.5.7 is Level AA: dragging movements need a single-pointer alternative.
- 2.5.8 is Level AA and sets a minimum size for touch targets. The pixel value was not shown in the retrieved text and is not restated here; read the criterion itself.
- 3.2.6 is Level A, consistent help.
- 3.3.7 is Level A, which stops users re-entering information they already supplied.
- 3.3.8 is Level AA, accessible authentication, described as not relying on cognitive function tests; 3.3.9 is the Level AAA enhanced form.

Success criterion 4.1.1 (Parsing) is obsolete and removed in 2.2. Content that conforms to 2.2 also conforms to 2.0 and 2.1 [(WCAG 2.2)](#source-wcag22). The official short names of the new criteria were not in the retrieved text, so this brief uses numbers and plain descriptions.

### Section 508

Section508.gov, on a page last updated July 2026, states that "Agencies must give disabled employees and members of the public access to information comparable to the access available to others." It names WCAG 2.0 as the standard referenced by the Access Board final rule of January 18, 2017, effective January 18, 2018, and says the requirement applies to "all federal agencies when they develop, procure, maintain, or use electronic and information technology" [(Section508.gov)](#source-s508).

### The DOJ Title II web rule

The final rule was published April 24, 2024, applies to state and local governments rather than private businesses, and adopts WCAG 2.1 Level AA [(ADA.gov)](#source-ada-rule). DOJ's page states that existing duties of "effective communication, reasonable modifications, and equal opportunity" remain [(ADA.gov)](#source-ada-rule).

Secondary law-firm summaries report that an interim final rule published April 20, 2026 moved the compliance dates: April 26, 2027 for entities serving populations of 50,000 or more, and April 26, 2028 for smaller entities and special districts. The Federal Register documents were not readable during retrieval [(2024 rule)](#source-fr-2024-07758) [(2026 rule)](#source-fr-2026-07663).

**Verify current rule.** The dates in this subsection come from the DOJ page and secondary summaries, not from the Federal Register text. Check the current rule before relying on them.

## Analysis: why accessibility belongs in launch scope

This section is analysis by World Enterprise Editorial. It is a reasoned argument, not a finding of the sources, and it contains no cost figures because none were sourced.

1. **The buyer chain carries the obligation.** A product sold to a federal agency meets Section 508 through procurement requirements; one sold to a state or local government meets the Title II rule through its customer. The vendor feels the obligation as a contract term even when the statute names someone else. This is inference, not text from the sources.
2. **Late fixes touch shared structure.** Focus order, form labelling, colour tokens, target sizes and error handling live in shared components. Retrofitting means reopening those components after many screens depend on them, and retesting everything that uses them. Fixing them while the component library is small changes one place.
3. **Some WCAG 2.2 criteria are design decisions.** Authentication flows (3.3.8), drag interactions (2.5.7) and repeated help (3.2.6) shape the product's structure. They are cheap to choose and expensive to reverse.
4. **A target that is a standard version is easier to test than a target that is a feeling.** Choosing "WCAG 2.2 Level AA" gives a test plan. The Title II rule's own standard is 2.1 Level AA, which content that conforms to 2.2 also meets.

## Methodology

On 6 October 2026 the W3C Recommendation, the Section508.gov page and the ADA.gov page were retrieved and read, and rule dates were cross-checked against several law-firm summaries. Quotations are reproduced as returned by the retrieval tool. Statements about what a standard or rule says carry a source reference; the analysis section is marked and carries none.

## Limitations

- Only the first part of the WCAG 2.2 text was read; the minimum target size value and the official criterion names were not confirmed.
- The Federal Register primary text for both DOJ rules was blocked and not read. The 2026 interim rule dates rest on secondary summaries. Verify current rule.
- Private-sector exposure under ADA Title III is outside the sources and is not addressed.
- This is not legal advice. Ask counsel about any specific obligation.
- Dates and versions are as of 6 October 2026.

## Appendix: WCAG 2.2 additions and obligation map

The first table repeats the criteria reported above as a testing aid. The second maps who each source binds.

| Criterion | Level | What to test |
|---|---|---|
| 2.4.11 | AA | A focused control is not entirely hidden by sticky headers, banners or other authored content |
| 2.4.13 | AAA | The focus indicator has 3:1 contrast |
| 2.5.7 | AA | Every drag interaction has a single-pointer alternative |
| 2.5.8 | AA | Interactive targets meet the minimum size stated in the criterion |
| 3.2.6 | A | Help is in the same relative place on each page where it appears |
| 3.3.7 | A | Users are not asked to re-enter data they already supplied in the same flow |
| 3.3.8 | AA | Sign-in does not depend on a cognitive function test |

| Source | Who it binds | Standard it names |
|---|---|---|
| Section 508 (Section508.gov) | Federal agencies | WCAG 2.0 |
| Title II web rule (ADA.gov) | State and local governments | WCAG 2.1 Level AA |
| WCAG 2.2 (W3C) | No one by itself; a technical Recommendation | Itself; also meets 2.0 and 2.1 |
