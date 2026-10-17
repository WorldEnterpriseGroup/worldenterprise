---
id: ai-native-build
title: "Building an AI-native product: considerations for founders"
version: "1.0"
updated: 2026-10-10
audience: [startup]
sentinel: "A model can be asked to do almost anything, so the work of building a product around one is deciding what it must never be allowed to do."
sources:
  - { id: nist-airmf, title: "AI Risk Management Framework", publisher: "National Institute of Standards and Technology", url: "https://www.nist.gov/itl/ai-risk-management-framework", accessed: 2026-10-10 }
  - { id: nist-core, title: "AI RMF Core", publisher: "National Institute of Standards and Technology, AI Resource Center", url: "https://airc.nist.gov/airmf-resources/airmf/5-sec-core/", accessed: 2026-10-10 }
  - { id: nist-genai, title: "Artificial Intelligence Risk Management Framework: Generative Artificial Intelligence Profile", publisher: "National Institute of Standards and Technology", url: "https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence", accessed: 2026-10-10 }
  - { id: owasp-top10, title: "OWASP Top 10 for LLM Applications", publisher: "OWASP GenAI Security Project", url: "https://genai.owasp.org/llm-top-10/", accessed: 2026-10-10 }
  - { id: owasp-llm01, title: "LLM01:2025 Prompt Injection", publisher: "OWASP GenAI Security Project", url: "https://genai.owasp.org/llmrisk/llm01-prompt-injection/", accessed: 2026-10-10 }
  - { id: owasp-llm06, title: "LLM06:2025 Excessive Agency", publisher: "OWASP GenAI Security Project", url: "https://genai.owasp.org/llmrisk/llm062025-excessive-agency/", accessed: 2026-10-10 }
  - { id: eu-ai-act, title: "AI Act", publisher: "European Commission, Shaping Europe's digital future", url: "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai", accessed: 2026-10-10 }
  - { id: anthropic-evals, title: "Define success criteria and build evaluations", publisher: "Anthropic, Claude developer documentation", url: "https://platform.claude.com/docs/en/test-and-evaluate/develop-tests", accessed: 2026-10-10 }
  - { id: openai-evals, title: "Evaluation best practices", publisher: "OpenAI, developer documentation", url: "https://developers.openai.com/api/docs/guides/evaluation-best-practices", accessed: 2026-10-10 }
---

# Building an AI-native product: considerations for founders

This brief sets out the considerations a founder faces when the core of a software product is a language model, and it is organized around the decisions that follow from that choice. It is general information, current as of October 10, 2026. It is not legal, tax or investment advice, and every rule or framework it describes should be checked against the current text with a qualified professional before a decision rests on it.

## The question this brief answers

A founder who builds a product around a language model gets a great deal of capability for little effort, and a set of questions that conventional software mostly does not raise. The model's output varies. It can be steered by text that arrives from outside the product. It can be given the ability to act, and then act wrongly. Whether it works is not settled by the usual tests, and in some markets the law now has views about it.

The common advice treats these as separate topics for separate teams: security here, quality there, compliance later. This brief treats them as one design problem and asks of each decision the same plain question: what is the model allowed to do, who decides, and how would you know if it went wrong? A model can be asked to do almost anything, so the work of building a product around one is deciding what it must never be allowed to do.

The sections below name the considerations, report what published frameworks and documentation say about each, and mark where the brief is giving its own judgment. It does not recommend a model, a vendor or an architecture.

## About the evidence

This brief draws on nine documents, each retrieved and read on the day it was written, October 10, 2026. They fall into four groups.

The first group is standards-body guidance from the National Institute of Standards and Technology: the page on the AI Risk Management Framework, the page describing the four functions at the framework's core, and the catalog entry for the Generative AI Profile that accompanies it. These documents are voluntary, and they describe a way of organizing the work, not a technical requirement.

The second group is the OWASP GenAI Security Project, which publishes a ranked list of risks for applications built on large language models. The brief uses the list page and two of its entries, on prompt injection and on excessive agency. The list is community guidance on security practice, not law and not an audit standard.

The third group is one regulator: the European Commission's page on the AI Act. It is a government description of a law, and it states dates and categories that the law and its amendments can change.

The fourth group is documentation from two model vendors, Anthropic and OpenAI, on how to define success and evaluate an application. These are used only to report what each vendor recommends, and each vendor has an interest in how its own tools are used. No claim in this brief about how well any model performs rests on them.

