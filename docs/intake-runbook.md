# Intake service runbook

Status: authored by WP-61. Audience: the operator who provisions and runs the World Enterprise intake service.

The intake service is an Azure Function (`infra/intake`) that takes the six site forms, writes each submission to Dataverse, and emails gated briefs. It ships inert. Nothing in this repository creates Azure or Dataverse objects until the operator supplies the inputs below and runs the manual pipeline jobs. Until then the site's forms stay `disabled`, and `verify:release` fails closed on a release tag because `PUBLIC_WE_INTAKE_API_URL` is unset. That is intended.

Rules that hold throughout:

- Nothing is created by hand. Azure is created by `intake:deploy` (Bicep), Dataverse by `intake:dataverse` (`infra/intake/dataverse/definition.json`), the Front Door route by a merge request to `FocusApiary/infrastructure`. No portal clicks, no `az ... create`, no imperative Dataverse calls.
- Secret values are never written to Git, the pipeline log or this file. This document records secret names only.
- Both jobs run from `demo` only, are manual, and exist only when the variables below are set.

## Inputs the operator provides

| Id | What is needed | Who provides it | Without it |
|---|---|---|---|
| OP-AZURE | An Azure subscription, and an Entra application with a federated credential for this GitLab project that can deploy to it (details below) | Azure subscription owner | No `intake:deploy` job exists; the Function does not exist |
| OP-FD | The Front Door merge request merged and applied, the DNS records for `intake.worldenterprise.org`, and the profile's Front Door id | Owner of FocusApiary/infrastructure and of the worldenterprise.org DNS zone | The endpoint is unreachable from a browser; forms stay disabled |
| OP-DV | A Dataverse environment URL, and the deploying application registered in it as an application user with the System Administrator role | Power Platform environment admin | `intake:dataverse` cannot run; submissions cannot be stored, so the service answers 503 |
| OP-MAIL | The sender decision and, if wanted, the mailing address for the email footer | WE owner | The Azure-managed sender domain is used; no footer address is printed |
| OP-RETAIN | How long engagement rows, suppression records and brief links are kept, and the wording for the privacy notice | WE owner with counsel | The notice states no period; `NURTURE_ENABLED` stays `false` |
| OP-COUNSEL | Counsel review of the privacy notice, the unsubscribe flow and the nurture sequence | WE owner's counsel | Nothing that sends marketing email is switched on |
| OP-FLAGS | Turning on `flags.briefUpdates` and `NURTURE_ENABLED`, and setting the site's `PUBLIC_WE_INTAKE_API_URL` and `PUBLIC_WE_NEWSLETTER_API_URL` | WE owner, by change request, after the items above | Forms stay disabled or marketing email stays off |

## OP-AZURE

1. Create or choose an Entra application registration for the pipeline. Add a federated credential with issuer the internal GitLab instance URL, audience `api://AzureADTokenExchange` and subject `project_path:WorldEnterpriseGroup/worldenterprise:ref_type:branch:ref:demo`. There is no client secret.
2. Grant it, at the subscription, the roles Bicep needs to create a resource group and assign roles: Contributor, plus either User Access Administrator or Role Based Access Control Administrator. The role-assignment right is needed because the `keyvault-access.bicep` module, which runs in the vault's resource group `Om-Labs`, assigns Key Vault Secrets User on `omlab-secrets` to the Function's identity, and the main template assigns the storage and Communication Services roles.
3. Create the two Key Vault secrets in `omlab-secrets`. The operator runs these once, with a value that is never printed:

   ```bash
   az keyvault secret set --vault-name omlab-secrets --name worldenterprise-intake-unsubscribe-key --value "$(openssl rand -base64 48)" --output none
   az keyvault secret set --vault-name omlab-secrets --name worldenterprise-intake-hmac-secret --value "$(openssl rand -base64 48)" --output none
   ```

   `worldenterprise-intake-unsubscribe-key` encrypts the stored unsubscribe tokens and is required. `worldenterprise-intake-hmac-secret` signs the optional webhook and is used only when `INTAKE_WEBHOOK_URL` is set. The third name in the contract, `worldenterprise-intake-acs-endpoint`, is not needed: Bicep injects the Azure Communication Services endpoint.
