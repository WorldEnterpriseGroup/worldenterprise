---
id: ai-company-diligence
title: "Diligence on an early-stage company that depends on a model"
version: "1.0"
updated: 2026-10-11
audience: [investor]
sentinel: "A model-dependent product has a supplier inside its cost, its quality and its legal position, and diligence is the work of finding where that supplier sits."
sources:
  - { id: nist-airmf, title: "AI Risk Management Framework", publisher: "National Institute of Standards and Technology", url: "https://www.nist.gov/itl/ai-risk-management-framework", accessed: 2026-10-11 }
  - { id: nist-genai, title: "Artificial Intelligence Risk Management Framework: Generative Artificial Intelligence Profile", publisher: "National Institute of Standards and Technology", url: "https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence", accessed: 2026-10-11 }
  - { id: nist-ssdf-ai, title: "Secure Software Development Practices for Generative AI and Dual-Use Foundation Models: An SSDF Community Profile (SP 800-218A)", publisher: "National Institute of Standards and Technology, Computer Security Resource Center", url: "https://csrc.nist.gov/pubs/sp/800/218/a/final", accessed: 2026-10-11 }
  - { id: eu-ai-act, title: "AI Act", publisher: "European Commission, Shaping Europe's digital future", url: "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai", accessed: 2026-10-11 }
  - { id: owasp-llm10, title: "OWASP Top 10 for LLM Applications", publisher: "OWASP GenAI Security Project", url: "https://genai.owasp.org/llm-top-10/", accessed: 2026-10-11 }
  - { id: copyright-ai, title: "Copyright and Artificial Intelligence", publisher: "U.S. Copyright Office", url: "https://www.copyright.gov/ai/", accessed: 2026-10-11 }
  - { id: copyright-part2, title: "Copyright Office Releases Part 2 of Artificial Intelligence Report", publisher: "U.S. Copyright Office", url: "https://www.copyright.gov/newsnet/2025/1060.html", accessed: 2026-10-11 }
  - { id: sec-ai-claims, title: "SEC Charges Two Investment Advisers with Making False and Misleading Statements About Their Use of Artificial Intelligence", publisher: "U.S. Securities and Exchange Commission", url: "https://www.sec.gov/newsroom/press-releases/2024-36", accessed: 2026-10-11 }
  - { id: ftc-ai-comply, title: "FTC Announces Crackdown on Deceptive AI Claims and Schemes", publisher: "Federal Trade Commission", url: "https://www.ftc.gov/news-events/news/press-releases/2024/09/ftc-announces-crackdown-deceptive-ai-claims-schemes", accessed: 2026-10-11 }
  - { id: osi-aidef, title: "The Open Source AI Definition, version 1.0", publisher: "Open Source Initiative", url: "https://opensource.org/ai/open-source-ai-definition", accessed: 2026-10-11 }
  - { id: openai-data, title: "Data controls in the OpenAI platform", publisher: "OpenAI, developer documentation", url: "https://developers.openai.com/api/docs/guides/your-data", accessed: 2026-10-11 }
  - { id: claude-privacy, title: "Is my data used for model training?", publisher: "Anthropic, Claude privacy center", url: "https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training", accessed: 2026-10-11 }
---

# Diligence on an early-stage company that depends on a model

This brief sets out what an investor can look at in an early-stage software company whose product depends on a machine learning model, and what each kind of evidence can and cannot show. It is general information, current as of October 11, 2026. It is not legal, tax or investment advice, and every rule it describes should be checked against its current text with a qualified professional before a decision rests on it.

## The question this brief answers

Most diligence on a software company starts from familiar ground: the legal entity, the cap table, the customers, the code. A company whose product calls a model adds a layer that those checks do not reach. The model may belong to someone else, the data that taught it may carry conditions, and the product's behavior may change when the supplier changes the model.

