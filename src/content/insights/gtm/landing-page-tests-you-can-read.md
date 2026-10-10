---
title: "Landing page tests you can read"
seoTitle: Landing page tests you can read
description: "How a technical founder can plan and read a two-version landing page test using the NIST statistics handbook, with invented numbers and no benchmarks."
topic: gtm
publishedDate: 2026-10-10
segments: [technical-founders, first-time-founders]
related: [writing-a-landing-page-that-says-what-the-product-does, choosing-your-first-channels]
sources:
  - id: nist-7-1-3
    title: "NIST/SEMATECH e-Handbook of Statistical Methods, 7.1.3 What are statistical tests?"
    publisher: National Institute of Standards and Technology
    url: https://www.itl.nist.gov/div898/handbook/prc/section1/prc13.htm
    accessed: 2026-10-10
  - id: nist-7-1-4
    title: "NIST/SEMATECH e-Handbook of Statistical Methods, 7.1.4 What are confidence intervals?"
    publisher: National Institute of Standards and Technology
    url: https://www.itl.nist.gov/div898/handbook/prc/section1/prc14.htm
    accessed: 2026-10-10
  - id: nist-7-3-3
    title: "NIST/SEMATECH e-Handbook of Statistical Methods: How can we determine whether two processes produce the same proportion of defectives?"
    publisher: National Institute of Standards and Technology
    url: https://www.itl.nist.gov/div898/handbook/prc/section3/prc33.htm
    accessed: 2026-10-10
  - id: nist-1-3-6-7-1
    title: "NIST/SEMATECH e-Handbook of Statistical Methods, 1.3.6.7.1 Cumulative distribution function of the standard normal distribution"
    publisher: National Institute of Standards and Technology
    url: https://www.itl.nist.gov/div898/handbook/eda/section3/eda3671.htm
    accessed: 2026-10-10
evidence: [nist-7-1-3, nist-7-1-4, nist-7-3-3, nist-1-3-6-7-1]
claimsUsed: []
draft: false
---

A landing page test shows two versions of a page to different visitors and compares what each group does. For a young product the hard part is not running the test. It is reading the result without fooling yourself, because the traffic is small and small counts move around a lot. This article uses the U.S. National Institute of Standards and Technology's public statistics handbook to explain how to plan a two-version test, how to read it and when to say that the numbers cannot tell you anything. The numbers in the examples are invented to show the arithmetic. They are not benchmarks, and the article gives no figure for what a page change might achieve.

## What a test can show

A test compares one measurable action between two versions of a page: sign-ups, demo requests, replies. It can tell you whether the difference you saw is hard to explain by chance, given the number of visitors. It cannot tell you why one version did better, whether the visitors were the right ones, or whether the product is worth buying. The words on the page come from your [positioning statement](/insights/a-one-page-positioning-statement/) and the [landing page article](/insights/writing-a-landing-page-that-says-what-the-product-does/) shows how to write them. A test is one way to check a choice between two wordings, and a few conversations with buyers are another.

## Write the question before you look at the data

The handbook's page on statistical tests starts with a definition: "A statistical test provides a mechanism for making quantitative decisions about a process or processes." It sets out two hypotheses. About the first it says: "The conjecture is called the null hypothesis." For a page test the null hypothesis is that the two versions have the same underlying rate for the action. About the second it says that the alternative hypothesis may be what the tester actually believes is true. Here that is the belief that one version differs from the other.

Before you start, write down five things:

1. **The action.** One, such as "submits the request form". If you watch five actions and report the one that looks best, you have changed the question.
2. **The unit.** Usually a visitor, counted once.
3. **The two versions.** Change one thing, so a difference has a candidate cause.
4. **The risk you will accept.** The handbook says: "The test procedure is constructed so that the risk of rejecting the null hypothesis, when it is in fact true, is small." The page calls this risk the significance level and writes it as α. You choose it before the test, not after.
5. **When you will stop.** A visitor count or a date, decided in advance. Whether looking at results part-way changes how a procedure behaves is a question for a statistician, and the safest course is not to depend on early peeks.

The handbook also notes a second risk that you do not set: "The risk of failing to reject the null hypothesis when it is in fact false is not chosen by the user." In plain terms, a real difference can be missed, and the smaller your sample, the more likely that is.

## Reading two proportions