4. Set these protected, masked-where-secret GitLab CI/CD variables on the project (they are identifiers, not secrets, but protect them anyway so only `demo` sees them):

   | Variable | Value |
   |---|---|
   | `INTAKE_AZURE_CLIENT_ID` | The application's client id |
   | `INTAKE_AZURE_TENANT_ID` | The Entra tenant id |
   | `INTAKE_AZURE_SUBSCRIPTION_ID` | The subscription id |
   | `INTAKE_FRONT_DOOR_ID` | The shared profile's Front Door id, from the `frontdoor_fdid` Terraform output (OP-FD) |
   | `INTAKE_DATAVERSE_URL` | `https://<org>.crm.dynamics.com` (OP-DV) |

   Optional: `INTAKE_LOCATION` (default `eastus`), `INTAKE_SENDER_ADDRESS`, `INTAKE_MAIL_FOOTER_ADDRESS`, `INTAKE_WEBHOOK_URL`, `INTAKE_ALERT_EMAIL`, `INTAKE_DEPLOY_PRINCIPAL_ID` (the application's object id, so it can upload rendered briefs), `INTAKE_NURTURE_ENABLED` (leave unset), `INTAKE_API_HOST` (default `intake.worldenterprise.org`).

With the five required variables set, the `intake:deploy`, `intake:dataverse` and `intake:verify` jobs appear on the next `demo` pipeline, all manual.

## OP-FD

The merge request is `FocusApiary/infrastructure` (draft, created by WP-61; see the WP-61 handoff for its number). It adds, on the shared `taodoor-standard` profile: the custom domain `intake.worldenterprise.org`, a rate-limit rule scoped to that host and the three form paths, and an origin group, origin, route and domain association for the four API paths (`/api/intake`, `/api/unsubscribe`, `/api/health`, `/api/newsletter`) with no caching.

1. Merge and apply it. The origin, route and association are created only when `worldenterprise_intake_origin_host` is set, so the first apply creates the domain and the WAF rule and nothing routes yet.
2. Read the `custom_domain_validation_tokens` output for `intake-worldenterprise-org`. In the DNS zone for worldenterprise.org (not managed in that repository) add the `_dnsauth.intake` TXT record with that token, and a CNAME from `intake` to the `frontdoor_endpoint_hostname` output. Front Door issues the managed certificate once the validation record is seen.
3. Read the `frontdoor_fdid` output and set it as `INTAKE_FRONT_DOOR_ID` (OP-AZURE step 4).
4. After `intake:deploy` succeeds, set `worldenterprise_intake_origin_host` in that repository's `terraform.tfvars` to the deployment's `functionOriginHost` output (printed by the job and stored in its `intake.env` artifact) and apply again. The route now carries traffic.

The Function accepts traffic only from this profile (Front Door service tag plus the `x-azure-fdid` header) and answers 403 to anything else, including a request straight to its `azurewebsites.net` host. The Front Door WAF blocks the default curl user agent, so use a browser-style user agent when testing by hand.

## OP-DV

1. In the Power Platform admin center, choose or create the Dataverse environment. Its URL is `INTAKE_DATAVERSE_URL`.
2. Register the pipeline's Entra application (`sp-worldenterprise-intake-deploy`) in that environment, once. This is code too: an operator who already administers the environment runs the bootstrap, which creates the World Enterprise business unit and the application user for `INTAKE_AZURE_CLIENT_ID`, holding the System Administrator role of that unit, and stops:

   ```bash
   DATAVERSE_URL="$INTAKE_DATAVERSE_URL" DATAVERSE_TOKEN="$(az account get-access-token --resource "$INTAKE_DATAVERSE_URL" --query accessToken --output tsv)" INTAKE_AZURE_CLIENT_ID=<client id> node infra/intake/dataverse/apply.ts --bootstrap
   ```

   The pipeline keeps that role so `intake:dataverse` can apply later changes to the definition (new tables, new role privileges). Narrow or remove it only if the definition is frozen.
3. Run `intake:dataverse` (manual, demo). It applies `infra/intake/dataverse/definition.json` and nothing else:
   - the publisher `worldenterprise` and the solution `worldenterprise_intake`,
   - the business unit "World Enterprise", an owner team, and the security role "World Enterprise Intake Service" (create, read, write, append and append-to on `we_engagement` and Contact; create, read, write and append-to on Account; Local depth, so it reaches only rows in the World Enterprise business unit),
   - the table `we_engagement` with its columns, the lookups to Contact and Account, and the alternate keys `we_engagement_requestid` and `we_engagement_tokenhash`,
   - the `we_accountkey` column and key on Account,
   - the Function's managed identity as an application user holding only that role.
   - when `INTAKE_E2E_CLIENT_ID` is set: the role "World Enterprise Intake E2E Reader" (Read and Delete on Lead, Contact and `we_engagement`, Local depth, nothing else; the definition refuses any other action) and `sp-worldenterprise-intake-e2e` as an application user holding only that role.
4. The job is idempotent. It looks first, creates only what is missing, never deletes, and never changes an existing object. A rerun after a partial failure is safe. Alternate keys activate asynchronously; the job waits.
5. Staff access. A team owns the rows, but the staff security role and its membership are left to the operator: decide who at WE reads `we_engagement` and add them to the team with a role that grants read.

The job needs `INTAKE_IDENTITY_CLIENT_ID`. Run it in the same pipeline as `intake:deploy` (it inherits the value), or set the variable to the Bicep `identityClientId` output.

## OP-MAIL

The service sends through Azure Communication Services Email. Bicep creates the Communication Service and an Azure-managed sender domain with a `DoNotReply` sender, with open and click tracking off, and points the Function at it. That works with no operator action.

- The sender address printed on mail is `DoNotReply@<managed domain>`. A reply goes nowhere. If WE wants a branded sender, that is a Bicep change (a customer-managed domain with SPF, DKIM and DKIM2 DNS records, linked to the Communication Service) and then `INTAKE_SENDER_ADDRESS` is set to the new address. Setting the variable without the linked domain makes every send fail, and the rows are marked `delivery-failed`. This change does not add a custom domain.
- `INTAKE_MAIL_FOOTER_ADDRESS` is the postal address printed in the footer. Unset means the line is omitted. Bulk marketing mail in some places requires one; counsel decides (OP-COUNSEL).
- A failed send leaves the row `delivery-failed`, an alert fires if `INTAKE_ALERT_EMAIL` is set, and the retry timer tries again.

## OP-RETAIN, OP-COUNSEL and OP-FLAGS

- Decide how long engagement rows, suppression records and brief links are kept. Send the wording. Updating `src/content/pages/legal/privacy.md` then also means changing the wp-10 pin that forbids a stated period, in the same merge request.
- `NURTURE_ENABLED` (Function setting, Bicep parameter `nurtureEnabled`) stays `false` until the notice states the retention period and counsel has reviewed the day 3, 10 and 21 emails. While it is `false` the nurture timer runs and sends nothing.
- `flags.briefUpdates` (site flag, default off) shows the second consent box on the brief form. It stays off until the same two items are closed.
- To connect the site: set `PUBLIC_WE_INTAKE_API_URL` to `https://intake.worldenterprise.org/api/intake` and `PUBLIC_WE_NEWSLETTER_API_URL` to `https://intake.worldenterprise.org/api/newsletter` in the site build's variables. A release build then passes `verify:release`.

## Running it

Order for the first provisioning:

1. OP-AZURE steps 1 to 4 (the Front Door id needs OP-FD step 3).
2. Merge the Front Door merge request and complete OP-FD steps 1 to 3.
3. Run `intake:deploy`. It runs the what-if first and refuses any plan that deletes or empties a resource, then deploys, ships `dist/function.zip`, and publishes rendered briefs to the private `briefs` container if `intake:render` produced any.
4. Run `intake:dataverse` (OP-DV).
5. Finish OP-FD step 4, then run `intake:verify`. It asserts that the direct Function host answers 403, and that `https://intake.worldenterprise.org/api/health` answers 200 with `configured: true` and the security headers (CSP, nosniff, referrer policy, no-store) and no cookie.

### Health

`GET https://intake.worldenterprise.org/api/health` reports configuration only: whether every required setting is present, the contract version in use and whether nurture is on. It never reports a secret or a connection result, and it sets no cookie. It answers 200 with `configured: true`, or 503 with `configured: false` when a setting is missing; then check the app settings and the Key Vault references. The Front Door probe uses the same path, so an unconfigured Function is taken out of rotation.

### Alerts and logs

Log lines hold an event name, request id, form, status and a hashed client address, never a body, email, token or link. Application Insights holds them. A scheduled query alert fires on `delivery_exhausted`, `delivery_failed` and `dataverse_write_failed`.

- `dataverse_write_failed`: the service answered 503 and kept nothing; the visitor sees a generic failure and can retry. Check the managed identity's Dataverse application user and role, and the Dataverse environment's status.
- `delivery_failed` or `delivery_exhausted`: the row is stored and `delivery-failed`. Check the Communication Service and the sender. The timer retries; a row that exhausts its attempts needs a person.

### Rollback

- Function code: run the previous pipeline's `intake:deploy` (it ships that commit's `dist/function.zip`), or revert the merge on `demo` and run it again.
- Infrastructure: a Bicep change reverts the same way. The what-if gate blocks a deleting plan, so a revert that would remove a resource is refused rather than applied; that needs a deliberate manual decision.
- Dataverse: changes are additive and idempotent; there is no rollback job and none is needed. Do not delete the table by hand: it holds submissions.
- To stop the service from taking submissions without deleting anything, unset `PUBLIC_WE_INTAKE_API_URL` in the site build; the forms return to `disabled`. To stop mail, `NURTURE_ENABLED` is already `false`, and a requested brief is transactional.

### Secrets

Names only: `worldenterprise-intake-unsubscribe-key`, `worldenterprise-intake-hmac-secret`. Both live in Key Vault `omlab-secrets`. The Function reads them through Key Vault references with its managed identity. There are no client secrets, no connection strings and no storage account keys anywhere; storage is reached through the managed identity only. A repository test scans `infra/intake` and the docs for any secret-shaped value.