A model-dependent product has a supplier inside its cost, its quality and its legal position, and diligence is the work of finding where that supplier sits. That sentence is the organizing idea of this brief. It does not say the supplier is a problem. It says the supplier is a fact about the company that belongs in the file, as a lease or a key customer would.

The brief takes eight checks in turn: what the product asks of the model, who may use the data, which supplier and which license sit underneath, how the product is attacked, what evidence shows that it works, what the company says about its AI, which rules may reach it, and who owns what it produces. For each check it reports what a public source says, then separates that report from analysis of what an investor might ask.

## About the evidence

The brief draws on twelve documents, each retrieved and read on October 11, 2026. They fall into four groups.

The first group is government and standards-body material: three pages from the National Institute of Standards and Technology, the European Commission's page on the AI Act, two pages from the U.S. Copyright Office, and enforcement announcements from the Securities and Exchange Commission and the Federal Trade Commission. They describe frameworks, rules and actions as their authors state them. They do not say how any rule applies to a particular company.

The second group is a community security document: the OWASP GenAI Security Project's list of leading risks for applications built on large language models. It is not a regulation.

The third group is publishers describing their own documents or practices. The Open Source Initiative publishes a definition of open source AI, and two model suppliers publish documentation about how they handle customer data. A supplier's documentation is a statement by an interested party, and the brief treats it as such.

The fourth group is the analysis in this brief. Where a sentence is a judgment and not a report of a source, it is marked as analysis or phrased as a question. No statistic about how often any of these risks becomes a loss appears in this brief, because none of the twelve sources supplies one.

Two limits deserve mention at the start. Most of the pages are summaries for a general audience, and a summary leaves out exceptions that the underlying text contains. Several of them also change often.

## How to read the checks

The checks are not a ranking. A company can be strong on one and weak on another for reasons that have nothing to do with its quality as a business. A model supplier's terms matter more to a company that sends customer documents through the model than to one that uses it to draft internal text. A rule about high-risk systems matters more to a company selling into hiring than to one selling a writing tool.

Each check below reports what the sources say, what the evidence for that check might look like in a company's files, and what that evidence cannot show. The brief uses "the supplier" for the organization that provides the model the product calls, and "the company" for the early-stage business under review. Some companies train their own models, and for them the supplier is partly the company itself and partly whoever provided the data. The checks apply in either case, with different documents behind them.

## Check one: what the product asks of the model

The first question is plain and often skipped: what does the product need the model to do, and what happens when the model does it badly? A product that drafts text for a human to edit asks little of the model's reliability. A product that takes an action in a customer's account on the model's word asks a great deal.

The NIST AI Risk Management Framework gives a vocabulary for the question. The page describes the framework as a way to better manage risks to individuals, organizations and society associated with artificial intelligence, and it says the framework is intended for voluntary use. It is organized around the functions Govern, Map, Measure and Manage. The generative AI profile is a cross-sectoral companion resource to that framework, published in July 2024, and it is also intended for voluntary use.

Neither document is a law, and a company that does not follow them has broken no rule. Analysis: their value in diligence is as a list of questions the company should have asked itself. Has anyone written down what the model is used for, what a wrong answer costs and who reviews it? A short internal document that answers those questions is evidence of a certain kind of care. Its absence is not evidence of the opposite, because an early-stage team may carry the answers in its heads.

What this check cannot show is whether the model behaves as described. A written intention is not a measurement.

## Check two: who may use the data

A model-dependent product handles data in at least two directions. Customer data goes into the model through prompts and documents. Other data, which the company or its supplier used to teach the model, sits behind the model.

On the first direction, the suppliers publish their own account. One supplier's developer documentation says that data sent through its programming interface is not used to train its models unless the customer opts in, and that logs created to monitor abuse are kept for a limited period by default. The same page describes an approval-based option that excludes customer content from those logs. A second supplier's privacy documentation says it does not by default use inputs or outputs from its commercial products to train its models, and that training can occur where a customer opts in or reports feedback.

These are statements by suppliers about their own practices. They show what a supplier says its default is. They do not show what the company signed, or whether its customers were told that their data passes to a supplier at all.

