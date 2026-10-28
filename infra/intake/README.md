# World Enterprise intake service

An Azure Function (Node 24, Flex Consumption, TypeScript) that takes the six site forms, writes each submission to Dataverse, and emails gated briefs. It is a separate deployable from the static site. It ships inert: nothing here creates an Azure or Dataverse object until the operator provides the inputs in `docs/intake-runbook.md` and runs the manual `intake:*` jobs.

- Contract: `docs/forms-contract.md` (v2) and its machine-readable form `docs/forms-contract.schema.json`. The service loads the schema, so the browser and the Function cannot drift.
- What the service does with the data, in words the privacy notice copies: `docs/forms-privacy-facts.md`.
- Operating it, and what the operator must supply: `docs/intake-runbook.md`.

## Routes

| Route | Methods | Purpose |
|---|---|---|
| `/api/intake` | `POST`, `OPTIONS` | All six forms, discriminated by `form` |
| `/api/newsletter` | `POST`, `OPTIONS` | Alias of the newsletter form |
| `/api/unsubscribe` | `GET`, `POST` | `GET` shows a confirmation page and changes nothing; only `POST` unsubscribes (so mail scanners cannot) |
| `/api/health` | `GET` | Configuration only: 200 with `configured: true`, or 503 |

Timers: a retry sweep every five minutes (failed sends), and a nurture sweep daily that is a no-op unless `NURTURE_ENABLED` is `true`.

A request is handled in this order: Origin check and single-origin CORS, body cap, honeypot (`website` non-empty returns 200 and stores nothing), validation against the schema (field errors as `{ ok: false, errors: { field: message } }` with 400 or 422, and a wrong `audience` for the form is a 422 on `audience`), rate limit (5 per hour per client address and per email, per form, 429 with `Retry-After`), idempotency on `requestId` (a repeat returns the original outcome and sends no second email), a durable Dataverse write, then 202. If the write fails the answer is 503 and nothing is kept. A failed email never fails the request: the row is marked `delivery-failed`, an alert fires, and the timer retries. A form-encoded post answers 303 to the form's thanks page; a `redirect` that is not on the allowlist is ignored. No cookies are set, no body is logged, no personal data goes in a URL, and every response carries the security headers.

## Layout

| Path | Contents |
|---|---|
| `src/logic/**` | Pure logic with `node:` built-ins only: contract, validation, mapping, rate limits, crypto, mail rendering, scheduling, the allowlist logger. The root `npm run test:unit` runs its tests (`tests/unit/wp-61/`). |
| `src/service/**` | The request flow, ports for every external dependency, the unsubscribe flow and the sweeps. No Azure SDK imports. |
| `src/azure/**` | Adapters: Dataverse Web API, blob state, ACS email, user-delegation SAS links, the HTTP bridge, wiring. |
| `src/functions.ts`, `src/host.json` | Function registration, and the host file that is packaged to the zip root. |
| `dataverse/` | `definition.json` (the Dataverse schema as code), `metadata.ts` (request bodies), `apply.ts` (idempotent applier, never deletes). |
| `render/` | `render.mjs` renders `briefs/<id>.md` to self-contained HTML and a PDF; `publish.mjs` uploads `briefs/<id>/v<version>/` and the `briefs.json` registry to the private container. Plain `.mjs` so the Playwright image needs no toolchain. |
| `iac/` | `main.bicep` (subscription scope), `intake.bicep`, `keyvault-access.bicep`, `whatif-gate.mjs` (refuses a deleting plan), `verify.mjs` (origin 403, public health), `package-function.ts` (the zip). |
| `tests/` | Fake-based tests: in-memory ports, a Dataverse fake, a blob fake. No network. |
| `ci.yml` | The pipeline jobs, included from `.gitlab-ci.yml`. |
| `briefs/` | Brief sources (`<id>.md`), written by WP-63. |

## Tests

The tests run in CI (`intake:test`) and need no Azure or network access. To run them on a machine with Node 24:

```bash
cd infra/intake
npm ci
npm run typecheck
npm test
```

They cover the contract matrix against the committed schema, the honeypot, idempotency, both rate limits, Origin and body-cap refusal, form-encoded redirects, a failing mailer (202, `delivery-failed`) and a failing Dataverse write (503, nothing kept), the unsubscribe flow and suppression, `NURTURE_ENABLED=false`, a capture of every log line asserting no body, email, token or SAS appears, the Bicep compile (the pinned `bicep` binary; `REQUIRE_BICEP=1` makes a missing binary an error), the what-if gate on a deleting fixture, and a scan that finds no secret value in the repository. The tests read the committed `docs/forms-contract.schema.json`, the same file the Function packages, so a change the server cannot read fails them.

`npm run build` compiles and packages `dist/function.zip`. CI does it; do not run it on a workstation.

## Settings

All are set by Bicep. Secret values come from Key Vault references, never from this repository.

| Setting | Source |
|---|---|
| `DATAVERSE_URL`, `ACS_ENDPOINT`, `ACS_SENDER_ADDRESS`, `STORAGE_ACCOUNT`, `STATE_CONTAINER`, `BRIEFS_CONTAINER` | Bicep outputs of the resources it creates, and the operator's inputs |
| `ALLOWED_ORIGINS`, `SITE_ORIGIN`, `API_ORIGIN`, `MAIL_FOOTER_ADDRESS` | Bicep parameters |
| `NURTURE_ENABLED` | Bicep parameter, default `false` |
| `UNSUBSCRIBE_KEY` | Key Vault secret `worldenterprise-intake-unsubscribe-key` |
| `NOTIFY_LOGICAPP_URL` | Bicep output of the notification Logic App trigger, without its signature. The Function calls it with a managed-identity token |
| `AZURE_CLIENT_ID` | The user-assigned managed identity. There are no client secrets, connection strings or storage keys. |