The analysis in this brief is its own. Where a sentence is a judgment rather than a report of a source, it is marked as analysis or phrased as a consideration. No statistic about how often models fail, how often applications are attacked or how many companies are affected appears in this brief, because none of the nine sources supplies one for the purpose.

Three limits on the evidence deserve mention at the start. The sources are summaries and guidance, and a summary leaves out detail that the underlying text contains. The field moves quickly, and the evidence was read on a single day. And the Generative AI Profile's own list of risks was not part of the evidence, because the page read is a catalog entry and does not set the list out.

## How to read the considerations

Each consideration below is described the same way: what a source says, what the consideration settles for a product, and what the founder should confirm with someone qualified. The parts that are analysis are labeled.

The considerations are not a sequence. A team will return to each of them as the product changes. They are ordered from the broadest, how the risk is managed at all, to the most specific, which law may reach the product.

## Consideration one: what the product asks of the model

This brief uses a working definition that is its own, not a sourced one. Analysis: an AI-native product is one whose main function would stop working if the model were removed, as opposed to a conventional product that has a model-powered feature added to it.

The distinction matters because it sets how much of the product's behavior the founder controls. In a conventional product, behavior is whatever the code says. In an AI-native product, behavior is partly whatever the model produces on a given day for a given input, and the code's job is to surround that behavior with limits. Analysis: that is the reason the questions in the rest of this brief belong to the founder and not only to a security or compliance specialist. They are questions about what the product is.

## Consideration two: managing the risk as a process

The National Institute of Standards and Technology describes its AI Risk Management Framework as a framework to better manage risks to individuals, organizations and society associated with artificial intelligence. The page says the framework is intended for voluntary use, and that it aims to improve the ability to incorporate trustworthiness considerations into the design, development, use and evaluation of AI products, services and systems. The page also says the framework is being revised, so the version a founder reads may not be the version in force next year.

A companion page describes the four functions at the framework's core. Govern is the cross-cutting function that runs through the other three and covers the culture, policies and accountability behind the work. Map establishes the context for a system: its intended uses, the people it affects and its limits. Measure uses quantitative, qualitative or mixed methods to assess and monitor the risks. Manage allocates resources to the risks that have been mapped and measured, and plans the response.

The Generative AI Profile is described by its catalog entry as a cross-sectoral profile of, and companion resource for, the framework, applied to generative AI. The entry does not list the risks the profile covers, and this brief does not claim to.

What this settles for a product is the shape of the work, not its content. Analysis: for a small team the four functions are a useful checklist of questions, in order: who is accountable, what is this system for and who does it affect, how will we assess it, and what do we do when the assessment finds something. A team that has answered the first two can answer the last two. A team that has not will find that the technical choices in the later sections have no one responsible for making them.

The framework is voluntary, and the page does not say that following it satisfies any law or any customer. Analysis: it can still be useful evidence. A customer's security reviewer who asks how the company manages AI risk is asking for a description of a process, and the four functions give a vocabulary for one.

## Consideration three: how a model application is attacked

OWASP publishes a ranked list of the main security risks for applications built on large language models. The 2025 list, as the page shows it, has ten entries: prompt injection, sensitive information disclosure, supply chain, data and model poisoning, improper output handling, excessive agency, system prompt leakage, vector and embedding weaknesses, misinformation and unbounded consumption.

The first entry is the one that distinguishes these applications most. The page on prompt injection says that direct prompt injections occur when a user's prompt input directly alters the behavior of the model, and that indirect prompt injections occur when the model accepts input from external sources, such as websites or files. The second form is the one a founder is likelier to overlook, because the person who wrote the hostile text is not the person using the product. A product that reads email, summarizes web pages or processes uploaded documents is taking input from people who are not its users.

The page lists mitigations, including constraining the model's behavior, defining and validating expected output formats with deterministic code, filtering inputs and outputs, enforcing least privilege, requiring human approval for high-risk actions, separating untrusted content from instructions and running adversarial tests. It also says plainly that, given how models work, it is unclear whether there are fool-proof methods of prevention.

That statement is the most useful sentence on the page for a founder. It means that the mitigations reduce the impact and the likelihood of an attack, and that none of them closes the question. Analysis: a design that depends on the model never being fooled is a design that will fail. A design that assumes the model will sometimes be fooled, and limits what that can cost, is one that can be defended. This is why the next consideration is about what the model is allowed to do, not about what it is told.

The list includes entries that this brief does not describe: poisoning, supply chain, embeddings, system prompt leakage and others. A founder building a product should read the full entries that apply to it.

