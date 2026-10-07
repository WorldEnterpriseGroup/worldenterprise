---
title: "Early-stage SaaS metrics definitions"
subtitle: "How to define and report MRR, ARR, churn, net revenue retention, CAC and customer lifetime value consistently. Formulas only, no benchmarks."
description: "Definitions and a formula appendix for MRR, ARR, churn, NRR, CAC and LTV, drawn from public references, with a reporting discipline and no benchmarks."
publishedDate: 2026-10-06
version: "1.0"
methodology: "Collects the definition and formula each of five public references gives for a metric, reports them as written, flags any formula the references do not state, and adds a labelled reporting-consistency checklist."
limitations: "The references are an explanatory payments page and encyclopedia entries, not accounting standards. The ARR-as-twelve-times-MRR convention is not stated by the references used. Symbol expansions come from page summaries. The brief gives no benchmarks and no target values."
sources:
  - { id: stripe-nrr, title: "Net revenue retention (NRR)", publisher: Stripe, url: "https://www.stripe.com/resources/more/net-revenue-retention", accessed: 2026-10-06 }
  - { id: wiki-arr, title: "Annual recurring revenue", publisher: Wikipedia, url: "https://en.wikipedia.org/wiki/Annual_recurring_revenue", accessed: 2026-10-06 }
  - { id: wiki-cac, title: "Customer acquisition cost", publisher: Wikipedia, url: "https://en.wikipedia.org/wiki/Customer_acquisition_cost", accessed: 2026-10-06 }
  - { id: wiki-clv, title: "Customer lifetime value", publisher: Wikipedia, url: "https://en.wikipedia.org/wiki/Customer_lifetime_value", accessed: 2026-10-06 }
  - { id: wiki-churn, title: "Churn rate", publisher: Wikipedia, url: "https://en.wikipedia.org/wiki/Churn_rate", accessed: 2026-10-06 }
appendix: "Formula table and reporting checklist"
draft: false
---

## Summary

Early-stage companies are asked for the same handful of numbers by every investor, advisor and customer, and report them differently each time. The cost is not the arithmetic; it is that two reports of "churn" cannot be compared unless the definition is the same. This brief collects the published definition and formula for each metric, says where a formula is not stated by the references, and proposes a short discipline for reporting them consistently.

Every figure in this brief is a formula or a symbol. There are no benchmarks, no typical values and no targets.

## Definitions and formulas

### Recurring revenue: MRR and ARR

"Recurring revenue is often tracked on either a monthly basis, as monthly recurring revenue (MRR), or an annual basis, as annual recurring revenue (ARR)" [(ARR entry)](#source-wiki-arr). The entry describes MRR as the average monthly client payment multiplied by the number of clients, and one-time fees are excluded.

The entry does not give a formula converting MRR to ARR. A common convention is to multiply a monthly figure by twelve. That convention is not stated by the references used here, so it is treated as a reporting choice: say which one you use.

### Customer churn

Churn rate "is a metric that measures the proportion of individuals (e.g. employees), customers, or items that leave a defined group during a specified period of time." For customers the entry gives Churn = (L / T) x 100, where L is customers lost and T is total customers during the time period [(Churn entry)](#source-wiki-churn). The entry notes an alternative that divides by customers acquired in the period instead of total customers, which is a different metric and must be labelled as such.

### Net revenue retention

"Net revenue retention (NRR) is a metric that measures a company's ability to retain revenue from existing customers over a specific period of time." The formula as shown is:

NRR = [(beginning recurring revenue - MRR lost from churn - MRR lost from downgrades + revenue from upgrades) / beginning recurring revenue] x 100 [(Stripe)](#source-stripe-nrr)

### Customer acquisition cost

"Customer acquisition cost (CAC) is the cost of persuading a customer to purchase a product or service." The simple form is CAC = MCC / CA, marketing cost for the period divided by customers acquired in it. An extended form adds sales and marketing wages, software, professional services and overhead [(CAC entry)](#source-wiki-cac). The choice between simple and extended changes the number, so state which you use.

### Customer lifetime value

LTV, or customer lifetime value (CLV), is "the net profit that a customer contributes to during the entire future relationship with a business." The basic formula shown is CLV = Margin x (Retention / (1 + Discount - Retention)), where the discount term reflects the time value of money [(CLV entry)](#source-wiki-clv). The CAC entry notes that a ratio of lifetime value to acquisition cost is sometimes quoted as a target; this brief records that the idea exists and publishes no target, because a rule of thumb is not a benchmark.

## Analysis: reporting consistently

This section is analysis by World Enterprise Editorial. It is a recommendation, not a statement of the references.

1. **Fix the period.** Report each metric over a stated period, and the same period each time.
2. **Fix the population.** Say which customers are in the denominator: all, paying only, or one cohort.
3. **Separate recurring from one-time.** The MRR entry excludes one-time fees; keep them out of every recurring metric.
4. **State the conversion convention.** If ARR is derived from MRR, write down the rule.
5. **Pair the number with its formula.** A reader should be able to recompute it from your inputs.
6. **Never mix simple and extended CAC in one trend line.** If the definition changes, restate the history.
7. **Do not quote a ratio without its inputs.** A ratio of two derived metrics hides both definitions.

## Methodology

On 6 October 2026 the five references listed under Sources were retrieved. For each metric the quotation and formula are reproduced as returned by the retrieval tool. A formula the references do not state is marked as a convention. Symbol meanings (MCC, CA, L, T) are as read from the page summaries. Nothing in this brief is a measured value.

## Limitations

- The references are one payments-company explainer and four encyclopedia entries. None is an accounting standard, and none replaces the definitions in a company's financial reporting framework.
- The MRR to ARR conversion is not stated by the references and is a convention here.
- Symbol expansions were read from page summaries and should be confirmed against the pages.
- Other widely used references (for example Investopedia and Stripe's MRR page) could not be retrieved, so they are not cited.
- The brief gives no benchmarks. Do not infer one from an example.

## Appendix: formula table and reporting checklist

| Metric | Formula as published | Reference | Note |
|---|---|---|---|
| MRR | Average monthly client payment x number of clients; one-time fees excluded | [ARR entry](#source-wiki-arr) | Define "client" and "payment" |
| ARR | Recurring revenue on an annual basis | [ARR entry](#source-wiki-arr) | Conversion from MRR is a stated convention |
| Customer churn | (Customers lost / Total customers during period) x 100 | [Churn entry](#source-wiki-churn) | State the period and the population |
| NRR | [(Beginning recurring revenue - MRR lost from churn - MRR lost from downgrades + revenue from upgrades) / Beginning recurring revenue] x 100 | [Stripe](#source-stripe-nrr) | Existing customers only |
| CAC, simple | MCC / CA | [CAC entry](#source-wiki-cac) | Marketing cost over customers acquired |
| CAC, extended | Simple form plus sales and marketing wages, software, professional services, overhead | [CAC entry](#source-wiki-cac) | Label which form is used |
| CLV | Margin x (Retention / (1 + Discount - Retention)) | [CLV entry](#source-wiki-clv) | Basic form only |

Reporting checklist, each item answered in writing for every metric you report:

1. What is the period?
2. Who is in the population?
3. Are one-time fees excluded?
4. Which formula variant is used?
5. Has the definition changed since the last report?
6. Can a reader recompute the number from the inputs given?