On the second direction, the Open Source Initiative's definition offers a useful standard even for a company that does not publish its model. It says an open source AI system must come with sufficiently detailed information about the data used to train the system. Analysis: a company that cannot describe the origin of its training data in similar terms has an open question about whether it may use that data for this purpose. An investor might ask where the training or fine-tuning data came from, under what terms, and whether any of it came from customers.

What this check cannot show is the contract itself. Enterprise terms are often negotiated, so the file should contain the signed agreement and not only the public page.

## Check three: the supplier and the license

The organizing idea of this brief applies here. If the product calls a supplier's model, the supplier's terms are part of the company's legal position, and the supplier's pricing and availability are part of its cost and its continuity.

An investor might ask which suppliers the product calls and whether it could run on another. Is there a written agreement, and what does it say about changes to the model, notice before a model is withdrawn, ownership of outputs, and use of the company's data? What happens if the supplier raises its prices or changes its terms? These are questions about concentration, the dependence of a business on a single source. The sources in this brief do not supply a measure of it, and the evidence is the company's own architecture and contracts.

For a company that uses a model released under a license, the license is the document. The Open Source Initiative's definition lists four freedoms: to use the system for any purpose without having to ask for permission, to study how it works, to modify it for any purpose and to share it for others to use. It also says the model parameters, such as weights or other configuration settings, must be made available under OSI-approved terms for a system to qualify. Analysis: many models are described informally as open without meeting that definition. A diligence file should name the actual license, whatever the model is called in marketing, and should record any use restriction in it.

What this check cannot show is whether a supplier will behave tomorrow as its documents say today. A supplier's published practice is a statement of present policy and it can change.

## Check four: how the product is attacked

A product built on a language model has security problems that ordinary web applications do not. The OWASP Top 10 for LLM Applications names them. Its 2025 list includes Prompt Injection, Sensitive Information Disclosure, Supply Chain, Data and Model Poisoning, Improper Output Handling, Excessive Agency, System Prompt Leakage, Vector and Embedding Weaknesses, Misinformation and Unbounded Consumption.

Two of these matter most to an investor reading a company's architecture. Prompt Injection concerns prompts that alter what the model does. Excessive Agency concerns how much the model is allowed to do. The page frames a system as often granted a degree of agency, and the question for diligence is whether the company has limited what a manipulated model could do. Analysis: a product whose model can send email, change records or spend money on its own authority has a larger consequence if injection succeeds than one whose model only drafts text for a person to approve.

NIST's secure development profile adds a second reference. It augments the secure software development practices and tasks of the Secure Software Development Framework, version 1.1, and it is intended to be useful to producers of AI models, producers of AI systems that use those models and acquirers of those systems. An investor is not an acquirer in that sense, but the profile shows what a reasonable secure development process contains.

An investor can ask for a description of the controls, the results of any security testing and a record of incidents. What this check cannot show is that the product is secure. A company that has answered each risk in writing has still not proven the answers correct.

## Check five: evidence that the product works

The most useful evidence in this category is also the hardest to read from outside: the company's own measurements of how well the model does its job. The NIST framework treats measurement as a function of risk management, and it names Measure among its four functions.

An investor might ask what the company measures, on what set of examples, how those examples were chosen and who chose them. Analysis: an evaluation built from the cases the product already handles well will show a good result by construction. A more informative one includes cases the company expects to fail, and it is run again whenever the supplier changes the model or the company changes the instructions it sends. A company that can show a dated series of results, with the cases that got worse as well as those that got better, is showing something a single headline figure cannot.

Be careful with any single accuracy figure the company offers. A figure without the test set behind it is a claim, not evidence. The sources in this brief supply no benchmark, and the brief states none.

What this check cannot show is how the product will behave on tomorrow's customer. An evaluation is a sample.

## Check six: what the company says about its AI

Statements about artificial intelligence made to customers and to investors are subject to the same law as other statements. Regulators have said so in terms an investor can read.