## Consideration four: how much the model may do

OWASP's entry on excessive agency describes a vulnerability that enables damaging actions to be performed in response to unexpected, ambiguous or manipulated outputs from a model. The page says the cause can be hallucination or poor model performance, or direct or indirect prompt injection. It says the root cause is typically one or more of excessive functionality, excessive permissions and excessive autonomy: that is, the model has access to more capabilities, more rights or more freedom to act without checks than the application needs.

The mitigations the page lists follow from the causes. Limit the tools the model may call to the minimum necessary. Grant downstream access at the minimum level needed, such as read-only roles. Require a human to approve high-impact actions. And, in the page's words, implement authorization in downstream systems rather than relying on a model to decide if an action is allowed or not.

That last mitigation is worth stating in plain terms. If the model decides whether it may delete a record, then an attacker who can steer the model can delete the record. If the system that holds the record checks whether the requester is allowed to delete it, the model's opinion does not matter. Analysis: the practical rule is that the model proposes and the surrounding code disposes. Every action a model can trigger should pass through a check that does not depend on the model's judgment.

The page notes that logging, monitoring and rate limiting do not prevent excessive agency but can limit the damage it causes. Analysis: they also give the team a way to know what happened, which the closing question of this brief depends on.

What this settles for a product is its authority boundary. A founder can answer it concretely: list every action the model can cause, and beside each write who or what checks it. The list is short for a product that only produces text for a person to read, and long for one that sends messages, spends money or changes records. The more the list contains, the more the product's safety depends on the checks and not on the model.

## Consideration five: knowing whether it works

Conventional tests ask whether the code returns the expected value. A model application can return a different answer to the same input, so the question changes: how often, and in what ways, does it do what it should? Both vendors' documentation treats the answer as something a team must build.

Anthropic's documentation says that building a successful application based on a language model starts with clearly defining the success criteria and then designing evaluations to measure performance against them. It says criteria should be specific, measurable, achievable and relevant, and it notes that most use cases need evaluation along several criteria at once. Its design principles are to make evaluations specific to the real task, including edge cases, to automate grading where possible and to prefer more questions with slightly lower signal over fewer questions graded by hand.

OpenAI's documentation makes similar points in its own words. It recommends evaluating early and often, designing tests that reflect real-world use, automating scoring where possible and using human feedback to calibrate the automated scoring. It describes three kinds of grader: metric-based ones, which give a numerical score and may miss nuance; human ones, which it describes as the highest quality but slow and expensive; and ones that use a model as judge, which it describes as cheaper and more scalable than human evaluation. It flags position and verbosity bias in model judges.

The two vendors agree on the shape of the practice and differ in emphasis. Both are describing how to use their own tools, and neither supplies evidence that following their advice produces a better product. This brief reports the advice and does not endorse a method.

Analysis: the useful point for a founder is that the evaluation set is a product asset. It records what the team decided the product should do. A team that has one can change the model, the prompt or the vendor and find out what changed. A team that does not is guessing each time. The set also supports the earlier considerations: a test for a prompt injection that once worked belongs in the set, and so does a test for an action the model should never take.

Analysis: the cheapest time to start is before the first customer. The first examples are the ones that came up while the founders were building, and they are lost if no one writes them down.

## Consideration six: the law that may reach the product

The European Commission describes the AI Act as a law that sorts AI systems into categories of risk. The page says that all AI systems considered a clear threat to the safety, livelihoods and rights of people are banned. It says that AI use cases that can pose serious risks to health, safety or fundamental rights are classified as high-risk, and it gives obligations on such systems, with risk management, documentation and human oversight as examples. A further category is about transparency: the page describes disclosure duties, such as telling people when they are interacting with a chatbot, and says providers of generative AI must make AI-generated content identifiable. And the page says the Act does not introduce rules for AI that is deemed minimal or no risk.

The page also describes rules for providers of general-purpose AI models, with transparency and copyright given as examples. Those obligations sit with the provider of the model. A founder who builds on someone else's model is usually a user of such a model, not its provider, though the page does not say where the line falls and this brief does not guess.

The page gives dates for the stages at which the Act applies, running from 2025 to 2028, and it mentions amendments that change some of them. Analysis: dates in a regulation like this one move, and the date a founder needs is the one in force when the product ships. This brief states none of them as settled, and the current schedule should be read from the source.

