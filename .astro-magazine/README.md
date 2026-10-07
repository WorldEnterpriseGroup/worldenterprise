# Astro Magazine studio state

This directory is the durable operating record for a publication commission. Keep it in the site repository unless the project has an approved equivalent.

- `commission.json`: scope, targets, creative direction, owners, and authority.
- `scope.json`: explicit included/excluded work, protected paths, constraints, and exceptions.
- `authority-policy.md`: source, rights, privacy, and external-action boundaries.
- `ownership.json`: exclusive write sets, leases, handoffs, and conflicts.
- `checkpoint.json`: current phase, event offset/hash, artifact counts/hashes, verified state, blockers, and exact next action.
- `schemas/`: versioned JSON Schema contracts for the commission, article records, and brief storyboards.
- `templates/`: starter route, content, brief, source, claim, media, interaction, and conversion records.
- `content-records/`: one JSON record per article or other substantive route.
- `briefs/`: one JSON storyboard per long-form brief.
- `claims/`: claim-to-source verification records.
- `sources/`: source and dataset records, including retrieval and transformation notes.
- `media/`: media manifests, contact-sheet indexes, rights, crops, and provenance.
- `interactions/`: component registry and route motion contracts.
- `links/`: topic/entity graph, internal-link graph, redirects, and orphan checks.
- `conversions/`: CTA-to-delivery paths, privacy, canary, and owner evidence.
- `reviews/`: editorial, visual, accessibility, SEO, security, PDF, and release evidence.
- `events.ndjson`: append-only material run events.
- `checkpoints/`: immutable gate snapshots; `checkpoint.json` is only the current pointer/summary.
- `locks/`: short-lived coordination records, never production truth.
- `decisions.md`: consequential editorial and engineering decisions.
- `adoption/`: immutable existing-site inventories, preservation baselines, route baselines, and the current adoption pointer.
- `priorities/`: RICE backlogs and decision records; mandatory release gates are never deprioritized by scores.

Use the baseline/build-evidence and visual-evidence templates for retained proof. A command listed without its exit status, build identity, timestamp, and report path is not verification.

Use the route-lifecycle template to compare the pre-upgrade and candidate route universes. Preserve public authority with explicit `preserve`, `redirect`, or authorized `retire` decisions; then verify the deployed HTTP behavior separately.

Do not store credentials or submitted personal data here. Use stable IDs so claims, sources, media, routes, and brief pages can reference one another.