The Securities and Exchange Commission announced settled charges against two investment advisers over statements about their use of artificial intelligence. One order found that the firm did not in fact have the AI and machine learning capabilities that it claimed. The announcement quotes the chair of the Commission at the time as saying that investment advisers should not mislead the public by saying they are using an AI model when they are not. The Federal Trade Commission, announcing a set of enforcement actions against deceptive uses of AI, quoted its chair as saying that there is no AI exemption from the laws on the books.

Neither announcement concerns an early-stage software company that sells to businesses, and neither says anything about how often a company overstates its AI. Their relevance is narrower: two agencies have treated a gap between a company's description of its AI and what the system does as a legal matter. Analysis: the practical questions are which statements in the company's pitch, website and customer contracts describe the model's role, and whether each is supported by something in the file. A claim that the product is powered by a model should match an actual call to a model. A claim about what the system can do should match the evaluation in the fifth check.

What this check cannot show is whether a particular statement is false. That is a matter of the facts and the law, for counsel to assess.

## Check seven: the rules that may reach the product

The European Commission's page describes the AI Act as taking a risk-based approach. It says the Act entered into force on 1 August 2024 and became applicable on 2 August 2026, with some exceptions. It sorts AI into categories. All AI systems considered a clear threat to the safety, livelihoods and rights of people are banned. AI use cases that can pose serious risks to health, safety or fundamental rights are classified as high-risk, and the page lists areas such as critical infrastructure, education, employment and law enforcement. The Act does not introduce rules for AI that is deemed minimal or no risk.

For high-risk systems the page describes strict obligations before a system can be put on the market, including risk assessment and mitigation, high-quality datasets, logging of activity, detailed documentation, human oversight and robustness. It dates the start of those obligations for high-risk systems in sensitive areas to 2 December 2027. It also says that providers of generative AI have to ensure that AI-generated content is identifiable. The page mentions transparency and copyright requirements for providers of general-purpose models, which concern the supplier more than a company that calls the model.

The page itself lists several dates, and a schedule like this one can move. An investor should read the current schedule rather than this summary.

Analysis: the useful diligence step is classification. Does the company know which category its product falls into in each market it sells to? A drafting tool and a screening tool for hiring decisions face very different positions. The file should contain the company's own reasoning, even if brief, and its date. Whether the Act applies to a given company at all is a question for counsel.

What this check cannot show is the position under any other law. Other jurisdictions, and the state laws of the United States, are not covered by these sources.

## Check eight: who owns what the product produces

A model-dependent product produces text, images, code or decisions, and customers often ask who owns them. The U.S. Copyright Office has published its views in parts. The second part addresses the copyrightability of outputs created using generative AI. The announcement says the Office concludes that outputs can be protected by copyright only where a human author has determined sufficient expressive elements. It says protection can apply where a human makes creative arrangements or modifications of the output, but not the mere provision of prompts. It also says the Office finds that the case has not been made for changes to existing law.

The Office's page also says that its third part, on generative AI training, was released in a pre-publication version in May 2025, with a final version to follow.

Analysis: if a company's value includes outputs that it expects to own or license, an investor can ask how much human authorship goes into them. A company that sells raw model output as a proprietary asset is relying on an ownership position that the Office's statement makes harder to assume. The question is not whether the output is useful, but what rights, if any, the company can pass to a customer, and the customer agreements should be read against it.

What this check cannot show is how a court would treat a given output or a given training practice. The Office's views are not a decision of a court.

## The checks side by side

| Check | What the file might hold | What it cannot show |
|---|---|---|
| What the product asks of the model | A written account of the model's role | That the model behaves as described |
| Who may use the data | Signed supplier terms, data provenance | Whether customers were told |
| The supplier and the license | The agreement, the license, a fallback plan | That the supplier's policy stays the same |
| How the product is attacked | Security test results, limits on the model | That the product is secure |
| Evidence that it works | Dated evaluations and their test sets | Behavior on a new customer's data |
| What the company says about its AI | Support for each claim made | Whether a statement is false |
| The rules that may reach it | A classification by market, dated | The position in other jurisdictions |
| Who owns the output | Customer terms on outputs | How a court would decide |