The handbook's page on comparing two proportions says: "The hypothesis of equal proportions can be tested using a z statistic". The statistic is built from counts you already have. Its top is the difference between the two observed proportions. Its bottom is the square root of p times (1 minus p) times (1 divided by n1 plus 1 divided by n2), where p is the pooled proportion, the total number of successes divided by the total number of visitors, and n1 and n2 are the visitors in each version. You then compare the size of the result with a critical value from the normal distribution.

The page gives a condition for using it: the normal approximation to the binomial applies when "the samples are reasonably large". The handbook does not set one number for that phrase in the sentence, so treat it as a reason to ask a statistician when your counts are small.

### An invented example

The numbers below are made up. They describe no real page.

| | Visitors | Sign-ups | Observed rate |
|---|---|---|---|
| Version A | 200 | 12 | 0.06 |
| Version B | 200 | 18 | 0.09 |

The pooled proportion is 30 divided by 400, or 0.075. The bottom of the statistic works out to about 0.0263, and the difference of 0.03 divided by that is about 1.14 in size. The handbook's table of the standard normal distribution lists "0.47500" in the row for 1.9 and the column for 0.06, which is the area between zero and 1.96. That leaves 0.025 in the upper tail and, by symmetry, 0.025 in the lower, which corresponds to a two-sided test at α of 0.05. A statistic of about 1.14 does not reach 1.96, so these counts do not separate the two versions at that risk level.

Now suppose the observed rates are the same, but there are 1,000 visitors per version, with 60 and 90 sign-ups. The pooled proportion is still 0.075. The bottom of the statistic falls to about 0.0118 and the statistic is about 2.55 in size, which passes 1.96. Nothing about the page changed. The only difference is the amount of data. A reading of "B did better" depends on how many people saw the pages as well as on how the rates compare.

## Small counts

A young product often has traffic like the third case below, and here the normal approximation is a poor fit. The handbook points to another procedure: "The Fisher Exact Probability test is an excellent choice for small samples". It works from the exact counts in a two-by-two table, with no approximation.

| | Visitors | Sign-ups |
|---|---|---|
| Version A | 20 | 3 |
| Version B | 20 | 6 |

The rates here are 0.15 and 0.30, and a sloppy reading would call B twice as good. The z statistic for these counts is about 1.14 again, but with 20 visitors per version it is the wrong tool, and the exact test is the one to run in a statistics package. This article does not give its result, since the point is the choice of tool. Many sets of small counts like these cannot separate two versions at any normal risk level, and that is an honest finding.

## Confidence intervals say how much you know

A test result is a yes or no at one risk level. A confidence interval shows the range of values the data support. The handbook says an interval "provides a range of values which is likely to contain the population parameter of interest" and that "Confidence intervals are constructed at a confidence level, such as 95 %, selected by the user." Reporting the interval for the difference in rates tells a reader more than a bare "significant" or "not significant". A wide interval says that the data leave many values possible. The handbook's page describes how an interval is interpreted over repeated samples, and a statistician can help you state it correctly for your case.

## How to report a result you can defend

Write the result as a short note in your log: the question, the two versions, the visitors and counts for each, the risk level chosen beforehand, the test used, what it showed and what you decided. "Not distinguishable with this amount of traffic" is a valid conclusion, and it points you toward bigger changes, more traffic, or other evidence such as buyer conversations, instead of toward a coin flip decided by noise.

## Habits that make a test harder to read

These are editorial cautions, not claims from the handbook.

- Changing the page while the test runs.
- Sending different kinds of visitors to each version, for example one version to an email list and the other to a forum, since the audience then differs as well as the page.
- Counting the same person more than once, or counting your own visits and automated traffic.
- Testing many versions or many actions at once and reporting the best. A statistician can explain what that does to the risk you chose.

For where traffic comes from in the first place, see the article on [choosing your first channels](/insights/choosing-your-first-channels/). The [glossary](/glossary/) defines terms such as activation, and the [metrics calculator](/tools/metrics-calculator/) works out SaaS measures from one month of your own numbers.

## What this article cannot tell you

This article cannot tell you how many visitors your test needs, what rate your page should reach, or whether a test is worth running at your current traffic. It gives no benchmark and no figure for any change. The four cited pages come from the NIST/SEMATECH e-Handbook of Statistical Methods, which was written for industrial processes, and they were read on 2026-10-10. The handbook describes the methods, and applying them to web visitors is this article's own step. The examples use invented counts. The handbook's procedures assume conditions, such as independent observations, that real web traffic may not meet. For a test that will decide something important, ask a statistician.