What this settles for a product is whether it is likely to fall in a regulated category at all, which depends on what the product is used for and where it is offered. The Act is a European law. A company that sells to customers in the European Union should ask a lawyer whether the Act reaches the product. Analysis: a product that helps with a decision about a person, such as hiring or education, is the kind the high-risk category describes, and the questions in the earlier sections about oversight and records become more than good practice for such a product. This brief does not describe the annexes or any other jurisdiction's rules.

## The considerations side by side

| Consideration | What it settles | What stays open | Where the evidence is |
|---|---|---|---|
| What the product asks of the model | How much behavior the founder controls | Where the limits sit | The brief's own analysis |
| Managing the risk as a process | Who is accountable and how risk is reviewed | Which customers want evidence | NIST framework pages |
| How a model application is attacked | Which attacks the design assumes | Which entries of the list apply | OWASP list and prompt injection entry |
| How much the model may do | The authority boundary | What each action needs to be checked | OWASP excessive agency entry |
| Knowing whether it works | What success means and how it is measured | Which grader suits which criterion | Vendor documentation |
| The law that may reach the product | Whether a regulated category is likely | Dates, annexes, other jurisdictions | European Commission page |

Read down the second column and a pattern appears. Analysis: most of these decisions are about limits and records, not about the model. The model is the part a founder can change in an afternoon, and the limits and records are the part that makes the product something a customer can rely on.

## Questions to ask before building

These questions test a design against the product in hand. They do not produce an answer.

**What is the worst thing the model could do if it were fully steered by someone hostile?** List the actions it can cause. If the answer is sending a message, spending money or changing a record, ask what stops each one that is not the model's own judgment.

**Where does text come from that the user did not write?** Documents, web pages, email and tool results are all input that a third party may have shaped. Mark each one in the design.

**Who is accountable for the system's behavior?** One named person is better than a shared duty. The risk framework's first function asks the question and the rest of the work depends on the answer.

**How would you know it got worse?** If the model, the prompt or the vendor changed tomorrow, what would tell you the product had changed for the worse? An evaluation set is one answer. If you have none, the product's quality is a belief.

**Which customers or markets might the law reach?** Ask a lawyer before the product ships, not after the first customer in a regulated market asks for documents.

**Who will read the design with the founders?** A security reviewer, a lawyer and a customer will each ask a different question of the same design, and it is cheaper to meet them in the design than in the contract.

## What this brief cannot tell you

This brief cannot tell you which model, vendor or architecture to use. That depends on facts about your product, your data and your customers that no general document can know.

It cannot tell you that any of these practices works. The sources describe recommended practice, and the evidence set contains no study of whether following it reduces failures. The OWASP page itself says that no mitigation is known to prevent prompt injection completely.

It cannot tell you the current state of the rules. The risk framework is being revised, the AI Act's schedule is described as subject to amendment and the vendors change their documentation. The evidence for this brief was read on a single day, so check the source before relying on a date or a version.

It cannot tell you how a rule applies to your product. The European Commission page is a description of a law for a general audience, and applying the law to a particular product is a lawyer's work.

It cannot tell you about the topics it does not cover. Data protection, intellectual property in training data and model outputs, contracts with model vendors, insurance and the rules of other jurisdictions are all outside this brief, and a company building on a model will meet most of them.

It cannot tell you how often any failure occurs. The evidence set contains no outcome data, and this brief offers none.

Finally, it is analysis in places, and the analysis can be wrong. The sections above mark where a sentence is a judgment. A founder should treat those sentences as questions to test, not as findings.

## Sources

- National Institute of Standards and Technology, "AI Risk Management Framework," https://www.nist.gov/itl/ai-risk-management-framework
- National Institute of Standards and Technology, AI Resource Center, "AI RMF Core," https://airc.nist.gov/airmf-resources/airmf/5-sec-core/
- National Institute of Standards and Technology, "Artificial Intelligence Risk Management Framework: Generative Artificial Intelligence Profile," https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence
- OWASP GenAI Security Project, "OWASP Top 10 for LLM Applications," https://genai.owasp.org/llm-top-10/
- OWASP GenAI Security Project, "LLM01:2025 Prompt Injection," https://genai.owasp.org/llmrisk/llm01-prompt-injection/
- OWASP GenAI Security Project, "LLM06:2025 Excessive Agency," https://genai.owasp.org/llmrisk/llm062025-excessive-agency/
- European Commission, "AI Act," https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai
- Anthropic, "Define success criteria and build evaluations," https://platform.claude.com/docs/en/test-and-evaluate/develop-tests
- OpenAI, "Evaluation best practices," https://developers.openai.com/api/docs/guides/evaluation-best-practices