## Questions to ask before relying on the answers

The questions below are for an investor to put to a company, or to counsel. They are not a checklist whose completion means a company is sound.

**What does the model do, and what does a bad answer cost?** Ask for the written account, and ask who reads the output before a customer sees it.

**Which suppliers does the product call, and on what written terms?** Ask for the agreements and not the public pages.

**Where did the data come from?** Ask for provenance for any training or fine-tuning data and the terms under which the company may use it.

**What could a manipulated model do?** Ask what actions the model may take without a person, and what testing has been done.

**What do the evaluations show, and when were they last run?** Ask for the test set, the dates and the cases that got worse.

**Can each statement about the AI be supported?** Ask for the pitch, the website and the customer contract side by side.

**Which rules apply in the markets where the product is sold?** Ask for the company's reasoning and its date.

**What does the company own, and what does it promise customers?** Ask for the customer terms on outputs.

## What this brief cannot tell you

This brief is general information. It is not an assessment of any company, and it is not a recommendation to invest in one. WE makes no promise of funding.

It cannot tell you whether any company is sound, whether its model works, or whether its claims are true. Those are facts about a particular company that no general document can know. The brief names no company and describes no particular arrangement.

It cannot tell you the current terms of any supplier. The supplier pages were read on a single day, and they describe defaults, which a signed agreement may change.

It cannot tell you how a rule applies to your facts. The pages from regulators and standards bodies are summaries for a general audience. Nothing here is a view on whether a product is high-risk or whether an output is protected by copyright.

It cannot tell you about other jurisdictions. The brief describes one European regulation and several United States agencies. The laws of individual states, and of every other country, are not covered.

It cannot tell you how often any of these risks leads to a loss. The evidence set contains no outcome data, and the brief offers none. It does not cover patent rights in inventions made with a model, or the tax treatment of any structure.

Finally, it is analysis in places, and the analysis can be wrong. Treat the sentences marked as analysis as questions to test, not as findings.

## Sources

- National Institute of Standards and Technology, "AI Risk Management Framework," https://www.nist.gov/itl/ai-risk-management-framework
- National Institute of Standards and Technology, "Artificial Intelligence Risk Management Framework: Generative Artificial Intelligence Profile," https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence
- National Institute of Standards and Technology, Computer Security Resource Center, "Secure Software Development Practices for Generative AI and Dual-Use Foundation Models: An SSDF Community Profile (SP 800-218A)," https://csrc.nist.gov/pubs/sp/800/218/a/final
- European Commission, "AI Act," https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai
- OWASP GenAI Security Project, "OWASP Top 10 for LLM Applications," https://genai.owasp.org/llm-top-10/
- U.S. Copyright Office, "Copyright and Artificial Intelligence," https://www.copyright.gov/ai/
- U.S. Copyright Office, "Copyright Office Releases Part 2 of Artificial Intelligence Report," https://www.copyright.gov/newsnet/2025/1060.html
- U.S. Securities and Exchange Commission, "SEC Charges Two Investment Advisers with Making False and Misleading Statements About Their Use of Artificial Intelligence," https://www.sec.gov/newsroom/press-releases/2024-36
- Federal Trade Commission, "FTC Announces Crackdown on Deceptive AI Claims and Schemes," https://www.ftc.gov/news-events/news/press-releases/2024/09/ftc-announces-crackdown-deceptive-ai-claims-schemes
- Open Source Initiative, "The Open Source AI Definition, version 1.0," https://opensource.org/ai/open-source-ai-definition
- OpenAI, "Data controls in the OpenAI platform," https://developers.openai.com/api/docs/guides/your-data
- Anthropic, "Is my data used for model training?," https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training
